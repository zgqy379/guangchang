// 只读定位：小红书草稿状态 + 编辑页含「发布」的叶子元素与页面末尾文本
const task = await taskSpace('gc-xhs-locate-' + Date.now());
const page = task.page('p1');
const fs = await import('node:fs');
const OUT = 'E:/guangchang/docs/loop/xhs-locate.json';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const out = {};

try { await page.cdp('Browser.setPermission', { permission: { name: 'geolocation' }, setting: 'denied', origin: 'https://creator.xiaohongshu.com' }); } catch (e) {}
await page.goto('https://creator.xiaohongshu.com/publish/publish', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
await wait(4500);
out.home = await page.evaluate(() => (document.body?.innerText || '').slice(0, 500));

// 打开草稿箱
await page.evaluate(() => {
  const el = [...document.querySelectorAll('*')].find((e) => /草稿箱/.test(e.innerText || '') && e.children.length <= 2);
  el?.click();
});
await wait(3500);
out.draftPanel = await page.evaluate(() => ({
  url: location.href,
  text: (document.body?.innerText || '').slice(0, 1200),
  buttons: [...document.querySelectorAll('button')].map((b) => (b.innerText || '').trim()).filter(Boolean).slice(0, 40),
}));

// 尝试打开第一篇草稿进入编辑态
await page.evaluate(() => {
  const c = [...document.querySelectorAll('*')].find((e) => /把 offer 砌成/.test(e.innerText || '') && e.children.length <= 3);
  c?.click();
});
await wait(5000);
out.editor = await page.evaluate(() => {
  const leaves = [...document.querySelectorAll('*')].filter((e) => e.children.length === 0 && /发布/.test(e.innerText || ''));
  return {
    url: location.href,
    tail: (document.body?.innerText || '').slice(-1200),
    publishLeaves: leaves.map((e) => ({
      tag: e.tagName, cls: (e.className || '').toString().slice(0, 60),
      text: (e.innerText || '').trim().slice(0, 40), top: Math.round(e.getBoundingClientRect().top),
    })).slice(0, 30),
    buttons: [...document.querySelectorAll('button')].map((b) => (b.innerText || '').trim()).filter(Boolean),
  };
});

fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out).slice(0, 2000));
await task.finish({ keep: [] });
