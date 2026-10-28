// 确定性时间缝（截图/测试专用 · 2026-10-27）
//
// 为什么存在：截图管线（tools/shoot-ego-street.mjs）只锁主题不锁时间，
// envHour 与太阳/月亮位置取真实系统时钟 → 不同时刻拍的「昼间」截图天色完全不同
// （polish9 的昼间截图全部摄于 23:00 = 合成黄昏态，详见
// docs/design/decisions/2026-10-27-01-daylight.md 的根因记录）。
// 本模块提供 ?hour=10 的 URL 冻结参数：生产环境不带参数时行为与旧版完全一致。
//
// 诚实性边界：这是测试基建，不是面向用户的功能——不进 UI、不写文案；
// 它让截图可复现（评审与回归都对着同一个太阳），不改变任何产品语义。

const HOUR_RE = /^\d{1,2}(\.\d{1,2})?$/

function parseFrozenHour(): number | null {
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('hour')
  if (raw === null || !HOUR_RE.test(raw)) return null
  const h = Number(raw)
  if (!Number.isFinite(h) || h < 0 || h > 24) return null
  return h
}

/** ?hour= 冻结的小时数（0-24）；未传参数为 null（跟随真实时钟） */
export const FROZEN_HOUR: number | null = parseFrozenHour()

/** 冻结时刻对应的 Date（真实当天，仅时/分被固定）；未冻结为 null */
const FROZEN_DATE: Date | null = (() => {
  if (FROZEN_HOUR === null) return null
  const d = new Date()
  d.setHours(Math.floor(FROZEN_HOUR), Math.round((FROZEN_HOUR % 1) * 60), 0, 0)
  return d
})();

/**
 * 场景应使用的「现在」：?hour= 存在时返回冻结时刻（太阳/月亮位置确定），
 * 否则返回当前时刻。WorkdaySky / TwinEnvironment 的 now 默认值统一走这里。
 */
export function sceneNow(): Date {
  return FROZEN_DATE ?? new Date()
}

/**
 * 昼间「上午斜阳」默认日照（决策纸⑦ · 风格锦标赛 R13-R15 三池证据）：
 * 亮色主题的环境时刻钳到 15.6（暖金低阳）——正午顶光被三个独立评审池判为
 * 「无影灯/白模」最弱档。优先级：now 入参 > ?hour= 冻结 > 金光钳制 > 真实时钟。
 * 夜主题不钳（真实月位是夜景配方的一部分）。
 */
export function displayNow(theme: 'light' | 'dark', now?: Date): Date {
  if (now) return now
  if (FROZEN_DATE) return FROZEN_DATE
  if (theme === 'light') {
    const d = new Date()
    d.setHours(15, 36, 0, 0)
    return d
  }
  return new Date()
}

/** 与 displayNow 配套的环境小时（供 duskT/label 等分支使用） */
export function displayHour(theme: 'light' | 'dark', now?: Date): number {
  if (now) return now.getHours() + now.getMinutes() / 60
  if (FROZEN_HOUR !== null) return FROZEN_HOUR
  return theme === 'light' ? 15.6 : new Date().getHours() + new Date().getMinutes() / 60
}
