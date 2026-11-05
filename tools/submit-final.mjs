// 官网「修改提交」最终动作：自包含地复核表单 → 点「提交新版本」→ 验证结果。
// 前置校验不通过则不点提交。所有状态写文件（egolite console 可能丢）。
const task = await taskSpace('gc-submit-v36-final-' + Date.now());
const page = task.page('p1');
const fs = await import('node:fs');
const OUT = 'E:/guangchang/docs/loop/submit-final.json';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PDF = 'E:/guangchang/docs/report.pdf';
const log = [];

const snap = () => page.evaluate(() => {
  const text = document.body?.innerText || '';
  return {
    url: location.href,
    reportSize: (text.match(/(\d+(?:\.\d+)?)\s*MB/) || [])[0] || null,
    version: (text.match(/第\s*\d+\s*版[^\n]*/) || [])[0] || null,
    submitted: text.includes('已提交'),
    boxes: [...document.querySelectorAll('input[type="checkbox"]')].filter((b) => b.value === 'on').map((b) => b.checked),
    submitBtn: [...document.querySelectorAll('button')].some((b) => (b.innerText || '').trim() === '提交新版本'),
    tail: text.slice(-500),
  };
});

let result = { submitted: false };
try {
  // 表单若已不在（跨会话丢失），自包含地重走一次
  let s = await snap();
  if (!s.submitBtn) {
    log.push('表单不在，重新打开修改提交');
    await page.goto('https://www.aholo3d.cn/hackathon/my', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await wait(4500);
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button, a')].find((e) => (e.textContent || '').trim() === '修改提交');
      b?.click();
    });
    await wait(4000);
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button, a, span')].find((e) => (e.textContent || '').trim() === '更换' && e.children.length === 0);
      b?.click();
    });
    await wait(1200);
    const doc = await page.cdp('DOM.getDocument', { depth: 1 });
    const q = await page.cdp('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'input[type="file"][accept*="pdf"]' });
    await page.cdp('DOM.setFileInputFiles', { nodeId: q.nodeId, files: [PDF] });
    await wait(12000);
    await page.evaluate(() => {
      [...document.querySelectorAll('input[type="checkbox"]')].filter((b) => b.value === 'on' && !b.checked).forEach((b) => b.click());
    });
    await wait(1500);
    s = await snap();
  }

  result.before = s;
  log.push('提交前: ' + JSON.stringify({ size: s.reportSize, boxes: s.boxes, btn: s.submitBtn }));

  // 硬校验：v3.6 已上传（13.9 MB）、两个确认框都勾、按钮存在
  const sizeOk = s.reportSize && parseFloat(s.reportSize) > 13;
  const boxesOk = s.boxes.length >= 2 && s.boxes.every(Boolean);
  if (!sizeOk || !boxesOk || !s.submitBtn) {
    result.error = '前置校验未通过，未点提交';
  } else {
    // 精确全等匹配「提交新版本」，避免误点「去提交作品」步骤卡按钮
    const clicked = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === '提交新版本');
      if (b) { b.click(); return true; }
      return false;
    });
    log.push('点击提交新版本: ' + clicked);
    await wait(3500);
    // 可能的二次确认弹窗
    const confirmed = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((e) => ['确认', '确定', '继续提交'].includes((e.innerText || '').trim()));
      if (b) { b.click(); return (b.innerText || '').trim(); }
      return null;
    });
    if (confirmed) log.push('二次确认: ' + confirmed);
    await wait(6500);
    result.after = await snap();
    result.submitted = !!result.after.version || result.after.submitted;
  }
} catch (e) {
  result.error = String(e?.message || e);
  log.push('异常: ' + result.error);
}
result.log = log;
fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
await task.finish({ keep: 'all' });
