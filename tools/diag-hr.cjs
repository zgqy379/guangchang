// 场景诊断：数一数摊位前的 HR 形象到底在不在、尺寸多大（lessons §7.6 的隔离诊断法）
// 用法：node ../tools/diag-hr.cjs --url http://127.0.0.1:4173/
const { chromium } = require('C:/Users/dqy/.workbuddy/binaries/node/workspace/node_modules/playwright')

const args = process.argv.slice(2)
const arg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d }
const URL = arg('url', 'http://127.0.0.1:4173/')

;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: false })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)) })
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 300)))
  page.on('requestfailed', (r) => errors.push('REQFAIL ' + r.url().slice(-60) + ' ' + (r.failure()?.errorText || '')))

  await page.goto(URL, { waitUntil: 'load', timeout: 60000 })
  await page.waitForSelector('.mode-switch')
  await page.click('.theme-lock')
  await page.getByRole('button', { name: /招聘街区/ }).click()
  await page.waitForFunction(() => !!window.__st, null, { timeout: 60000 })
  await page.waitForTimeout(4000)

  // 走到互联网区第一个摊位旁，触发近景 LOD（真实 HR GLB）
  await page.evaluate(() => {
    window.__project = function (cam, x, y, z) {
      const e = cam.matrixWorldInverse.elements
      const vx = e[0] * x + e[4] * y + e[8] * z + e[12]
      const vy = e[1] * x + e[5] * y + e[9] * z + e[13]
      const vz = e[2] * x + e[6] * y + e[10] * z + e[14]
      const p = cam.projectionMatrix.elements
      const cx = p[0] * vx, cy = p[5] * vy, cw = -vz
      return { x: (cx / cw * 0.5 + 0.5) * window.innerWidth, y: (1 - (cy / cw * 0.5 + 0.5)) * window.innerHeight }
    }
  })
  const pt = await page.evaluate(() => window.__project(window.__cam, 14, 0.02, 3.9))
  await page.mouse.click(Math.round(pt.x), Math.round(pt.y))
  await page.waitForTimeout(9000)

  const info = await page.evaluate(() => {
    const scene = window.__st
    const out = { skinned: 0, meshes: 0, near: [], cam: null, roam: null }
    out.cam = { x: +window.__cam.position.x.toFixed(2), y: +window.__cam.position.y.toFixed(2), z: +window.__cam.position.z.toFixed(2) }
    const r = window.__roam
    if (r) {
      out.roam = {
        pos: [+r.position.current.x.toFixed(2), +r.position.current.z.toFixed(2)],
        target: r.target.current ? [+r.target.current.x.toFixed(2), +r.target.current.z.toFixed(2)] : null,
        focus: r.focus?.current ? [+r.focus.current.x.toFixed(2), +r.focus.current.z.toFixed(2)] : null,
        heading: +(r.heading?.current ?? 0).toFixed(2),
      }
    }
    scene.traverse((o) => {
      if (o.isSkinnedMesh) {
        out.skinned++
        const p = new o.position.constructor()
        o.getWorldPosition(p)
        if (Math.abs(p.x - 14) < 4 && Math.abs(p.z - 7.4) < 4) {
          out.near.push({
            name: o.name || '(anon)',
            pos: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
            visible: o.visible,
            parentVisible: o.parent?.visible,
            parentName: o.parent?.name || '(anon)',
            scale: [+o.scale.x.toFixed(3), +o.scale.y.toFixed(3), +o.scale.z.toFixed(3)],
            matType: o.material?.type,
          })
        }
      }
      if (o.isMesh) out.meshes++
    })
    // 摊位占位人形（capsule/sphere）是否在
    out.placeholderCapsules = 0
    scene.traverse((o) => { if (o.isMesh && o.geometry?.type === 'CapsuleGeometry') out.placeholderCapsules++ })
    return out
  })
  console.log(JSON.stringify(info, null, 2))
  console.log('ERRORS:', errors.slice(0, 12))
  await browser.close()
})().catch((e) => { console.error('FATAL', e); process.exit(1) })
