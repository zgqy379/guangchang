// 小红书发布页结构探测（只读，不点发布）：确认文件上传入口与表单字段
const task = await taskSpace('gc-xhs-probe-' + Date.now());
const page = task.page('p1');
const fs = await import('node:fs');
const OUT = 'E:/guangchang/docs/loop/xhs-probe.json';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await page.goto('https://creator.xiaohongshu.com/publish/publish', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
await wait(4500);
// 点「上传图文」进入图文发布
await page.evaluate(() => {
  const el = [...document.querySelectorAll('*')].find((e) => (e.textContent || '').trim() === '上传图文' && e.children.length === 0);
  el?.click();
}).catch(() => {});
await wait(3500);

const info = await page.evaluate(() => ({
  url: location.href,
  title: document.title,
  inputs: [...document.querySelectorAll('input')].map((i) => ({
    type: i.type, accept: i.accept || '', multiple: i.multiple,
    placeholder: i.placeholder || '', cls: (i.className || '').slice(0, 80),
  })),
  textareas: [...document.querySelectorAll('textarea')].map((t) => ({ placeholder: t.placeholder || '', cls: (t.className || '').slice(0, 80) })),
  contentEditable: [...document.querySelectorAll('[contenteditable="true"]')].length,
  buttons: [...document.querySelectorAll('button')].map((b) => (b.innerText || '').trim()).filter(Boolean).slice(0, 40),
  text: (document.body?.innerText || '').slice(0, 900),
})).catch((e) => ({ error: String(e?.message || e) }));

fs.writeFileSync(OUT, JSON.stringify(info, null, 2) + '\n');
console.log(JSON.stringify(info));
await task.finish({ keep: [] });
