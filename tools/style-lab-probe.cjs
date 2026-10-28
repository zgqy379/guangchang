// 美术风格实验 · 场景探针：把线上 R14 街区的灯光/材质/天空结构打印出来
// 用法：NODE_PATH=... node tools/style-lab-probe.cjs
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const URL = process.env.GC_URL || 'https://zgqy379.github.io/guangchang/';
const OUT = path.resolve('docs/design/proofs/art-style');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1600,980'] });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.log('[page]', m.text()); });
  const log = (m) => console.log(m);

  await page.goto(URL + '?debug=1&v=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('.gc-role-gate', { timeout: 90000 });
  await page.evaluate(() => document.querySelector('.gc-role-gate__direct')?.click());
  await page.waitForSelector('.street-cta', { timeout: 90000 });
  await page.waitForFunction(() => !(document.body.innerText || '').includes('招聘街区加载中'), undefined, { timeout: 90000 });
  await wait(6000);

  // 切日间
  for (let i = 0; i < 4; i++) {
    const cur = await page.evaluate(() => document.querySelector('.app')?.getAttribute('data-theme'));
    if (cur === 'light') break;
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('.mode-switch .theme-lock')].find((x) =>
        (x.getAttribute('aria-label') || '').startsWith('主题'));
      b?.click();
    });
    await wait(1200);
  }
  await wait(2500);

  await page.evaluate(() => {
    const sel = 'header, footer, .game-hud, .gc-nav, .lot-card-dock, .street-cta, .nav-stack, .game-toast, .xp-pop, .delivered, .scene-vignette, .office-loading';
    document.querySelectorAll(sel).forEach((el) => { el.style.display = 'none'; });
    document.body.style.background = '#0e0f11';
  });

  const dump = await page.evaluate(() => {
    const scene = window.__st;
    const cam = window.__cam;
    const gl = window.__gl;
    if (!scene) return { error: 'no __st' };
    const lights = [];
    const matMap = new Map();
    const meshes = [];
    let n = 0;
    scene.traverse((o) => {
      n++;
      if (o.isLight) {
        lights.push({
          kind: o.type, name: o.name || '(unnamed)',
          intensity: o.intensity,
          color: o.color ? '#' + o.color.getHexString() : null,
          pos: o.position ? o.position.toArray().map((v) => +v.toFixed(2)) : null,
          castShadow: !!o.castShadow,
        });
      }
      if (o.isMesh) {
        const g = o.geometry;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (!m) continue;
          const key = [
            m.type, m.name || '', m.color ? m.color.getHexString() : '',
            'r' + (m.roughness ?? '-'), 'm' + (m.metalness ?? '-'),
            m.emissive ? 'e' + m.emissive.getHexString() + '@' + (m.emissiveIntensity ?? 1) : '',
            't' + (m.transparent ? m.opacity : 'opaque'),
            m.map ? 'map' : 'nomap',
          ].join('|');
          if (!matMap.has(key)) matMap.set(key, { key, count: 0, meshes: [] });
          const rec = matMap.get(key);
          rec.count++;
          if (rec.meshes.length < 6) rec.meshes.push(o.name || '(unnamed)');
        }
        if (meshes.length < 120) {
          meshes.push({
            name: o.name || '(unnamed)',
            geo: g?.type,
            verts: g?.attributes?.position?.count ?? 0,
            mat: (Array.isArray(o.material) ? o.material[0] : o.material)?.type,
            matName: (Array.isArray(o.material) ? o.material[0] : o.material)?.name || '',
            pos: o.position.toArray().map((v) => +v.toFixed(1)),
            visible: o.visible,
          });
        }
      }
    });
    // 天空穹顶线索：BackSide 大球
    const sky = [];
    scene.traverse((o) => {
      if (o.isMesh && o.material && o.material.side === 1 /* BackSide */) {
        sky.push({
          name: o.name || '(unnamed)',
          geo: o.geometry?.type,
          scale: o.scale.toArray(),
          mat: o.material.type,
          matColor: o.material.color ? '#' + o.material.color.getHexString() : null,
          hasMap: !!o.material.map,
          mapSize: o.material.map ? [o.material.map.image?.width, o.material.map.image?.height] : null,
          fog: o.material.fog,
        });
      }
    });
    return {
      objects: n,
      lights,
      sky,
      exposure: gl.toneMappingExposure,
      toneMapping: gl.toneMapping,
      envIntensity: scene.environmentIntensity,
      env: !!scene.environment,
      fog: scene.fog ? { color: '#' + scene.fog.color.getHexString(), near: scene.fog.near, far: scene.fog.far } : null,
      background: scene.background ? (scene.background.color ? '#' + scene.background.color.getHexString() : scene.background.type) : null,
      camera: { pos: cam.position.toArray().map((v) => +v.toFixed(2)), fov: cam.fov, near: cam.near, far: cam.far },
      materials: [...matMap.values()].sort((a, b) => b.count - a.count).slice(0, 40),
      meshes,
    };
  });

  fs.writeFileSync(path.join(OUT, 'scene-probe.json'), JSON.stringify(dump, null, 2));
  log('objects=' + dump.objects + ' lights=' + dump.lights.length + ' materials=' + dump.materials.length);
  log(JSON.stringify(dump.lights, null, 1));
  log(JSON.stringify(dump.sky, null, 1));
  log(JSON.stringify(dump.camera, null, 1));
  await browser.close();
})();
