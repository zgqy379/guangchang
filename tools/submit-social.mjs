// 官网「修改提交」第 3 版：登记小红书社交媒体发布链接
// 合规（docs/lessons.md §13.13）：固定空间名，结束 finish({keep:[]})。
const task = await taskSpace('gc-submit-social');
const page = task.page('p1');
const fs = await import('node:fs');
const OUT = 'E:/guangchang/docs/loop/submit-social.json';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const POST_URL = 'https://www.xiaohongshu.com/explore/6aec5119000000000602cd58';
const PDF = 'E:/guangchang/docs/report.pdf';
const result = { submitted: false, postUrl: POST_URL, steps: [] };
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
    tail: text.slice(-600),
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

  // 表单字段结构：每个 url 输入连同附近说明文字
  const fields = await page.evaluate(() => {
    return [...document.querySelectorAll('input[type="url"]')].map((i, idx) => {
      let p = i, ctx = '';
      for (let k = 0; k < 6 && p; k++) {
        p = p.parentElement;
        if (p) ctx = (p.innerText || '').trim().slice(0, 160);
        if (/社交|小红书|报告链接|Demo|源码|项目链接/.test(ctx)) break;
      }
      return { idx, value: i.value || '', placeholder: i.placeholder || '', context: ctx };
    });
  });
  result.fields = fields;
  note('URL 字段: ' + JSON.stringify(fields));

  // 找社交媒体链接字段：优先上下文含「社交/小红书」，否则取空值且非 Demo/源码的那一个
  const socialIdx = await page.evaluate(() => {
    const list = [...document.querySelectorAll('input[type="url"]')];
    const ctx = (i) => {
      let p = i, t = '';
      for (let k = 0; k < 6 && p; k++) { p = p.parentElement; if (p) t = (p.innerText || '').trim().slice(0, 200); if (/社交|小红书/.test(t)) return t; }
      return t;
    };
    let hit = list.findIndex((i) => /社交|小红书/.test(ctx(i)));
    if (hit < 0) hit = list.findIndex((i) => !(i.value || '').trim());
    return hit;
  });
  note('社交媒体字段索引=' + socialIdx);
  if (socialIdx < 0) throw new Error('未找到社交媒体链接输入框');

  const filled = await page.evaluate(({ idx, value }) => {
    const el = [...document.querySelectorAll('input[type="url"]')][idx];
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    return el.value;
  }, { idx: socialIdx, value: POST_URL });
  note('已填入: ' + filled);
  await wait(2500);

  // 若报告 PDF 在本次修改提交里需要重传（表单显示无 13.9MB），补传 v3.6
  let s = await snap();
  result.beforeFirst = s;
  if (!s.reportSize || parseFloat(s.reportSize) < 13) {
    note('报告文件需重传，上传 v3.6');
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button, a, span')].find((e) => (e.textContent || '').trim() === '更换' && e.children.length === 0);
      b?.click();
    });
    await wait(1200);
    const doc = await page.cdp('DOM.getDocument', { depth: 1 });
    const q = await page.cdp('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'input[type="file"][accept*="pdf"]' });
    if (q?.nodeId) { await page.cdp('DOM.setFileInputFiles', { nodeId: q.nodeId, files: [PDF] }); await wait(12000); }
  }

  // 两个确认框（须知勾选不随草稿保存）
  await page.evaluate(() => {
    [...document.querySelectorAll('input[type="checkbox"]')].filter((b) => b.value === 'on' && !b.checked).forEach((b) => b.click());
  });
  await wait(1500);
  s = await snap();
  result.before = s;
  note('提交前: ' + JSON.stringify({ size: s.reportSize, boxes: s.boxes, btn: s.submitBtn, urls: s.urls, version: s.version }));

  const linkOk = s.urls.some((u) => u.includes('6aec5119000000000602cd58'));
  const boxesOk = s.boxes.length >= 2 && s.boxes.every(Boolean);
  if (!linkOk || !boxesOk || !s.submitBtn) {
    result.error = '前置校验未通过，未点提交: ' + JSON.stringify({ linkOk, boxesOk, btn: s.submitBtn });
    note(result.error);
  } else {
    const cap0 = await page.cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync('E:/guangchang/docs/figures/submit-social-before.png', Buffer.from(cap0.data, 'base64'));
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === '提交新版本');
      b?.click();
    });
    note('已点击提交新版本');
    await wait(9000);
    const after = await snap();
    result.after = after;
    note('提交后: ' + JSON.stringify({ version: after.version, submitted: after.submitted, tail: after.tail.slice(0, 260) }));
    result.submitted = after.submitted || /第\s*3\s*版/.test(after.version || '') || /提交成功/.test(after.tail);
    const cap1 = await page.cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync('E:/guangchang/docs/figures/submit-social-after.png', Buffer.from(cap1.data, 'base64'));
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
