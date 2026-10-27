// 逛厂 Demo v2 真实操作素材录制 v3：只补 m03/m04a/m04b/m05
// 关键修正：DOM 点击走 evaluate（避开 Playwright actionability 长等），办公室改用展示幕。
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const URL = process.env.GC_URL || 'https://zgqy379.github.io/guangchang/';
const OUT = path.resolve('docs/video/demo-v2/assets/raw');
const SHOT = path.resolve('docs/video/demo-v2/diag/probe');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(SHOT, { recursive: true });

async function openPage(browser, name) {
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    recordVideo: { dir: OUT, size: { width: 1600, height: 900 } },
  });
  const page = await context.newPage();
  const t0 = Date.now();
  const log = (msg) => console.log(`[${name}] +${((Date.now() - t0) / 1000).toFixed(1)}s ${msg}`);
  await page.goto(URL + '?v=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('.gc-role-gate, .mode-switch', { timeout: 90000 });
  await page.bringToFront();
  log('page ready');
  return { context, page, log, t0 };
}

async function closePage(ctx, name) {
  const video = ctx.page.video();
  await ctx.context.close();
  const src = await video.path();
  const dst = path.join(OUT, `${name}.webm`);
  fs.copyFileSync(src, dst);
  console.log(`[${name}] video -> ${dst} (${(fs.statSync(dst).size / 1024 / 1024).toFixed(1)} MB)`);
}

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
  return await page.evaluate(() => document.querySelector('.app')?.getAttribute('data-theme'));
}

async function enterStreet(page, theme, log) {
  if (await page.locator('.gc-role-gate__direct').count()) {
    await page.evaluate(() => document.querySelector('.gc-role-gate__direct')?.click());
  }
  await page.waitForSelector('.mode-switch', { timeout: 30000 });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('招聘街区'));
    b?.click();
  });
  await page.waitForFunction(
    () => !(document.body.innerText || '').includes('招聘街区搭建中') && !!document.querySelector('.street-cta'),
    undefined,
    { timeout: 90000 },
  );
  log('street ready');
  await page.waitForTimeout(1200);
  await setTheme(page, theme, log);
  await page.waitForTimeout(1200);
}

async function walkToBooth(page, log) {
  await page.evaluate(() => document.querySelector('.street-cta')?.click());
  await page.waitForTimeout(800);
  await page.mouse.click(800, 450);
  await page.waitForTimeout(600);
  await page.keyboard.down('w');
  await page.waitForTimeout(3600);
  await page.keyboard.up('w');
  log('walked W');
  await page.waitForTimeout(1600);
  if (!(await page.locator('.lot-card-actions').count())) {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('.nav-pill')].find((x) => (x.textContent || '').includes('互联网'));
      b?.click();
    });
    log('nav internet');
    await page.waitForTimeout(2200);
  }
  await page.waitForSelector('.lot-card-actions', { timeout: 12000 }).catch(() => {});
  log('card=' + (await page.locator('.lot-card-actions').count()));
}

async function enterSingle(page, log) {
  if (await page.locator('.gc-role-card--candidate').count()) {
    await page.locator('.gc-role-card--candidate').click();
  }
  await page.waitForSelector('.mode-switch', { timeout: 30000 });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('逛一家'));
    b?.click();
  });
  await page.waitForSelector('.controls', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await setTheme(page, 'light', log);
  await page.waitForTimeout(1500);
  log('single ready');
}

async function dragRange(page, locator, fromRatio, toRatio, steps = 26) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('slider bbox null');
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * fromRatio, y);
  await page.waitForTimeout(150);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * toRatio, y, { steps });
  await page.waitForTimeout(150);
  await page.mouse.up();
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1600,980'] });

  // m03 日间街区 → 走近摊位 → 投递
  {
    const ctx = await openPage(browser, 'm03');
    await enterStreet(ctx.page, 'light', ctx.log);
    await ctx.page.waitForTimeout(2400);
    ctx.log('bird view');
    await walkToBooth(ctx.page, ctx.log);
    await ctx.page.waitForTimeout(3200);
    ctx.log('booth focus');
    await ctx.page.evaluate(() => {
      const b = [...document.querySelectorAll('.lot-card-actions button')].find((x) => (x.textContent || '').includes('投简历'));
      b?.click();
    });
    ctx.log('deliver clicked');
    await ctx.page.waitForTimeout(8000);
    await ctx.page.screenshot({ path: path.join(SHOT, 'm03-after.png') });
    await closePage(ctx, 'm03-street');
  }

  // m04a 日间街区 → 对比篮 → A/B
  {
    const ctx = await openPage(browser, 'm04a');
    await enterStreet(ctx.page, 'light', ctx.log);
    await walkToBooth(ctx.page, ctx.log);
    await ctx.page.evaluate(() => {
      const b = [...document.querySelectorAll('.lot-card-actions button')].find((x) => (x.textContent || '').includes('对比'));
      b?.click();
    });
    ctx.log('compare added');
    await ctx.page.waitForTimeout(600);
    await ctx.page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('A/B 对比'));
      b?.click();
    });
    ctx.log('A/B clicked');
    await ctx.page.waitForTimeout(8000);
    await ctx.page.screenshot({ path: path.join(SHOT, 'm04a-compare.png') });
    await closePage(ctx, 'm04a-compare');
  }

  // m04b 夜间街区（默认 dark）
  {
    const ctx = await openPage(browser, 'm04b');
    await enterStreet(ctx.page, 'dark', ctx.log);
    await ctx.page.waitForTimeout(1200);
    await ctx.page.evaluate(() => document.querySelector('.street-cta')?.click());
    await ctx.page.waitForTimeout(1200);
    await ctx.page.mouse.click(800, 450);
    await ctx.page.waitForTimeout(600);
    await ctx.page.keyboard.down('w');
    await ctx.page.waitForTimeout(4000);
    await ctx.page.keyboard.up('w');
    ctx.log('night walk');
    await ctx.page.waitForTimeout(7000);
    await ctx.page.screenshot({ path: path.join(SHOT, 'm04b-night.png') });
    await closePage(ctx, 'm04b-night');
  }

  // m05 单人模式（日间）：拖年薪 → 拖到 23:00
  {
    const ctx = await openPage(browser, 'm05');
    await enterSingle(ctx.page, ctx.log);
    const salary = ctx.page.locator('.gc-slider', { hasText: '年薪' }).locator('input[type=range]').first();
    await dragRange(ctx.page, salary, 0.15, 0.82);
    ctx.log('salary dragged');
    await ctx.page.waitForTimeout(3600);
    const offwork = ctx.page.locator('.gc-slider', { hasText: '下班' }).locator('input[type=range]').first();
    const range = await offwork.evaluate((el) => ({ min: Number(el.min), max: Number(el.max) }));
    const ratio = (23 - range.min) / (range.max - range.min);
    ctx.log('offwork range=' + JSON.stringify(range) + ' targetRatio=' + ratio.toFixed(2));
    await dragRange(ctx.page, offwork, 0.75, ratio);
    ctx.log('offwork dragged');
    await ctx.page.waitForTimeout(4500);
    await ctx.page.screenshot({ path: path.join(SHOT, 'm05-after.png') });
    await closePage(ctx, 'm05-single');
  }

  await browser.close();
  console.log('ALL DONE');
})();
