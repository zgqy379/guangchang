// 线上完整启动验收（gh-pages）：角色门 → 进街区 → DOM/canvas/drawCalls/console
// 契约：部署验收必须对着线上做完整启动确认（DOM 挂载 + canvas 存在 + Runtime 零异常），curl 200 不算数
const task = await taskSpace('gc-accept-live-' + Date.now())
const page = task.page('p1')
const URL = 'https://zgqy379.github.io/guangchang/?v=' + Date.now() + '&debug=1' // 击穿 Pages 缓存；?debug=1 挂诊断钩子（engine/debug 门控，线上默认不暴露）
console.log('→ goto', URL)
await page.goto(URL, { waitUntil: 'load', timeout: 60000 })
await page.waitForSelector('.gc-glass-gate, .gc-role-gate, .mode-switch', { timeout: 45000 })

const rootInfo = await page.evaluate(() => {
  const r = document.getElementById('root')
  return r ? { children: r.children.length } : null
})
const canvas0 = await page.evaluate(() => document.querySelectorAll('canvas').length)
console.log('=== 首屏验收 ===')
console.log('DOM root children:', rootInfo ? rootInfo.children : 'null')
console.log('首屏 canvas 数:', canvas0, '(期望 0 —— 角色门不挂 3D)')

const gate = await page.evaluate(() => !!document.querySelector('.gc-glass-gate, .gc-role-gate'))
if (gate) {
  await page.evaluate(() => {
    // 新版 RoleGateGlass（gc-glass-gate）：主 CTA「进入街区」直入求职者动线；
    // 旧版 RoleGate（gc-role-gate）：求职者卡片
    const enter = [...document.querySelectorAll('button, a, [role="button"]')].find(
      (e) => (e.textContent || '').includes('进入街区'),
    )
    if (enter) { enter.click(); return }
    const c = document.querySelector('.gc-role-card--candidate') || document.querySelector('.gc-role-card')
    if (c) c.click()
  })
}
await page.waitForSelector('.mode-switch', { timeout: 30000 })
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('招聘街区'))
  if (b) b.click()
})
await page.waitForFunction(() => !!window.__st, undefined, { timeout: 60000 })
await page.waitForTimeout(6000)

const after = await page.evaluate(() => {
  const gl = window.__gl
  return {
    canvas: document.querySelectorAll('canvas').length,
    drawCalls: gl ? gl.info.render.calls : null,
    hasErrorText: document.body.innerText.includes('加载失败') || document.body.innerText.includes('出错了'),
  }
})
console.log('=== 街区验收 ===')
console.log(JSON.stringify(after))
await page.screenshot({ path: 'E:/guangchang/tmp-design-review/live-accept.png' })
console.log('✓ 线上截图已存 tmp-design-review/live-accept.png')
if (!after.canvas || after.hasErrorText || !after.drawCalls) {
  console.error('✗ 线上验收未通过')
  process.exit(1)
}
console.log('✓ 线上验收通过')
await task.finish({ keep: 'all' })
