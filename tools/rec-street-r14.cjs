// 录制 R14 线上街区鸟瞰段（1600x900，headed Chrome；供 m02 第二段裁尾使用）
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const URL = process.env.GC_URL || 'https://zgqy379.github.io/guangchang/';
const OUT = path.resolve('docs/video/demo-v2/assets/raw');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function setTheme(page, target, log) {
  for (let i = 0; i < 4; i++) {
    const cur = await page.evaluate(() => document.querySelector('.app')?.getAttribute('data-theme'));
    if (cur === target) { log('theme=' + cur); return cur; }
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('.mode-switch .theme-lock')].find((x) =>
        (x.getAttribute('aria-label') || '').startsWith('主题'));
      b?.click();
    });
    await page.waitForTimeout(900);
  }
  const cur = await page.evaluate(() => document.querySelector('.app')?.getAttribute('data-theme'));
  log('theme final=' + cur);
  return cur;
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1600,980'] });
  const ctx = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    recordVideo: { dir: OUT, size: { width: 1600, height: 900 } },
  });
  const page = await ctx.newPage();
  const t0 = Date.now();
  const log = (m) => console.log(`+${((Date.now() - t0) / 1000).toFixed(1)}s ${m}`);
  await page.goto(URL + '?v=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('.gc-role-gate', { timeout: 90000 });
  await page.evaluate(() => document.querySelector('.gc-role-gate__direct')?.click());
  log('clicked direct');
  await page.waitForSelector('.street-cta', { timeout: 90000 });
  log('street-cta');
  await wait(1500);
  await setTheme(page, 'light', log);
  await wait(2500);
  log('street stable; recording 12s');
  await wait(12000);
  const video = page.video();
  await ctx.close();
  const src = await video.path();
  const dst = path.join(OUT, 'm02-street-r14.webm');
  fs.copyFileSync(src, dst);
  console.log(`video -> ${dst} (${(fs.statSync(dst).size / 1024 / 1024).toFixed(1)} MB)`);
  await browser.close();
})();
