// 只读验证 v2：从创作平台首页点侧边栏「笔记管理」→ 找已发布笔记与链接
// 合规：固定空间名，结束 finish({keep:[]})。绝不重复发布。
const task = await taskSpace('gc-xhs-verify2');
const page = task.page('p1');
const fs = await import('node:fs');
const OUT = 'E:/guangchang/docs/loop/xhs-verify2.json';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const result = { confirmed: false, steps: [] };
const note = (s) => { result.steps.push(s); console.log(s); };
let finished = false;

try {
  await page.goto('https://creator.xiaohongshu.com/publish/publish', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await wait(7000);

  // 用 CDP 真实鼠标点侧边栏「笔记管理」（div，不是 button）
  const target = await page.evaluate(() => {
    const all = [...document.querySelectorAll('a, div, span, li')];
    const hits = all.filter((e) => {
      const t = (e.innerText || '').trim();
      const r = e.getBoundingClientRect();
      return t === '笔记管理' && r.width > 20 && r.height > 12;
    });
    if (!hits.length) return null;
    const e = hits[hits.length - 1];
    const r = e.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), tag: e.tagName, href: e.getAttribute('href') || '' };
  });
  note('侧边栏目标: ' + JSON.stringify(target));
  if (target) {
    await page.cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: target.x, y: target.y, button: 'left', clickCount: 1 });
    await wait(120);
    await page.cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: target.x, y: target.y, button: 'left', clickCount: 1 });
    await wait(8000);
  }

  const snap = await page.evaluate(() => {
    const t = document.body?.innerText || '';
    const links = [...document.querySelectorAll('a')].map((a) => ({ href: a.href, text: (a.innerText || '').trim().slice(0, 70) }))
      .filter((x) => x.href && /xiaohongshu|xhslink/.test(x.href));
    return {
      url: location.href,
      titleFound: t.includes('把 offer 砌成一条 3D 招聘街'),
      text: t.slice(0, 2200),
      links,
      detailLinks: links.filter((x) => /\/explore\/|\/discovery\/item\/|\/note\//.test(x.href)),
    };
  });
  result.snap = snap;
  note('页面: ' + JSON.stringify({ url: snap.url, titleFound: snap.titleFound, linkCount: snap.links.length, detailCount: snap.detailLinks.length }));
  note('文本: ' + snap.text.slice(0, 900).replace(/\n/g, ' | '));
  result.postUrl = snap.detailLinks[0]?.href || null;
  result.confirmed = snap.titleFound || snap.detailLinks.length > 0;

  const cap = await page.cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync('E:/guangchang/docs/figures/xhs-verify2-manage.png', Buffer.from(cap.data, 'base64'));
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
console.log('CONFIRMED=' + result.confirmed + ' POST_URL=' + (result.postUrl || 'none'));
