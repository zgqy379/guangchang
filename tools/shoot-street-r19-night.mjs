// R19 夜间重拍（最终构建）：night-bird / night-walk
const task = await taskSpace('gc-shoot-' + Date.now());
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
for (let i = 0; i < 90; i++) {
  await wait(2000);
  try {
    const calls = await page.evaluate(() => window.__gl?.info?.render?.calls ?? 0);
    if (calls > 400) { console.log('ready, calls =', calls); break; }
  } catch {}
}
await wait(5000);

async function shot(name) {
  for (let i = 0; i < 6; i++) {
    try { await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('shot:', name); return; }
    catch (e) { await wait(4000); }
  }
  console.error('shot FAILED:', name);
}

await shot('night-bird');
let box = null;
try {
  box = await page.evaluate(() => {
    const r = document.querySelectorAll('canvas')[0].getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
} catch (e) {}
if (box) {
  await page.mouse.click(box.x + 180, box.y + 70, { label: 'walk' });
  await wait(4500);
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
      if (ok) { console.log('hud ready'); break; }
    } catch {}
  }
  await shot('night-walk');
}
const stats = await page.evaluate(() => {
  const gl = window.__gl;
  return { drawCalls: gl?.info?.render?.calls ?? null, triangles: gl?.info?.render?.triangles ?? null };
});
fs.writeFileSync(`${OUT}/stats.json`, JSON.stringify(stats, null, 1));
fs.writeFileSync(`${OUT}/night-done.txt`, 'done ' + new Date().toISOString());
console.log('DONE');
