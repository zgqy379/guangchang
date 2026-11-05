// 移动端体验修复验收（2026-11-05）：两条独立用例
// A. GLB 加载失败降级：拦截 HR/avatar GLB 请求 → 进入街区 → 必须出现占位人形且整页不崩
// B. 移动端布局：CDP 模拟 390×844 视口 → 进入街区 → HUD/CTA/按钮不得再占掉半屏
// 合规（docs/lessons.md §13.13）：固定空间名，结束 finish({keep:[]})。
const task = await taskSpace('gc-mobile-ux');
const page = task.page('p1');
const fs = await import('node:fs');
const OUT = 'E:/guangchang/docs/loop/mobile-ux-accept.json';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const result = { a: null, b: null, steps: [] };
const note = (s) => { result.steps.push(s); console.log(s); };
const shot = async (p) => {
  const cap = await page.cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(p, Buffer.from(cap.data, 'base64'));
};
const clickByText = (text) =>
  page.evaluate((t) => {
    const hits = [...document.querySelectorAll('button, a, div, span')].filter((e) => {
      const x = (e.innerText || '').trim()
      const r = e.getBoundingClientRect()
      return x.includes(t) && x.length <= t.length + 8 && r.width > 40 && r.height > 16
    })
    const el = hits[hits.length - 1]
    if (el) {
      el.click()
      return (el.innerText || '').trim()
    }
    return ''
  }, text);

let finished = false;
try {
  // ── 用例 A：GLB 拦截 → 降级而不崩 ──
  await page.goto('http://localhost:4173/?hour=10', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await wait(3500);
  // 拦截 HR 与 avatar GLB（模拟 5G fetch 失败）
  await page.cdp('Network.enable').catch(() => {});
  await page.cdp('Network.setBlockedURLs', { urls: ['*/assets/hr/*', '/assets/avatar/avatar-idle.glb', '/assets/avatar/avatar-walk.glb'] }).catch((e) => note('拦截设置失败: ' + String(e?.message || e).slice(0, 80)));
  note('已拦截 HR/avatar GLB 请求');
  note('点击进入: ' + ((await clickByText('继续')) || (await clickByText('进入街区'))));
  await wait(20000);
  const a = await page.evaluate(() => {
    const t = document.body?.innerText || ''
    return {
      url: location.href,
      hasCanvas: document.querySelectorAll('canvas').length,
      sceneFailed: /加载失败/.test(t),
      techDetailFolded: !!document.querySelector('details'),
      techDetail: (document.querySelector('details')?.textContent || '').slice(0, 400),
      bodyHasGlb: /\.glb/.test(t),
      text: t.slice(0, 500),
    }
  })
  await shot('E:/guangchang/docs/figures/mobile-2026-11-05/ux-a-glb-fallback.png')
  result.a = a
  note('用例A: ' + JSON.stringify(a))
  await page.cdp('Network.setBlockedURLs', { urls: [] }).catch(() => {})
  note('已解除拦截')

  // ── 用例 B：390×844 移动端视口布局 ──
  await page.cdp('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 3, mobile: true,
  })
  await page.goto('http://localhost:4173/?hour=10', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await wait(3500)
  await clickByText('进入街区')
  await wait(18000)
  const b = await page.evaluate(() => {
    const vw = window.innerWidth
    const rect = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
    }
    const btns = [...document.querySelectorAll('.mode-switch button')].map((e) => {
      const r = e.getBoundingClientRect()
      return { text: (e.innerText || '').trim(), w: Math.round(r.width), h: Math.round(r.height) }
    })
    return {
      viewport: { w: vw, h: window.innerHeight },
      hud: rect('.game-hud'),
      cta: rect('.street-cta'),
      legend: rect('.game-hud-legend'),
      buttons: btns,
      hudWidthRatio: rect('.game-hud') ? +(rect('.game-hud').w / vw).toFixed(2) : null,
      touchTargetOk: btns.every((x) => x.h >= 44),
    }
  })
  await shot('E:/guangchang/docs/figures/mobile-2026-11-05/ux-b-mobile-layout.png')
  result.b = b
  note('用例B: ' + JSON.stringify(b))

  result.pass =
    !!(result.a && !result.a.sceneFailed && result.a.hasCanvas > 0) &&
    !!(result.b && result.b.hudWidthRatio !== null && result.b.hudWidthRatio <= 0.5 && result.b.touchTargetOk)
} catch (e) {
  result.error = String(e?.message || e)
  note('异常: ' + result.error)
} finally {
  if (!finished) {
    finished = true
    try { await task.finish({ keep: [] }); note('空间已关闭'); } catch (e) { /* 忽略 */ }
  }
}
fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n')
console.log('PASS=' + result.pass)
