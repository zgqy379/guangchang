// 面板文字色自检：不透明面板（header/footer/面板类）用了玻璃墨色 → 深色主题下深字压深底
//
// 背景：--ui-ink-* 是"压在玻璃浮层上"的墨色（深色主题下 = 深墨 #0b0e1a / #39414d / #454c59），
//       而 --ui-panel-bg 是**不透明**面板底（深色主题下 = #0d1117 深底）。
//       两者混用 → 深字压深底 = 文字不可见（既存 bug：顶栏「逛厂」在深色主题下看不见）。
//
// 用法：node tools/check-panel-ink.mjs
// 退出码非 0 表示有不匹配项
//
// 2026-10-27 加固（原正则 `/(^|\n)([^{}@\/][^{}]*?)\{([^}]*)\}/g` 的盲区）：
//   1. @media/@supports 等容器规则内的普通规则此前被 `@` 首字符排除而漏检 → 现递归进入容器
//   2. CSS 注释里的花括号会打乱块配对 → 解析前先剥离注释（保留换行，行号仍对齐原文）
//   3. `var( --x )` 带空格的写法不被 `includes('var(--x)')` 命中 → 改用容忍空格的正则
//   4. 间接变量（--fg: var(--ui-ink-primary); color: var(--fg)）此前漏检 → 建变量定义表做引用闭包
//   5. `:root` 判定由 startsWith 放宽为 includes（选择器可能是 `:root, [data-theme="dark"]`）

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const cssPath = path.resolve(__dirname, '../web/src/styles.css')
const rawCss = fs.readFileSync(cssPath, 'utf8')

// 不透明面板底色使用的变量
const PANEL_BG_VARS = ['--ui-panel-bg', '--ui-page-bg']
// 玻璃浮层墨色（不能用在不透明面板上）
const GLASS_INK_VARS = ['--ui-ink-primary', '--ui-ink-secondary', '--ui-ink-muted']

// 去注释：逐字符替换为非换行空格，保持换行结构（行号与原文一致）；
// 注释中的花括号因此不再污染块解析。
const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))

/** 收集文本中所有 var() 引用的变量名（容忍 `var( --x )` 的空格写法） */
function varRefs(text) {
  const out = []
  const re = /var\(\s*(--[\w-]+)\s*[,)]/g
  let m
  while ((m = re.exec(text)) !== null) out.push(m[1])
  return out
}

/** 绝对偏移 → 行号（基于去注释后的 css，换行数与原文一致） */
function lineOf(index) {
  let n = 1
  for (let k = 0; k < index && k < css.length; k++) if (css[k] === '\n') n++
  return n
}

/**
 * 解析规则块，返回 { selector, body, line }。
 * - 容器规则（以 @ 开头，如 @media/@supports/@layer）递归进入内部，取出其中的普通规则；
 * - 用花括号深度配对，跳过嵌套体。
 */
function extractRules(text, offset = 0) {
  const rules = []
  let i = 0
  let buf = ''
  let bufStart = 0
  while (i < text.length) {
    const ch = text[i]
    if (ch === '{') {
      const selector = buf.trim()
      const selStart = bufStart
      let depth = 1
      let j = i + 1
      while (j < text.length && depth > 0) {
        if (text[j] === '{') depth++
        else if (text[j] === '}') depth--
        j++
      }
      const innerStart = i + 1
      const inner = text.slice(innerStart, j - 1)
      if (selector.startsWith('@')) {
        rules.push(...extractRules(inner, offset + innerStart))
      } else if (selector) {
        rules.push({ selector, body: inner, line: lineOf(offset + selStart) })
      }
      i = j
      buf = ''
      bufStart = i
      continue
    }
    if (ch === '}') {
      i++
      buf = ''
      bufStart = i
      continue
    }
    if (buf === '') bufStart = i
    buf += ch
    i++
  }
  return rules
}

// 变量定义表：--name → 值文本（供间接变量引用闭包使用）
const varDefs = new Map()
{
  const re = /(--[\w-]+)\s*:\s*([^;{}]*)[;}]/g
  let m
  while ((m = re.exec(css)) !== null) {
    if (!varDefs.has(m[1])) varDefs.set(m[1], m[2])
  }
}

/** 变量 varName 是否（直接或经定义链间接）指向 targets 中任一变量 */
function reaches(varName, targets, seen = new Set()) {
  if (targets.includes(varName)) return true
  if (seen.has(varName)) return false
  seen.add(varName)
  const def = varDefs.get(varName)
  if (!def) return false
  return varRefs(def).some((v) => reaches(v, targets, seen))
}

/** 纯变量定义块（体内每条声明都以 `--` 开头）不是"属性应用"，跳过 */
function isVarDefBlock(body) {
  const decls = body.split(';').map((s) => s.trim()).filter(Boolean)
  if (decls.length === 0) return false
  return decls.every((d) => d.startsWith('--'))
}

const rules = extractRules(css)
const problems = []
for (const r of rules) {
  // 排除 :root / 变量定义块本身（放宽为 includes：选择器可能是 `:root, [data-theme=...]`）
  if (r.selector.includes(':root') || r.selector.startsWith('--')) continue
  if (isVarDefBlock(r.body)) continue

  const refs = varRefs(r.body)
  // 该块是否用了不透明面板底（含间接引用）
  if (!refs.some((v) => reaches(v, PANEL_BG_VARS))) continue
  // 命中哪些玻璃墨色（含间接引用）
  const hitInks = [...new Set(refs.filter((v) => reaches(v, GLASS_INK_VARS)))]
  if (hitInks.length === 0) continue

  problems.push({ selector: r.selector, inks: hitInks, line: r.line })
}

if (problems.length === 0) {
  console.log('✓ 面板文字色检查通过：没有不透明面板误用玻璃墨色')
  process.exit(0)
}

console.log('✗ 发现不透明面板误用玻璃墨色（深色主题下深字压深底 = 不可见）：')
for (const p of problems) {
  console.log(`  ${p.selector}  →  ${p.inks.join(', ')}   (约第 ${p.line} 行)`)
}
console.log('')
console.log('修法：给不透明面板单独定义随主题反相的前景色，')
console.log('     如 --ui-page-fg / --ui-panel-fg-muted，不要用 --ui-ink-*。')
process.exit(1)