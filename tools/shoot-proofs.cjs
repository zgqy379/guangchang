// 编辑设计样张截图：gate 桌面/移动、street HUD、report 封面
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const DIR = path.resolve('docs/design/proofs/editorial');
const OUT = path.join(DIR, 'out');
fs.mkdirSync(OUT, { recursive: true });

async function shot(browser, html, name, viewport, dpr = 2, fullPage = false) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  await page.goto('file://' + path.join(DIR, html).replace(/\\/g, '/'), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0), undefined, { timeout: 30000 });
  await page.waitForTimeout(400);
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage });
  console.log(name, viewport, 'dpr', dpr, '->', file);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  await shot(browser, 'proof-gate.html', 'gate-desktop.png', { width: 1600, height: 900 }, 2);
  await shot(browser, 'proof-gate.html', 'gate-mobile.png', { width: 390, height: 844 }, 2);
  await shot(browser, 'proof-street.html', 'street-hud.png', { width: 1600, height: 900 }, 2);
  await shot(browser, 'proof-report.html', 'report-cover.png', { width: 1240, height: 1754 }, 1.5);
  await browser.close();
})();
