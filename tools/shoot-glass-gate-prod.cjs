// 玻璃门 · 本地生产构建截图 + 首屏资产审计
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const BASE = 'http://localhost:4173/';
const OUT = path.resolve('docs/design/proofs/editorial/out');
fs.mkdirSync(OUT, { recursive: true });

const DESKTOP = [
  { name: 'glass-gate-1600x900', w: 1600, h: 900, dpr: 1 },
  { name: 'glass-gate-1280x800', w: 1280, h: 800, dpr: 1 },
  { name: 'glass-gate-1024x768', w: 1024, h: 768, dpr: 1 },
];
const MOBILE = [
  { name: 'glass-gate-390x844', w: 390, h: 844, dpr: 2 },
  { name: 'glass-gate-360x740', w: 360, h: 740, dpr: 2 },
];

async function shot(browser, spec) {
  const ctx = await browser.newContext({
    viewport: { width: spec.w, height: spec.h },
    deviceScaleFactor: spec.dpr,
    isMobile: spec.w < 500,
    hasTouch: spec.w < 500,
  });
  const page = await ctx.newPage();
  const reqs = [];
  page.on('request', (r) => reqs.push(r.url()));
  await page.goto(BASE + '?gate=glass&v=' + Date.now(), { waitUntil: 'networkidle', timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);

  const info = await page.evaluate(() => {
    const res = performance.getEntriesByType('resource');
    const by = {};
    let total = 0;
    for (const r of res) {
      const t = r.initiatorType || 'other';
      by[t] = (by[t] || 0) + (r.transferSize || 0);
      total += r.transferSize || 0;
    }
    const nav = performance.getEntriesByType('navigation')[0];
    return {
      canvases: document.querySelectorAll('canvas').length,
      webgl: (() => {
        const c = document.createElement('canvas');
        return !!(c.getContext('webgl2') || c.getContext('webgl'));
      })(),
      doc: nav ? nav.transferSize : 0,
      total,
      by,
      h1: document.querySelector('.gg-console h1')?.getBoundingClientRect().toJSON(),
      console: document.querySelector('.gg-console')?.getBoundingClientRect().toJSON(),
      cta: document.querySelector('.gg-cta')?.getBoundingClientRect().toJSON(),
      roleLast: document.querySelector('.gg-role:last-child')?.getBoundingClientRect().toJSON(),
      scrollH: document.documentElement.scrollHeight,
      innerH: innerHeight,
      overflowX: document.documentElement.scrollWidth > innerWidth,
    };
  });
  const glb = reqs.filter((u) => /\.(glb|gltf|spz|ply)(\?|$)/i.test(u));
  const three = reqs.filter((u) => /aholo|three|StreetScene/i.test(u));
  const file = path.join(OUT, spec.name + '.png');
  await page.screenshot({ path: file, fullPage: false });
  console.log(JSON.stringify({ spec, info, glb, three, file }, null, 1));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const s of [...DESKTOP, ...MOBILE]) await shot(browser, s);
  await browser.close();
})();
