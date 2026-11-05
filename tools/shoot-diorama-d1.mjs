// D1 立体参数沙盘采集（2026-11-05）
// 照 tools/shoot-street-r19-day.mjs 的结构，改为 ?mode=diorama 深链直达。
//
// 与范例的差异（任务书硬要求）：
//   · goto('?hour=10&mode=diorama&v=...')，删掉点「进入街区」按钮那一步（深链直达，
//     否则角色门盖住顶栏、脚本点不到任何东西）
//   · 就绪判定轮询 window.__gl.info.render.calls > 0（lessons §13.7：不能只等
//     window.__diorama，它远早于首帧，会拍到无内容半成品帧），再 wait 5s 才截
//   · 关键结果写文件（console.log 在 egolite 会丢）；截图 6 次重试
//   · 结尾必须 await task.finish({ keep: [] })（默认关闭空间、释放页签；见 docs/lessons.md §13.13）

const task = await taskSpace('gc-diorama-d1-' + Date.now());
const page = task.page('p1');
const fs = await import('node:fs');
const OUT = 'E:/guangchang/docs/figures/diorama-2026-11-05-d1';
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// egolite 的 console.log 会丢 → 所有关键结论同时累积到内存并写文件
const lines = [];
const note = (s) => {
  lines.push(String(s));
  console.log(s);
};
const flush = (extra) => {
  try {
    fs.writeFileSync(`${OUT}/d1-done.txt`, lines.concat(extra || []).join('\n') + '\n');
  } catch (e) {
    console.error('write d1-done.txt FAILED:', e);
  }
};

await page.cdp('Emulation.setDeviceMetricsOverride', {
  width: 1600,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
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

  // 深链直达：不点「进入街区」按钮。?mode=diorama 已让 App 初始 mode='diorama'
  // 且 roleGate=false，顶栏与 Canvas 直接可采集。

  // 就绪判定：最长 ~3 分钟，必须以真实首帧 drawCalls 为准（lessons §13.7）
  for (let i = 0; i < 90; i++) {
    await wait(2000);
    try {
      calls = await page.evaluate(() => window.__gl?.info?.render?.calls ?? 0);
      if (calls > 0) {
        ready = true;
        note(`ready, drawCalls = ${calls} at ${i * 2}s`);
        break;
      }
    } catch (e) {
      // evaluate 偶发超时，继续轮询
    }
  }
  if (!ready) note('NOT READY after 3min (drawCalls stayed 0)');

  // 诊断钩子：把 T9 包围盒断言结论写进结果文件（不是就绪判定依据）
  try {
    diag = await page.evaluate(() => {
      const d = window.__diorama;
      if (!d) return null;
      return {
        cameraPosition: d.cameraPosition,
        target: d.target,
        cameraOutside: d.cameraOutside,
        minGap: d.minGap,
        volumeCount: (d.volumes || []).length,
        readyAt: d.readyAt,
      };
    });
  } catch (e) {
    note('diag evaluate failed: ' + (e?.message || e));
  }
  note('diag = ' + JSON.stringify(diag));

  // 首帧后再等 5s，让着色器编译 / 光照稳定后再截
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

  shotOk = await shot('d1-sandbox-base');
  note('DONE');
} finally {
  flush([
    `url=http://localhost:4173/?hour=10&mode=diorama`,
    `ready=${ready}`,
    `drawCalls=${calls}`,
    `diag=${JSON.stringify(diag)}`,
    `screenshot=${shotOk ? 'd1-sandbox-base.png' : 'FAILED'}`,
    'done ' + new Date().toISOString(),
  ]);
  // 任务书 §1 硬要求：原范例脚本漏了这一步
  await task.finish({ keep: [] });
}
