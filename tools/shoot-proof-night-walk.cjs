// 夜间越肩干净图版：隐藏 HUD/导航，只留 R14 街区 canvas（1600x900）
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const URL = process.env.GC_URL || 'https://zgqy379.github.io/guangchang/';
const OUT = path.resolve('docs/design/proofs/editorial/assets');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1600,980'] });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(URL + '?v=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('.gc-role-gate', { timeout: 90000 });
  await page.evaluate(() => document.querySelector('.gc-role-gate__direct')?.click());
  await page.waitForSelector('.street-cta', { timeout: 90000 });
  await page.waitForFunction(() => !(document.body.innerText || '').includes('招聘街区加载中'), undefined, { timeout: 90000 });
  await wait(4500);
  for (let i = 0; i < 4; i++) {
    const cur = await page.evaluate(() => document.querySelector('.app')?.getAttribute('data-theme'));
    if (cur === 'dark') break;
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('.mode-switch .theme-lock')].find((x) => (x.getAttribute('aria-label') || '').startsWith('主题'));
      b?.click();
    });
    await page.waitForTimeout(900);
  }
  await wait(1600);
  await page.evaluate(() => { const b = document.querySelector('.street-cta'); if (b) b.style.display = ''; });
  await page.evaluate(() => document.querySelector('.street-cta')?.click());
  await wait(1400);
  const c = await page.evaluate(() => {
    const r = document.querySelector('canvas').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.click(c.x, c.y + 30);
  await wait(900);
  await page.keyboard.down('w');
  await wait(3800);
  await page.keyboard.up('w');
  await wait(1800);
  await page.evaluate(() => {
    const sel = 'header, footer, .game-hud, .gc-nav, .lot-card-dock, .street-cta, .nav-stack, .game-toast, .xp-pop, .delivered, .scene-vignette, .office-loading';
    document.querySelectorAll(sel).forEach((el) => { el.style.display = 'none'; });
    [...document.querySelectorAll('body *')].forEach((el) => {
      const t = (el.textContent || '').trim();
      if (!t.includes('作品廊') && !t.includes('点击地面开始逛')) return;
      if (el.children.length > 0) return;
      el.style.display = 'none';
      if (t.includes('作品廊') && el.parentElement) el.parentElement.style.display = 'none';
    });
    document.body.style.background = '#0e0f11';
  });
  await wait(1000);
  await page.screenshot({ path: path.join(OUT, 'street-clean-night-walk.png') });
  console.log('saved night walk');
  await browser.close();
})();
