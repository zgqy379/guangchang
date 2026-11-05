// 小红书图文：上传 3 张配图（固定 TaskSpace，后续脚本 resume 同名继续填表）
// 不点发布。CDP DOM.setFileInputFiles 走本地绝对路径，不经手任何账号凭据。
const task = await taskSpace('gc-xhs-publish');
const page = task.page('p1');
const fs = await import('node:fs');
const OUT = 'E:/guangchang/docs/loop/xhs-upload.json';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const files = [
  'E:/guangchang/web/public/og-image.png',
  'E:/guangchang/docs/figures/street-2026-11-04-r19/day-bird.png',
  'E:/guangchang/docs/figures/street-2026-11-04-r19/night-bird.png',
];

await page.goto('https://creator.xiaohongshu.com/publish/publish', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
await wait(4500);
await page.evaluate(() => {
  const el = [...document.querySelectorAll('*')].find((e) => (e.textContent || '').trim() === '上传图文' && e.children.length === 0);
  el?.click();
}).catch(() => {});
await wait(3500);

let upload = {};
try {
  const doc = await page.cdp('DOM.getDocument', { depth: 1 });
  const q = await page.cdp('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'input.upload-input' });
  if (!q?.nodeId) throw new Error('未找到 input.upload-input');
  await page.cdp('DOM.setFileInputFiles', { nodeId: q.nodeId, files });
  upload = { ok: true, count: files.length, nodeId: q.nodeId };
} catch (e) {
  upload = { ok: false, error: String(e?.message || e) };
}
await wait(11000);

const info = await page.evaluate(() => ({
  url: location.href,
  inputs: [...document.querySelectorAll('input')].filter((i) => i.type !== 'file').map((i) => ({
    type: i.type, placeholder: i.placeholder || '', maxlength: i.maxLength, cls: (i.className || '').slice(0, 80),
  })),
  textareas: [...document.querySelectorAll('textarea')].map((t) => ({ placeholder: t.placeholder || '' })),
  editable: [...document.querySelectorAll('[contenteditable="true"]')].map((e) => ({
    tag: e.tagName, cls: (e.className || '').slice(0, 80), text: (e.innerText || '').slice(0, 60),
  })),
  buttons: [...document.querySelectorAll('button')].map((b) => (b.innerText || '').trim()).filter(Boolean).slice(0, 40),
  imgs: document.querySelectorAll('img').length,
  text: (document.body?.innerText || '').slice(0, 1200),
})).catch((e) => ({ error: String(e?.message || e) }));

fs.writeFileSync(OUT, JSON.stringify({ upload, info }, null, 2) + '\n');
console.log(JSON.stringify({ upload, info }));
await task.finish({ keep: 'all' });
