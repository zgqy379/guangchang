// 诊断：屏幕取样点上有哪些网格（投影包围盒命中）
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
    const scene = window.__st, cam = window.__cam;
    cam.fov = 45;
    cam.position.set(45, 2.2, 3.1);
    cam.lookAt(-1, 3.55, -1.2);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
    const sampled = [[-0.7, 0.72], [0.72, 0.72], [-0.8, 0.35], [0.85, 0.4], [0.0, -0.2]];
    const rows = [];
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      o.geometry.computeBoundingBox?.();
      const bb = o.geometry.boundingBox;
      if (!bb) return;
      const V = o.position.constructor;
      const pts = [];
      for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) {
        const v = new V(x, y, z).applyMatrix4(o.matrixWorld).project(cam);
        pts.push(v);
      }
      const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      for (const [sx, sy] of sampled) {
        if (sx < minX || sx > maxX || sy < minY || sy > maxY) continue;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        const m = mats[0];
        rows.push({
          sample: [sx, sy],
          type: m.type,
          color: '#' + m.color.getHexString(),
          transparent: m.transparent,
          opacity: m.opacity,
          map: !!m.map,
          toneMapped: m.toneMapped,
          inst: o.isInstancedMesh ? o.count : 0,
          instanceColor: !!o.instanceColor,
          geo: o.geometry.type,
          params: JSON.stringify(o.geometry.parameters || {}).slice(0, 80),
          bbox: [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z].map((v) => +v.toFixed(1)),
          world: o.getWorldPosition(new V()).toArray().map((v) => +v.toFixed(1)),
          parent: o.parent?.type + '/' + (o.parent?.name || ''),
          depth: +o.getWorldPosition(new V()).distanceTo(cam.position).toFixed(1),
        });
      }
    });
    return rows;
  });
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})();
