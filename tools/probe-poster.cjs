// 背板探针：定位公司背板（map 宽 512 的 InstancedMesh）实例 0 的世界位置并投影屏幕坐标
// 用法：cd web && node ../tools/probe-poster.cjs
const { chromium } = require('C:/Users/dqy/.workbuddy/binaries/node/workspace/node_modules/playwright')
const URL_ = 'http://localhost:4173/?hour=10'

;(async () => {
  const browser = await chromium.launch({ headless: false, channel: 'chrome' })
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const page = await context.newPage()
  await page.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('.mode-switch, .gc-role-gate', { timeout: 60000 })
  if (await page.locator('.gc-role-gate').count()) {
    const card = page.locator('.gc-role-card--candidate').first()
    if (await card.count()) await card.click()
    else await page.locator('.gc-role-card').first().click()
  }
  await page.waitForSelector('.mode-switch', { timeout: 60000 })
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('招聘街区'))
    b?.click()
  })
  await page.waitForTimeout(7000)
  // 走向 01 摊位：点击其前方地面两次，触发跟随+驻停 focus
  await page.mouse.click(640, 480)
  await page.waitForTimeout(2200)
  await page.mouse.click(700, 460)
  await page.waitForTimeout(2500)
  await page.mouse.click(760, 430)
  await page.waitForTimeout(6000)
  const out = await page.evaluate(() => {
    const scene = window.__st
    const cam = window.__cam
    if (!scene || !cam) return { error: 'no hooks' }
    const found = []
    scene.traverse((o) => {
      if (o.isInstancedMesh && o.material?.map && o.material.map.image && o.material.map.image.width === 512) {
        const m = new THREE_MATRIX()
        function THREE_MATRIX() {
          return scene.matrixWorld ? new (Object.getPrototypeOf(scene.matrixWorld)).constructor() : null
        }
        // 取实例 0 世界位置：matrixWorld = mesh.matrixWorld × instanceMatrix
        const im = new (Object.getPrototypeOf(o.matrixWorld)).constructor()
        o.getMatrixAt(0, im)
        const mw = o.matrixWorld.clone().multiply(im)
        const pos = new (Object.getPrototypeOf(cam.position)).constructor().setFromMatrixPosition(mw)
        const v = pos.clone().project(cam)
        found.push({
          count: o.count,
          visible: o.visible,
          world: [pos.x.toFixed(2), pos.y.toFixed(2), pos.z.toFixed(2)],
          ndc: [v.x.toFixed(2), v.y.toFixed(2), v.z.toFixed(2)],
          inFrustum: v.z > -1 && v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1,
        })
      }
    })
    return { cam: [cam.position.x.toFixed(2), cam.position.y.toFixed(2), cam.position.z.toFixed(2)], found }
  })
  console.log(JSON.stringify(out, null, 2))
  await page.screenshot({ path: 'E:/guangchang/docs/figures/probe-poster-focus.png' })
  await browser.close()
})().catch((e) => {
  console.error('probe failed:', e.message)
  process.exit(1)
})
