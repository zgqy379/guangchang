// egolite 街区截图管线 v1 —— 契约指定通道（Chrome 版 shoot-street.cjs 的等价移植）
// 产出：昼4 + 夜4 + 移动6 = 14 张 → docs/figures/street-2026-10-27-polish9/
// 运行：cmd /c "ego-browser nodejs < E:\guangchang\tools\shoot-ego-street.mjs"
const OUT = 'E:/guangchang/docs/figures/street-2026-10-27-polish9'
const URL = 'http://localhost:4173/'
const fs = await import('node:fs/promises')
await fs.mkdir(OUT, { recursive: true })

const task = await taskSpace('gc-shoot-ego-' + Date.now())
const page = task.page('p1')
console.log('taskSpace:', task.spaceId)

const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log('  ✓', name)
}
const dc = async () => page.evaluate(() => (window.__gl ? window.__gl.info.render.calls : -1))
const enterStreet = async () => {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('招聘街区'))
    if (b) b.click()
  })
  await page.waitForFunction(() => !!window.__st, undefined, { timeout: 60000 })
  await page.waitForTimeout(5000)
}
const setTheme = async (want) => {
  for (let i = 0; i < 3; i++) {
    const cur = await page.evaluate(() => document.querySelector('.app').getAttribute('data-theme'))
    if (cur === want) return cur
    // .theme-lock 类名被主题钮与角色钮共用 → 按 aria-label 前缀精确点击（盲审管线修复）
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('.mode-switch .theme-lock')].find((x) => (x.getAttribute('aria-label') || '').startsWith('主题'))
      if (b) b.click()
    })
    await page.waitForTimeout(800)
  }
  return page.evaluate(() => document.querySelector('.app').getAttribute('data-theme'))
}
// 地面点击 → R3F 指针事件（pointerdown/up/click 序列）
const groundClick = async (wx, wz) => {
  const pt = await page.evaluate(([x, z]) => {
    const c = document.querySelector('canvas')
    const r = c.getBoundingClientRect()
    const e = window.__cam.matrixWorldInverse.elements
    const vx = e[0] * x + e[4] * 0.02 + e[8] * z + e[12]
    const vy = e[1] * x + e[5] * 0.02 + e[9] * z + e[13]
    const vz = e[2] * x + e[6] * 0.02 + e[10] * z + e[14]
    const p = window.__cam.projectionMatrix.elements
    const cx = p[0] * vx, cy = p[5] * vy, cw = -vz
    return { x: r.left + (cx / cw * 0.5 + 0.5) * r.width, y: r.top + (1 - (cy / cw * 0.5 + 0.5)) * r.height }
  }, [wx, wz])
  await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y) || document.querySelector('canvas')
    const opt = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, isPrimary: true, button: 0 }
    el.dispatchEvent(new PointerEvent('pointerdown', opt))
    el.dispatchEvent(new PointerEvent('pointerup', opt))
    el.dispatchEvent(new MouseEvent('click', opt))
  }, [pt.x, pt.y])
  return pt
}
const deliverClick = async () => {
  return page.evaluate(() => {
    const b = [...document.querySelectorAll('.lot-card-dock button')].find((x) => x.textContent.includes('投简历'))
    if (b) { b.click(); return true }
    return false
  })
}
const gateThenStreet = async () => {
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 })
  await page.waitForSelector('.gc-role-gate, .mode-switch', { timeout: 30000 })
  const gate = await page.evaluate(() => !!document.querySelector('.gc-role-gate'))
  if (gate) {
    const ok = await page.evaluate(() => {
      const c = document.querySelector('.gc-role-card--candidate') || document.querySelector('.gc-role-card')
      if (c) { c.click(); return true }
      return false
    })
    if (!ok) console.log('  !! 角色门点击失败')
  }
  await page.waitForSelector('.mode-switch', { timeout: 30000 })
}

// ---------- 昼（light）----------
console.log('→ 昼')
await gateThenStreet()
await setTheme('light')
await enterStreet()
await shot('hero')
console.log('  hero drawCalls:', await dc())
const pt = await groundClick(14, 3.9)
console.log('  ground click:', JSON.stringify(pt))
await page.waitForTimeout(2600)
await shot('walk')
try { await page.waitForFunction(() => window.__roam && !window.__roam.target.current, undefined, { timeout: 30000 }) } catch (e) { console.log('  !! 玩家未到位') }
await page.waitForTimeout(2500)
await shot('focus')
if (await deliverClick()) await page.waitForTimeout(850)
await shot('deliver')

// ---------- 夜（dark，重载取干净状态）----------
console.log('→ 夜')
await page.reload({ waitUntil: 'load' })
await page.waitForSelector('.gc-role-gate, .mode-switch', { timeout: 30000 })
if (await page.evaluate(() => !!document.querySelector('.gc-role-gate'))) await page.evaluate(() => { const c = document.querySelector('.gc-role-card--candidate') || document.querySelector('.gc-role-card'); if (c) c.click() })
await page.waitForSelector('.mode-switch', { timeout: 30000 })
console.log('  theme =', await setTheme('dark'))
await enterStreet()
await shot('night/hero')
console.log('  night hero drawCalls:', await dc())
await groundClick(14, 3.9)
await page.waitForTimeout(2600)
await shot('night/walk')
try { await page.waitForFunction(() => window.__roam && !window.__roam.target.current, undefined, { timeout: 30000 }) } catch (e) {}
await page.waitForTimeout(2500)
await shot('night/focus')
if (await deliverClick()) await page.waitForTimeout(850)
await shot('night/deliver')

// ---------- 移动端（390×844，CDP 视口，白天）----------
console.log('→ 移动')
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
await page.reload({ waitUntil: 'load' })
await page.waitForSelector('.gc-role-gate, .mode-switch', { timeout: 30000 })
if (await page.evaluate(() => !!document.querySelector('.gc-role-gate'))) await page.evaluate(() => { const c = document.querySelector('.gc-role-card--candidate') || document.querySelector('.gc-role-card'); if (c) c.click() })
await page.waitForSelector('.mode-switch', { timeout: 30000 })
await setTheme('light')
await enterStreet()
await shot('mobile/hero')
await groundClick(14, 3.9)
await page.waitForTimeout(2600)
await shot('mobile/walk')
try { await page.waitForFunction(() => window.__roam && !window.__roam.target.current, undefined, { timeout: 30000 }) } catch (e) {}
await page.waitForTimeout(2200)
await shot('mobile/focus')
if (await deliverClick()) await page.waitForTimeout(850)
await shot('mobile/deliver')
await shot('mobile/mobile-collapsed')
await page.click('.gc-nav-toggle')
await page.waitForTimeout(900)
await shot('mobile/mobile-expanded')
await page.cdp('Emulation.clearDeviceMetricsOverride')
console.log('=== DONE: 14 shots →', OUT)
