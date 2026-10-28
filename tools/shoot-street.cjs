// 街区实拍脚本：1280×720 四张（hero / focus / walk / deliver）+ draw call 与 fps 实测
//
// 用法（web 目录下）：
//   npx vite preview --port 4173        # 另开一个终端
//   node ../tools/shoot-street.cjs --out ../docs/figures/street-2026-10-27 --label after
//
// 为什么用 CommonJS：Windows 下 ESM 导入需 file:// URL（lessons §8.5）
// 为什么用 headed Chrome：本机 headless Edge 的 WebGL 截图不可靠（team-lead 铁律）
const path = require('path')
const fs = require('fs')
const { chromium } = require('C:/Users/dqy/.workbuddy/binaries/node/workspace/node_modules/playwright')

const args = process.argv.slice(2)
function arg(name, def) {
  const i = args.indexOf('--' + name)
  return i >= 0 ? args[i + 1] : def
}
const OUT = path.resolve(arg('out', '../docs/figures/street-2026-10-27'))
const LABEL = arg('label', 'shot')
const URL = arg('url', 'http://localhost:4173/')
const THEME = arg('theme', 'light') // light | dark
const MOBILE = args.includes('--mobile')
const W = MOBILE ? 390 : Number(arg('w', 1280))
const H = MOBILE ? 844 : Number(arg('h', 720))

fs.mkdirSync(OUT, { recursive: true })

/** 在页面内做世界坐标 → 屏幕坐标投影（不依赖页面暴露 THREE）；显式挂 window，initScript 字符串按函数体执行 */
const PROJECT_FN = `
window.__project = function (cam, x, y, z) {
  const e = cam.matrixWorldInverse.elements
  const vx = e[0]*x + e[4]*y + e[8]*z + e[12]
  const vy = e[1]*x + e[5]*y + e[9]*z + e[13]
  const vz = e[2]*x + e[6]*y + e[10]*z + e[14]
  const p = cam.projectionMatrix.elements
  const cx = p[0]*vx, cy = p[5]*vy, cw = -vz
  // 注意：画布不是整个窗口（顶栏/页脚占位），必须用 canvas 的 rect 换算
  const c = document.querySelector('canvas')
  const r = c ? c.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
  return { x: r.left + (cx/cw*0.5+0.5)*r.width, y: r.top + (1-(cy/cw*0.5+0.5))*r.height }
}
window.__renderer = function () {
  if (window.__gl) return window.__gl
  const c = document.querySelector('canvas')
  if (!c) return null
  if (c.__r3f && c.__r3f.root && c.__r3f.root.getState) {
    try { const st = c.__r3f.root.getState(); if (st && st.gl) return st.gl } catch (e) {}
  }
  return null
}
`

async function measure(page, label) {
  // 采样前置前页面：Chrome 会把不可见页签的 rAF 限流到 ~1fps，
  // 不置前就会把真实 40fps 采成 1fps（历史上"越肩 13–14fps"的记录值即此污染）。
  await page.bringToFront().catch(() => {})
  return page.evaluate(
    async (tag) => {
      const gl = __renderer()
      // 采样 5 轮 × 60 帧，取各轮中位帧间隔；限流轮次（<5fps）单独记账后剔除
      const rounds = []
      let maxCalls = -1
      let minCalls = Infinity
      let maxTris = -1
      for (let round = 0; round < 5; round++) {
        const samples = []
        await new Promise((res) => {
          let n = 0
          let last = performance.now()
          const tick = () => {
            const now = performance.now()
            samples.push({
              calls: gl ? gl.info.render.calls : -1,
              tris: gl ? gl.info.render.triangles : -1,
              dt: now - last,
            })
            last = now
            if (++n < 60) requestAnimationFrame(tick)
            else res()
          }
          requestAnimationFrame(tick)
        })
        const dts = samples.slice(10).map((s) => s.dt).sort((a, b) => a - b)
        rounds.push(dts[Math.floor(dts.length / 2)] || 0)
        const cs = samples.map((s) => s.calls).filter((c) => c >= 0)
        const ts = samples.map((s) => s.tris).filter((c) => c >= 0)
        if (cs.length) { maxCalls = Math.max(maxCalls, ...cs); minCalls = Math.min(minCalls, ...cs) }
        if (ts.length) maxTris = Math.max(maxTris, ...ts)
      }
      rounds.sort((a, b) => a - b)
      // 帧间隔 > 250ms（≈<4fps）判为限流轮次：Chrome 不可见页签的典型特征，不参与中位数
      const clean = rounds.filter((d) => d > 0 && d <= 250)
      const throttled = rounds.length - clean.length
      const pool = clean.length ? clean : rounds
      const med = pool[Math.floor(pool.length / 2)] || 0
      return {
        tag,
        throttledRounds: clean.length ? throttled : rounds.length,
        drawCalls: maxCalls,
        drawCallsMin: minCalls === Infinity ? -1 : minCalls,
        triangles: maxTris,
        fps: med > 0 ? +(1000 / med).toFixed(1) : -1,
        fpsRounds: rounds.map((d) => (d > 0 ? +(1000 / d).toFixed(1) : -1)),
        memory: gl ? { geometries: gl.info.memory.geometries, textures: gl.info.memory.textures, programs: gl.info.programs?.length ?? -1 } : null,
        webgl2: gl ? gl.capabilities.isWebGL2 : null,
        renderer: gl ? (() => { try { const d = gl.getContext().getExtension('WEBGL_debug_renderer_info'); return d ? gl.getContext().getParameter(d.UNMASKED_RENDERER_WEBGL) : 'n/a' } catch (e) { return 'n/a' } })() : null,
      }
    },
    label
  )
}

async function shoot(page, name) {
  const file = path.join(OUT, `${name}.png`)
  // 截图同样会被"单帧迟迟不到"卡死（本机并发负载高时实测 TimeoutError 报废整轮）：
  // 置前重试一次并放宽超时——慢帧可以接受，静默拿空帧不行，整轮无声报废更不行。
  try {
    await page.screenshot({ path: file, timeout: 60000 })
  } catch (e) {
    console.log(`  · 截图超时（${name}），置前重试:`, String(e).slice(0, 70))
    await page.bringToFront().catch(() => {})
    await page.screenshot({ path: file, timeout: 120000 })
  }
  console.log('  ✓', path.relative(process.cwd(), file))
  return file
}

;(async () => {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--disable-gpu-sandbox', '--enable-unsafe-swiftshader'],
  })
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  // 诊断函数注入全局（投影/渲染器读取）
  await page.addInitScript(PROJECT_FN)
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)) })
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 200)))

  console.log('→ goto', URL)
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 })
  await page.waitForSelector('.mode-switch, .gc-role-gate, .gc-glass-gate', { timeout: 30000 })

  // 角色选择门（2026-10-27 由轨道B 引入）：先选「求职者」，再进街区。
  // 2026-10-29 起默认门为玻璃门（.gc-glass-gate），?gate=classic 才出现旧街景门
  const classicGate = await page.locator('.gc-role-gate').count()
  const glassGate = await page.locator('.gc-glass-gate').count()
  if (classicGate) {
    console.log('→ 检测到街景门（classic），选择「求职者」')
    const card = page.locator('.gc-role-card--candidate').first()
    if (await card.count()) await card.click()
    else await page.locator('.gc-role-card').first().click()
  } else if (glassGate) {
    console.log('→ 检测到玻璃门，点主 CTA 直接进街区')
    await page.locator('.gg-cta').first().click()
  }
  await page.waitForSelector('.mode-switch', { timeout: 30000 })

  // 主题锁定：auto → light → dark → auto。点一次即强制白天（孪生风主色）
  if (THEME === 'light') {
    await page.click('.theme-lock')
    await page.waitForTimeout(400)
  } else if (THEME === 'dark') {
    await page.click('.theme-lock')
    await page.waitForTimeout(300)
    await page.click('.theme-lock')
    await page.waitForTimeout(400)
  }

  // 进街区
  await page.getByRole('button', { name: /招聘街区/ }).click()
  console.log('→ 等待街区场景就绪')
  await page.waitForFunction(() => !!window.__st, null, { timeout: 60000 })
  // 等首帧：条件等待替代固定等待。headed Chrome 的页签被遮挡/最小化时 rAF 停摆，
  // __gl.info.render.calls 会恒为 0——此时截图是空帧、指标却是"正常数"（同源事故见 §11.3）。
  const firstFrame = async (budget) => page.waitForFunction(() => window.__gl && window.__gl.info.render.calls > 0, null, { timeout: budget })
  try {
    await firstFrame(20000)
  } catch (e) {
    const diag = await page.evaluate(() => ({
      visibility: document.visibilityState, hasFocus: document.hasFocus(),
      calls: window.__gl ? window.__gl.info.render.calls : -1,
    }))
    console.log('  · 首帧未到（页签可能被遮挡），前置窗口后重试:', JSON.stringify(diag))
    await page.bringToFront()
    await firstFrame(20000)
  }
  await page.waitForTimeout(4500) // 等 GLB / 贴图 / 阴影稳定

  const theme = await page.getAttribute('.app', 'data-theme')
  console.log('  主题 =', theme)

  // 就绪断言（与 lessons §11.3 同源事故）：空帧 / DC=0 时指标会伪装成正常值，
  // 必须在取数前确认画面真的在渲染，否则拒绝出数。
  const ready = await page.evaluate(() => {
    const gl = window.__gl
    return { gl: !!gl, calls: gl ? gl.info.render.calls : -1, canvas: document.querySelectorAll('canvas').length }
  })
  if (!ready.gl || ready.calls <= 0) {
    throw new Error(
      `街区未真正出画面：canvas=${ready.canvas} __gl=${ready.gl} drawCalls=${ready.calls} —— 拒绝在空帧上采集指标`,
    )
  }
  console.log(`  就绪 ✓ canvas=${ready.canvas} drawCalls=${ready.calls}`)

  // —— 1. hero（鸟瞰，未交互）——
  await shoot(page, 'hero')
  const hero = await measure(page, 'hero(鸟瞰)')

  // —— 2/3. walk（越肩行走）→ focus（摊位特写）——
  // 一次地面点击驱动两段：玩家从 (8,2) 走到 (14,3.9)，
  // 途中是越肩机位（walk），抵达后摊位在 3.5m 内 → 触发 3/4 特写（focus）。
  const groundClick = async (wx, wz) => {
    const pt = await page.evaluate(
      ([x, z]) => {
        const cam = window.__cam
        return __project(cam, x, 0.02, z)
      },
      [wx, wz]
    )
    if (pt.x < 0 || pt.y < 0 || pt.x > W || pt.y > H) {
      console.log(`  !! 目标点 (${wx},${wz}) 不在视口内：`, pt)
      return false
    }
    await page.mouse.click(Math.round(pt.x), Math.round(pt.y))
    return true
  }
  const clicked = await groundClick(14, 3.9)
  await page.waitForTimeout(2400)
  await shoot(page, 'walk')
  const walk = await measure(page, 'walk(越肩)')

  // 等玩家走到位（target 清空）+ 特写相机 lerp 到位
  try {
    await page.waitForFunction(() => window.__roam && !window.__roam.target.current, null, { timeout: 30000 })
    console.log('  玩家已到位')
  } catch (e) {
    console.log('  !! 玩家未在 30s 内到位')
  }
  await page.waitForTimeout(3000)
  const hasCard = await page.locator('.lot-card-dock').count()
  console.log('  名片卡 =', hasCard, '| 地面点击 =', clicked)
  await shoot(page, 'focus')
  const focus = await measure(page, 'focus(特写)')

  // —— 4. deliver（投递后）——
  const btn = page.locator('.lot-card-dock button', { hasText: '投简历' })
  if (await btn.count()) {
    await btn.first().click()
    await page.waitForTimeout(850)
    await shoot(page, 'deliver')
  } else {
    console.log('  !! 找不到投简历按钮')
    await shoot(page, 'deliver')
  }
  const deliver = await measure(page, 'deliver(投递)')

  // —— 布局量化验收（lessons §8.5：量化而非目测）——
  // ① 同侧浮层是否重叠（HUD vs 导航器 vs 名片卡）
  // ② SVG 罗盘文字是否被 viewBox 裁切（getBBox 越界）
  // ③ 是否有横向溢出
  // ④ 导航器面板的高度构成（回答"445px 都花在哪了"）
  const layout = await page.evaluate(() => {
    const rect = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { sel, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
    }
    const boxes = ['.game-hud', '.gc-nav', '.lot-card-dock', '.nav-stack'].map(rect).filter(Boolean)
    const overlaps = []
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]
        const b = boxes[j]
        // 父子关系不算压盖（.gc-nav 是 .nav-stack 的子元素，边界相同是正常的）
        const aEl = document.querySelector(a.sel)
        const bEl = document.querySelector(b.sel)
        if (aEl && bEl && (aEl.contains(bEl) || bEl.contains(aEl))) continue
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
        if (ox > 0 && oy > 0) overlaps.push({ a: a.sel, b: b.sel, ox: Math.round(ox), oy: Math.round(oy) })
      }
    }
    // SVG 文字越界检查
    const svg = document.querySelector('.gc-nav-compass')
    const clipped = []
    if (svg) {
      const vb = svg.viewBox.baseVal
      svg.querySelectorAll('text').forEach((t) => {
        const b = t.getBBox()
        if (b.x < 0 || b.y < 0 || b.x + b.width > vb.width || b.y + b.height > vb.height) {
          clipped.push({ text: t.textContent, x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) })
        }
      })
    }
    // 触控尺寸（≥22px 高）
    const small = []
    document.querySelectorAll('.gc-nav button, .gc-nav-toggle').forEach((b) => {
      const r = b.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) return
      if (r.height < 22 || r.width < 22) small.push({ cls: b.className, w: Math.round(r.width), h: Math.round(r.height) })
    })
    // 导航器高度构成
    const navParts = []
    const nav = document.querySelector('.gc-nav')
    if (nav) {
      for (const child of nav.children) {
        const r = child.getBoundingClientRect()
        navParts.push({
          cls: child.className || child.tagName,
          h: Math.round(r.height),
          visible: r.height > 0,
        })
      }
    }
    const navRect = nav ? nav.getBoundingClientRect() : null
    return {
      boxes,
      overlaps,
      clipped,
      small,
      navParts,
      navHeight: navRect ? Math.round(navRect.height) : -1,
      navBottom: navRect ? Math.round(navRect.bottom) : -1,
      viewportH: window.innerHeight,
      navOverflowsViewport: navRect ? navRect.bottom > window.innerHeight + 1 : false,
      hOverflow: document.documentElement.scrollWidth > window.innerWidth,
    }
  })
  console.log('\n=== LAYOUT ===')
  console.log(JSON.stringify(layout, null, 2))

  // —— 移动端专项（390×844）：折叠圆钮 / 展开浮层 与 名片卡 的关系 ——
  let mobile = null
  if (MOBILE) {
    const measureMobile = () =>
      page.evaluate(() => {
        const r = (sel) => {
          const el = document.querySelector(sel)
          if (!el) return null
          const b = el.getBoundingClientRect()
          return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }
        }
        const inter = (a, b) =>
          a && b
            ? {
                ox: Math.round(Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)),
                oy: Math.round(Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)),
              }
            : null
        const toggle = r('.gc-nav-toggle')
        const panel = r('.gc-nav')
        const card = r('.lot-card-dock')
        const hud = r('.game-hud')
        return {
          toggle,
          panel,
          card,
          hud,
          toggleVsCard: inter(toggle, card),
          toggleVsHud: inter(toggle, hud),
          panelVsCard: inter(panel, card),
          viewport: { w: window.innerWidth, h: window.innerHeight },
          hOverflow: document.documentElement.scrollWidth > window.innerWidth,
        }
      })
    mobile = { collapsed: await measureMobile() }
    await shoot(page, 'mobile-collapsed')
    // 导航器整块挂在 follow 态上（两段式相机：首次交互后才出现）。
    // 地面点击是合成的、不保证生效，所以这里显式把页面推进跟随态再点圆钮，
    // 而不是假设 .gc-nav-toggle 一定存在（此前 FATAL: waiting for locator）。
    if ((await page.locator('.gc-nav-toggle').count()) === 0) {
      console.log('  · 未进跟随态：点 .street-cta 进入（应用设计的首个交互入口）')
      const cta = page.locator('.street-cta')
      if ((await cta.count()) === 0) throw new Error('移动端既无 .gc-nav-toggle 也无 .street-cta：跟随态入口丢失')
      await cta.click()
      await page.waitForSelector('.gc-nav-toggle', { timeout: 15000 })
      await page.waitForTimeout(700)
      mobile.collapsed = await measureMobile() // 重测：跟随态才是移动端真实首屏
      await shoot(page, 'mobile-collapsed')
    }
    await page.click('.gc-nav-toggle')
    await page.waitForTimeout(700)
    mobile.expanded = await measureMobile()
    await shoot(page, 'mobile-expanded')
    console.log('\n=== MOBILE ===')
    console.log(JSON.stringify(mobile, null, 2))
  }

  const report = {
    label: LABEL,
    url: URL,
    theme,
    viewport: `${W}x${H}`,
    metrics: [hero, walk, focus, deliver],
    layout,
    mobile,
    consoleErrors: errors.slice(0, 10),
    out: OUT,
  }
  fs.writeFileSync(path.join(OUT, `metrics-${LABEL}.json`), JSON.stringify(report, null, 2))
  console.log('\n=== METRICS ===')
  console.log(JSON.stringify(report, null, 2))
  await browser.close()
})().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
