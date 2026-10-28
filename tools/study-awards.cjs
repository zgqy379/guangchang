const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const OUT = path.resolve('docs/design/research/awards');
const SITES = [
  ['lusion', 'https://lusion.co/'],
  ['active-theory', 'https://activetheory.net/'],
  ['immersive-garden', 'https://immersive-g.com/'],
  ['monogrid', 'https://monogrid.com/'],
  ['awwwards-webgl', 'https://www.awwwards.com/websites/webgl/'],
  ['monument-valley', 'https://www.monumentvalleygame.com/mv2'],
];
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1600,1100'] });
  for (const [name, url] of SITES) {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await ctx.newPage();
    const logs = [];
    page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text().slice(0, 200)); });
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(7000);
      const info = await page.evaluate(() => ({
        title: document.title,
        text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 600),
        canvases: document.querySelectorAll('canvas').length,
      }));
      await page.screenshot({ path: path.join(OUT, name + '.png') });
      console.log(JSON.stringify({ name, url, info, logs: logs.slice(0, 3) }));
    } catch (e) {
      console.log(JSON.stringify({ name, url, error: String(e).slice(0, 300) }));
    }
    await ctx.close();
  }
  await browser.close();
})();
