// R19 Pages 线上验收（抗加载阻塞版）：短轮询 + 逐次 catch，不在主线程忙时硬等
// 契约：线上完整启动确认（DOM 挂载 + canvas 存在 + drawCalls 非零 + 零异常文案），curl 200 不算数
const task = await taskSpace('gc-accept-r19-' + Date.now());
const page = task.page('p1');
const fs = await import('node:fs');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = 'E:/guangchang/tmp-design-review';

const URL = 'https://zgqy379.github.io/guangchang/?v=' + Date.now() + '&debug=1';
try { await page.goto(URL, { waitUntil: 'load', timeout: 60000 }); } catch (e) {
  console.error('goto timeout (继续等待):', String(e).slice(0, 60));
}

// 首屏：DOM 挂载 + 角色门 + 0 canvas
let gate = false;
for (let i = 0; i < 20; i++) {
  await wait(2000);
  try {
    gate = await page.evaluate(() => !!document.querySelector('.gc-glass-gate, .gc-role-gate'));
    if (gate) break;
  } catch {}
}
console.log('gate:', gate);

if (gate) {
  try {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button, a, [role="button"]')].find(
        (e) => (e.textContent || '').includes('进入街区'),
      );
      if (b) b.click();
    });
  } catch {}
}

// 进街区：canvas + __st + drawCalls>0（最长 ~4 分钟，逐次短调用）
let ok = false;
for (let i = 0; i < 120; i++) {
  await wait(2000);
  try {
    const calls = await page.evaluate(() => window.__gl?.info?.render?.calls ?? 0);
    if (calls > 0) { ok = true; console.log('drawCalls =', calls, 'at', i * 2, 's'); break; }
  } catch {}
}
await wait(4000);

const after = await page.evaluate(() => ({
  canvas: document.querySelectorAll('canvas').length,
  drawCalls: window.__gl?.info?.render?.calls ?? 0,
  hasErrorText: document.body.innerText.includes('加载失败') || document.body.innerText.includes('出错了'),
})).catch(() => null);
console.log('RESULT:', JSON.stringify(after));

try { await page.screenshot({ path: OUT + '/live-accept-r19.png' }); } catch (e) {}
if (!after || !after.canvas || after.hasErrorText || !after.drawCalls) {
  console.error('FAIL: 线上验收未通过');
  process.exit(1);
}
console.log('PASS: 线上验收通过');
await task.finish({ keep: [] });
