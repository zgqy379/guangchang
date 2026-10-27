// 进度持久化统一层
//
// 为什么需要（docs/design/role-flow-master-v1.md §6.1 M3）：
//   现状 localStorage 只有 1 个 key（'gc-street-progress-v1'），且读写散落在
//   StreetScene.tsx 三处。后果：
//   · 对比篮（App.tsx 的 basket 局部 state）刷新即丢，违反 ui-system-v3 §13.1 验收项
//   · 角色 / 档案 / 建厂进度无处安放
//   · 每个新场景各写各的 key，迟早键名漂移
//
// 设计原则：
//   ① 每个 key 显式声明类型与损坏行为（隐私模式 / 手工改坏 / 版本升级）
//   ② 读写全部经过本模块，业务代码不再直接碰 localStorage
//   ③ 隐私模式下 localStorage 不可用 → 静默降级为内存态，绝不抛错
//     （沿用 StreetScene.tsx 既有 loadProgress 的 try/catch 兜底模式）

const NS = 'gc'
const VERSION = 'v1'

/** 键名清单：新增场景时在此登记，避免键名散落 */
export const ProgressKeys = {
  /** 街区进度：已投递 / 已参观的摊位 id */
  streetProgress: `${NS}-street-progress-${VERSION}`,
  /** 对比篮：最多 2 个摊位 id（容量 2，满了要提示替换） */
  basket: `${NS}-basket-${VERSION}`,
  /** 用户选择的角色：'candidate' | 'hr' */
  role: `${NS}-role-${VERSION}`,
  /** 首屏是否已完成新手引导 */
  onboarded: `${NS}-onboarded-${VERSION}`,
  /** 主题锁定：'auto' | 'light' | 'dark' */
  themeLock: `${NS}-theme-lock-${VERSION}`,
  /** 求职者档案：已装配的形象参数 */
  avatarProfile: `${NS}-avatar-profile-${VERSION}`,
  /** 求职者作品集条目（含隐私分级） */
  portfolio: `${NS}-portfolio-${VERSION}`,
  /** HR 建厂草稿 */
  factoryDraft: `${NS}-factory-draft-${VERSION}`,
  /** HR 已发布的摊位数据 */
  factoryPublished: `${NS}-factory-published-${VERSION}`,
  /** 投递回执列表 */
  deliveryReceipts: `${NS}-delivery-receipts-${VERSION}`,
  /** 作品廊：已探访的求职者空间地址 */
  visitedSpaces: `${NS}-visited-spaces-${VERSION}`,
  /** 用户主动排除的公司 id（「不适合我」） */
  excludedLots: `${NS}-excluded-lots-${VERSION}`,
} as const

export type ProgressKey = (typeof ProgressKeys)[keyof typeof ProgressKeys]

/** localStorage 是否可用（隐私模式下访问会抛错） */
function storageAvailable(): boolean {
  try {
    const probe = `${NS}-probe`
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

const HAS_STORAGE = typeof window !== 'undefined' && storageAvailable()

/** 隐私模式下的内存兜底：刷新即丢，但不崩 */
const memory = new Map<string, string>()

function rawGet(key: string): string | null {
  if (!HAS_STORAGE) return memory.get(key) ?? null
  try {
    // getItem 返回 null 可能是「写失败已落 memory」的场景（rawSet 配额满/权限被拒时
    // 只写了 memory），此时必须回退 memory，否则内存兜底读穿失效。
    return window.localStorage.getItem(key) ?? memory.get(key) ?? null
  } catch {
    return memory.get(key) ?? null
  }
}

function rawSet(key: string, value: string): void {
  memory.set(key, value)
  if (!HAS_STORAGE) return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* 配额满 / 权限被拒 → 保留内存态，不抛错 */
  }
}

function rawRemove(key: string): void {
  memory.delete(key)
  if (!HAS_STORAGE) return
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* 忽略 */
  }
}

/**
 * 读取一个 JSON 进度值。
 * @param fallback 读取失败（内容损坏 / 类型不符 / 不存在）时的默认值
 */
export function readJson<T>(key: ProgressKey, fallback: T): T {
  const raw = rawGet(key)
  if (raw == null) return fallback
  try {
    const parsed = JSON.parse(raw) as T
    return parsed ?? fallback
  } catch {
    // 内容损坏 → 静默重置（ui-system-v3 §7.4：进度丢失静默重置，不报错弹窗）
    rawRemove(key)
    return fallback
  }
}

/** 写入一个 JSON 进度值 */
export function writeJson(key: ProgressKey, value: unknown): void {
  try {
    rawSet(key, JSON.stringify(value))
  } catch {
    /* 序列化失败（循环引用等）→ 忽略，不影响主流程 */
  }
}

/** 读取一个字符串进度值 */
export function readString(key: ProgressKey, fallback: string): string {
  const raw = rawGet(key)
  return raw ?? fallback
}

/** 写入一个字符串进度值 */
export function writeString(key: ProgressKey, value: string): void {
  rawSet(key, value)
}

/** 清除单个 key */
export function clearProgress(key: ProgressKey): void {
  rawRemove(key)
}

/** 清除本命名空间下的全部进度（「我的」页的一键删除走这里） */
export function clearAllProgress(): void {
  Object.values(ProgressKeys).forEach((k) => rawRemove(k))
  memory.clear()
}

// ── 业务级封装 ────────────────────────────────────────────────

export interface StreetProgress {
  delivered: string[]
  visited: string[]
}

/** 读街区进度（已投递 / 已参观） */
export function loadStreetProgress(): StreetProgress {
  const p = readJson<Partial<StreetProgress>>(ProgressKeys.streetProgress, {})
  return {
    delivered: Array.isArray(p.delivered) ? p.delivered.filter((x) => typeof x === 'string') : [],
    visited: Array.isArray(p.visited) ? p.visited.filter((x) => typeof x === 'string') : [],
  }
}

/** 写街区进度 */
export function saveStreetProgress(p: StreetProgress): void {
  writeJson(ProgressKeys.streetProgress, {
    delivered: [...new Set(p.delivered)],
    visited: [...new Set(p.visited)],
  })
}

/** 读对比篮（容量 2） */
export function loadBasket(): string[] {
  const b = readJson<unknown>(ProgressKeys.basket, [])
  return Array.isArray(b) ? b.filter((x) => typeof x === 'string').slice(0, 2) : []
}

/** 写对比篮（容量 2，超出截断） */
export function saveBasket(ids: string[]): void {
  writeJson(ProgressKeys.basket, [...new Set(ids)].slice(0, 2))
}

export type UserRole = 'candidate' | 'hr'

/** 读上次选择的角色 */
export function loadRole(): UserRole | null {
  const r = readString(ProgressKeys.role, '')
  return r === 'candidate' || r === 'hr' ? r : null
}

/** 写角色选择 */
export function saveRole(role: UserRole): void {
  writeString(ProgressKeys.role, role)
}
