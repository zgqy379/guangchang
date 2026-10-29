// 魔搭创空间部署入口探针：等 SPA 渲染完 → 列出可点控件 + 部署状态文案
// 用途：确认登录态、当前状态（运行中/未部署）、以及「重新部署」按钮是否存在。
// 配方见 docs/lessons.md §7.4 / §13.7
const task = await taskSpace('ms-probe-' + Date.now());
const page = task.page('p1');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  await page.goto('https://modelscope.cn/studios/zgqy379/guangchang3d/settings', { timeout: 60000 });
} catch (e) {
  console.error('goto timeout (继续):', String(e).slice(0, 80));
}
await wait(12000);
// 触发懒加载：滚动几屏
for (let i = 0; i < 4; i++) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
  await wait(1500);
}

const info = await page.evaluate(() => {
  const body = document.body.innerText || '';
  const btns = [...document.querySelectorAll('button, a, [role="button"], [class*="btn"]')]
    .filter((e) => e.offsetParent)
    .map((e) => ({
      tag: e.tagName,
      cls: (e.className || '').toString().slice(0, 44),
      text: (e.textContent || '').trim().slice(0, 30),
    }))
    .filter((x) => x.text)
    .slice(0, 30);
  return {
    url: location.href,
    len: body.length,
    hasLogin: body.includes('登录'),
    hasRedeploy: body.includes('重新部署'),
    status: (body.match(/运行中|未部署|构建中|Creating/gi) || []).slice(0, 3),
    body: body.slice(0, 900),
    btns,
  };
}).catch((e) => ({ err: String(e).slice(0, 200) }));

console.log('=== INFO ===');
console.log(JSON.stringify(info, null, 1));
await task.finish({ keep: 'all' });
