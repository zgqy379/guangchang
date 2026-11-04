// R19 夜间特写补拍：参数碑数字面 + 行业原型道具
const task = await taskSpace('gc-closeup-' + Date.now());
const page = task.page('p1');
const fs = await import('node:fs');
const OUT = 'E:/guangchang/docs/figures/street-2026-11-04-r19';
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });

try { await page.goto(`http://localhost:4173/?hour=21&v=${Date.now()}`); } catch (e) {}
await wait(5000);
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) =>
    (x.textContent || '').includes('进入街区') || (x.textContent || '').includes('招聘街区'));
  b?.click();
}).catch(() => {});
// 就绪门槛提到 400+ drawCalls（街区完整渲染量），防止撞上「1 call 加载中」假就绪
for (let i = 0; i < 90; i++) {
  await wait(2000);
  try {
    const calls = await page.evaluate(() => window.__gl?.info?.render?.calls ?? 0);
    if (calls > 400) { console.log('ready, calls =', calls); break; }
  } catch {}
}
await wait(5000);

async function camShot(name, px, py, pz, tx, ty, tz) {
  try {
    await page.evaluate((o) => {
      const cam = window.__cam;
      cam.position.set(o.px, o.py, o.pz);
      cam.lookAt(o.tx, o.ty, o.tz);
    }, { px, py, pz, tx, ty, tz });
  } catch (e) { console.error('cam set timeout, retry'); await wait(6000); }
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

await camShot('closeup-stele-night', 15.05, 1.35, 4.6, 15.05, 0.75, 7.95);
await camShot('closeup-proto-night', 12.2, 1.7, 4.9, 13.2, 0.85, 7.9);
fs.writeFileSync(`${OUT}/closeup-night-done.txt`, 'done ' + new Date().toISOString());
console.log('DONE');
