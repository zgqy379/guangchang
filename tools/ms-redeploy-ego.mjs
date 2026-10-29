// 魔搭「重新部署→确认部署」——免 cookie 版：依赖 ego lite 配置文件自带的魔搭登录态
// （ms-cookies.json 已被清理时的替代通道，配方 docs/lessons.md §7.4）
// 任一关键步骤失败 → process.exit(1)
const task = await taskSpace('ms-redeploy-ego-' + Date.now())
const page = task.page('p1')

try {
  await page.goto('https://modelscope.cn/studios/zgqy379/guangchang3d/settings', { timeout: 60000 })
} catch (e) {
  console.error('goto timeout (继续):', String(e).slice(0, 80))
}
// SPA 渲染慢：轮询等待「重新部署」控件出现（含滚动触发懒加载）
let clicked = false
for (let i = 0; i < 12 && !clicked; i++) {
  await page.waitForTimeout(3000)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {})
  clicked = await page.evaluate(() => {
    // 「重新部署」控件非标准 button（可能是 span/div），全元素精确文本匹配取最内层
    const els = [...document.querySelectorAll('*')].filter(
      (e) => (e.textContent || '').trim() === '重新部署' && e.offsetParent && e.children.length === 0,
    )
    const el = els[els.length - 1]
    if (el) { el.click(); return true }
    return false
  })
  if (!clicked) console.error('等待「重新部署」控件…', i + 1)
}
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
