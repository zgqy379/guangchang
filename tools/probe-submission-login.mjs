// 提交前登录态探测（2026-11-05）：只读，不改任何账号状态。
// 官网「修改提交」与小红书发布都是真实账号动作，先确认浏览器会话是否仍登录。
const task = await taskSpace('gc-probe-login-' + Date.now());
const page = task.page('p1');
const fs = await import('node:fs');
const OUT = 'E:/guangchang/docs/loop/account-probe.json';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const targets = [
  ['hackathon', 'https://www.aholo3d.cn/hackathon/my'],
  ['xiaohongshu', 'https://creator.xiaohongshu.com/publish/publish'],
];
const results = {};
for (const [name, url] of targets) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (e) {
    results[name] = { error: String(e?.message || e).slice(0, 120) };
  }
  await wait(4000);
  try {
    const observed = await page.evaluate(() => ({
      url: location.href,
      title: document.title,
      text: (document.body?.innerText || '').slice(0, 400),
    }));
    results[name] = { ...(results[name] || {}), ...observed };
  } catch (e) {
    results[name] = { ...(results[name] || {}), evalError: String(e?.message || e).slice(0, 120) };
  }
}
fs.writeFileSync(OUT, JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results));
await task.finish({ keep: 'all' });
