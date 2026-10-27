// 魔搭「重新部署→确认部署」——免 cookie 版：依赖 ego lite 配置文件自带的魔搭登录态
// （ms-cookies.json 已被清理时的替代通道，配方 docs/lessons.md §7.4）
// 任一关键步骤失败 → process.exit(1)
const task = await taskSpace('ms-redeploy-ego-' + Date.now())
const page = task.page('p1')

await page.goto('https://modelscope.cn/studios/zgqy379/guangchang3d/settings', { timeout: 60000 })
await page.waitForTimeout(6000)

// 登录态检查：页面若跳登录墙则终止
const loginWall = await page.evaluate(() => document.body.innerText.includes('登录') && !document.body.innerText.includes('重新部署'))
if (loginWall) {
  console.error('✗ 登录态失效（egolite 配置文件无魔搭登录态）——请先在 ego lite 里登录魔搭')
  process.exit(1)
}

const clicked = await page.evaluate(() => {
  // 「重新部署」控件非标准 button（可能是 span/div），全元素精确文本匹配取最内层
  const els = [...document.querySelectorAll('*')].filter(
    (e) => (e.textContent || '').trim() === '重新部署' && e.offsetParent && e.children.length === 0,
  )
  const el = els[els.length - 1]
  if (el) { el.click(); return true }
  return false
})
console.log('redeploy clicked', clicked)
if (!clicked) {
  console.error('✗ 找不到「重新部署」按钮（登录态失效或页面结构变更）')
  process.exit(1)
}

await page.waitForTimeout(2500)
const confirmed = await page.evaluate(() => {
  const els = [...document.querySelectorAll('*')].filter(
    (e) => (e.textContent || '').trim() === '确认部署' && e.offsetParent && e.children.length === 0,
  )
  const el = els[els.length - 1]
  if (el) { el.click(); return true }
  return false
})
console.log('confirm clicked', confirmed)
if (!confirmed) {
  console.error('✗ 找不到「确认部署」按钮')
  process.exit(1)
}

await page.waitForTimeout(6000)
const submitted = await page.evaluate(() => document.body.innerText.includes('重新部署已提交'))
if (!submitted) {
  console.error('✗ 未检测到「重新部署已提交」文案（部署可能未提交成功）')
  process.exit(1)
}
console.log('✓ ms-redeploy-ego 完成：已提交重新部署')
await task.finish({ keep: 'all' })
