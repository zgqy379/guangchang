// 列出街区页面上覆盖在 canvas 之上的 DOM 元素（为“干净图版”截图确定隐藏清单）
const { chromium } = require('playwright');
const URL = process.env.GC_URL || 'https://zgqy379.github.io/guangchang/';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1600,980'] });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(URL + '?v=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('.gc-role-gate', { timeout: 90000 });
  await page.evaluate(() => document.querySelector('.gc-role-gate__direct')?.click());
  await page.waitForSelector('.street-cta', { timeout: 90000 });
  await wait(1500);
  const rows = await page.evaluate(() => {
    const out = [];
    const seen = new Set();
    for (const el of document.querySelectorAll('body *')) {
      const st = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const cls = typeof el.className === 'string' ? el.className : '';
      const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
      const interesting = /hud|nav|card|cta|toast|gallery|label|tag|hint|vignette|overlay|onboard|tutorial|caption|dock|panel/i.test(cls) ||
        /作品廊|点击地面|直接逛|招聘街区/.test(text);
      if (!interesting || st.display === 'none' || Number(st.opacity) === 0) continue;
      const key = el.tagName + '|' + cls + '|' + Math.round(r.x) + ',' + Math.round(r.y) + ',' + Math.round(r.width) + ',' + Math.round(r.height);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        tag: el.tagName,
        cls,
        text,
        pos: st.position,
        z: st.zIndex,
        rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
        kids: el.children.length,
      });
    }
    return out;
  });
  console.log(JSON.stringify(rows, null, 2));
  await browser.close();
})();
