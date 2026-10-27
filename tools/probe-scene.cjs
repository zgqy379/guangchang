// 场景状态探针：读灯光/材质/instanceColor 实况，定位白天街景「幽灵化+黑棚」根因
const { chromium } = require('C:/Users/dqy/.workbuddy/binaries/node/workspace/node_modules/playwright')
;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--disable-gpu-sandbox', '--enable-unsafe-swiftshader'] })
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage()
  await page.goto('http://localhost:4173/', { waitUntil: 'load', timeout: 60000 })
  await page.waitForSelector('.mode-switch, .gc-role-gate', { timeout: 30000 })
  if (await page.locator('.gc-role-gate').count()) {
    const card = page.locator('.gc-role-card--candidate').first()
    if (await card.count()) await card.click()
  }
  await page.waitForSelector('.mode-switch', { timeout: 30000 })
  await page.click('.theme-lock')
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: /招聘街区/ }).click()
  await page.waitForSelector('canvas', { timeout: 60000 })
  await page.waitForTimeout(12000)
  const info = await page.evaluate(() => {
    const scene = window.__st
    if (!scene) return { err: 'no __st' }
    const out = { theme: document.querySelector('.app').getAttribute('data-theme'), lights: [], roofs: [], facades: [], caps: [] }
    scene.traverse((o) => {
      if (o.isDirectionalLight) out.lights.push({ color: '#' + o.color.getHexString(), intensity: +o.intensity.toFixed(2), pos: o.position.toArray().map((v) => +v.toFixed(1)), castShadow: o.castShadow })
      if (o.isHemisphereLight) out.lights.push({ hemi: true, sky: '#' + o.color.getHexString(), ground: '#' + o.groundColor.getHexString(), intensity: +o.intensity.toFixed(2) })
      if (o.isInstancedMesh) {
        const m = o.material
        const rec = { count: o.count, color: '#' + m.color.getHexString(), vertexColors: !!m.vertexColors, hasIC: !!o.instanceColor, ic0: o.instanceColor ? o.instanceColor.getX(0).toFixed(2) + ',' + o.instanceColor.getY(0).toFixed(2) + ',' + o.instanceColor.getZ(0).toFixed(2) : null, emissive: m.emissive ? '#' + m.emissive.getHexString() + '@' + m.emissiveIntensity : null, hasMap: !!m.map, mapW: m.map && m.map.image ? m.map.image.width : null, geo: o.geometry.type + (o.geometry.parameters ? ':' + [o.geometry.parameters.width, o.geometry.parameters.height, o.geometry.parameters.depth].join('x') : '') }
        if (m.emissive && m.emissiveIntensity < 1 && m.emissiveIntensity > 0.05 && !m.map) out.roofs.push(rec)
        else if (m.map && m.map.image && m.map.image.width === 512) out.facades.push(rec)
        else if (m.vertexColors && !m.map && o.geometry.type === 'BoxGeometry') out.caps.push(rec)
      }
    })
    out.fog = scene.fog ? { color: '#' + scene.fog.color.getHexString(), near: scene.fog.near, far: scene.fog.far } : null
    out.bg = scene.background && scene.background.getHexString ? '#' + scene.background.getHexString() : null
    out.env = scene.environment ? 'present' : null
    return out
  })
  console.log(JSON.stringify(info, null, 1))
  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
