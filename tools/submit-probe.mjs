// 官网「修改提交」表单结构探测（只读，不点提交）
const task = await taskSpace('gc-submit-probe-' + Date.now());
const page = task.page('p1');
const fs = await import('node:fs');
const OUT = 'E:/guangchang/docs/loop/submit-probe.json';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await page.goto('https://www.aholo3d.cn/hackathon/my', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
await wait(4500);
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button, a')].find((e) => (e.textContent || '').trim() === '修改提交');
  b?.click();
}).catch(() => {});
await wait(4000);

const info = await page.evaluate(() => ({
  url: location.href,
  title: document.title,
  inputs: [...document.querySelectorAll('input')].map((i) => ({
    type: i.type, accept: i.accept || '', placeholder: i.placeholder || '',
    value: (i.value || '').slice(0, 120), checked: i.checked, cls: (i.className || '').slice(0, 60),
  })),
  textareas: [...document.querySelectorAll('textarea')].map((t) => ({ placeholder: t.placeholder || '', value: (t.value || '').slice(0, 100) })),
  selects: [...document.querySelectorAll('select')].map((s) => (s.value || '').slice(0, 80)),
  buttons: [...document.querySelectorAll('button, a')].map((b) => (b.innerText || '').trim()).filter(Boolean).slice(0, 60),
  text: (document.body?.innerText || '').slice(0, 1800),
})).catch((e) => ({ error: String(e?.message || e) }));

fs.writeFileSync(OUT, JSON.stringify(info, null, 2) + '\n');
console.log(JSON.stringify(info));
await task.finish({ keep: 'all' });
