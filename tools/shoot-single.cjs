// 单人模式实拍：构图自适应验收（1280×720）
//   低薪参数（默认 15 万 → 山 0.32m）与高薪参数（不限星云科技 100 万 → 山 ~2.1m）
//   各拍一张白天 + 高薪加拍夜间，验证 MountainFit 相机/目标点随参数重设。
// 用法（web 目录下）：
//   npx vite preview --port 4173        # 另开一个终端
//   node ../tools/shoot-single.cjs --out ../docs/figures/single-2026-10-27 --label polish9
// CommonJS + headed Chrome 理由同 shoot-street.cjs（lessons §7.3 / §8.5）
const path = require('path')
const fs = require('fs')
const { chromium } = require('C:/Users/dqy/.workbuddy/binaries/node/workspace/node_modules/playwright')

const args = process.argv.slice(2)
function arg(name, def) {
  const i = args.indexOf('--' + name)
  return i >= 0 ? args[i + 1] : def
}
const OUT = path.resolve(arg('out', '../docs/figures/single-2026-10-27'))
const LABEL = arg('label', 'shot')
const URL = arg('url', 'http://localhost:4173/')
const W = Number(arg('w', 1280))
const H = Number(arg('h', 720))

fs.mkdirSync(OUT, { recursive: true })

async function shoot(page, name) {
  const file = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: file })
  console.log('  ✓', path.relative(process.cwd(), file))
}

;(async () => {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--disable-gpu-sandbox', '--enable-unsafe-swiftshader'],
  })
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 200)))

  console.log('→ goto', URL)
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 })
  await page.waitForSelector('.mode-switch, .gc-role-gate', { timeout: 30000 })

  // 角色门：选 HR（薪资芯片/预设公司只在 HR 参数面板里）
  const gate = await page.locator('.gc-role-gate').count()
  if (gate) {
    const card = page.locator('.gc-role-card--hr').first()
    if (await card.count()) await card.click()
    else await page.locator('.gc-role-card').first().click()
  }
  await page.waitForSelector('.mode-switch', { timeout: 30000 })

  // 两类角色进门都落街区：手动切到「逛一家」（单人模式）
  await page.getByRole('button', { name: /逛一家/ }).click()
  await page.waitForTimeout(800)

  // 锁定白天（与街区白天截图同基准）
  await page.click('.theme-lock')
  await page.waitForTimeout(400)

  // 默认就是 single（逛一家）。等 lazy 3D 组件 + 挂载稳定
  await page.waitForSelector('canvas', { timeout: 60000 })
  await page.waitForTimeout(5000)

  // ① 低薪默认（15 万）：构图自适应的主角
  await shoot(page, `single-low-${LABEL}`)
  console.log('  主题 =', await page.getAttribute('.app', 'data-theme'))

  // ② 高薪（不眠星云科技）：大山 + 引线/钞票带应≈历史行为
  await page.locator('.preset-row button, .chip-btn', { hasText: '不眠星云科技' }).first().click()
  await page.waitForTimeout(3500)
  await shoot(page, `single-high-${LABEL}`)

  // ③ 高薪夜间：auto→light 已点过一次，从 light 再点一次即 dark（勿连点两次回到 auto）
  await page.click('.theme-lock')
  await page.waitForTimeout(1500)
  await shoot(page, `single-high-night-${LABEL}`)
  console.log('  主题 =', await page.getAttribute('.app', 'data-theme'))

  if (errors.length) {
    console.log('!! 页面错误：')
    errors.forEach((e) => console.log('  ', e))
    process.exitCode = 2
  }
  await browser.close()
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
