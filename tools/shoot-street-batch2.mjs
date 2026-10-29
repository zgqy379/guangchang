// 街区批次②视觉采集（egolite）
// 产出：docs/figures/street-2026-10-29-batch2/{day-bird,day-focus,night-bird,night-walk}.png
// ?hour= 冻结环境时间 → 昼/夜可复现（engine/time.ts FROZEN_HOUR）
const task = await taskSpace('gc-shoot-' + Date.now());
const page = task.page('p1');
const fs = await import('node:fs');

const OUT = 'E:/guangchang/docs/figures/street-2026-10-29-batch2';
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await page.cdp('Emulation.setDeviceMetricsOverride', {
  width: 1600,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});

async function enterStreet(hour) {
  // ego 的 page.goto 有 15s 硬超时；街区 45MB 资产常超——超时不等于没加载，继续等就绪即可
  try {
    await page.goto(`http://localhost:4173/?hour=${hour}&v=${Date.now()}`);
  } catch (e) {
    console.error('goto timeout (继续等待就绪):', hour);
  }
  await wait(4000);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) =>
      (x.textContent || '').includes('进入街区') || (x.textContent || '').includes('招聘街区')
    );
    b?.click();
  }).catch(() => {});
  for (let i = 0; i < 30; i++) {
    await wait(2000);
    try {
      const ok = await page.evaluate(() => !!document.querySelector('canvas') && !!window.__st);
      if (ok) break;
    } catch {
      /* 加载期主线程忙 */
    }
  }
  // 渲染就绪：等 renderer 真正出帧（draw call > 0）且连续两次非零，
  // 否则截图会撞上 CDP 15s 超时（Runtime.evaluate 阻塞）。
  for (let i = 0; i < 20; i++) {
    await wait(2000);
    try {
      const calls = await page.evaluate(() => window.__gl?.info?.render?.calls ?? 0);
      if (calls > 0) {
        await wait(2500);
        console.log('ready, drawCalls =', calls);
        break;
      }
    } catch {
      /* 主线程仍忙 */
    }
  }
  await wait(4000);
}

// 截图带重试：主线程被资产加载占住时 CDP 会超时，稍后重试通常就过
async function shot(name) {
  for (let i = 0; i < 6; i++) {
    try {
      await page.screenshot({ path: `${OUT}/${name}.png` });
      console.log('shot:', name, `try=${i + 1}`);
      return;
    } catch (e) {
      console.error('shot retry:', name, i + 1, String(e).slice(0, 80));
      await wait(4000);
    }
  }
  console.error('shot FAILED:', name);
}

// 取 canvas 中心（主线程忙时会超时，返回 null 跳过该步而不中断整场）
async function canvasCenter() {
  try {
    return await page.evaluate(() => {
      const r = document.querySelectorAll('canvas')[0].getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
  } catch (e) {
    console.error('canvasCenter failed:', String(e).slice(0, 80));
    return null;
  }
}

// 等 HUD 真正可见（进度卡存在 + 非零尺寸 + 不透明）——否则截到入场动画半途的「无 HUD 帧」
// （R18 复评点名：day-walk 缺 HUD，评审会读成漏版）
async function waitForHud(tag) {
  for (let i = 0; i < 20; i++) {
    await wait(1500);
    try {
      const ok = await page.evaluate(() => {
        const el = document.querySelector('.game-hud');
        if (!el) return false;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 10 && r.height > 10 && Number(cs.opacity) > 0.6 && cs.visibility !== 'hidden';
      });
      if (ok) {
        console.log('hud ready:', tag);
        return true;
      }
    } catch {
      /* 主线程忙 */
    }
  }
  console.error('hud NOT ready:', tag);
  return false;
}

// —— 昼间（?hour=10）：鸟瞰 + 特写 ——
await enterStreet(10);
await shot('day-bird');
// 点地面漫游 → 越肩跟随机位
const box = await canvasCenter();
if (box) {
  await page.mouse.click(box.x + 180, box.y + 70, { label: 'walk' });
  await wait(4000);
  await waitForHud('day-walk');
  await shot('day-walk');
}

// —— 夜间（?hour=21）：鸟瞰 + 行走 ——
await enterStreet(21);
await shot('night-bird');
const box2 = await canvasCenter();
if (box2) {
  await page.mouse.click(box2.x + 180, box2.y + 70, { label: 'walk' });
  await wait(4000);
  await waitForHud('night-walk');
  await shot('night-walk');
}

const stats = await page.evaluate(() => {
  const gl = window.__gl;
  return {
    drawCalls: gl?.info?.render?.calls ?? null,
    triangles: gl?.info?.render?.triangles ?? null,
    geometries: gl?.info?.memory?.geometries ?? null,
    textures: gl?.info?.memory?.textures ?? null,
  };
});
console.log('night stats:', JSON.stringify(stats));
fs.writeFileSync(`${OUT}/stats.json`, JSON.stringify(stats, null, 1));
console.log('DONE');
