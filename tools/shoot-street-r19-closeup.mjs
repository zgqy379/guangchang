// R19 特写验证：参数碑数字面 + 行业原型道具（昼/夜各一组）
// 机位：lot01 星链科技（internet, slot0 side+1, position [14,0,7.4], rotY=PI）
//   碑 local(-1.05,·,-0.55) → world(15.05,·,7.95)，面冲 -z（街心）
//   原型 local(0.98,·,-0.5) → world(13.02,·,7.90)
const task = await taskSpace('gc-closeup-' + Date.now());
const page = task.page('p1');
const fs = await import('node:fs');
const OUT = 'E:/guangchang/docs/figures/street-2026-11-04-r19';
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });

async function enter(hour) {
  try { await page.goto(`http://localhost:4173/?hour=${hour}&v=${Date.now()}`); } catch (e) {}
  await wait(5000);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) =>
      (x.textContent || '').includes('进入街区') || (x.textContent || '').includes('招聘街区'));
    b?.click();
  }).catch(() => {});
  for (let i = 0; i < 90; i++) {
    await wait(2000);
    try {
      const calls = await page.evaluate(() => window.__gl?.info?.render?.calls ?? 0);
      if (calls > 0) { console.log('ready, calls =', calls); break; }
    } catch {}
  }
  await wait(4000);
}

async function camShot(name, px, py, pz, tx, ty, tz) {
  // 鸟瞰未交互态相机静止——直接改写 __cam 位姿
  await page.evaluate((o) => {
    const cam = window.__cam;
    cam.position.set(o.px, o.py, o.pz);
    cam.lookAt(o.tx, o.ty, o.tz);
  }, { px, py, pz, tx, ty, tz });
  await wait(700);
  for (let i = 0; i < 5; i++) {
    try {
      await page.screenshot({ path: `${OUT}/${name}.png` });
      console.log('shot:', name);
      return;
    } catch (e) { await wait(3000); }
  }
  console.error('FAILED:', name);
}

await enter(10);
// 碑正面（从街心看）：数字面在碑身下段
await camShot('closeup-stele-day', 15.05, 1.35, 4.6, 15.05, 0.75, 7.95);
// 摊位原型（互联网=悬浮数据节点，镜头稍高带一点摊位全貌）
await camShot('closeup-proto-day', 12.2, 1.7, 4.9, 13.2, 0.85, 7.9);

await enter(21);
await camShot('closeup-stele-night', 15.05, 1.35, 4.6, 15.05, 0.75, 7.95);
await camShot('closeup-proto-night', 12.2, 1.7, 4.9, 13.2, 0.85, 7.9);

fs.writeFileSync(`${OUT}/closeup-done.txt`, 'done ' + new Date().toISOString());
console.log('DONE');
