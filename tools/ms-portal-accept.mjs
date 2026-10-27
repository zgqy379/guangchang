// 魔搭门户 ?mode=full 实况验收截图（iframe 内跑 ms.show 应用）
const task = await taskSpace('ms-portal-accept-' + Date.now())
const page = task.page('p1')
await page.goto('https://modelscope.cn/studios/zgqy379/guangchang3d?mode=full', { timeout: 60000 })
await page.waitForTimeout(30000)
await page.screenshot({ path: 'E:/guangchang/tmp-design-review/ms-portal-accept2.png' })
console.log('✓ portal 截图2已存（25s）')
await task.finish({ keep: 'all' })
