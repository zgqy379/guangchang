// 角色门首屏截图（桌面 1600x900 / 移动 390x844），仅 gate，不涉 WebGL
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const URL = process.env.GC_URL || 'https://zgqy379.github.io/guangchang/';
const OUT = path.resolve('docs/figures/rolegate-2026-10-28');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const [name, viewport, mobile] of [
    ['gate-desktop', { width: 1600, height: 900 }, false],
    ['gate-mobile', { width: 390, height: 844 }, true],
  ]) {
    const ctx = await browser.newContext({ viewport, isMobile: mobile, deviceScaleFactor: mobile ? 2 : 1 });
    const page = await ctx.newPage();
    await page.goto(URL + '?v=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForSelector('.gc-role-gate', { timeout: 45000 });
    await page.waitForTimeout(1400);
    await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
    console.log(name, viewport, 'saved');
    await ctx.close();
  }
  await browser.close();
})();
