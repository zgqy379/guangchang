// 美术方向 F · 桌面模型（低机位微缩摄影）
// 运行时：加底座/桌面、改机位、釉面材质、暖灯主光。生产文件零改动。
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const URL = process.env.GC_URL || 'https://zgqy379.github.io/guangchang/';
const TAG = process.argv[2] || 'desk';
const OUT = path.resolve('docs/design/proofs/art-style');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const CAM = { pos: [88, 28, 76], look: [0, 2.5, 0], fov: 36 };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--window-size=1600,980'] });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.log('[page]', m.text()); });
  const log = (m) => console.log(`[${TAG}] ${m}`);

  await page.goto(URL + '?debug=1&v=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('.gc-role-gate', { timeout: 90000 });
  await page.evaluate(() => document.querySelector('.gc-role-gate__direct')?.click());
  await page.waitForSelector('.street-cta', { timeout: 90000 });
  await page.waitForFunction(() => !(document.body.innerText || '').includes('招聘街区加载中'), undefined, { timeout: 90000 });
  await wait(6500);

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
    const report = { converted: 0, added: [] };

    cam.fov = CAM.fov;
    cam.position.set(...CAM.pos);
    cam.lookAt(...CAM.look);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);

    // —— 天幕：暗棚 ——
    scene.traverse((o) => {
      if (o.isMesh && o.material && o.material.side === 1 && o.material.map && !o.material.transparent) {
        const Ctor = o.material.map.constructor;
        const c = document.createElement('canvas');
        c.width = 4; c.height = 512;
        const g = c.getContext('2d');
        const grad = g.createLinearGradient(0, 0, 0, 512);
        grad.addColorStop(0, '#0d0b0a');
        grad.addColorStop(0.55, '#171310');
        grad.addColorStop(0.7, '#241b15');
        grad.addColorStop(1, '#0f0c0a');
        g.fillStyle = grad;
        g.fillRect(0, 0, 4, 512);
        const tex = new Ctor(c);
        tex.colorSpace = 'srgb';
        tex.needsUpdate = true;
        o.material.map = tex;
        o.material.color.set('#ffffff');
        o.material.needsUpdate = true;
      }
    });
    if (scene.background && scene.background.isColor) scene.background.set('#0d0b0a');

    // 月亮 / 星星收掉
    scene.traverse((o) => {
      if (o.isGroup && o.children.length === 2) {
        const hasSprite = o.children.some((c) => c.isSprite);
        const hasBall = o.children.some((c) => c.isMesh && c.geometry && c.geometry.type === 'SphereGeometry');
        if (hasSprite && hasBall) o.visible = false;
      }
      if (o.isPoints) o.visible = false;
    });

    // —— 灯光：左侧暖灯 + 右侧冷补 ——
    const lights = [];
    scene.traverse((o) => { if (o.isLight) lights.push(o); });
    const key = lights.find((l) => l.isDirectionalLight && l.castShadow);
    const fill = lights.find((l) => l.isDirectionalLight && !l.castShadow);
    const hemi = lights.find((l) => l.isHemisphereLight);
    if (key) {
      key.position.set(-70, 62, 58);
      key.color.set('#ffcb96');
      key.intensity = 3.1;
      key.shadow.needsUpdate = true;
    }
    if (fill) {
      fill.position.set(78, 34, -52);
      fill.color.set('#7f9ec4');
      fill.intensity = 0.55;
    }
    if (hemi) {
      hemi.color.set('#4a3b30');
      hemi.groundColor.set('#0b0908');
      hemi.intensity = 0.35;
    }

    gl.toneMappingExposure = 1.12;
    scene.environmentIntensity = 0.55;
    if (scene.fog) {
      scene.fog.color.set('#1a1410');
      scene.fog.near = 160;
      scene.fog.far = 520;
    }
    gl.shadowMap.needsUpdate = true;

    // —— 地面/道路缩到模型底座范围内 ——
    scene.traverse((o) => {
      if (!o.isMesh || !o.geometry || !o.geometry.parameters) return;
      const p = o.geometry.parameters;
      if (o.geometry.type === 'PlaneGeometry' && p.width === 240 && p.height === 240) {
        o.scale.setScalar(0.64);
      }
      if (o.geometry.type === 'PlaneGeometry' && p.width === 180 && p.height === 10.4) {
        o.scale.setScalar(0.78);
      }
      if (o.geometry.type === 'PlaneGeometry' && p.width === 180 && p.height === 180) {
        o.scale.setScalar(0.78);
      }
    });

    // —— 釉面瓷 ——
    let Std = null, Basic = null;
    scene.traverse((o) => {
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!Std && m && m.isMeshStandardMaterial) Std = m.constructor;
      if (!Basic && m && m.isMeshBasicMaterial) Basic = m.constructor;
    });
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m || !m.color) continue;
        if (m.side === 1 || m.fog === false) continue;
        if (m.toneMapped === false) continue;
        if (m.transparent && m.map) continue;
        if (m.transparent) {
          m.color.set('#3a3028');
          m.opacity = Math.min(m.opacity ?? 0.5, 0.5);
          m.needsUpdate = true;
          continue;
        }
        if (m.map) {
          const img = m.map.image;
          const isLabel = img && img.width === 512 && img.height <= 200;
          if (!isLabel) { m.map = null; m.needsUpdate = true; } else continue;
        }
        const l = 0.2126 * m.color.r + 0.7152 * m.color.g + 0.0722 * m.color.b;
        const v = 0.84 + l * 0.12;
        m.color.setRGB(v, v * 0.96, v * 0.9);
        if (m.isMeshStandardMaterial) {
          m.roughness = 0.34;
          m.metalness = 0.03;
          m.envMapIntensity = 1.2;
          m.emissive?.setRGB(0, 0, 0);
          m.emissiveIntensity = 0;
        }
        m.needsUpdate = true;
      }
      if (o.isInstancedMesh && o.instanceColor) {
        const col = o.instanceColor;
        for (let i = 0; i < col.count; i++) {
          const c = col.getX(i), g = col.getY(i), b = col.getZ(i);
          if (g > c * 1.12 && g > b * 1.12) col.setXYZ(i, 0.5, 0.56, 0.5);
          else {
            const l = 0.2126 * c + 0.7152 * g + 0.0722 * b;
            const v = 0.82 + l * 0.12;
            col.setXYZ(i, v, v * 0.96, v * 0.9);
          }
        }
        col.needsUpdate = true;
      }
    });

    // 远景天际线（r 60–70 的 8 栋）在模型视角会变成巨塔：隐藏
    scene.traverse((o) => {
      if (!o.isInstancedMesh || o.geometry?.type !== 'BoxGeometry' || o.count !== 8) return;
      const tmp = o.matrix.clone();
      const pos = o.position.clone();
      const quat = o.quaternion.clone();
      const scl = o.position.clone();
      let far = 0;
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, tmp);
        tmp.decompose(pos, quat, scl);
        far = Math.max(far, Math.hypot(pos.x, pos.z));
      }
      if (far > 50) o.visible = false;
    });

    // —— 底座 + 桌面 + 桌面暖光池 ——
    const V3 = cam.position.constructor;
    let MeshCtor = null, BoxCtor = null, PlaneCtor = null;
    scene.traverse((o) => {
      if (!o.isMesh) return;
      if (!MeshCtor) MeshCtor = o.constructor;
      if (!BoxCtor && o.geometry?.type === 'BoxGeometry') BoxCtor = o.geometry.constructor;
      if (!PlaneCtor && o.geometry?.type === 'PlaneGeometry') PlaneCtor = o.geometry.constructor;
    });
    if (!MeshCtor || !BoxCtor || !PlaneCtor) return { error: 'no geometry constructors' };
    const boxGeo = new BoxCtor(110, 6, 110);
    const plinthMat = new Std();
    plinthMat.color.set('#cdc2b1');
    plinthMat.roughness = 0.92;
    plinthMat.metalness = 0;
    plinthMat.envMapIntensity = 0.6;
    const plinth = new MeshCtor(boxGeo, plinthMat);
    plinth.position.set(0, -3.2, 0);
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    scene.add(plinth);
    report.added.push('plinth');

    const planeGeo = new PlaneCtor(900, 900);
    const tableMat = new Std();
    tableMat.color.set('#241812');
    tableMat.roughness = 0.62;
    tableMat.metalness = 0.08;
    const table = new MeshCtor(planeGeo, tableMat);
    table.rotation.x = -Math.PI / 2;
    table.position.y = -6.02;
    table.receiveShadow = true;
    scene.add(table);
    report.added.push('table');

    // 桌面暖光池（径向渐变贴图）
    const mapProto = (() => {
      let t = null;
      scene.traverse((o) => { const m = Array.isArray(o.material) ? o.material[0] : o.material; if (!t && m?.map) t = m.map; });
      return t;
    })();
    if (mapProto) {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const g = c.getContext('2d');
      const rad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      rad.addColorStop(0, 'rgba(255,196,128,0.55)');
      rad.addColorStop(0.5, 'rgba(255,170,100,0.18)');
      rad.addColorStop(1, 'rgba(255,150,80,0)');
      g.fillStyle = rad;
      g.fillRect(0, 0, 256, 256);
      const tex = new (mapProto.constructor)(c);
      tex.colorSpace = 'srgb';
      const poolMat = new Basic();
      poolMat.map = tex;
      poolMat.transparent = true;
      poolMat.depthWrite = false;
      poolMat.blending = 2;
      poolMat.opacity = 0.85;
      const pool = new MeshCtor(planeGeo, poolMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(-6, -5.98, -2);
      pool.scale.setScalar(0.38);
      scene.add(pool);
      report.added.push('pool');
    }

    // 中央信标暖金
    scene.traverse((o) => {
      if (!o.isMesh || !o.geometry || !o.geometry.parameters) return;
      const p = o.geometry.parameters;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!m) return;
      const world = o.getWorldPosition(new V3());
      if (o.geometry.type === 'CylinderGeometry' && p.height === 5 && Math.abs(world.x) < 1 && Math.abs(world.z) < 1) {
        if (m.emissive) {
          m.emissive.set('#ffb45e');
          m.emissiveIntensity = 1.5;
        }
        m.color.set('#efe0c4');
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
    document.body.style.background = '#0d0b0a';
  });
  await wait(2600);

  const file = path.join(OUT, `raw-${TAG}.png`);
  await page.screenshot({ path: file });
  log('saved ' + file);
  await browser.close();
})();
