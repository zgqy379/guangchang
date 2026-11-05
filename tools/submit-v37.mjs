// 官网「修改提交」第 4 版：上传报告书 v3.7（含移动端体验工程章节）
// 合规（docs/lessons.md §13.13）：固定空间名，结束 finish({keep:[]})。
const task = await taskSpace('gc-submit-v37');
const page = task.page('p1');
const fs = await import('node:fs');
const OUT = 'E:/guangchang/docs/loop/submit-v37.json';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PDF = 'E:/guangchang/docs/report.pdf';
const POST_URL = 'https://www.xiaohongshu.com/explore/6aec5119000000000602cd58';
const result = { submitted: false, steps: [] };
const note = (s) => { result.steps.push(s); console.log(s); };
let finished = false;

const snap = () => page.evaluate(() => {
  const text = document.body?.innerText || '';
  return {
    url: location.href,
    reportSize: (text.match(/(\d+(?:\.\d+)?)\s*MB/) || [])[0] || null,
    version: (text.match(/第\s*\d+\s*版[^\n]*/) || [])[0] || null,
    submitted: text.includes('已提交'),
    boxes: [...document.querySelectorAll('input[type="checkbox"]')].filter((b) => b.value === 'on').map((b) => b.checked),
    submitBtn: [...document.querySelectorAll('button')].some((b) => (b.innerText || '').trim() === '提交新版本'),
    urls: [...document.querySelectorAll('input[type="url"]')].map((i) => i.value || ''),
    tail: text.slice(-400),
  };
});

try {
  await page.goto('https://www.aholo3d.cn/hackathon/my', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await wait(5000);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button, a')].find((e) => (e.textContent || '').trim() === '修改提交');
    b?.click();
  });
  await wait(5000);

  // 上传 v3.7 PDF（点「更换」后 setFileInputFiles）
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button, a, span')].find((e) => (e.textContent || '').trim() === '更换' && e.children.length === 0);
    b?.click();
  });
  await wait(1200);
  const doc = await page.cdp('DOM.getDocument', { depth: 1 });
  const q = await page.cdp('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'input[type="file"][accept*="pdf"]' });
  if (!q?.nodeId) throw new Error('未找到 PDF 上传控件');
  await page.cdp('DOM.setFileInputFiles', { nodeId: q.nodeId, files: [PDF] });
  note('v3.7 PDF 已提交上传');
  await wait(16000);

  // 社交链接应保留；若被清空则补填
  const filled = await page.evaluate((postUrl) => {
    const list = [...document.querySelectorAll('input[type="url"]')];
    const hit = list.find((i) => !(i.value || '').trim());
    if (!hit) return { filled: false, all: list.map((i) => i.value) };
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(hit), 'value')?.set;
    if (setter) setter.call(hit, postUrl); else hit.value = postUrl;
    hit.dispatchEvent(new Event('input', { bubbles: true }));
    hit.dispatchEvent(new Event('change', { bubbles: true }));
    hit.dispatchEvent(new Event('blur', { bubbles: true }));
    return { filled: true, all: list.map((i) => i.value) };
  }, POST_URL);
  note('社交链接检查: ' + JSON.stringify(filled));
  await wait(1500);

  // 两个确认框（须知不随草稿保存）
  await page.evaluate(() => {
    [...document.querySelectorAll('input[type="checkbox"]')].filter((b) => b.value === 'on' && !b.checked).forEach((b) => b.click());
  });
  await wait(1500);
  const s = await snap();
  result.before = s;
  note('提交前: ' + JSON.stringify({ size: s.reportSize, boxes: s.boxes, btn: s.submitBtn, urls: s.urls, version: s.version }));

  const sizeOk = s.reportSize && parseFloat(s.reportSize) > 15;
  const boxesOk = s.boxes.length >= 2 && s.boxes.every(Boolean);
  const socialOk = s.urls.some((u) => u.includes('6aec5119000000000602cd58'));
  if (!sizeOk || !boxesOk || !socialOk || !s.submitBtn) {
    result.error = '前置校验未通过，未点提交: ' + JSON.stringify({ sizeOk, boxesOk, socialOk, btn: s.submitBtn });
    note(result.error);
  } else {
    const cap0 = await page.cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync('E:/guangchang/docs/figures/submit-v37-before.png', Buffer.from(cap0.data, 'base64'));
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === '提交新版本');
      b?.click();
    });
    note('已点击提交新版本');
    await wait(10000);
    const after = await snap();
    result.after = after;
    note('提交后: ' + JSON.stringify({ version: after.version, submitted: after.submitted, tail: after.tail.slice(0, 200) }));
    result.submitted = after.submitted || /第\s*4\s*版/.test(after.version || '');
    const cap1 = await page.cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync('E:/guangchang/docs/figures/submit-v37-after.png', Buffer.from(cap1.data, 'base64'));
  }
} catch (e) {
  result.error = String(e?.message || e);
  note('异常: ' + result.error);
} finally {
  if (!finished) {
    finished = true;
    try { await task.finish({ keep: [] }); note('空间已关闭'); } catch (e) { /* 忽略 */ }
  }
}
fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
console.log('SUBMITTED=' + result.submitted);
