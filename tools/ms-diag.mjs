// 诊断：魔搭设置页实况截图 + 文本摘要
const task = await taskSpace('ms-diag-' + Date.now())
const page = task.page('p1')
await page.goto('https://modelscope.cn/studios/zgqy379/guangchang3d/settings', { timeout: 60000 })
await page.waitForTimeout(9000)
await page.screenshot({ path: 'E:/guangchang/tmp-design-review/ms-settings-diag.png' })
const info = await page.evaluate(() => ({
  url: location.href,
  text: document.body.innerText.slice(0, 400),
  buttons: [...document.querySelectorAll('button, a, div[role="button"]')].map((b) => (b.textContent || '').trim()).filter((t) => t && t.length < 14).slice(0, 24),
}))
console.log(JSON.stringify(info, null, 1))
await task.finish({ keep: 'all' })
