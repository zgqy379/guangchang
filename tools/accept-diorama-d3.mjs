// D3 交互验收（2026-11-05）：hover 公司卡 / 钉选 ≤3 家 / 点选拉近 / 浮层对比度
// 输出 docs/figures/diorama-2026-11-05-d3/，供循环工作流 R3 审查取证。
//
// 关键：屏幕坐标由页面里的 window.__dioramaProject() 实时投影得出（相机移动后仍准），
// 不靠猜像素；egolite 的 console.log 会丢 → 全部结论写文件。

const task = await taskSpace('gc-diorama-d3-' + Date.now());
const page = task.page('p1');
const fs = await import('node:fs');
const OUT = 'E:/guangchang/docs/figures/diorama-2026-11-05-d3';
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const lines = [];
const note = (s) => { lines.push(String(s)); console.log(s); };

const parseRgb = (s) => {
  const m = String(s || '').match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(',').map((x) => parseFloat(x.trim()));
  return { r: p[0], g: p[1], b: p[2] };
};
const lum = (c) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
};
const contrast = (a, b) => {
  const x = parseRgb(a), y = parseRgb(b);
  if (!x || !y) return null;
  const l1 = lum(x), l2 = lum(y);
  return Number(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2));
};

await page.cdp('Emulation.setDeviceMetricsOverride', {
  width: 1600, height: 900, deviceScaleFactor: 1, mobile: false,
});

const result = { pass: false };
try {
  try {
    await page.goto(`http://localhost:4173/?hour=10&mode=diorama&v=${Date.now()}`);
    note('goto ok');
  } catch (e) { note('goto timeout: ' + (e?.message || e)); }
  await wait(5000);

  let calls = 0;
  for (let i = 0; i < 60; i++) {
    await wait(2000);
    try {
      calls = await page.evaluate(() => window.__gl?.info?.render?.calls ?? 0);
      if (calls > 0) break;
    } catch (e) { /* 继续轮询 */ }
  }
  result.drawCalls = calls;
  note(`drawCalls=${calls}`);

  // 交互前先留一张初始鸟瞰（确认 I-004 放大楼群后仍是「一屏看全」的沙盘构图）
  await wait(2500);
  for (let i = 0; i < 6; i++) {
    try {
      await page.screenshot({ path: `${OUT}/d3-bird.png` });
      result.birdShot = 'd3-bird.png';
      break;
    } catch (e) { await wait(4000); }
  }

  let points = await page.evaluate(() => window.__dioramaProject?.() ?? null);
  result.projectedCount = points ? points.length : 0;
  note(`projected buildings=${result.projectedCount}`);

  // ── 1. hover 出公司卡 + 钉选（4 次，验证「最多 3 家」硬上限）──
  result.pinSteps = [];
  for (const idx of [0, 20, 40, 55]) {
    const pt = points?.find((p) => p.index === idx);
    if (!pt) { note(`skip ${idx}: no projection`); continue; }
    await page.mouse.move(pt.x, pt.y);
    await wait(450);
    const card = await page.evaluate(() => {
      const el = document.querySelector('[aria-label*="参数卡"]');
      return el ? (el.innerText || '').replace(/\n/g, ' | ').slice(0, 150) : null;
    });
    const clicked = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('钉选对比'));
      if (b) { b.click(); return true; }
      return false;
    });
    await wait(350);
    const bar = await page.evaluate(() => (document.body.innerText.match(/并排对比 · \d\/3/) || [])[0] || null);
    const step = { index: idx, card: card ? 'visible' : 'missing', cardText: card, pinClicked: clicked, bar };
    result.pinSteps.push(step);
    note(`hover ${idx}: card=${step.card}, pin=${clicked}, bar=${bar}`);
  }
  result.pinCapOk = (result.pinSteps.at(-1)?.bar || '').includes('3/3');

  // ── 2. 浮层文字对比度（按最坏背景：不透明面板实底）──
  const styles = await page.evaluate(() => {
    const card = document.querySelector('[aria-label*="参数卡"]');
    if (!card) return null;
    const cs = getComputedStyle(card);
    const muted = [...card.querySelectorAll('span')].find((s) => (s.textContent || '').includes('年总包'));
    return {
      bg: cs.backgroundColor,
      fg: cs.color,
      mutedFg: muted ? getComputedStyle(muted).color : null,
    };
  });
  result.contrast = styles ? {
    main: contrast(styles.bg, styles.fg),
    muted: contrast(styles.bg, styles.mutedFg),
    styles,
  } : null;
  note('contrast=' + JSON.stringify(result.contrast));
  result.contrastOk = !!result.contrast && result.contrast.main >= 4.5 && result.contrast.muted >= 4.5;

  // ── 3. 点选拉近：投影坐标应随相机聚焦明显变化 ──
  const before = await page.evaluate(() => window.__dioramaProject?.()?.[0] ?? null);
  const clickPt = points?.find((p) => p.index === 10);
  if (clickPt) {
    await page.mouse.click(clickPt.x, clickPt.y);
    await wait(2600);
  }
  const after = await page.evaluate(() => window.__dioramaProject?.()?.[0] ?? null);
  result.focusShiftPx = before && after
    ? Number(Math.hypot(after.x - before.x, after.y - before.y).toFixed(1))
    : 0;
  note(`focusShiftPx=${result.focusShiftPx}`);
  result.focusOk = result.focusShiftPx > 5;

  // ── 4. 真实浏览计数 / 零异常文案 ──
  result.bodyFlags = await page.evaluate(() => {
    const t = document.body.innerText;
    return {
      visited: (t.match(/已浏览\s*\d+\s*\/\s*64/) || [])[0] || null,
      errors: ['出错', '加载失败', 'Something went wrong', 'ErrorBoundary'].filter((k) => t.includes(k)),
    };
  });
  note('bodyFlags=' + JSON.stringify(result.bodyFlags));

  await wait(1200);
  for (let i = 0; i < 6; i++) {
    try {
      await page.screenshot({ path: `${OUT}/d3-interaction.png` });
      result.screenshot = 'd3-interaction.png';
      break;
    } catch (e) { await wait(4000); }
  }

  // ── 5. 夜间主题（?hour=21）浮层对比度复验 + 实拍（双主题都按最坏背景验算）──
  try {
    await page.goto(`http://localhost:4173/?hour=21&mode=diorama&v=${Date.now()}`);
    await wait(6000);
    for (let i = 0; i < 30; i++) {
      await wait(1500);
      try { if ((await page.evaluate(() => window.__gl?.info?.render?.calls ?? 0)) > 0) break; } catch (e) { /* 继续 */ }
    }
    const npts = await page.evaluate(() => window.__dioramaProject?.() ?? null);
    if (npts?.[0]) { await page.mouse.move(npts[0].x, npts[0].y); await wait(700); }
    const ns = await page.evaluate(() => {
      const c = document.querySelector('[aria-label*="参数卡"]');
      if (!c) return null;
      const cs = getComputedStyle(c);
      const m = [...c.querySelectorAll('span')].find((s) => (s.textContent || '').includes('年总包'));
      return { bg: cs.backgroundColor, fg: cs.color, mutedFg: m ? getComputedStyle(m).color : null };
    });
    result.nightContrast = ns
      ? { main: contrast(ns.bg, ns.fg), muted: contrast(ns.bg, ns.mutedFg), styles: ns }
      : null;
    note('nightContrast=' + JSON.stringify(result.nightContrast));
    await page.screenshot({ path: `${OUT}/d3-night.png` });
    result.nightShot = 'd3-night.png';
  } catch (e) {
    note('night check failed: ' + (e?.message || e));
  }
  result.nightContrastOk =
    !!result.nightContrast && result.nightContrast.main >= 4.5 && result.nightContrast.muted >= 4.5;

  result.pass =
    calls > 0 &&
    result.projectedCount === 64 &&
    result.pinSteps.length === 4 &&
    result.pinSteps.every((s) => s.card === 'visible') &&
    result.pinCapOk &&
    result.contrastOk &&
    result.nightContrastOk &&
    result.focusOk &&
    result.bodyFlags.errors.length === 0;
  note('pass=' + result.pass);
} catch (e) {
  result.fatal = String(e?.message || e);
  note('fatal=' + result.fatal);
} finally {
  fs.writeFileSync(`${OUT}/d3-done.json`, JSON.stringify(result, null, 2) + '\n');
  fs.writeFileSync(`${OUT}/d3-done.txt`, lines.join('\n') + '\n');
  await task.finish({ keep: [] });
}
