#!/usr/bin/env node
// UI 对比度自检（v4 玻璃数字孪生 · 2026-10-26）
//
// 为什么需要这个脚本：
//   UI 玻璃是**半透明**的，会透出 3D 场景。按"纯白底 / 纯黑底"算对比度会失真——
//   真实底色是玻璃色与场景色的合成结果。夜间亮玻璃叠深色场景合成后 ≈ rgb(188,189,192)，
//   白天深玻璃叠浅色场景 ≈ rgb(63,67,79)。文字色阶必须远离这个合成底色。
//
// 用法：node tools/check-contrast.mjs
// 退出码非 0 表示有不达标项（可直接接入 CI / prebuild）

function lum(r, g, b) {
  const f = (c) => {
    c /= 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

function ratio(a, b) {
  const l1 = lum(...a)
  const l2 = lum(...b)
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}

/** 半透明前景色 over 背景色（alpha 0-1） */
function blend(fg, alpha, bg) {
  return fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)))
}

const grade = (r) => (r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : '✗ 不达标')

// —— 玻璃合成底色（关键：不能用纯白/纯黑） ——
const NIGHT_SCENE = [15, 20, 30] // 夜间场景典型底（深靛）
const DAY_SCENE = [195, 205, 215] // 白天场景典型底（冷白玻璃/浅地面）
const nightGlass = blend([255, 255, 255], 0.72, NIGHT_SCENE)
const lightGlass = blend([11, 14, 26], 0.72, DAY_SCENE)

const THEMES = {
  '夜间主题（亮玻璃 + 深墨字）': {
    base: nightGlass,
    ink: {
      primary: [11, 14, 26], // #0b0e1a
      secondary: [57, 65, 77], // #39414d
      muted: [69, 76, 89], // #454c59
    },
  },
  '白天主题（深玻璃 + 浅色字）': {
    base: lightGlass,
    ink: {
      primary: [230, 237, 243], // #e6edf3
      secondary: [183, 194, 204], // #b7c2cc
      muted: [176, 188, 200], // #b0bcc8
    },
  },
}

let failed = 0

console.log('UI 对比度自检（玻璃底色按半透明合成计算）\n')
for (const [name, t] of Object.entries(THEMES)) {
  console.log(`=== ${name} ===`)
  console.log(`  合成底色 rgb(${t.base.join(',')})`)
  for (const [k, c] of Object.entries(t.ink)) {
    const r = ratio(c, t.base)
    const ok = r >= 4.5
    if (!ok) failed++
    console.log(
      `  ${k.padEnd(10)} rgb(${c.join(',')})`.padEnd(40) +
        `${r.toFixed(2)}:1  ${grade(r)}`
    )
  }
  console.log('')
}

console.log('=== 品牌色使用约束 ===')
const brandRed = ratio([194, 58, 43], [255, 255, 255])
const brandRedBright = ratio([255, 90, 60], [255, 255, 255])
console.log(`  实心按钮底 #c23a2b + 白字     ${brandRed.toFixed(2)}:1  ${grade(brandRed)}`)
console.log(`  亮红 #ff5a3c + 白字（仅装饰）  ${brandRedBright.toFixed(2)}:1  ${grade(brandRedBright)}  ← 禁止作按钮底`)
if (brandRed < 4.5) failed++
if (brandRedBright >= 4.5) {
  console.log('  注意：亮红已达标，但规范仍要求实心按钮用深红（品牌一致性）')
}

console.log('')
if (failed) {
  console.error(`✗ 对比度自检失败：${failed} 项不达标`)
  process.exit(1)
}
console.log('✓ 对比度自检通过：全部文字组合 ≥ AA (4.5:1)')
