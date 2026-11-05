// D7 第三轮盲审四张评审图采集（2026-11-05）：昼鸟瞰 / 夜鸟瞰 / 近景 / 对比态
// 豁免 kill switch 后的定向修复版。首轮图已备份到 d5-firstround/ 供报告书做迭代对比。
// 1600×900，?hour=10 昼 / ?hour=21 夜，egolite 真浏览器实拍。
// 就绪判定只认 window.__gl.info.render.calls > 0（lessons §13.7），结果写文件。

const task = await taskSpace('gc-diorama-d7-' + Date.now());
const page = task.page('p1');
const fs = await import('node:fs');
const OUT = 'E:/guangchang/docs/figures/diorama-2026-11-05-d7';
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const lines = [];
const note = (s) => { lines.push(String(s)); console.log(s); };

await page.cdp('Emulation.setDeviceMetricsOverride', {
  width: 1600, height: 900, deviceScaleFactor: 1, mobile: false,
});

const result = { pass: false, shots: [], errors: [] };

async function open(hour) {
  try {
    await page.goto(`http://localhost:4173/?hour=${hour}&mode=diorama&v=${Date.now()}`);
  } catch (e) { note(`goto(${hour}) timeout: ` + (e?.message || e)); }
  await wait(5000);
  let calls = 0;
  for (let i = 0; i < 60; i++) {
    await wait(2000);
    try {
      calls = await page.evaluate(() => window.__gl?.info?.render?.calls ?? 0);
      if (calls > 0) break;
    } catch (e) { /* 继续轮询 */ }
  }
  await wait(3500);
  const errs = await page.evaluate(() => {
    const t = document.body.innerText;
    return ['出错', '加载失败', 'Something went wrong', 'ErrorBoundary'].filter((k) => t.includes(k));
  }).catch(() => []);
  if (errs.length) result.errors.push({ hour, errs });
  note(`open hour=${hour}, drawCalls=${calls}, errors=${errs.length}`);
  return calls;
}

async function shot(name, calls) {
  for (let i = 0; i < 6; i++) {
    try {
      await page.screenshot({ path: `${OUT}/${name}.png` });
      result.shots.push({ name, drawCalls: calls });
      note(`shot: ${name}.png (drawCalls=${calls})`);
      return true;
    } catch (e) { await wait(4000); }
  }
  note('shot FAILED: ' + name);
  return false;
}

try {
  // ① 昼鸟瞰
  let calls = await open(10);
  await shot('d7-day-bird', calls);
  result.diagnostics = await page.evaluate(() => {
    const d = window.__diorama;
    return d ? {
      cameraOutside: d.cameraOutside, minGap: d.minGap,
      volumeCount: d.volumeCount, volumeRange: d.volumeRange,
      channelStats: d.channelStats,
    } : null;
  }).catch(() => null);
  note('diagnostics=' + JSON.stringify(result.diagnostics));

  // ② 夜鸟瞰
  calls = await open(21);
  await shot('d7-night-bird', calls);

  // ③ 近景：点选一栋楼让相机聚焦
  calls = await open(10);
  const pts = await page.evaluate(() => window.__dioramaProject?.() ?? null);
  const focusPt = pts?.find((p) => p.index === 10) ?? pts?.[0];
  if (focusPt) {
    await page.mouse.click(focusPt.x, focusPt.y);
    await wait(2800);
  }
  await shot('d7-closeup', calls);

  // ④ 对比态：hover 并钉选 3 家
  calls = await open(10);
  const pts2 = await page.evaluate(() => window.__dioramaProject?.() ?? null);
  for (const idx of [0, 20, 40]) {
    const pt = pts2?.find((p) => p.index === idx);
    if (!pt) continue;
    await page.mouse.move(pt.x, pt.y);
    await wait(450);
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('钉选对比'));
      b?.click();
    });
    await wait(350);
  }
  result.compareBar = await page.evaluate(() => (document.body.innerText.match(/并排对比 · \d\/3/) || [])[0] || null);
  note('compareBar=' + result.compareBar);
  await shot('d7-compare', calls);

  result.pass =
    result.shots.length === 4 &&
    result.shots.every((s) => s.drawCalls > 0) &&
    result.errors.length === 0 &&
    (result.compareBar || '').includes('3/3');
  note('pass=' + result.pass);
} catch (e) {
  result.fatal = String(e?.message || e);
  note('fatal=' + result.fatal);
} finally {
  fs.writeFileSync(`${OUT}/d7-done.json`, JSON.stringify(result, null, 2) + '\n');
  fs.writeFileSync(`${OUT}/d7-done.txt`, lines.join('\n') + '\n');
  await task.finish({ keep: 'all' });
}
