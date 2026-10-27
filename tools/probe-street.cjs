// 街区崩溃探针：抓完整 console 错误栈 + R3F 组件栈
const { chromium } = require('C:/Users/dqy/.workbuddy/binaries/node/workspace/node_modules/playwright')
;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--disable-gpu-sandbox', '--enable-unsafe-swiftshader'] })
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage()
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('=== CONSOLE ERROR ===\n' + m.text().slice(0, 3000) + '\n')
  })
  page.on('pageerror', (e) => console.log('=== PAGEERROR ===\n' + String(e).slice(0, 3000) + '\n'))
  await page.goto('http://localhost:4173/', { waitUntil: 'load', timeout: 60000 })
  await page.waitForSelector('.mode-switch, .gc-role-gate', { timeout: 30000 })
  if (await page.locator('.gc-role-gate').count()) {
    const card = page.locator('.gc-role-card--candidate').first()
    if (await card.count()) await card.click()
    else await page.locator('.gc-role-card').first().click()
  }
  await page.waitForSelector('.mode-switch', { timeout: 30000 })
  await page.click('.theme-lock')
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: /招聘街区/ }).click()
  await page.waitForTimeout(12000)
  console.log('=== error boundary present:', await page.locator('.scene-error, [class*=error]').count())
  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
