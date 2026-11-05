// D2 立体参数沙盘采集（2026-11-05）：64 栋参数楼 + draw calls 红线 + T9 全量包围盒
// 照 tools/shoot-diorama-d1.mjs 结构，输出独立目录，供循环工作流 R2 审查取证。
//
// 就绪判定仍以 window.__gl.info.render.calls > 0 为准（lessons §13.7），
// 不以 window.__diorama 出现为依据（它远早于首帧，会拍到半成品帧）。

const task = await taskSpace('gc-diorama-d2-' + Date.now());
const page = task.page('p1');
const fs = await import('node:fs');
const OUT = 'E:/guangchang/docs/figures/diorama-2026-11-05-d2';
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const lines = [];
const note = (s) => { lines.push(String(s)); console.log(s); };
const flush = (extra) => {
  try {
    fs.writeFileSync(`${OUT}/d2-done.txt`, lines.concat(extra || []).join('\n') + '\n');
  } catch (e) {
    console.error('write d2-done.txt FAILED:', e);
  }
};

await page.cdp('Emulation.setDeviceMetricsOverride', {
  width: 1600, height: 900, deviceScaleFactor: 1, mobile: false,
});

let ready = false;
let calls = 0;
let diag = null;
let shotOk = false;

try {
  try {
    await page.goto(`http://localhost:4173/?hour=10&mode=diorama&v=${Date.now()}`);
    note('goto ok: /?hour=10&mode=diorama');
  } catch (e) {
    note('goto timeout (继续等待): ' + (e?.message || e));
  }
  await wait(5000);

  for (let i = 0; i < 90; i++) {
    await wait(2000);
    try {
      calls = await page.evaluate(() => window.__gl?.info?.render?.calls ?? 0);
      if (calls > 0) { ready = true; note(`ready, drawCalls = ${calls} at ${i * 2}s`); break; }
    } catch (e) { /* evaluate 偶发超时，继续轮询 */ }
  }
  if (!ready) note('NOT READY after 3min (drawCalls stayed 0)');

  try {
    diag = await page.evaluate(() => {
      const d = window.__diorama;
      if (!d) return null;
      return {
        cameraPosition: d.cameraPosition,
        cameraOutside: d.cameraOutside,
        minGap: d.minGap,
        volumeCount: d.volumeCount,
        volumeRange: d.volumeRange,
        buildingVolumes: (d.volumes || []).filter((v) => v.name.startsWith('参数楼')).length,
      };
    });
  } catch (e) {
    note('diag evaluate failed: ' + (e?.message || e));
  }
  note('diag = ' + JSON.stringify(diag));

  await wait(5000);

  async function shot(name) {
    for (let i = 0; i < 6; i++) {
      try {
        await page.screenshot({ path: `${OUT}/${name}.png` });
        note(`shot: ${name}.png`);
        return true;
      } catch (e) {
        note(`shot retry ${i + 1}: ${e?.message || e}`);
        await wait(4000);
      }
    }
    note('shot FAILED: ' + name);
    return false;
  }

  shotOk = await shot('d2-buildings');
  note('DONE');
} finally {
  flush([
    `url=http://localhost:4173/?hour=10&mode=diorama`,
    `ready=${ready}`,
    `drawCalls=${calls}`,
    `drawCallsRedLine=150`,
    `drawCallsPass=${ready && calls <= 150}`,
    `diag=${JSON.stringify(diag)}`,
    `screenshot=${shotOk ? 'd2-buildings.png' : 'FAILED'}`,
    'done ' + new Date().toISOString(),
  ]);
  await task.finish({ keep: 'all' });
}
