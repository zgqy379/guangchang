// 美术方向 E · 蓝调釉面模型（夜景，街平视）
// 只改运行时：机位 / 天幕 / 雾 / 灯光 / 釉面材质。生产文件零改动。
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const URL = process.env.GC_URL || 'https://zgqy379.github.io/guangchang/';
const TAG = process.argv[2] || 'bluehour';
const OUT = path.resolve('docs/design/proofs/art-style');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const W = +(process.env.W || 1600);
const H = +(process.env.H || 900);
const CAM = { pos: [40, 2.75, 2.4], look: [-1, 4.15, -1.0], fov: 43 };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: false, args: [`--window-size=${W},${H + 80}`] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.log('[page]', m.text()); });
  const log = (m) => console.log(`[${TAG}] ${m}`);

  await page.goto(URL + '?debug=1&v=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('.gc-role-gate', { timeout: 90000 });
  await page.evaluate(() => document.querySelector('.gc-role-gate__direct')?.click());
  await page.waitForSelector('.street-cta', { timeout: 90000 });
  await page.waitForFunction(() => !(document.body.innerText || '').includes('招聘街区加载中'), undefined, { timeout: 90000 });
  await wait(6500);

  // 夜间主题（提供灯头辉光 / 湿反射带 / 星空）
  for (let i = 0; i < 4; i++) {
    const cur = await page.evaluate(() => document.querySelector('.app')?.getAttribute('data-theme'));
    if (cur === 'dark') break;
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('.mode-switch .theme-lock')].find((x) =>
        (x.getAttribute('aria-label') || '').startsWith('主题'));
      b?.click();
    });
    await wait(1200);
  }
  await wait(3200);

  const info = await page.evaluate(({ CAM }) => {
    const scene = window.__st, gl = window.__gl, cam = window.__cam;
    if (!scene || !gl || !cam) return { error: 'missing hooks' };
    const report = { converted: 0, points: 0, lights: [], sky: false };

    cam.fov = CAM.fov;
    cam.position.set(...CAM.pos);
    cam.lookAt(...CAM.look);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);

    // —— 天幕：深蓝到余晖 ——
    scene.traverse((o) => {
      if (o.isMesh && o.material && o.material.side === 1 && o.material.map && !o.material.transparent) {
        const Ctor = o.material.map.constructor;
        const c = document.createElement('canvas');
        c.width = 4; c.height = 512;
        const g = c.getContext('2d');
        const grad = g.createLinearGradient(0, 0, 0, 512);
        grad.addColorStop(0.00, '#0a1322');
        grad.addColorStop(0.30, '#152338');
        grad.addColorStop(0.44, '#354260');
        grad.addColorStop(0.485, '#a2766e');
        grad.addColorStop(0.505, '#e9a06c');
        grad.addColorStop(0.545, '#8a5f58');
        grad.addColorStop(1.00, '#241b1a');
        g.fillStyle = grad;
        g.fillRect(0, 0, 4, 512);
        const tex = new Ctor(c);
        tex.colorSpace = 'srgb';
        tex.needsUpdate = true;
        o.material.map = tex;
        o.material.color.set('#ffffff');
        o.material.needsUpdate = true;
        report.sky = true;
      }
    });
    if (scene.background && scene.background.isColor) scene.background.set('#0c1524');

    // 月亮收掉（蓝调时刻以城市灯为主）
    scene.traverse((o) => {
      if (o.isGroup && o.children.length === 2) {
        const hasSprite = o.children.some((c) => c.isSprite);
        const hasBall = o.children.some((c) => c.isMesh && c.geometry && c.geometry.type === 'SphereGeometry');
        if (hasSprite && hasBall) o.visible = false;
      }
    });

    // —— 灯光：低角度余晖 + 冷天光 ——
    const lights = [];
    scene.traverse((o) => { if (o.isLight) lights.push(o); });
    const key = lights.find((l) => l.isDirectionalLight && l.castShadow);
    const fill = lights.find((l) => l.isDirectionalLight && !l.castShadow);
    const hemi = lights.find((l) => l.isHemisphereLight);
    if (key) {
      key.position.set(-54, 68, 46);
      key.color.set('#a6c3e6');
      key.intensity = 1.9;
      key.shadow.needsUpdate = true;
      report.lights.push('key');
    }
    if (fill) {
      fill.position.set(-86, 14, 12);
      fill.color.set('#ffa870');
      fill.intensity = 0.8;
      report.lights.push('fill');
    }
    if (hemi) {
      hemi.color.set('#6b88b8');
      hemi.groundColor.set('#11161f');
      hemi.intensity = 0.6;
      report.lights.push('hemi');
    }

    gl.toneMappingExposure = 1.3;
    scene.environmentIntensity = 0.9;
    if (scene.fog) {
      scene.fog.color.set('#1b2a3d');
      scene.fog.near = 16;
      scene.fog.far = 118;
    }
    gl.shadowMap.needsUpdate = true;

    // —— 釉面瓷：所有受光面统一为暖白瓷；灯/LED/标牌保留 ——
    let Std = null;
    scene.traverse((o) => {
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!Std && m && m.isMeshStandardMaterial) Std = m.constructor;
    });
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m || !m.color) continue;
        if (m.side === 1 || m.fog === false) continue;        // 天空/云
        if (m.toneMapped === false) continue;                  // LED/霓虹
        if (m.transparent && m.map) continue;                  // 带图透明片
        if (m.transparent) {                                   // 玻璃窗 → 深釉
          m.color.set('#28394a');
          m.opacity = Math.min(m.opacity ?? 0.5, 0.52);
          if (m.isMeshStandardMaterial) {
            m.roughness = 0.14;
            m.metalness = 0.3;
            m.envMapIntensity = 1.6;
          }
          m.needsUpdate = true;
          continue;
        }
        if (m.map) continue;                                   // 文本/贴图牌面
        const l = 0.2126 * m.color.r + 0.7152 * m.color.g + 0.0722 * m.color.b;
        const v = 0.83 + l * 0.12;
        m.color.setRGB(v, v * 0.972, v * 0.93);
        if (m.isMeshStandardMaterial) {
          m.roughness = 0.3;
          m.metalness = 0.035;
          m.envMapIntensity = 1.4;
          m.emissive?.setRGB(0, 0, 0);
          m.emissiveIntensity = 0;
        }
        m.needsUpdate = true;
      }
      if (o.isInstancedMesh && o.instanceColor) {
        const mats2 = Array.isArray(o.material) ? o.material : [o.material];
        if (mats2.some((m) => m && m.toneMapped === false)) return;
        const col = o.instanceColor;
        for (let i = 0; i < col.count; i++) {
          const c = col.getX(i), g = col.getY(i), b = col.getZ(i);
          if (g > c * 1.12 && g > b * 1.12) {
            col.setXYZ(i, 0.55, 0.62, 0.56);                   // 树冠：青瓷
          } else {
            const l = 0.2126 * c + 0.7152 * g + 0.0722 * b;
            const v = 0.8 + l * 0.14;
            col.setXYZ(i, v, v * 0.972, v * 0.93);
          }
        }
        col.needsUpdate = true;
      }
    });

    // 树冠：低模绿球在夜景里像巨石，缩 22% 并压成深青瓷
    scene.traverse((o) => {
      if (!o.isInstancedMesh || !o.geometry || o.geometry.type !== 'IcosahedronGeometry') return;
      const tmp = o.matrix.clone();
      const pos = o.position.clone();
      const quat = o.quaternion.clone();
      const scl = o.position.clone();
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, tmp);
        tmp.decompose(pos, quat, scl);
        scl.multiplyScalar(0.62);
        tmp.compose(pos, quat, scl);
        o.setMatrixAt(i, tmp);
      }
      o.instanceMatrix.needsUpdate = true;
      if (o.instanceColor) {
        const col = o.instanceColor;
        for (let i = 0; i < col.count; i++) {
          const v = 0.2 + ((i * 37) % 5) * 0.012;
          col.setXYZ(i, v * 0.9, v * 1.08, v * 1.0);
        }
        col.needsUpdate = true;
      }
    });

    // 路灯辉光点：若夜间主题已挂载，调大一点
    scene.traverse((o) => {
      if (o.isPoints && o.material && o.material.isPointsMaterial) {
        o.material.size = 2.0;
        o.material.opacity = 1;
        report.points++;
      }
    });

    // 中央信标：暖金中轴
    scene.traverse((o) => {
      if (!o.isMesh || !o.geometry || !o.geometry.parameters) return;
      const p = o.geometry.parameters;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!m) return;
      const world = o.getWorldPosition(new (o.position.constructor)());
      if (o.geometry.type === 'CylinderGeometry' && p.height === 5 && Math.abs(world.x) < 1 && Math.abs(world.z) < 1) {
        if (m.emissive) {
          m.emissive.set('#ffb45e');
          m.emissiveIntensity = 1.4;
        }
        m.color.set('#e9d7b6');
        m.needsUpdate = true;
      }
      if (o.geometry.type === 'CylinderGeometry' && p.height === 15 && Math.abs(world.x) < 1 && Math.abs(world.z) < 1) {
        m.color.set('#ffc27a');
        m.opacity = m.opacity > 0.1 ? 0.3 : 0.1;
        m.needsUpdate = true;
      }
    });

    return report;
  }, { CAM });
  log(JSON.stringify(info));

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
  await wait(2800);

  const file = path.join(OUT, `raw-${TAG}.png`);
  await page.screenshot({ path: file });
  log('saved ' + file);
  await browser.close();
})();
