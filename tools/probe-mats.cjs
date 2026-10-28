// 诊断：列出场景里的大体量网格与蓝色材质归属
const { chromium } = require('playwright');
const URL = process.env.GC_URL || 'https://zgqy379.github.io/guangchang/';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1280,800'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(URL + '?debug=1&v=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('.gc-role-gate', { timeout: 90000 });
  await page.evaluate(() => document.querySelector('.gc-role-gate__direct')?.click());
  await page.waitForSelector('.street-cta', { timeout: 90000 });
  await wait(6500);
  const out = await page.evaluate(() => {
    const scene = window.__st;
    const rows = [];
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const m = mats[0];
      if (!m) return;
      const c = m.color || { r: 0, g: 0, b: 0 };
      const blue = c.b > c.r * 1.3 && c.b > c.g * 1.15;
      const hot = blue || m.emissive && m.emissive.getHex() !== 0;
      if (!hot) return;
      if (!o.geometry) return;
      o.geometry.computeBoundingBox?.();
      const bb = o.geometry.boundingBox;
      const p = o.geometry.parameters || {};
      rows.push({
        type: m.type,
        color: '#' + m.color.getHexString(),
        emissive: m.emissive ? '#' + m.emissive.getHexString() : null,
        ei: m.emissiveIntensity ?? null,
        transparent: m.transparent,
        opacity: m.opacity,
        map: !!m.map,
        toneMapped: m.toneMapped,
        geo: o.geometry.type,
        params: JSON.stringify(p).slice(0, 120),
        instances: o.isInstancedMesh ? o.count : 0,
        instanceColor: !!o.instanceColor,
        bbox: bb ? [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z].map((v) => +v.toFixed(1)) : null,
        world: o.getWorldPosition(new (o.position.constructor)()).toArray().map((v) => +v.toFixed(1)),
      });
    });
    // 按体量排序
    rows.sort((a, b) => {
      const va = a.bbox ? a.bbox[0] * a.bbox[1] * a.bbox[2] : 0;
      const vb = b.bbox ? b.bbox[0] * b.bbox[1] * b.bbox[2] : 0;
      return vb - va;
    });
    return rows.slice(0, 40);
  });
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})();
