// 办公室漫游（3DGS/SPZ）取景重验：进页 → 点「办公室漫游」→ 等 viewer 就绪 → 截图 2 张
// 用法：cd web && node ../tools/probe-office.cjs --out ../docs/figures/office-2026-10-28
const path = require('path')
const fs = require('fs')
const { chromium } = require('C:/Users/dqy/.workbuddy/binaries/node/workspace/node_modules/playwright')

const args = process.argv.slice(2)
function arg(name, def) {
  const i = args.indexOf('--' + name)
  return i >= 0 ? args[i + 1] : def
}
const OUT = path.resolve(arg('out', '../docs/figures/office-2026-10-28'))
const URL_ = arg('url', 'http://localhost:4173/?hour=10')
fs.mkdirSync(OUT, { recursive: true })

;(async () => {
  const browser = await chromium.launch({ headless: false, channel: 'chrome' })
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const page = await context.newPage()
  page.on('console', (msg) => {
    if (msg.text().includes('[office]')) console.log('CONSOLE:', msg.text())
  })
  await page.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('.mode-switch, .gc-role-gate', { timeout: 60000 })
  // 角色门：先选「求职者」再进应用（与 shoot-street 同逻辑）
  if (await page.locator('.gc-role-gate').count()) {
    const card = page.locator('.gc-role-card--candidate').first()
    if (await card.count()) await card.click()
    else await page.locator('.gc-role-card').first().click()
  }
  await page.waitForSelector('.mode-switch', { timeout: 60000 })
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('办公室漫游'))
    b?.click()
  })
  // 等 SPZ/3DGS viewer 挂载并稳定 12 秒（首帧编译 + 资产流式）
  await page.waitForTimeout(12000)
  await page.bringToFront().catch(() => {})
  await page.screenshot({ path: path.join(OUT, 'office-12s.png') })
  await page.waitForTimeout(10000)
  await page.screenshot({ path: path.join(OUT, 'office-22s.png') })
  const info = await page.evaluate(() => ({
    canvases: document.querySelectorAll('canvas').length,
    body: document.body.innerText.slice(0, 300),
  }))
  console.log(JSON.stringify(info, null, 2))
  await browser.close()
})().catch((e) => {
  console.error('probe-office failed:', e.message)
  process.exit(1)
})
