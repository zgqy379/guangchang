// 美术风格实验 · 三方向同一机位实拍
// 用法：STYLE=A|B|C NODE_PATH=... node tools/style-lab-shoot.cjs
// 仅做线上 R14 场景的运行时灯光/材质实验，不改任何生产文件。
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const URL = process.env.GC_URL || 'https://zgqy379.github.io/guangchang/';
const OUT = path.resolve('docs/design/proofs/art-style');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const STYLES = {
  // A · 建筑沙盘：哑光模型 + 亚克力/铝 + 摄影棚柔光。几何不重建，只换光照与材质。
  A: {
    theme: 'light',
    exposure: 0.78,
    env: 1.0,
    fog: ['#dfd2bd', 70, 210],
    skyTint: '#efdcc0',
    key: { pos: [-70, 28, 34], color: '#ffbe78', intensity: 2.6 },
    fill: { pos: [60, 30, -30], color: '#9fbcd8', intensity: 0.15 },
    hemi: { sky: '#f6e3c8', ground: '#a89078', intensity: 0.28 },
    relight: { roughness: 0.92, metalness: 0.02 },
    emissive: 1.0,
  },
  // B · 蓝调霓虹：夜景 + 自发光增强。同一相机、同一几何。
  B: {
    theme: 'dark',
    exposure: 1.32,
    env: 1.3,
    fog: ['#0d1830', 38, 170],
    skyTint: '#cdd9f5',
    key: { pos: [-52, 46, -38], color: '#9db8e8', intensity: 0.8 },
    fill: { pos: [46, 18, 26], color: '#8a7bff', intensity: 0.5 },
    hemi: { sky: '#6f8cc4', ground: '#141a26', intensity: 0.72 },
    relight: null,
    emissive: 1.65,
  },
  // C · 潮玩展柜：高调棚拍 + 亮面搪胶 + 干净背景。
  C: {
    theme: 'light',
    exposure: 0.8,
    env: 1.25,
    fog: ['#f4eee5', 85, 270],
    skyTint: '#fffaf2',
    key: { pos: [34, 70, 42], color: '#ffffff', intensity: 1.7 },
    fill: { pos: [-58, 32, -22], color: '#ffe6cc', intensity: 0.55 },
    hemi: { sky: '#ffffff', ground: '#e8ddd0', intensity: 0.7 },
    relight: { roughness: 0.34, metalness: 0.22 },
    emissive: 1.15,
  },
};

const styleKey = (process.env.STYLE || 'A').toUpperCase();
const S = STYLES[styleKey];
if (!S) { console.error('STYLE must be A/B/C'); process.exit(1); }

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1600,980'] });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.log('[page]', m.text()); });
  const log = (m) => console.log(`[${styleKey}] ${m}`);

  await page.goto(URL + '?debug=1&v=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('.gc-role-gate', { timeout: 90000 });
  await page.evaluate(() => document.querySelector('.gc-role-gate__direct')?.click());
  await page.waitForSelector('.street-cta', { timeout: 90000 });
  await page.waitForFunction(() => !(document.body.innerText || '').includes('招聘街区加载中'), undefined, { timeout: 90000 });
  await wait(6000);

  // 主题
  for (let i = 0; i < 4; i++) {
    const cur = await page.evaluate(() => document.querySelector('.app')?.getAttribute('data-theme'));
    if (cur === S.theme) break;
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('.mode-switch .theme-lock')].find((x) =>
        (x.getAttribute('aria-label') || '').startsWith('主题'));
      b?.click();
    });
    await wait(1200);
  }
  await wait(2600);

  // 固定机位：与门头 hero 同机位
  await page.evaluate(() => {
    const cam = window.__cam;
    if (cam) {
      cam.position.set(26, 36, 26);
      cam.lookAt(0, 0, 0);
      cam.updateProjectionMatrix();
    }
  });

  const applied = await page.evaluate((S) => {
    const scene = window.__st, gl = window.__gl;
    if (!scene) return { error: 'no __st' };
    const report = { converted: 0, lights: [], note: [] };

    // 找灯光（主光/补光/半球）
    const lights = [];
    scene.traverse((o) => { if (o.isLight) lights.push(o); });
    const key = lights.find((l) => l.isDirectionalLight && l.castShadow);
    const fill = lights.find((l) => l.isDirectionalLight && !l.castShadow);
    const hemi = lights.find((l) => l.isHemisphereLight);

    if (key) {
      key.position.set(...S.key.pos);
      key.color.set(S.key.color);
      key.intensity = S.key.intensity;
      key.shadow.needsUpdate = true;
      report.lights.push('key');
    }
    if (fill) {
      fill.position.set(...S.fill.pos);
      fill.color.set(S.fill.color);
      fill.intensity = S.fill.intensity;
      report.lights.push('fill');
    }
    if (hemi) {
      hemi.color.set(S.hemi.sky);
      hemi.groundColor.set(S.hemi.ground);
      hemi.intensity = S.hemi.intensity;
      report.lights.push('hemi');
    }

    gl.toneMappingExposure = S.exposure;
    scene.environmentIntensity = S.env;
    if (scene.fog) {
      scene.fog.color.set(S.fog[0]);
      scene.fog.near = S.fog[1];
      scene.fog.far = S.fog[2];
    }

    // 天空穹顶着色（BackSide 大球）
    scene.traverse((o) => {
      if (o.isMesh && o.material && o.material.side === 1 && o.material.map) {
        o.material.color.set(S.skyTint);
      }
    });

    // 可选：把「非发光、非透明」的 Basic 面换成 Standard，让它们吃光/吃阴影
    if (S.relight) {
      let Std = null;
      scene.traverse((o) => {
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        if (!Std && m && m.isMeshStandardMaterial) Std = m.constructor;
      });
      if (!Std) return { error: 'no standard material prototype' };
      scene.traverse((o) => {
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        let did = false;
        const next = mats.map((m) => {
          if (!m || !m.isMeshBasicMaterial) return m;
          if (m.side === 1 || m.fog === false) return m;      // 天空/云/太阳
          if (m.transparent) return m;                         // 窗/玻璃/叠加
          if (m.toneMapped === false) return m;                // 霓虹/LED
          const s = new Std();
          s.name = 'labStd';
          s.color.copy(m.color);
          if (m.map) { s.map = m.map; }
          s.roughness = S.relight.roughness;
          s.metalness = S.relight.metalness;
          s.side = m.side;
          s.vertexColors = m.vertexColors;
          s.depthWrite = m.depthWrite;
          s.depthTest = m.depthTest;
          s.toneMapped = m.toneMapped;
          s.envMapIntensity = 1;
          did = true;
          return s;
        });
        if (did) {
          o.material = Array.isArray(o.material) ? next : next[0];
          o.castShadow = true;
          o.receiveShadow = true;
          report.converted++;
        }
      });
    }

    // 自发光增强（夜景霓虹）
    if (S.emissive !== 1) {
      scene.traverse((o) => {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (m && m.isMeshStandardMaterial && m.emissive && m.emissive.getHex() !== 0) {
            m.emissiveIntensity *= S.emissive;
          }
        }
      });
    }
    return report;
  }, S);
  log(JSON.stringify(applied));
  await wait(1800);

  // 隐藏所有 UI，只留 canvas
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
  await wait(900);

  const file = path.join(OUT, `raw-${styleKey.toLowerCase()}.png`);
  await page.screenshot({ path: file });
  log('saved ' + file);
  await browser.close();
})();
