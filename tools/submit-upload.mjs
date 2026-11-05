// 官网「修改提交」：上传报告 v3.6 + 重勾须知，输出复核状态（本脚本不点提交）
const task = await taskSpace('gc-submit-v36');
const page = task.page('p1');
const fs = await import('node:fs');
const OUT = 'E:/guangchang/docs/loop/submit-upload.json';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PDF = 'E:/guangchang/docs/report.pdf';

await page.goto('https://www.aholo3d.cn/hackathon/my', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
await wait(4500);
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button, a')].find((e) => (e.textContent || '').trim() === '修改提交');
  b?.click();
}).catch(() => {});
await wait(4000);

let upload = {};
try {
  // 先点「更换」确保上传控件处于可写状态
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button, a, span')].find((e) => (e.textContent || '').trim() === '更换' && e.children.length === 0);
    b?.click();
  });
  await wait(1200);
  const doc = await page.cdp('DOM.getDocument', { depth: 1 });
  const q = await page.cdp('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'input[type="file"][accept*="pdf"]' });
  if (!q?.nodeId) throw new Error('未找到 PDF 上传控件');
  await page.cdp('DOM.setFileInputFiles', { nodeId: q.nodeId, files: [PDF] });
  upload = { ok: true, file: PDF, bytes: fs.statSync(PDF).size };
} catch (e) {
  upload = { ok: false, error: String(e?.message || e) };
}
await wait(12000);

// 重勾「已阅读并同意须知」（草稿不保存该勾选）——只勾 value=on 且未勾选的
await page.evaluate(() => {
  [...document.querySelectorAll('input[type="checkbox"]')]
    .filter((b) => b.value === 'on' && !b.checked)
    .forEach((b) => b.click());
}).catch(() => {});
await wait(2000);

const state = await page.evaluate(() => {
  const text = document.body?.innerText || '';
  return {
    url: location.href,
    reportLine: (text.match(/report\.pdf[^\n]*/) || [])[0] || null,
    sizeLine: (text.match(/\d+(\.\d+)?\s*MB/) || [])[0] || null,
    checkboxes: [...document.querySelectorAll('input[type="checkbox"]')].map((b) => ({ v: b.value, checked: b.checked })),
    buttons: [...document.querySelectorAll('button')].map((b) => (b.innerText || '').trim()).filter(Boolean).slice(-14),
    tail: text.slice(-700),
  };
}).catch((e) => ({ error: String(e?.message || e) }));

fs.writeFileSync(OUT, JSON.stringify({ upload, state }, null, 2) + '\n');
console.log(JSON.stringify({ upload, state }));
await task.finish({ keep: 'all' });
