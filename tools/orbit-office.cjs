// 轨道接触表：7 个机位各拍一张（6 方位外景 + dense 中心内景），用于选型
const path = require('path')
const { chromium } = require('C:/Users/dqy/.workbuddy/binaries/node/workspace/node_modules/playwright')
const OUT = 'E:/guangchang/docs/figures/office-orbit'
;(async () => {
  const browser = await chromium.launch({ headless: false, channel: 'chrome' })
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const page = await context.newPage()
  page.on('console', (m) => { if (m.text().includes('[office]')) console.log('CONSOLE:', m.text()) })
  await page.goto('http://localhost:4173/?hour=10', { waitUntil: 'domcontentloaded', timeout: 60000 })
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
  for (let i = 0; i < 7; i++) {
    await page.evaluate((idx) => {
      const viewer = window.__officeViewer
      const cam = viewer ? viewer.getCamera() : window.__officeCam
      if (!cam || !viewer) return
      // dense 盒（由 [office] 日志）：c=(-2.65,-0.68,0.25) 尺寸 8.2/14.2/3.25
      const c = { x: -2.65, y: -0.68, z: 0.25 }
      const R = 11
      const a = (idx / 6) * Math.PI * 2
      const elev = idx === 6 ? 0 : 0.35
      cam.position.set(c.x + Math.cos(a) * R, c.y + Math.sin(elev) * R, c.z + Math.sin(a) * R)
      cam.lookAt(c.x, c.y, c.z)
      viewer.setCamera(cam)
      viewer.render()
    }, i)
    await page.waitForTimeout(1200)
    await page.screenshot({ path: path.join(OUT, `orbit-${i}.png`) })
  }
  // 第 7 张：dense 中心内景（朝 -x）
  await page.evaluate(() => {
    const cam = window.__officeCam
    const viewer = window.__officeViewer
    if (!cam || !viewer) return
    cam.position.set(0.8, -0.5, 0.25)
    cam.lookAt(-4, -1, 0.3)
    viewer.setCamera(cam)
    viewer.render()
  })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: path.join(OUT, 'inside.png') })
  console.log('orbit done')
  await browser.close()
})().catch((e) => { console.error('orbit failed:', e.message); process.exit(1) })
