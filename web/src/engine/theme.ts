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
const DAWN_START = 6.0
const DAWN_END = 8.5
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

/**
 * 主题判定的时间边界常数（导出便于测试与文档同步）
 */
export const THEME_BOUNDS = {
  dawnStart: DAWN_START,
  dawnEnd: DAWN_END,
  duskStart: DUSK_START,
  duskEnd: DUSK_END,
} as const

/**
 * 主题描述文案（供 HUD/调试面板展示）
 */
export function themeLabel(name: ThemeName, dusk: boolean): string {
  if (name === 'dark') return '夜间 · 深色孪生'
  if (dusk) return '黄昏 · 暖金孪生'
  return '白天 · 浅色孪生'
}

/**
 * 公司的"下班光效"色相与强度（参数时间语义，与环境时间无关）
 *   ≤18:30 → 暖金日落辉光
 *   19–21  → 暮色橙紫
 *   ≥21    → 冷蓝月光
 * 返回 hex 颜色 + 发光强度倍率。
 */
export function offworkGlow(
  offworkTime: number
): { color: string; intensity: number; label: string } {
  if (offworkTime <= 18.5) {
    return { color: '#ffb066', intensity: 1.0, label: '夕阳 · 准点走的温度' }
  }
  if (offworkTime <= 21) {
    return { color: '#ff8a4c', intensity: 0.85, label: '暮色 · 天快黑了' }
  }
  return { color: '#7fa8ff', intensity: 0.7, label: '深夜强度陈述' }
}
