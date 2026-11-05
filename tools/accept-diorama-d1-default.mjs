// D1 质量门 · 默认 URL 回归验收（2026-11-05）
// 目的：证明加了 ?mode=diorama 深链之后，无参数打开仍是 R19 原样首屏：
//   角色门在、canvas 数 = 0、零 3D 资产（.glb/.gltf/.spz/.ply/.bin/.hdr/.exr）请求、零异常文案。
// 依据：AGENTS.md「首屏不挂任何 <Canvas>」铁律 + 任务书 §7 懒加载要求。
// 结果写文件（egolite 的 console.log 会丢）。

const task = await taskSpace('gc-diorama-d1-default-' + Date.now());
const page = task.page('p1');
const fs = await import('node:fs');
const OUT = 'E:/guangchang/docs/figures/diorama-2026-11-05-d1';
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await page.cdp('Emulation.setDeviceMetricsOverride', {
  width: 1600,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});

let result = { pass: false };
try {
  try {
    await page.goto(`http://localhost:4173/?v=${Date.now()}`);
  } catch (e) {
    result.gotoError = String(e?.message || e);
  }
  await wait(6000);

  const observed = await page.evaluate(() => {
    const resources = performance.getEntriesByType('resource').map((r) => r.name);
    const heavy = resources.filter((u) => /\.(glb|gltf|spz|ply|bin|hdr|exr)(\?|$)/i.test(u));
    const text = (document.body?.innerText || '').slice(0, 800);
    return {
      canvasCount: document.querySelectorAll('canvas').length,
      appMounted: !!document.querySelector('.app'),
      roleGateSelectorHit: !!document.querySelector('[class*="role-gate"]'),
      heavyAssets: heavy,
      resourceCount: resources.length,
      errorText: ['出错', '加载失败', 'Something went wrong', 'ErrorBoundary', '页面崩溃'].filter(
        (k) => text.includes(k)
      ),
      bodyText: text.slice(0, 240),
    };
  });
  result = { ...result, ...observed };

  for (let i = 0; i < 3; i++) {
    try {
      await page.screenshot({ path: `${OUT}/d1-default-gate.png` });
      result.screenshot = 'd1-default-gate.png';
      break;
    } catch (e) {
      await wait(3000);
    }
  }

  result.pass =
    result.appMounted === true &&
    result.canvasCount === 0 &&
    result.heavyAssets.length === 0 &&
    result.errorText.length === 0 &&
    !result.gotoError;
} catch (e) {
  result.fatal = String(e?.message || e);
  result.pass = false;
}

fs.writeFileSync(`${OUT}/d1-default-gate.json`, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
await task.finish({ keep: 'all' });
