// 只读验证：小红书笔记是否真的已发布 + 取回帖子链接（不重复发布）
// 合规（docs/lessons.md §13.13）：固定空间名，结束 finish({keep:[]})。
const task = await taskSpace('gc-xhs-verify');
const page = task.page('p1');
const fs = await import('node:fs');
const OUT = 'E:/guangchang/docs/loop/xhs-verify.json';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const result = { confirmed: false, steps: [] };
const note = (s) => { result.steps.push(s); console.log(s); };
let finished = false;

try {
  await page.goto('https://creator.xiaohongshu.com/publish/manage', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await wait(7000);

  // 若直接进不去，点侧边栏「笔记管理」
  const nav = await page.evaluate(() => {
    const t = document.body?.innerText || '';
    if (/笔记管理/.test(t) && !/把 offer 砌成一条 3D 招聘街/.test(t)) {
      const el = [...document.querySelectorAll('a, div, span, li')].find((e) => (e.innerText || '').trim() === '笔记管理');
      if (el) { el.click(); return true; }
    }
    return false;
  });
  note('点击笔记管理: ' + nav);
  if (nav) await wait(6000);

  const snap = await page.evaluate(() => {
    const t = document.body?.innerText || '';
    const links = [...document.querySelectorAll('a')].map((a) => ({ href: a.href, text: (a.innerText || '').trim().slice(0, 60) }))
      .filter((x) => x.href && /xiaohongshu|xhslink/.test(x.href));
    return {
      url: location.href,
      titleFound: t.includes('把 offer 砌成一条 3D 招聘街'),
      text: t.slice(0, 1800),
      links: links.slice(0, 30),
      hasPublishedFlag: /published=true/.test(location.href),
    };
  });
  result.snap = snap;
  note('页面: ' + JSON.stringify({ url: snap.url, titleFound: snap.titleFound, linkCount: snap.links.length }));
  note('文本: ' + snap.text.slice(0, 700).replace(/\n/g, ' | '));

  // 找指向笔记详情的链接
  const detail = snap.links.filter((x) => /\/explore\/|\/discovery\/item\/|\/note\//.test(x.href));
  result.detailLinks = detail;
  result.postUrl = detail[0]?.href || null;
  result.confirmed = snap.titleFound || detail.length > 0;

  const cap = await page.cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync('E:/guangchang/docs/figures/xhs-verify-manage.png', Buffer.from(cap.data, 'base64'));
  note('管理页截图已保存');
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
