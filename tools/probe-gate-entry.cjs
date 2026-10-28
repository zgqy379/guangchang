// 测量线上角色门 → 街区入场时序（1600x900，headed Chrome）
const path = require('node:path');
const { chromium } = require('playwright');

const URL = process.env.GC_URL || 'https://zgqy379.github.io/guangchang/';
const OUT = path.resolve('tmp-design-review');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1600,980'] });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  const t0 = Date.now();
  const log = (m) => console.log(`+${((Date.now() - t0) / 1000).toFixed(2)}s ${m}`);
  await page.goto(URL + '?v=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('.gc-role-gate', { timeout: 45000 });
  log('gate mounted');
  await page.waitForFunction(() => {
    const img = document.querySelector('.gc-role-gate__hero-img');
    return img && img.complete && img.naturalWidth > 0;
  }, undefined, { timeout: 30000 }).catch(() => log('hero img not ready'));
  await page.evaluate(() => document.fonts.ready);
  log('fonts + hero ready');
  await page.waitForTimeout(1200);
  log('gate stable');
  await page.screenshot({ path: path.join(OUT, 'probe-gate.png') });

  const tClick = Date.now();
  await page.evaluate(() => document.querySelector('.gc-role-gate__direct')?.click());
  log('clicked direct');
  await page.waitForSelector('.street-cta', { timeout: 90000 });
  log(`street-cta after ${((Date.now() - tClick) / 1000).toFixed(2)}s`);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, 'probe-street.png') });
  log('street shot');
  await browser.close();
})();
