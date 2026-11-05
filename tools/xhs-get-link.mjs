// 只读：取回已发布笔记的公开链接（供官网「社交媒体发布」栏登记）
// 合规：固定空间名，结束 finish({keep:[]})。
const task = await taskSpace('gc-xhs-getlink');
const page = task.page('p1');
const fs = await import('node:fs');
const OUT = 'E:/guangchang/docs/loop/xhs-post-link.json';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const result = { postUrl: null, steps: [] };
const note = (s) => { result.steps.push(s); console.log(s); };
let finished = false;

try {
  await page.goto('https://creator.xiaohongshu.com/publish/publish', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await wait(6500);

  const nav = await page.evaluate(() => {
    const hits = [...document.querySelectorAll('a, div, span, li')].filter((e) => {
      const r = e.getBoundingClientRect();
      return (e.innerText || '').trim() === '笔记管理' && r.width > 20 && r.height > 12;
    });
    const e = hits[hits.length - 1];
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  });
  if (nav) {
    await page.cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: nav.x, y: nav.y, button: 'left', clickCount: 1 });
    await wait(120);
    await page.cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: nav.x, y: nav.y, button: 'left', clickCount: 1 });
    await wait(7000);
  }
  note('进入笔记管理: ' + JSON.stringify({ url: await page.url(), nav }));

  // 先从页面 HTML / 内嵌数据里挖 note id（小红书链接形如 /explore/<24位hex>）
  const mined = await page.evaluate(() => {
    const html = document.documentElement.outerHTML;
    const ids = [...new Set((html.match(/(?:explore|discovery\/item|note_id|noteId)[\/"':=\s]+([a-f0-9]{24})/g) || [])
      .map((s) => (s.match(/[a-f0-9]{24}/) || [])[0]).filter(Boolean))];
    const allHex = [...new Set((html.match(/[a-f0-9]{24}/g) || []))].slice(0, 20);
    const titleEl = [...document.querySelectorAll('*')].find((e) =>
      (e.innerText || '').trim() === '把 offer 砌成一条 3D 招聘街' && e.children.length <= 2);
    let rowHtml = '';
    if (titleEl) {
      let p = titleEl;
      for (let i = 0; i < 5 && p; i++) { rowHtml = p.outerHTML || ''; if (/[a-f0-9]{24}/.test(rowHtml)) break; p = p.parentElement; }
    }
    return { ids, allHex, rowHtml: rowHtml.slice(0, 1500), url: location.href };
  });
  result.mined = mined;
  note('挖掘: ' + JSON.stringify({ ids: mined.ids, allHex: mined.allHex.slice(0, 6), rowHtml: mined.rowHtml.slice(0, 300) }));

  // 点第一条笔记标题，看是否打开详情页/新页签
  const titleHit = await page.evaluate(() => {
    const hits = [...document.querySelectorAll('*')].filter((e) => {
      const t = (e.innerText || '').trim();
      const r = e.getBoundingClientRect();
      return t === '把 offer 砌成一条 3D 招聘街' && r.width > 40 && r.height > 10 && r.y > 100;
    });
    const e = hits[hits.length - 1];
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: Math.round(r.x + Math.min(r.width / 2, 120)), y: Math.round(r.y + r.height / 2) };
  });
  note('标题坐标: ' + JSON.stringify(titleHit));
  if (titleHit) {
    await page.cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: titleHit.x, y: titleHit.y, button: 'left', clickCount: 1 });
    await wait(120);
    await page.cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: titleHit.x, y: titleHit.y, button: 'left', clickCount: 1 });
    await wait(6000);
  }

  const tabs = await task.tabs();
  result.tabs = tabs.map((t) => ({ label: t.label || null, url: t.url || '', title: t.title || '' }));
  note('页签: ' + JSON.stringify(result.tabs));

  const explore = result.tabs.find((t) => /explore|discovery\/item/.test(t.url));
  result.postUrl = explore?.url || (mined.ids[0] ? 'https://www.xiaohongshu.com/explore/' + mined.ids[0] : null);
  result.confirmed = !!result.postUrl;

  const cap = await page.cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync('E:/guangchang/docs/figures/xhs-get-link.png', Buffer.from(cap.data, 'base64'));
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
console.log('POST_URL=' + (result.postUrl || 'none'));
