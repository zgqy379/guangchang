// 工时天空系统：下班时间滑杆 → 夕阳/月亮实时切换（project.md 5.1 offwork_time）
// 17:00 午后 → 18:00 夕阳 → 19:30 暮色 → 20:00 后月亮升起，越晚月亮越高越冷

export interface SkyState {
  bg: string
  fog: string
  sunPos: [number, number, number]
  sunColor: string
  sunIntensity: number
  ambient: number
  night: boolean
  moonPos: [number, number, number]
  label: string
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const lerpColor = (c1: number[], c2: number[], t: number) =>
  '#' +
  c1
    .map((c, i) => Math.round(lerp(c, c2[i], t)).toString(16).padStart(2, '0'))
    .join('')

export function skyFromOffworkHour(h: number): SkyState {
  const dusk = Math.min(1, Math.max(0, (h - 17) / 3)) // 17→20 天色变暗
  const night = h >= 20

  const day = [0x87, 0xce, 0xeb]
  // 审美修订：夕阳→暮色压暗一档，拉开钞票山（暗红发光）与背景的明暗对比，主体才跳得出来
  const sunset = [0xd9, 0x6e, 0x3f]
  const nightC = [0x0b, 0x10, 0x2a]
  const bg =
    dusk < 0.5
      ? lerpColor(day, sunset, dusk * 2)
      : lerpColor(sunset, nightC, (dusk - 0.5) * 2)

  // 太阳：17:00 高挂 → 19:30 落到地平线以下
  const sunAngle = lerp(1.15, -0.25, Math.min(1, (h - 17) / 2.5))
  const sunPos: [number, number, number] = [
    Math.cos(sunAngle) * 40,
    Math.sin(sunAngle) * 30,
    -30,
  ]

  // 月亮：20:00 后升起，越晚越高；凌晨 2 点挂在头顶
  const moonT = night ? Math.min(1, (h - 20) / 6) : 0
  const moonAngle = lerp(0.1, 1.35, moonT)
  const moonPos: [number, number, number] = [
    -Math.cos(moonAngle) * 35,
    Math.sin(moonAngle) * 26,
    -28,
  ]

  return {
    bg,
    fog: bg,
    sunPos,
    sunColor: dusk < 0.6 ? lerpColor([0xff, 0xff, 0xe0], [0xff, 0x7f, 0x50], dusk) : '#6b7fad',
    sunIntensity: lerp(1.6, 0.25, dusk),
    ambient: lerp(0.7, 0.22, dusk),
    night,
    moonPos,
    label: h <= 18.5 ? '夕阳 · 准点走的温度' : h <= 20 ? '暮色 · 天快黑了' : `月亮 · ${labelForNight(h)}`,
  }
}

function labelForNight(h: number): string {
  if (h <= 21) return '晚上九点前'
  if (h <= 23) return '深夜强度陈述'
  return '永远挂在凌晨的月亮'
}
