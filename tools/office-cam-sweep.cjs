// officeCam 参数扫掠：6 组仰角/方位各拍一张，选初始取景
const { chromium } = require('C:/Users/dqy/.workbuddy/binaries/node/workspace/node_modules/playwright')
const SETS = [
  ['e042a078', '0.42,0.785'],
  ['e010a000', '0.10,0.0'],
  ['e010a157', '0.10,1.5708'],
  ['e010a314', '0.10,3.1416'],
  ['e010a471', '0.10,4.7124'],
  ['e075a078', '0.75,0.785'],
]
;(async () => {
  const browser = await chromium.launch({ headless: false, channel: 'chrome' })
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  for (const [name, param] of SETS) {
    const page = await context.newPage()
    page.on('console', (m) => { if (m.text().includes('[office]')) console.log(name, '|', m.text().slice(0, 200)) })
    await page.goto('http://localhost:4173/?hour=10&officeCam=' + encodeURIComponent(param), { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForSelector('.mode-switch, .gc-role-gate', { timeout: 60000 })
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
    await page.waitForTimeout(15000)
    await page.screenshot({ path: `E:/guangchang/docs/figures/office-cam-sweep/${name}.png` })
    await page.close()
    console.log(name, 'shot')
  }
  await browser.close()
})().catch((e) => { console.error('sweep failed:', e.message); process.exit(1) })
