// 面板文字色自检：不透明面板（header/footer/面板类）用了玻璃墨色 → 深色主题下深字压深底
//
// 背景：--ui-ink-* 是"压在玻璃浮层上"的墨色（深色主题下 = 深墨 #0b0e1a / #39414d / #454c59），
//       而 --ui-panel-bg 是**不透明**面板底（深色主题下 = #0d1117 深底）。
//       两者混用 → 深字压深底 = 文字不可见（既存 bug：顶栏「逛厂」在深色主题下看不见）。
//
// 用法：node tools/check-panel-ink.mjs
// 退出码非 0 表示有不匹配项

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const cssPath = path.resolve(__dirname, '../src/styles.css')
const css = fs.readFileSync(cssPath, 'utf8')

// 不透明面板底色使用的变量
const PANEL_BG_VARS = ['--ui-panel-bg', '--ui-page-bg']
// 玻璃浮层墨色（不能用在不透明面板上）
const GLASS_INK_VARS = ['--ui-ink-primary', '--ui-ink-secondary', '--ui-ink-muted']

// 解析顶层选择器块
const rules = []
const re = /(^|\n)([^{}@\/][^{}]*?)\{([^}]*)\}/g
let m
while ((m = re.exec(css)) !== null) {
  const selector = m[2].trim().replace(/\s+/g, ' ')
  const body = m[3]
  const line = css.slice(0, m.index).split('\n').length
  rules.push({ selector, body, line })
}

// 判断某选择器块是否用了不透明面板底
function usesPanelBg(body) {
  return PANEL_BG_VARS.some(v => body.includes(`var(${v})`))
}

const problems = []
for (const r of rules) {
  if (!usesPanelBg(r.body)) continue
  for (const ink of GLASS_INK_VARS) {
    if (!r.body.includes(`var(${ink})`)) continue
    // 排除 :root / 变量定义块本身
    if (r.selector.startsWith(':root') || r.selector.startsWith('--')) continue
    problems.push({
      selector: r.selector,
      ink,
      line: r.line,
    })
  }
}

if (problems.length === 0) {
  console.log('✓ 面板文字色检查通过：没有不透明面板误用玻璃墨色')
  process.exit(0)
}

console.log('✗ 发现不透明面板误用玻璃墨色（深色主题下深字压深底 = 不可见）：')
for (const p of problems) {
  console.log(`  ${p.selector}  →  ${p.ink}   (约第 ${p.line} 行)`)
}
console.log('')
console.log('修法：给不透明面板单独定义随主题反相的前景色，')
console.log('     如 --ui-page-fg / --ui-panel-fg-muted，不要用 --ui-ink-*。')
process.exit(1)
