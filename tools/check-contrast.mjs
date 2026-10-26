#!/usr/bin/env node
// UI 对比度自检（v4 玻璃数字孪生 · 2026-10-26 起；2026-10-27 扩展为按场景色扫描）
//
// 为什么需要这个脚本：
//   UI 玻璃是**半透明**的，会透出 3D 场景。按"纯白底 / 纯黑底"算对比度会失真——
//   真实底色是玻璃色与**背后场景色**的合成结果。关键事实：**背景是变量，不是常量**。
//   同一个玻璃浮层，压在浅色天幕上 vs 压在深色地面上，合成底能差一倍以上。
//
// 2026-10-27 的扩展（主理人指出原来的缺陷）：
//   旧版只用两个"典型底"常量（夜间 rgb(15,20,30) / 白天 rgb(195,205,215)）——
//   正好漏掉了真实最坏情况：**浅色主题压 theme.light.skyHorizon #f4f8fb** 时，
//   深玻璃合成底掉到 #4C5059，次级文字 4.48:1 ❌、弱化文字 4.20:1 ❌。
//   新版**直接读 web/design/tokens.json 里的 theme.light.* / theme.dark.* 实际值**，
//   对每一个可能的场景底色逐一算合成底，取最坏值 —— 自动发现"压最亮天幕时不达标"。
//
// 用法：node tools/check-contrast.mjs
// 退出码非 0 表示有不达标项（可直接接入 CI / prebuild）

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TOKENS_PATH = path.resolve(__dirname, '../web/design/tokens.json')

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

/** #rrggbb → [r,g,b] */
function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

const grade = (r) => (r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : '✗ 不达标')

// —— 从设计令牌里取真实场景色 ——
let tokens = null
try {
  tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf8'))
} catch (e) {
  console.error(`✗ 读不到设计令牌 ${TOKENS_PATH}：${e.message}`)
  process.exit(1)
}

const themeLight = tokens.theme?.light ?? {}
const themeDark = tokens.theme?.dark ?? {}

/** 场景里可能被玻璃浮层压住的底色（按亮度排序取最坏） */
const SCENE_BASES = {
  light: Object.entries(themeLight)
    .filter(([, v]) => typeof v?.$value === 'string' && v.$value.startsWith('#'))
    .map(([k, v]) => ({ name: `theme.light.${k}`, rgb: hexToRgb(v.$value) })),
  dark: Object.entries(themeDark)
    .filter(([, v]) => typeof v?.$value === 'string' && v.$value.startsWith('#'))
    .map(([k, v]) => ({ name: `theme.dark.${k}`, rgb: hexToRgb(v.$value) })),
}

// —— 玻璃参数（与 styles.css 的实际值一致）——
const GLASS = {
  light: { fill: [11, 14, 26], fillAlpha: 0.72, underlay: [11, 14, 26], underlayAlpha: 0.86 },
  dark: { fill: [255, 255, 255], fillAlpha: 0.72, underlay: [255, 255, 255], underlayAlpha: 0.86 },
}

const INK_FALLBACK = {
  light: {
    primary: '#e6edf3', // --ui-ink-primary（浅色主题：深玻璃上的浅色字）
    secondary: '#b7c2cc', // --ui-ink-secondary
    muted: '#b0bcc8', // --ui-ink-muted
  },
  dark: {
    primary: '#0b0e1a', // --ui-ink-primary（深色主题：亮玻璃上的深墨字）
    secondary: '#39414d', // --ui-ink-secondary
    muted: '#454c59', // --ui-ink-muted
  },
}

/**
 * 从 styles.css 里解析真实的墨色（--ui-ink-*）。
 * 为什么必须解析而不是写死：写死的基准会**静默过期** —— 样式里改了墨色，
 * 脚本还拿着旧值算，结论看着通过、实际已经失效（这正是"文档与代码不同步"的同类坑）。
 * 解析不到时退回 fallback，并明确告警。
 */
function parseInkFromStyles() {
  const cssPath = path.resolve(__dirname, '../web/src/styles.css')
  let css
  try {
    css = fs.readFileSync(cssPath, 'utf8')
  } catch {
    return { ink: null, note: `读不到 ${cssPath}` }
  }
  // 取 .app { ... }（夜间默认）与 .app[data-theme='light'] { ... }（浅色）两个块
  // ⚠ 用全局匹配遍历**所有**同名块：styles.css 里有多个 .app[data-theme='light'] 规则，
  //   第一个只管背景/文字色，墨色变量在后面那个 —— 只取第一个会解析失败并静默退回兜底。
  const grab = (blockRe) => {
    const re = new RegExp(blockRe.source, 'g')
    let m
    while ((m = re.exec(css)) !== null) {
      const body = m[1]
      const out = {}
      for (const key of ['primary', 'secondary', 'muted']) {
        const v = body.match(new RegExp(`--ui-ink-${key}:\\s*(#[0-9a-fA-F]{3,8})`))
        if (v) out[key] = v[1]
      }
      if (Object.keys(out).length === 3) return out
    }
    return null
  }
  const dark = grab(/\.app\s*\{([\s\S]*?)\n\}/)
  const light = grab(/\.app\[data-theme='light'\]\s*\{([\s\S]*?)\n\}/)
  if (!dark || !light) return { ink: null, note: 'styles.css 里没找到含 --ui-ink-primary/secondary/muted 的 .app / .app[data-theme=\'light\'] 块' }
  return { ink: { light, dark }, note: null }
}

const parsed = parseInkFromStyles()
const INK = parsed.ink ?? INK_FALLBACK
if (!parsed.ink) {
  console.warn(`⚠ 未能从 styles.css 解析墨色（${parsed.note}），退回脚本内置基准 —— 若样式里的墨色已改，结论不可信`)
}

const toRgb = (hex) => {
  const h = hex.replace('#', '')
  if (h.length === 3) return [0, 1, 2].map((i) => parseInt(h[i] + h[i], 16))
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
const INK_RGB = {
  light: Object.fromEntries(Object.entries(INK.light).map(([k, v]) => [k, toRgb(v)])),
  dark: Object.fromEntries(Object.entries(INK.dark).map(([k, v]) => [k, toRgb(v)])),
}

let failed = 0

console.log('UI 对比度自检（按设计令牌里的真实场景色扫描，逐个背景取最坏值）\n')
console.log(
  `墨色基准来源：${parsed.ink ? 'styles.css 实时解析（.app / .app[data-theme=light] 的 --ui-ink-*）' : `⚠ 内置兜底（${parsed.note}）`}`
)
console.log(
  `  浅色主题 secondary=${INK.light.secondary} muted=${INK.light.muted} · 夜间主题 secondary=${INK.dark.secondary} muted=${INK.dark.muted}\n`
)

for (const theme of ['light', 'dark']) {
  const g = GLASS[theme]
  const inkRgb = INK_RGB[theme]
  const bases = SCENE_BASES[theme]
  const themeName = theme === 'light' ? '白天主题（深玻璃 + 浅色字）' : '夜间主题（亮玻璃 + 深墨字）'
  console.log(`=== ${themeName} ===`)

  for (const [mode, alpha, label, gates] of [
    ['未垫实底', g.fillAlpha, '只有 --ui-glass-fill（.72 半透明）—— 参考值，不参与门禁', false],
    ['垫实底', g.underlayAlpha, '加了 --ui-glass-underlay —— 新增玻璃浮层必须用这一档', true],
  ]) {
    const fg = mode === '未垫实底' ? g.fill : g.underlay
    console.log(`  —— ${mode}：${label} ——`)
    // 对每个场景底色算合成底，再对每个文字层级取**最坏**（对比度最低）的那个
    for (const [k, c] of Object.entries(inkRgb)) {
      let worst = { r: Infinity, name: '', base: null }
      for (const b of bases) {
        const composite = blend(fg, alpha, b.rgb)
        const r = ratio(c, composite)
        if (r < worst.r) worst = { r, name: b.name, base: composite }
      }
      const ok = worst.r >= 4.5
      // 只有"垫实底"这一档参与门禁；未垫实底一档是**为什么必须垫底**的论据
      if (!ok && gates) failed++
      console.log(
        `  ${k.padEnd(10)}`.padEnd(14) +
          `最坏 ${worst.r.toFixed(2)}:1  ${grade(worst.r).padEnd(10)}` +
          `← 压 ${worst.name}（合成 rgb(${worst.base.join(',')})）` +
          (gates || ok ? '' : '   ← 不达标即"必须垫实底"的证据')
      )
    }
    console.log('')
  }
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
console.log('✓ 对比度自检通过：全部文字组合在**所有场景底色**上均 ≥ AA (4.5:1)')
