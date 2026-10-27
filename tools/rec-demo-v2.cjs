// 逛厂 Demo v2 真实操作素材录制 v2（Playwright + 本机 Chrome，1600x900）
// 修正：显式日/夜主题、键盘 W 靠近摊位、办公室等待 .office-select、A/B 用头部按钮。
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const URL = process.env.GC_URL || 'https://zgqy379.github.io/guangchang/';
const OUT = path.resolve('docs/video/demo-v2/assets/raw');
const SHOT = path.resolve('docs/video/demo-v2/diag/probe');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(SHOT, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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
  const cur = await page.evaluate(() => document.querySelector('.app')?.getAttribute('data-theme'));
  log('theme final=' + cur);
  return cur;
}

async function dismissGate(page) {
  if (await page.locator('.gc-role-card--candidate').count()) {
    await page.locator('.gc-role-card--candidate').click();
  }
  await page.waitForSelector('.mode-switch', { timeout: 30000 });
}

async function enterStreet(page, theme, log) {
  if (await page.locator('.gc-role-gate__direct').count()) {
    await page.locator('.gc-role-gate__direct').click();
  }
  await page.waitForSelector('.mode-switch', { timeout: 30000 });
  await page.locator('button', { hasText: '招聘街区' }).first().click();
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
  await page.locator('.street-cta').click();
  await page.waitForTimeout(1200);
  await page.locator('canvas').first().click({ position: { x: 800, y: 450 } }).catch(() => {});
  await page.waitForTimeout(1000);
  await page.keyboard.down('w');
  await page.waitForTimeout(3800);
  await page.keyboard.up('w');
  log('walked W');
  await page.waitForTimeout(1800);
  if (!(await page.locator('.lot-card-actions').count())) {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('.nav-pill')].find((x) => (x.textContent || '').includes('互联网'));
      b?.click();
    });
    log('nav internet');
    await page.waitForTimeout(2600);
  }
  if (!(await page.locator('.lot-card-actions').count())) {
    const c = await page.evaluate(() => {
      const r = document.querySelector('canvas').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await page.mouse.click(c.x, c.y + 40);
    log('ground click fallback');
    await page.waitForTimeout(2600);
  }
  await page.waitForSelector('.lot-card-actions', { timeout: 15000 }).catch(() => {});
  log('card=' + (await page.locator('.lot-card-actions').count()));
}

async function enterSingle(page, log) {
  await dismissGate(page);
  await page.locator('button', { hasText: '逛一家' }).first().click();
  await page.waitForSelector('.controls', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await setTheme(page, 'light', log);
  await page.waitForTimeout(1500);
  log('single ready');
}

async function enterOffice(page, log) {
  await dismissGate(page);
  await page.locator('button', { hasText: '办公室漫游' }).first().click();
  const sel = page.locator('.office-select');
  await sel.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1200);
  if (await sel.count()) await sel.selectOption({ index: 0 }).catch(() => {});
  log('office select ready');
  await page.waitForTimeout(9000);
  await page.screenshot({ path: path.join(SHOT, 'office-9s.png') });
  log('office screenshot');
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

  // m02 角色门 → 点击 → 街区加载 → 日间鸟瞰
  {
    const ctx = await openPage(browser, 'm02');
    await ctx.page.waitForTimeout(5000);
    ctx.log('gate hold done');
    await ctx.page.locator('.gc-role-gate__direct').click();
    await ctx.page.waitForSelector('.mode-switch', { timeout: 30000 });
    await ctx.page.locator('button', { hasText: '招聘街区' }).first().click();
    await ctx.page.waitForFunction(
      () => !(document.body.innerText || '').includes('招聘街区搭建中') && !!document.querySelector('.street-cta'),
      undefined,
      { timeout: 90000 },
    );
    ctx.log('street ready');
    await setTheme(ctx.page, 'light', ctx.log);
    await ctx.page.waitForTimeout(5000);
    await closePage(ctx, 'm02-rolegate');
  }

  // m03 日间街区 → 走近摊位 → 投递
  {
    const ctx = await openPage(browser, 'm03');
    await enterStreet(ctx.page, 'light', ctx.log);
    await ctx.page.waitForTimeout(2200);
    ctx.log('bird view');
    await walkToBooth(ctx.page, ctx.log);
    await ctx.page.waitForTimeout(2600);
    ctx.log('booth focus');
    const deliver = ctx.page.locator('.lot-card-actions button', { hasText: '投简历' }).first();
    if (await deliver.count()) {
      await deliver.click();
      ctx.log('deliver clicked');
    }
    await ctx.page.waitForTimeout(6000);
    await closePage(ctx, 'm03-street');
  }

  // m04a 日间街区 → 对比篮 → A/B
  {
    const ctx = await openPage(browser, 'm04a');
    await enterStreet(ctx.page, 'light', ctx.log);
    await walkToBooth(ctx.page, ctx.log);
    const compare = ctx.page.locator('.lot-card-actions button', { hasText: '对比' }).first();
    if (await compare.count()) {
      await compare.click();
      ctx.log('compare added');
    }
    await ctx.page.waitForTimeout(700);
    const ab = ctx.page.locator('button', { hasText: 'A/B 对比' }).first();
    if (await ab.count()) {
      await ab.click();
      ctx.log('A/B clicked');
    }
    await ctx.page.waitForFunction(() => (document.body.innerText || '').includes('A · 我的山'), undefined, { timeout: 20000 }).catch(() => {});
    ctx.log('compare text=' + (await ctx.page.evaluate(() => (document.body.innerText || '').includes('A · 我的山'))));
    await ctx.page.waitForTimeout(6000);
    await ctx.page.screenshot({ path: path.join(SHOT, 'compare.png') });
    await closePage(ctx, 'm04a-compare');
  }

  // m04b 夜间街区（默认 dark，不再切主题）
  {
    const ctx = await openPage(browser, 'm04b');
    await enterStreet(ctx.page, 'dark', ctx.log);
    await ctx.page.waitForTimeout(1200);
    await ctx.page.locator('.street-cta').click();
    await ctx.page.waitForTimeout(1800);
    await ctx.page.keyboard.down('w');
    await ctx.page.waitForTimeout(3200);
    await ctx.page.keyboard.up('w');
    ctx.log('night walk');
    await ctx.page.waitForTimeout(6000);
    await closePage(ctx, 'm04b-night');
  }

  // m05 单人模式（日间）：拖年薪 → 拖下班
  {
    const ctx = await openPage(browser, 'm05');
    await enterSingle(ctx.page, ctx.log);
    await ctx.page.screenshot({ path: path.join(SHOT, 'single-before.png') });
    const salary = ctx.page.locator('.gc-slider', { hasText: '年薪' }).locator('input[type=range]').first();
    await dragRange(ctx.page, salary, 0.15, 0.82);
    ctx.log('salary dragged');
    await ctx.page.waitForTimeout(3600);
    const offwork = ctx.page.locator('.gc-slider', { hasText: '下班' }).locator('input[type=range]').first();
    await dragRange(ctx.page, offwork, 0.75, 0.96);
    ctx.log('offwork dragged');
    await ctx.page.waitForTimeout(4200);
    await ctx.page.screenshot({ path: path.join(SHOT, 'single-after.png') });
    await closePage(ctx, 'm05-single');
  }

  // m06 办公室 3DGS（等下拉 + 9s 载入）
  {
    const ctx = await openPage(browser, 'm06');
    await enterOffice(ctx.page, ctx.log);
    const c = await ctx.page.evaluate(() => {
      const r = document.querySelector('canvas').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await ctx.page.mouse.move(c.x, c.y);
    await ctx.page.mouse.wheel(0, -240);
    await ctx.page.waitForTimeout(1500);
    await ctx.page.mouse.move(c.x - 160, c.y + 40);
    await ctx.page.mouse.down();
    await ctx.page.mouse.move(c.x + 160, c.y + 10, { steps: 24 });
    await ctx.page.mouse.up();
    ctx.log('office orbit');
    await ctx.page.waitForTimeout(4500);
    await closePage(ctx, 'm06-office');
  }

  await browser.close();
  console.log('ALL DONE');
})();
