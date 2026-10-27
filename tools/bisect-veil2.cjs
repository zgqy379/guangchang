// 白幕终极二分（夜间 focus 态）：隐藏全部透明网格 → 按组恢复
const { chromium } = require('C:/Users/dqy/.workbuddy/binaries/node/workspace/node_modules/playwright')
;(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: false, args: ['--disable-gpu-sandbox', '--enable-unsafe-swiftshader'] })
  const p = await (await b.newContext({ viewport: { width: 1527, height: 943 } })).newPage()
  await p.goto('http://localhost:4173/', { waitUntil: 'load', timeout: 60000 })
  await p.waitForSelector('.gc-role-gate, .mode-switch', { timeout: 30000 })
  if (await p.locator('.gc-role-gate').count()) await p.evaluate(() => { const c = document.querySelector('.gc-role-card--candidate') || document.querySelector('.gc-role-card'); if (c) c.click() })
  await p.waitForSelector('.mode-switch', { timeout: 30000 })
  for (let i = 0; i < 3; i++) {
    const t = await p.evaluate(() => document.querySelector('.app').getAttribute('data-theme'))
    if (t === 'dark') break
    await p.evaluate(() => { const x = [...document.querySelectorAll('.mode-switch .theme-lock')].find((x) => (x.getAttribute('aria-label') || '').startsWith('主题')); if (x) x.click() })
    await p.waitForTimeout(700)
  }
  await p.evaluate(() => { const x = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('招聘街区')); if (x) x.click() })
  await p.waitForFunction(() => !!window.__st, undefined, { timeout: 60000 })
  await p.waitForTimeout(6000)
  // 走到摊位（对齐 shoot 流程）
  await p.evaluate(() => {
    window.__project = function (cam, x, y, z) {
      const e = cam.matrixWorldInverse.elements
      const vx = e[0] * x + e[4] * y + e[8] * z + e[12]
      const vy = e[1] * x + e[5] * y + e[9] * z + e[13]
      const vz = e[2] * x + e[6] * y + e[10] * z + e[14]
      const pr = cam.projectionMatrix.elements
      const c = document.querySelector('canvas')
      const r = c.getBoundingClientRect()
      return { x: r.left + ((pr[0] * vx) / -vz * 0.5 + 0.5) * r.width, y: r.top + (1 - ((pr[5] * vy) / -vz * 0.5 + 0.5)) * r.height }
    }
    const pt = window.__project(window.__cam, 14, 0.02, 3.9)
    const el = document.elementFromPoint(pt.x, pt.y) || document.querySelector('canvas')
    const opt = { bubbles: true, clientX: pt.x, clientY: pt.y, pointerId: 1, isPrimary: true, button: 0 }
    el.dispatchEvent(new PointerEvent('pointerdown', opt))
    el.dispatchEvent(new PointerEvent('pointerup', opt))
    el.dispatchEvent(new MouseEvent('click', opt))
  })
  await p.waitForTimeout(6000)
  const shoot = (n) => p.screenshot({ path: 'tmp-design-review/veil-' + n + '.png' }).then(() => console.log('✓', n))
  // 收集所有透明网格 + 所属组件线索（name/geometry）
  const report = await p.evaluate(() => {
    const list = []
    window.__st.traverse((o) => {
      const m = o.material
      if (m && m.transparent && o.type === 'Mesh') {
        list.push({ idx: list.length, w: o.geometry?.parameters?.width, h: o.geometry?.parameters?.height, op: m.opacity, color: '#' + (m.color ? m.color.getHexString() : '?'), blending: m.blending, name: o.name || '' })
        o.visible = false
      }
    })
    return list
  })
  console.log('hidden transparent meshes:', report.length)
  console.log(JSON.stringify(report.slice(0, 40), null, 1))
  await shoot('A-allhidden')
  // 分三批恢复：按 idx 奇偶与范围
  const reveal = async (idxList) => p.evaluate(({ idxList }) => {
    const arr = []
    window.__st.traverse((o) => {
      const m = o.material
      if (m && m.transparent && o.type === 'Mesh') arr.push(o)
    })
    idxList.forEach((i) => { if (arr[i]) arr[i].visible = true })
  }, { idxList })
  const n = report.length
  await reveal(Array.from({ length: n }, (_, i) => i).filter((i) => i % 2 === 0))
  await p.waitForTimeout(300); await shoot('B-even')
  await reveal(Array.from({ length: n }, (_, i) => i).filter((i) => i % 2 === 1))
  await p.waitForTimeout(300); await shoot('C-all-restored')
  await b.close()
})().catch((e) => { console.error(e); process.exit(1) })
