// 美术方向 × 液态玻璃 UI 合成截图
const path = require('node:path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const DIR = path.resolve('docs/design/proofs/editorial');
const OUT = path.resolve('docs/design/proofs/art-style');

async function shot(browser, html, name) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(path.join(DIR, html)).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0), undefined, { timeout: 30000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, name) });
  console.log(name);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const list = process.argv.slice(2);
  const jobs = list.length
    ? list.map((s) => [s, 'with-ui-' + s + '.png'])
    : [['a', 'with-ui-a.png'], ['b', 'with-ui-b.png'], ['c', 'with-ui-c.png']];
  for (const [k, out] of jobs) await shot(browser, `proof-style-${k}.html`, out);
  await browser.close();
})();
