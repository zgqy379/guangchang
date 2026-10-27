// 白幕二分：夜间轮流隐藏 玻璃/楼体/外溢面/发光点 各拍一张，定位白幕载体
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
  const shoot = (n) => p.screenshot({ path: 'tmp-design-review/bisect-' + n + '.png' }).then(() => console.log('✓', n))
  const setVis = (pred, vis) => p.evaluate(
    `[ (o) => (${pred}) ].forEach(() => {}) ` && undefined // noop guard
  ).catch(() => {})
  // 用字符串条件在页面内执行
  const apply = async (condSrc, vis) => {
    await p.evaluate(({ condSrc, vis }) => {
      const pred = eval(condSrc)
      window.__st.traverse((o) => { if (pred(o)) o.visible = vis })
    }, { condSrc, vis })
  }
  const glass = `(o) => o.geometry && o.geometry.parameters && o.geometry.parameters.width === 5.8 && o.geometry.parameters.height === 2.1`
  const body = `(o) => o.geometry && o.geometry.parameters && o.geometry.parameters.width === 6.4 && o.geometry.parameters.height === 1`
  const spill = `(o) => o.material && o.material.blending === 2 && o.geometry && o.geometry.parameters && o.geometry.parameters.width === 5.4`
  const glow = `(o) => o.geometry && o.geometry.parameters && o.geometry.parameters.width === 2.18 && o.geometry.parameters.height === 1.72`
  await shoot('0-base')
  await apply(glass, false); await p.waitForTimeout(300); await shoot('1-noglass')
  await apply(glass, true)
  await apply(body, false); await p.waitForTimeout(300); await shoot('2-nobody')
  await apply(body, true)
  await apply(spill, false); await apply(glow, false); await p.waitForTimeout(300); await shoot('3-nospillglow')
  await apply(spill, true); await apply(glow, true)
  await b.close()
})().catch((e) => { console.error(e); process.exit(1) })
