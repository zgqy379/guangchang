// 精确应用"不透明面板文字色"修正（脚本化，避免手写 Edit 覆盖他人并发改动）
// 修法：不透明面板用随主题反相的面板色，不用玻璃墨色 --ui-ink-*
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const cssPath = path.resolve(__dirname, '../src/styles.css')
let css = fs.readFileSync(cssPath, 'utf8')

const edits = [
  // [原文, 新文, 期望出现次数]
  [
    `  --ui-page-bg: var(--color-neutral-1);\n  --ui-page-fg: var(--color-text-primary);\n  --ui-panel-bg: #0d1117;`,
    `  --ui-page-bg: var(--color-neutral-1);\n  --ui-page-fg: var(--color-text-primary);\n  /* 不透明面板（顶栏/页脚/侧栏）的次级文字色：随主题反相。\n     不用 --ui-ink-secondary —— 那是玻璃浮层专用（深色主题下为深墨，压深底不可见） */\n  --ui-panel-fg-muted: #8b949e;\n  /* 不透明面板里的**强调数值**色：随主题反相。\n     单一橙色做不到两头都达标（#f0883e 浅底 2.28:1 / 深底 7.48:1；\n     #c2610f 浅底 3.78:1 / 深底 4.52:1 —— 都有一头不达 AA） */\n  --ui-panel-accent: #f0883e;\n  --ui-panel-bg: #0d1117;`,
    1,
  ],
  [
    `  --ui-panel-bg: rgba(255, 255, 255, 0.92);\n  --ui-panel-border: rgba(11, 14, 26, 0.1);`,
    `  --ui-panel-fg-muted: #4a5160;\n  --ui-panel-accent: #a84d08;\n  --ui-panel-bg: rgba(255, 255, 255, 0.92);\n  --ui-panel-border: rgba(11, 14, 26, 0.1);`,
    1,
  ],
  // header：主文字 + 次级文字
  [
    `  background: var(--ui-panel-bg);\n  color: var(--ui-ink-primary);\n  transition: background-color 600ms ease, color 600ms ease, border-color 600ms ease;\n}\nheader h1 {`,
    `  background: var(--ui-panel-bg);\n  /* 顶栏是**不透明面板**（不是玻璃浮层），文字色必须跟页面底色走，不能用\n     --ui-ink-primary（那是"压在玻璃面上"的墨色：深色主题下为 #0b0e1a 深墨，\n     压在不透明深底 --ui-panel-bg 上 → 深字压深底，标题不可见。既存 bug）\n     → 用 --ui-page-fg（页面前景色，随主题反相） */\n  color: var(--ui-page-fg);\n  transition: background-color 600ms ease, color 600ms ease, border-color 600ms ease;\n}\nheader h1 {`,
    1,
  ],
  [
    `header h1 span {\n  font-size: 13px;\n  font-weight: normal;\n  color: var(--ui-ink-secondary);\n  margin-left: 10px;\n}`,
    `header h1 span {\n  font-size: 13px;\n  font-weight: normal;\n  /* 顶栏是不透明面板，次级文字同样不能用玻璃墨色（深色主题下是深墨，压深底不可见） */\n  color: var(--ui-panel-fg-muted);\n  margin-left: 10px;\n}`,
    1,
  ],
  // .controls 侧栏
  [
    `  background: var(--ui-panel-bg);\n  color: var(--ui-ink-primary);\n  transition: background-color 600ms ease, color 600ms ease, border-color 600ms ease;\n}\n\n/*`,
    `  background: var(--ui-panel-bg);\n  /* 不透明面板 → 用页面前景色（随主题反相），不用玻璃墨色 */\n  color: var(--ui-page-fg);\n  transition: background-color 600ms ease, color 600ms ease, border-color 600ms ease;\n}\n\n/*`,
    1,
  ],
  // 面板内的次级文字
  [
    `.panel h2 {\n  font-size: 13px;\n  color: var(--color-text-secondary);`,
    `.panel h2 {\n  font-size: 13px;\n  /* 在不透明侧栏面板内 → 面板次级色（随主题反相） */\n  color: var(--ui-panel-fg-muted);`,
    1,
  ],
  [
    `.planned h3 {\n  font-size: 12px;\n  color: var(--color-text-muted);`,
    `.planned h3 {\n  font-size: 12px;\n  color: var(--ui-panel-fg-muted);`,
    1,
  ],
  [
    `  border: 1px solid var(--color-border-strong);\n  color: var(--color-text-secondary);`,
    `  border: 1px solid var(--color-border-strong);\n  color: var(--ui-panel-fg-muted);`,
    1,
  ],
  [
    `.readout small {\n  color: var(--color-text-muted);\n}`,
    `.readout small {\n  color: var(--ui-panel-fg-muted);\n}`,
    1,
  ],
  [
    `.tagline {\n  color: var(--color-text-muted);`,
    `.tagline {\n  color: var(--ui-panel-fg-muted);`,
    1,
  ],
  [
    `.perception {\n  display: block;\n  color: var(--color-text-muted);`,
    `.perception {\n  display: block;\n  /* 在不透明侧栏面板内 → 用面板次级色（随主题反相）。\n     旧的 --color-text-muted（#6e7681）在深色主题下压深底仅 4.12:1，不达 AA */\n  color: var(--ui-panel-fg-muted);`,
    1,
  ],
  [
    `.field-label .value {\n  font-style: normal;\n  color: var(--color-brand-orange);`,
    `.field-label .value {\n  font-style: normal;\n  /* 面板内的强调数值：随主题反相的橙（浅底 5.08:1 / 深底 7.48:1，均达 AA） */\n  color: var(--ui-panel-accent);`,
    1,
  ],
  [
    `.readout strong {\n  color: var(--color-brand-orange);\n}`,
    `.readout strong {\n  color: var(--ui-panel-accent);\n}`,
    1,
  ],
  // footer
  [
    `  border-top: 1px solid var(--ui-panel-border);\n  color: var(--ui-ink-muted);\n  background: var(--ui-panel-bg);`,
    `  border-top: 1px solid var(--ui-panel-border);\n  /* 同样是不透明面板 → 次级文字用面板专用色（随主题反相），不用玻璃墨色 */\n  color: var(--ui-panel-fg-muted);\n  background: var(--ui-panel-bg);`,
    1,
  ],
]

let applied = 0
for (const [from, to, expected] of edits) {
  const count = css.split(from).length - 1
  if (count !== expected) {
    console.error(`✗ 匹配数不符（期望 ${expected}，实际 ${count}）：\n${from.slice(0, 70)}...`)
    process.exit(1)
  }
  css = css.replace(from, to)
  applied++
}

fs.writeFileSync(cssPath, css)
console.log(`✓ 已应用 ${applied} 处面板文字色修正`)
