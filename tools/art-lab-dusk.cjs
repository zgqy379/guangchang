// 美术方向 D · 下班时分（街平视逆光）
// 只改运行时：机位 / 太阳 / 天幕 / 雾 / 灯光 / Basic→Standard。生产文件零改动。
// 用法：NODE_PATH=... node tools/art-lab-dusk.cjs [tag]
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const URL = process.env.GC_URL || 'https://zgqy379.github.io/guangchang/';
const TAG = process.argv[2] || 'dusk';
const PLASTER = process.env.PLASTER === '1';
const GLAZE = process.env.GLAZE === '1';
const HERO = process.env.HERO === '1';
const OUT = path.resolve('docs/design/proofs/art-style');
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const CAM = process.env.HERO === '1'
  ? { pos: [40, 2.75, 2.4], look: [-1, 4.15, -1.0], fov: 43 }
  : { pos: [45, 2.2, 3.1], look: [-1, 3.55, -1.2], fov: 45 };

(async () => {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--window-size=1600,980'],
  });
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

  // 强制浅色主题（黄昏天幕由运行时重画，不依赖主题）
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
  await wait(2600);

  const info = await page.evaluate(({ CAM, PLASTER, GLAZE, HERO }) => {
    const scene = window.__st, gl = window.__gl, cam = window.__cam;
    if (!scene || !gl || !cam) return { error: 'missing hooks' };
    const report = { converted: 0, lights: [], sunNdc: null, sky: false };

    cam.fov = CAM.fov;
    cam.position.set(...CAM.pos);
    cam.lookAt(...CAM.look);
    cam.updateProjectionMatrix();

    // —— 天空穹顶：重画黄昏渐变 ——
    let skyMesh = null;
    scene.traverse((o) => {
      if (!skyMesh && o.isMesh && o.material && o.material.side === 1 && o.material.map) skyMesh = o;
    });
    if (skyMesh) {
      const Ctor = skyMesh.material.map.constructor;
      const c = document.createElement('canvas');
      c.width = 4; c.height = 512;
      const g = c.getContext('2d');
      const grad = g.createLinearGradient(0, 0, 0, 512);
      grad.addColorStop(0.00, '#3f567d');
      grad.addColorStop(0.30, '#76809a');
      grad.addColorStop(0.44, '#c9a596');
      grad.addColorStop(0.492, '#ffc98f');
      grad.addColorStop(0.512, '#ffb877');
      grad.addColorStop(0.60, '#e2a583');
      grad.addColorStop(1.00, '#b98f7e');
      g.fillStyle = grad;
      g.fillRect(0, 0, 4, 512);
      const tex = new Ctor(c);
      tex.colorSpace = 'srgb';
      tex.needsUpdate = true;
      skyMesh.material.map = tex;
      skyMesh.material.color.set('#ffffff');
      skyMesh.material.needsUpdate = true;
      report.sky = true;
    }
    scene.background = scene.background && scene.background.isColor
      ? scene.background.set('#e0b48f')
      : scene.background;

    // —— 太阳：找到场景里那颗太阳（球 + 46 宽 sprite），压到地平线上 ——
    const sunPos = [-132, 14, 6];
    let sunGroup = null;
    scene.traverse((o) => {
      if (sunGroup) return;
      if (o.isGroup && o.children.length === 2) {
        const hasSprite = o.children.some((c) => c.isSprite);
        const hasBall = o.children.some((c) => c.isMesh && c.geometry && c.geometry.type === 'SphereGeometry');
        if (hasSprite && hasBall) sunGroup = o;
      }
    });
    if (sunGroup) {
      sunGroup.position.set(...sunPos);
      sunGroup.traverse((o) => {
        if (o.isSprite) {
          o.scale.set(HERO ? 54 : 64, HERO ? 54 : 64, 1);
          o.material.color.set(HERO ? '#ff9c58' : '#ffd2a0');
          o.material.opacity = HERO ? 0.72 : 0.92;
        }
        if (o.isMesh && o.material) o.material.color.set('#fff0d2');
      });
      sunGroup.updateMatrixWorld(true);
      cam.updateMatrixWorld(true);
      const p = sunGroup.position.clone().project(cam);
      report.sunNdc = [p.x, p.y];
    }

    // —— 灯光 ——
    const lights = [];
    scene.traverse((o) => { if (o.isLight) lights.push(o); });
    const key = lights.find((l) => l.isDirectionalLight && l.castShadow);
    const fill = lights.find((l) => l.isDirectionalLight && !l.castShadow);
    const hemi = lights.find((l) => l.isHemisphereLight);
    if (key) {
      key.position.set(...sunPos);
      key.color.set('#ffb277');
      key.intensity = HERO ? 3.9 : 3.4;
      key.shadow.needsUpdate = true;
      report.lights.push('key');
    }
    if (fill) {
      fill.position.set(52, 18, 34);
      fill.color.set('#8fb2da');
      fill.intensity = 0.42;
      report.lights.push('fill');
    }
    if (hemi) {
      hemi.color.set('#ffd0a4');
      hemi.groundColor.set('#4a4750');
      hemi.intensity = 0.62;
      report.lights.push('hemi');
    }

    gl.toneMappingExposure = GLAZE ? 1.06 : 1.02;
    scene.environmentIntensity = GLAZE ? 1.15 : 0.7;
    if (scene.fog) {
      scene.fog.color.set('#e3b691');
      scene.fog.near = 20;
      scene.fog.far = 138;
    }
    gl.shadowMap.needsUpdate = true;

    // —— Basic → Standard：让楼体吃逆光与阴影 ——
    let Std = null;
    scene.traverse((o) => {
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!Std && m && m.isMeshStandardMaterial) Std = m.constructor;
    });
    if (Std) {
      scene.traverse((o) => {
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        let did = false;
        const next = mats.map((m) => {
          if (!m || !m.isMeshBasicMaterial) return m;
          if (m.side === 1 || m.fog === false) return m;
          if (m.transparent) return m;
          if (m.toneMapped === false) return m;
          const s = new Std();
          s.name = 'labStd';
          s.color.copy(m.color);
          if (m.map) s.map = m.map;
          s.roughness = 0.74;
          s.metalness = 0.05;
          s.side = m.side;
          s.vertexColors = m.vertexColors;
          s.depthWrite = m.depthWrite;
          s.depthTest = m.depthTest;
          s.toneMapped = m.toneMapped;
          s.envMapIntensity = 0.8;
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

    // —— 路灯点亮（黄昏首灯）：实例灯头自发光 ——
    scene.traverse((o) => {
      if (!o.isInstancedMesh || !o.geometry) return;
      if (o.geometry.type !== 'SphereGeometry') return;
      const m = o.material;
      if (!m || !m.isMeshStandardMaterial) return;
      m.emissive = m.emissive || m.color.clone();
      m.emissive.set('#ffb765');
      m.emissiveIntensity = 2.2;
      m.color.set('#ffe0b0');
      m.needsUpdate = true;
      report.lights.push('lamps-on');
    });

    // 云带压薄、染暖
    scene.traverse((o) => {
      if (o.isMesh && o.material && o.material.side === 1 && o.material.transparent && o.material.map && o.material.fog === false) {
        o.material.color.set('#ffd7b6');
        o.material.opacity = 0.22;
      }
    });

    // 斑马线：远距离满不透明度会把路口烧成一块白幕（街平视尤其致命）
    scene.traverse((o) => {
      if (!o.isMesh || !o.geometry || !o.geometry.parameters) return;
      const p = o.geometry.parameters;
      if (p.width === 0.5 && p.height === 9.6 && o.material) {
        o.material.transparent = true;
        o.material.opacity = 0.14;
        o.material.needsUpdate = true;
      }
    });

    // 地面天光反射贴片：压到薄薄一层，别在逆光下变白漆
    scene.traverse((o) => {
      if (!o.isMesh || !o.geometry || !o.geometry.parameters) return;
      const p = o.geometry.parameters;
      if (p.width === 96 && p.height === 96 && o.material && o.material.blending === 2) {
        o.material.opacity = Math.min(o.material.opacity ?? 0.2, 0.09);
        o.material.needsUpdate = true;
      }
    });

    // 行道树：低模绿球在天光下最抢眼，压成暮色橄榄
    scene.traverse((o) => {
      if (!o.isInstancedMesh || !o.instanceColor) return;
      const m = o.material;
      if (!m) return;
      const col = o.instanceColor;
      for (let i = 0; i < col.count; i++) {
        const c = col.getX(i), g = col.getY(i), b = col.getZ(i);
        // 只处理绿色占优的实例（树冠），其余（灯条/宝石）不动
        if (!(g > c * 1.15 && g > b * 1.15)) continue;
        const l = 0.2126 * c + 0.7152 * g + 0.0722 * b;
        col.setXYZ(i, l * 0.72 + 0.012, l * 0.84 + 0.01, l * 0.68 + 0.014);
      }
      col.needsUpdate = true;
    });

    // 四区饱和色（尤其 #4a9eff 蓝顶）在逆光里像塑料玩具：统一褪饱和 + 压暗
    // （釉面模式走自己的配色，跳过这一步）
    const IND = ['#4a9eff', '#d4a72c', '#f0883e', '#c678dd'];
    const near = (col, hex) => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      return Math.abs(col.r - r) < 0.02 && Math.abs(col.g - g) < 0.02 && Math.abs(col.b - b) < 0.02;
    };
    scene.traverse((o) => {
      if (GLAZE) return;
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m || !m.color) continue;
        if (!IND.some((h) => near(m.color, h))) continue;
        m.color.offsetHSL(0, -0.3, -0.05);
      }
      if (o.isInstancedMesh && o.instanceColor) {
        const proto = mats.find((m) => m && m.color);
        if (!proto) return;
        const tmp = proto.color.clone();
        const col = o.instanceColor;
        for (let i = 0; i < col.count; i++) {
          const c = { r: col.getX(i), g: col.getY(i), b: col.getZ(i) };
          if (!IND.some((h) => near(c, h))) continue;
          tmp.setRGB(c.r, c.g, c.b).offsetHSL(0, -0.3, -0.05);
          col.setXYZ(i, tmp.r, tmp.g, tmp.b);
        }
        col.needsUpdate = true;
      }
    });

    // —— 石膏 / 釉面瓷模型：把所有受光面压成同一族材质，靠明度保留体块 ——
    if (PLASTER || GLAZE) {
      const GLAZE_TINTS = HERO
        ? [
            { hex: '#4a9eff', rgb: [0.67, 0.78, 0.82] },   // 互联网 · 青釉
            { hex: '#d4a72c', rgb: [0.86, 0.76, 0.55] },   // 金融 · 米金
            { hex: '#f0883e', rgb: [0.87, 0.69, 0.58] },   // 智造 · 陶土
            { hex: '#c678dd', rgb: [0.79, 0.66, 0.78] },   // 文创 · 藕紫
          ]
        : [
            { hex: '#4a9eff', rgb: [0.73, 0.82, 0.85] },   // 互联网 · 青釉
            { hex: '#d4a72c', rgb: [0.89, 0.82, 0.66] },   // 金融 · 米金
            { hex: '#f0883e', rgb: [0.91, 0.76, 0.67] },   // 智造 · 陶土
            { hex: '#c678dd', rgb: [0.86, 0.76, 0.83] },   // 文创 · 藕紫
          ];
      const hexRgb = (hex) => [
        parseInt(hex.slice(1, 3), 16) / 255,
        parseInt(hex.slice(3, 5), 16) / 255,
        parseInt(hex.slice(5, 7), 16) / 255,
      ];
      const glazeOf = (c) => {
        const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
        for (const t of GLAZE_TINTS) {
          const [r, g, b] = hexRgb(t.hex);
          if (Math.abs(c.r - r) < 0.03 && Math.abs(c.g - g) < 0.03 && Math.abs(c.b - b) < 0.03) {
            const k = 0.9 + l * 0.16;
            return t.rgb.map((v) => v * k);
          }
        }
        const v = 0.87 + l * 0.1;
        return [v, v * 0.972, v * 0.925];
      };
      scene.traverse((o) => {
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (!m || !m.color) continue;
          if (m.side === 1 || m.fog === false) continue;      // 天空/云/太阳
          if (m.toneMapped === false) continue;                // 发光标牌保持
          if (m.transparent && m.map) continue;                // 带图透明片不动
          if (m.transparent) {                                 // 玻璃窗 → 深釉凹槽
            m.color.set(GLAZE ? '#5b6c78' : '#6f675c');
            m.opacity = Math.min(m.opacity ?? 0.5, 0.5);
            if (GLAZE && m.isMeshStandardMaterial) {
              m.roughness = 0.12;
              m.metalness = 0.25;
              m.envMapIntensity = 1.5;
            }
            m.needsUpdate = true;
            continue;
          }
          if (m.map) continue;                                 // 文本/贴图牌面保留
          if (!GLAZE) {
            const l = 0.2126 * m.color.r + 0.7152 * m.color.g + 0.0722 * m.color.b;
            const v = 0.60 + l * 0.36;                         // 0.60–0.96
            m.color.setRGB(v * 1.0, v * 0.965, v * 0.905);
          } else {
            const [r, g, b] = glazeOf(m.color);
            m.color.setRGB(r, g, b);
          }
          if (m.isMeshStandardMaterial) {
            m.roughness = GLAZE ? 0.27 : 0.94;
            m.metalness = GLAZE ? 0.04 : 0.0;
            m.envMapIntensity = GLAZE ? 1.35 : 0.8;
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
            const c = { r: col.getX(i), g: col.getY(i), b: col.getZ(i) };
            if (!GLAZE) {
              const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
              const v = 0.58 + l * 0.4;
              col.setXYZ(i, v, v * 0.965, v * 0.9);
              continue;
            }
            // 树冠（绿占优）→ 青瓷；其余 → 暖白釉
            if (c.g > c.r * 1.12 && c.g > c.b * 1.12) {
              col.setXYZ(i, 0.66, 0.73, 0.66);
            } else {
              const [r, g, b] = glazeOf(c);
              col.setXYZ(i, r, g, b);
            }
          }
          col.needsUpdate = true;
        }
      });
      if (HERO) {
        // 中央信标：给画面一根暖金中轴，呼应 UI 的金线
        scene.traverse((o) => {
          if (!o.isMesh || !o.geometry || !o.geometry.parameters) return;
          const p = o.geometry.parameters;
          const m = Array.isArray(o.material) ? o.material[0] : o.material;
          if (!m) return;
          const world = o.getWorldPosition(new (o.position.constructor)());
          if (o.geometry.type === 'CylinderGeometry' && p.height === 5 && Math.abs(world.x) < 1 && Math.abs(world.z) < 1) {
            if (m.emissive) {
              m.emissive.set('#ffb45e');
              m.emissiveIntensity = 1.15;
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
      }

      // 灯头/信标保持一点暖光，让模型里有"正在使用"的痕迹
      scene.traverse((o) => {
        if (!o.isInstancedMesh || !o.geometry || o.geometry.type !== 'SphereGeometry') return;
        const m = o.material;
        if (!m || !m.isMeshStandardMaterial) return;
        m.emissive.set('#ffc078');
        m.emissiveIntensity = 2.4;
        m.color.set('#ffe2b8');
        m.needsUpdate = true;
      });
    }

    return report;
  }, { CAM, PLASTER, GLAZE, HERO });
  log(JSON.stringify(info));

  // 隐藏全部 UI
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
  await wait(2600);

  const file = path.join(OUT, `raw-${TAG}.png`);
  await page.screenshot({ path: file });
  fs.writeFileSync(path.join(OUT, `raw-${TAG}.json`), JSON.stringify(info, null, 2));
  log('saved ' + file);
  await browser.close();
})();
