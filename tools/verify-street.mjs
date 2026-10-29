// 街区运行时验收（egolite · 唯一指定的浏览器验证路径）
//
// 量五件事，输出可复现数字：
//   1. GL 渲染器 + 实测 fps —— 量具自检。egolite 窗口被遮挡/后台时 rAF 被节流到 1–2fps，
//      此时"骨骼没动"只是采样窗口不足一帧的假象（2026-10-29 踩过），不是产品缺陷。
//   2. 骨骼动画增量（长窗口）：行走 vs 站定
//   3. 作品廊标签可见性：鸟瞰应隐藏（不再浮在远景屋顶上）、走近应出现
//   4. draw call / 三角面（鸟瞰与特写两个机位分别取——数值随机位变化，单一口径会骗人）
//   5. 控制台告警（缺剪辑假告警应在修复后消失）
//
// 用法：ego-browser nodejs < tools/verify-street.mjs
const task = await taskSpace('gc-verify-' + Date.now());
const page = task.page('p1');
const fs = await import('node:fs');

const OUT = 'E:/guangchang/docs/figures/verify';
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (file) => {
  try {
    await page.screenshot({ path: file });
    return true;
  } catch (e) {
    console.error('[shot skipped]', file, String(e).slice(0, 120));
    return false;
  }
};
const probe = async (fn, tries = 4) => {
  for (let i = 0; i < tries; i++) {
    try {
      return await page.evaluate(fn);
    } catch (e) {
      if (i === tries - 1) throw e;
      await wait(4000);
    }
  }
};
// fps：自带超时上限，窗口被节流时也不会把 evaluate 拖到 15s 超时
const FPS = async () =>
  page.evaluate(async () => {
    const t0 = performance.now();
    let f = 0;
    await new Promise((res) => {
      const timer = setTimeout(res, 1200);
      const loop = () => {
        f++;
        if (performance.now() - t0 < 1000) requestAnimationFrame(loop);
        else {
          clearTimeout(timer);
          res();
        }
      };
      requestAnimationFrame(loop);
    });
    return f;
  });

await page.cdp('Emulation.setDeviceMetricsOverride', {
  width: 1600,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
// 控制台告警捕获（修复前会有 avatar-walk 假告警）
await page.cdp('Page.addScriptToEvaluateOnNewDocument', {
  source: `window.__warns=[];const ow=console.warn.bind(console);console.warn=function(...a){window.__warns.push({t:Math.round(performance.now()),m:a.map(String).join(' ')});return ow(...a);};`,
});
await page.goto('http://localhost:4173/');
await wait(4000);
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) =>
    (x.textContent || '').includes('进入街区') || (x.textContent || '').includes('招聘街区')
  );
  b?.click();
});

let ready = false;
for (let i = 0; i < 30 && !ready; i++) {
  await wait(2000);
  try {
    ready = await page.evaluate(() => !!document.querySelector('canvas') && !!window.__st);
  } catch {
    /* 加载期主线程忙 */
  }
}
if (!ready) {
  console.error('STREET NOT READY after 60s');
  process.exit(1);
}
await wait(2500);

const PROBE = () => {
  const scene = window.__st;
  const cam = window.__cam;
  const gl = window.__gl;
  if (!scene || !cam) return { error: 'debug hooks missing' };

  const player = window.__roam?.position?.current;
  let playerMesh = null;
  let playerDist = Infinity;
  let skinCount = 0;
  scene.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    skinCount++;
    if (!player) return;
    const w = o.getWorldPosition(new o.position.constructor());
    const d = w.distanceTo(player);
    if (d < playerDist) {
      playerDist = d;
      playerMesh = o;
    }
  });
  const bones = playerMesh?.skeleton?.bones ?? [];
  const quats = bones.flatMap((b) => b.quaternion.toArray().map((v) => +v.toFixed(3)));

  // 摊位名牌（3D 贴图板 plane 1.45×0.27）
  let plate = null;
  scene.traverse((o) => {
    if (!o.isMesh || o.geometry?.type !== 'PlaneGeometry') return;
    const p = o.geometry.parameters || {};
    if (p.width !== 1.45) return;
    const w = o.getWorldPosition(new o.position.constructor()).clone();
    const s = w.project(cam);
    plate = {
      x: Math.round(((s.x + 1) / 2) * innerWidth),
      y: Math.round(((1 - s.y) / 2) * innerHeight),
      w: Math.round((p.width / 2) * 300),
      h: Math.round((p.height / 2) * 300),
    };
  });

  // 作品廊标签：叶子节点含「作品廊」；drei 会在点位于相机背后时置 display:none
  const labelEl = [...document.querySelectorAll('div')].find(
    (d) => d.children.length === 0 && (d.textContent || '').includes('作品廊')
  );
  const labelRect = labelEl ? labelEl.getBoundingClientRect().toJSON() : null;

  let renderer = null;
  try {
    const ctx = gl.getContext();
    const dbg = ctx.getExtension('WEBGL_debug_renderer_info');
    renderer = dbg ? ctx.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER);
  } catch {
    /* 拿不到就算了 */
  }

  return {
    drawCalls: gl?.info?.render?.calls ?? null,
    triangles: gl?.info?.render?.triangles ?? null,
    geometries: gl?.info?.memory?.geometries ?? null,
    textures: gl?.info?.memory?.textures ?? null,
    skinCount,
    playerDist: +playerDist.toFixed(2),
    quats,
    plate,
    labelRect,
    labelVisible: labelRect ? labelRect.width > 0 && labelRect.height > 0 : false,
    renderer,
    player: player ? { x: +player.x.toFixed(2), z: +player.z.toFixed(2) } : null,
  };
};

const overlap = (a, b) => {
  if (!a || !b) return null;
  const w = Math.min(a.right, b.x + b.w / 2) - Math.max(a.left, b.x - b.w / 2);
  const h = Math.min(a.bottom, b.y + b.h / 2) - Math.max(a.top, b.y - b.h / 2);
  return w > 0 && h > 0 ? Math.round(w * h) : 0;
};
// 骨骼四元数变化幅度（两快照逐骨比较）
const quatDelta = (a, b) => {
  if (!a || !b || a.length !== b.length) return null;
  let changed = 0;
  let sum = 0;
  for (let i = 0; i < a.length; i += 4) {
    const d =
      Math.abs(a[i] - b[i]) +
      Math.abs(a[i + 1] - b[i + 1]) +
      Math.abs(a[i + 2] - b[i + 2]) +
      Math.abs(a[i + 3] - b[i + 3]);
    if (d > 0.02) changed++;
    sum += d;
  }
  return { changedBones: changed, totalBones: a.length / 4, sumDelta: +sum.toFixed(3) };
};

const report = {};

// ① 鸟瞰机位
const bird = await probe(PROBE);
const fpsBird = await FPS();
await shot(OUT + '/street-bird.png');
report.bird = {
  drawCalls: bird.drawCalls,
  triangles: bird.triangles,
  geometries: bird.geometries,
  textures: bird.textures,
  skinCount: bird.skinCount,
  fps: fpsBird,
  labelVisible: bird.labelVisible,
  renderer: bird.renderer,
};

// ② 行走 vs 站定：采样窗口必须跨过至少一帧（fps 低时窗口要更长）
const WINDOW_MS = fpsBird >= 20 ? 600 : 2600;
const canvasBox = await page.evaluate(() => {
  const r = document.querySelectorAll('canvas')[0].getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
});
await page.mouse.click(canvasBox.x + 200, canvasBox.y + 90, { label: 'walk' });
await wait(900);
const walk1 = await probe(PROBE);
await wait(WINDOW_MS);
const walk2 = await probe(PROBE);
const moved = Math.hypot(
  (walk2.player?.x ?? 0) - (walk1.player?.x ?? 0),
  (walk2.player?.z ?? 0) - (walk1.player?.z ?? 0)
);
// 站定后再采一次
await wait(3000);
const idle1 = await probe(PROBE);
await wait(WINDOW_MS);
const idle2 = await probe(PROBE);
report.walk = {
  windowMs: WINDOW_MS,
  moving: quatDelta(walk1.quats, walk2.quats),
  idle: quatDelta(idle1.quats, idle2.quats),
  movedDuringSampling: +moved.toFixed(3),
  playerAtWalk: walk1.player,
  playerAtIdle: idle1.player,
  playerMeshDist: walk1.playerDist,
};

// ③ 走近作品廊入口：标签应出现
await page.evaluate(() => {
  const t = window.__roam?.teleportTo;
  if (t?.current) t.current.set(0, 0, 14);
});
await wait(6000);
const nearGallery = await probe(PROBE);
await shot(OUT + '/street-gallery.png');
report.nearGallery = {
  labelVisible: nearGallery.labelVisible,
  labelRect: nearGallery.labelRect,
  plate: nearGallery.plate,
  overlapPx: overlap(nearGallery.labelRect, nearGallery.plate),
  player: nearGallery.player,
  drawCalls: nearGallery.drawCalls,
  triangles: nearGallery.triangles,
};

// ④ 控制台告警
const warns = await page.evaluate(() => window.__warns ?? []);
report.warns = warns;

console.log(JSON.stringify(report, null, 1));
fs.writeFileSync(OUT + '/report.json', JSON.stringify(report, null, 1));
