// Style Dictionary 构建配置：DTCG tokens.json → tokens.css + tokens.js + d.mts
// 用法：npm run tokens（web/ 目录下）
import fs from 'node:fs'
import StyleDictionary from 'style-dictionary'

const sd = new StyleDictionary({
  source: ['design/tokens.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      buildPath: 'generated/',
      files: [{ destination: 'design-tokens.output.css', format: 'css/variables' }],
    },
    js: {
      transformGroup: 'js',
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

