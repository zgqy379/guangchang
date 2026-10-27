// 环境主题系统（v4 玻璃数字孪生 · 2026-10-26）
//
// 职责：把「系统时钟」映射为「环境主题（light / dark）」，并驱动：
//   ① 天幕与太阳/月亮位置
//   ② 场景材质（玻璃体透明度、自发光强度、行业色）
//   ③ UI 玻璃反相（data-theme 属性）
//
// 关键语义分离（见 docs/design/twin-style-spec-v4.md §2 矛盾 B）：
//   - 环境时间 = 系统时钟 → 决定天色（"现在几点"）
//   - 参数时间 = 公司 offworkTime → 决定该公司门前的下班光效（"这家几点下班"）
//   两者互不干扰：拖动下班时间滑杆不会改变天色。

export type ThemeName = 'light' | 'dark'
/** 主题锁定模式：auto 跟随系统时间 / light 强制白天 / dark 强制夜间 */
export type LockMode = 'auto' | 'light' | 'dark'

export interface EnvTheme {
  /** 当前主题 */
  name: ThemeName
  /** 系统时间（小时，可含小数，0-24） */
  envHour: number
  /** 是否为夜间（决定星空/月亮/路灯） */
  night: boolean
  /** 是否处于黄昏过渡段（17:30-19:00，天色偏暖但 UI 主题仍为 light） */
  dusk: boolean
  /** 主题锁定（用户手动切换后为 true，不再跟随系统时间） */
  locked: boolean
  /** 用户锁定时选定的模式：'auto' | 'light' | 'dark' */
  lockMode: LockMode
}

// —— 时间分段阈值（对应 spec §4 判定表） ——
// 阈值以词典（dictionary/hr-dictionary.json）为唯一事实源：此处仅服务于
// 「环境时间→UI 主题」的判定（systemHour/themeForHour/isDusk），
// 与「参数时间→下班光效」的词典映射互不干扰，勿在此另立一套分叉阈值。
const DAWN_START = 6.0
const DUSK_START = 17.5
const DUSK_END = 19.0

/** 取当前系统时间的小时数（0-24，含小数） */
export function systemHour(now: Date = new Date()): number {
  return now.getHours() + now.getMinutes() / 60
}

/** 按系统小时判定主题（不考虑锁定） */
export function themeForHour(h: number): ThemeName {
  if (h >= DUSK_END || h < DAWN_START) return 'dark'
  return 'light'
}

/** 是否黄昏段（天色偏暖，UI 主题不变） */
export function isDusk(h: number): boolean {
  return h >= DUSK_START && h < DUSK_END
}

/**
 * 计算最终生效的主题：锁定优先，否则跟随系统时间。
 * lockMode: 'auto' 跟随系统 / 'light' 强制白天 / 'dark' 强制夜间
 */
export function resolveTheme(
  h: number,
  lockMode: LockMode = 'auto'
): ThemeName {
  if (lockMode === 'light') return 'light'
  if (lockMode === 'dark') return 'dark'
  return themeForHour(h)
}

