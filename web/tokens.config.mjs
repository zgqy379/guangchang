// Style Dictionary 构建配置：DTCG tokens.json → tokens.css + tokens.js + d.mts
// 用法：npm run tokens（web/ 目录下）
//
// v4 变更（玻璃数字孪生 · 2026-10-26）：
//   1. 注册 `shadow` 类型转换（原脚本只认 color/dimension/duration/number，
//      UI v3 §12 L2 标注的风险点在此确认并修复）——多段 box-shadow 需保留逗号结构
//   2. 注册 `glass` 组参数的输出（透明白/描边/模糊等作为独立 CSS 变量输出）
import fs from 'node:fs'
import StyleDictionary from 'style-dictionary'

/**
 * shadow 类型转换：把 DTCG shadow 值转成 CSS box-shadow 字符串。
 * 多段阴影（逗号分隔）逐段处理；字符串值原样透传。
 *
 * 注意：必须用 filter 而非 match + transitive，否则会误伤 number/dimension 令牌
 * （曾导致 game.xp.* 全变成 "none"，HUD 显示 Lv.NaN）。
 */
StyleDictionary.registerTransform({
  name: 'shadow/css',
  type: 'value',
  transitive: true,
  filter: (token) => token.$type === 'shadow',
  transform: (token) => {
    const raw = token.$value
    if (typeof raw === 'string') return raw
    if (raw && typeof raw === 'object') {
      // DTCG shadow 对象 → CSS 片段
      const { offsetX = 0, offsetY = 0, blur = 0, spread = 0, color = 'rgba(0,0,0,.3)', inset = false } = raw
      return `${inset ? 'inset ' : ''}${offsetX}px ${offsetY}px ${blur}px ${spread}px ${color}`
    }
    return 'none'
  },
})

/**
 * glass 组：透明白等参数需要输出为独立 CSS 变量（如 --glass-fill）。
 * 这里把 DTCG 的 $value 原样输出（rgba 字符串或 dimension 字符串均可）。
 *
 * 同样用 filter 限定范围，避免误伤其他类型的令牌。
 */
StyleDictionary.registerTransform({
  name: 'glass/css',
  type: 'value',
  transitive: true,
  filter: (token) => token.path[0] === 'glass' && token.$type !== 'number',
  transform: (token) => {
    const v = token.$value
    if (v && typeof v === 'object' && 'r' in v) {
      const { r, g, b, a = 1 } = v
      return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`
    }
    return String(v)
  },
})

const sd = new StyleDictionary({
  source: ['design/tokens.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      transforms: ['shadow/css', 'glass/css'],
      buildPath: 'generated/',
      files: [{ destination: 'design-tokens.output.css', format: 'css/variables' }],
    },
    js: {
      transformGroup: 'js',
      transforms: ['shadow/css', 'glass/css'],
      buildPath: 'generated/',
      files: [
        {
          destination: 'design-tokens.output.mjs',
          format: 'javascript/es6',
        },
      ],
    },
  },
})

await sd.buildAllPlatforms()

// 生成类型声明，保证 TS 侧可以直接消费生成的令牌（与 mjs 同名导出）
const tokens = JSON.parse(fs.readFileSync('design/tokens.json', 'utf8'))
const decls = []
const walk = (obj, path) => {
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object' && '$type' in value) {
      const name = [...path, key].map((p) => p[0].toUpperCase() + p.slice(1)).join('')
      const type = value.$type === 'number' ? 'number' : 'string'
      decls.push(`export declare const ${name}: ${type}`)
    } else if (value && typeof value === 'object') {
      walk(value, [...path, key])
    }
  }
}
walk(tokens, [])
fs.writeFileSync('generated/design-tokens.output.d.mts', decls.join('\n') + '\n')
console.log('tokens built: generated/design-tokens.output.css / .mjs / .d.mts')

// —— 构建后自检：number 令牌不得被自定义 transform 破坏 ——
// 背景：曾用 match + transitive 注册 transform，导致 game.xp.* 全变 "none"，
// HUD 显示 Lv.NaN。此处显式断言，坏构建直接失败而不是静默上线。
const built = await import('./generated/design-tokens.output.mjs')
const numberTokens = []
const collectNumbers = (obj, path) => {
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object' && '$type' in value) {
      if (value.$type === 'number') {
        numberTokens.push([...path, key].map((p) => p[0].toUpperCase() + p.slice(1)).join(''))
      }
    } else if (value && typeof value === 'object') {
      collectNumbers(value, [...path, key])
    }
  }
}
collectNumbers(tokens, [])
const broken = numberTokens.filter((name) => {
  const v = built[name]
  return v === undefined || v === 'none' || typeof v !== 'number'
})
if (broken.length) {
  console.error(`✗ tokens 自检失败：${broken.length} 个 number 令牌被破坏 → ${broken.join(', ')}`)
  console.error('  常见原因：自定义 transform 用了 match+transitive，误伤 number 类型。请改用 filter。')
  process.exit(1)
}
console.log(`✓ tokens 自检通过：${numberTokens.length} 个 number 令牌类型正确`)
