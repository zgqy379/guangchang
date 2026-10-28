// 液态玻璃样张截图
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');
const DIR = path.resolve('docs/design/proofs/editorial');
const OUT = path.join(DIR, 'out');
fs.mkdirSync(OUT, { recursive: true });

async function shot(browser, html, name, viewport, dpr = 2) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(path.join(DIR, html)).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0), undefined, { timeout: 30000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, name) });
  console.log(name, viewport);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  await shot(browser, 'proof-glass-gate.html', 'glass-gate-desktop.png', { width: 1600, height: 900 });
  await shot(browser, 'proof-glass-gate.html', 'glass-gate-mobile.png', { width: 390, height: 844 });
  await shot(browser, 'proof-glass-gate-day.html', 'glass-gate-day.png', { width: 1600, height: 900 });
  await shot(browser, 'proof-glass-gate-day.html', 'glass-gate-day-mobile.png', { width: 390, height: 844 });
  await shot(browser, 'proof-glass-street.html', 'glass-street-hud.png', { width: 1600, height: 900 });
  await browser.close();
})();
