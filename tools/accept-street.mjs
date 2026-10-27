// 逛厂 · egolite 验收脚本（第 1 周还债项验收）——诊断版
const task = await taskSpace('gc-accept-' + Date.now());
const page = task.page('p1');

await page.goto('http://localhost:4175/');
await page.waitForTimeout(3000);

// ① 首屏验收
const rootInfo = await page.evaluate(() => {
  const r = document.getElementById('root');
  return r ? { children: r.children.length } : null;
});
const canvasCount = await page.evaluate(() => document.querySelectorAll('canvas').length);
console.log('=== 首屏验收 ===');
console.log('DOM root children:', rootInfo ? rootInfo.children : 'null');
console.log('首屏 canvas 数:', canvasCount, '(期望 0)');

// ② 进入街区
const entered = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) =>
    b.textContent.includes('招聘街区')
  );
  if (btn) {
    console.log('街区按钮类名:', btn.className);
    btn.click();
    return true;
  }
  return false;
});
console.log('街区入口点击:', entered);
await page.waitForTimeout(2000);

// ③ 诊断：点击后检查 mode 状态（通过按钮 active 类）
const afterClick = await page.evaluate(() => {
  const streetBtn = [...document.querySelectorAll('button')].find((b) =>
    b.textContent.includes('招聘街区')
  );
  const activeBtns = [...document.querySelectorAll('button.active')].map((b) => b.textContent.trim());
  const hasLoadingMask = !!document.querySelector('.office-loading');
  const hasErrorText = document.body.innerText.includes('加载失败') || document.body.innerText.includes('出错了');
  const canvas = document.querySelectorAll('canvas').length;
  return {
    streetBtnActive: streetBtn ? streetBtn.className.includes('active') : false,
    activeButtons: activeBtns,
    hasLoadingMask,
    hasErrorText,
    canvasCount: canvas,
    bodyTextSnippet: document.body.innerText.slice(0, 200),
  };
});
console.log('点击后诊断:', JSON.stringify(afterClick, null, 2));

// ④ 再等一段时间，看是否有变化
await page.waitForTimeout(15000);
const afterWait = await page.evaluate(() => {
  const canvas = document.querySelectorAll('canvas').length;
  const hasErrorText = document.body.innerText.includes('加载失败') || document.body.innerText.includes('出错了');
  const gl = window.__gl;
  const dc = gl && (gl.info || (gl.renderer ? gl.renderer.info : null))
    ? (gl.info || gl.renderer.info).render.calls : null;
  return { canvas, hasErrorText, drawCalls: dc };
});
console.log('等待后:', JSON.stringify(afterWait));

// 截图
await page.screenshot({ path: 'C:/tmp/gc-accept-street.png', fullPage: true });
console.log('截图已保存');
