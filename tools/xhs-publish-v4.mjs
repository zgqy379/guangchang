// 小红书图文发布 v4：底部区域全量 dump（不过滤）→ 按真实 rect 坐标点击 → 严格验证
// v3 教训：精确文本 + pointerEvents + 尺寸三重过滤把可见的红色「发布」div 滤没了，
// 但 CDP 截图里按钮清晰可见。本轮先原样 dump 所有底部元素，再据此点击。
const task = await taskSpace('gc-xhs-v4-' + Date.now());
const page = task.page('p1');
const fs = await import('node:fs');
const OUT = 'E:/guangchang/docs/loop/xhs-publish-v4.json';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const TITLE = '把 offer 砌成一条 3D 招聘街';
const BODY = [
  '“年薪 30 万”“五险一金全额”“弹性工作”……这些词到底差在哪？',
  '',
  '我把它们砌成了一条可以走进去的 3D 招聘街区。',
  '64 家虚构公司，四个行业街区。走近一个摊位，HR 是 3D 生成角色；身后的钱堆是总包，碑身灯条是五险，顶灯是下班时间。拖一下滑杆，山实时长高；拖下班时间，太阳落下、月亮升起。投简历、加对比篮、两座山并排——谁画的饼更大，一眼就知道。',
  '',
  '技术：Aholo Lux3D 生成角色/钞票，SpatialGen 生成四套办公室，Aholo Viewer 承载 3DGS 漫游。',
  '',
  '后来我们试着把 64 家公司压成一块桌上微缩沙盘，一屏看全。三轮、六位独立评审、只看图不知实现——6.2、6.2、6.8，始终没过自己定的 7 分线。于是按写好的规则撤掉，线上仍是过线那版。失败轮次和每一版截图都留在报告书里。',
  '',
  '在线 Demo：zgqy379.github.io/guangchang',
  '',
  '#Aholo黑客松 #3D #AI #数据可视化 #求职 #独立开发 #黑客松',
].join('\n');
const FILES = [
  'E:/guangchang/web/public/og-image.png',
  'E:/guangchang/docs/figures/street-2026-11-04-r19/day-bird.png',
  'E:/guangchang/docs/figures/street-2026-11-04-r19/night-bird.png',
];

const result = { published: false, steps: [] };
const note = (s) => { result.steps.push(s); console.log(s); };
const shot = async (path, label) => {
  try {
    const cap = await page.cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(path, Buffer.from(cap.data, 'base64'));
    note(label + ': ' + path);
  } catch (e) { note(label + ' 失败'); }
};
const clickAt = async (x, y) => {
  await page.cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await wait(250);
  await page.cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await wait(120);
  await page.cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
};

try {
  try {
    await page.cdp('Browser.setPermission', {
      permission: { name: 'geolocation' }, setting: 'denied',
      origin: 'https://creator.xiaohongshu.com',
    });
  } catch (e) { /* 忽略 */ }

  await page.goto('https://creator.xiaohongshu.com/publish/publish', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await wait(5000);
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('*')].find((e) => (e.textContent || '').trim() === '上传图文' && e.children.length === 0);
    el?.click();
  });
  await wait(3500);
  const doc = await page.cdp('DOM.getDocument', { depth: 1 });
  const q = await page.cdp('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'input.upload-input' });
  if (!q?.nodeId) throw new Error('未找到图片上传控件');
  await page.cdp('DOM.setFileInputFiles', { nodeId: q.nodeId, files: FILES });
  note('3 张配图已提交上传');
  await wait(18000);

  const filled = await page.evaluate(({ title, body }) => {
    const setVal = (el, v) => {
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
      if (setter) setter.call(el, v); else el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const inputs = [...document.querySelectorAll('input')].filter((i) => i.type !== 'file');
    const titleEl = inputs.find((i) => /标题/.test(i.placeholder || '')) || inputs.find((i) => i.type === 'text');
    if (titleEl) setVal(titleEl, title);
    const bodyEl = [...document.querySelectorAll('[contenteditable="true"]')][0];
    if (bodyEl) {
      bodyEl.focus();
      bodyEl.innerText = body;
      bodyEl.dispatchEvent(new InputEvent('input', { bubbles: true, data: body }));
      bodyEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // 关掉任何「我知道了」引导层
    const tip = [...document.querySelectorAll('button, div, span')].find((e) => (e.innerText || '').trim() === '我知道了');
    tip?.click();
    return { titleVal: titleEl?.value || '', bodyLen: bodyEl?.innerText?.length || 0 };
  }, { title: TITLE, body: BODY });
  note('填表: ' + JSON.stringify(filled));
  await wait(7000);

  const check = await page.evaluate(() => {
    const t = document.body?.innerText || '';
    return {
      hasTitle: t.includes('把 offer 砌成一条 3D 招聘街'),
      hasTopic: t.includes('#Aholo黑客松'),
      hasDemo: t.includes('zgqy379.github.io/guangchang'),
    };
  });
  result.check = check;
  note('内容校验: ' + JSON.stringify(check));
  if (!check.hasTitle || !check.hasTopic || !check.hasDemo) throw new Error('内容硬校验未通过，拒绝发布');

  // ── 底部区域全量 dump：所有含「发布」文本的元素，不做任何过滤 ──
  const dump = await page.evaluate(() => {
    const out = [];
    for (const e of document.querySelectorAll('*')) {
      const t = (e.textContent || '').trim();
      const it = (e.innerText || '').trim();
      if (!/发布/.test(it) && !/发布/.test(t)) continue;
      if (t.length > 20 && it.length > 20) continue;
      const r = e.getBoundingClientRect();
      const st = window.getComputedStyle(e);
      out.push({
        tag: e.tagName, cls: String(e.className || '').slice(0, 80),
        text: it.slice(0, 20), raw: t.slice(0, 20),
        x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
        pe: st.pointerEvents, vis: st.visibility, disp: st.display, op: st.opacity,
        children: e.children.length, html: (e.outerHTML || '').slice(0, 140),
      });
    }
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      scrollY: window.scrollY, docH: document.documentElement.scrollHeight,
      items: out,
    };
  });
  result.dump = dump;
  note('视口: ' + JSON.stringify(dump.viewport) + ' scrollY=' + dump.scrollY + ' docH=' + dump.docH);
  note('底部候选数=' + dump.items.length);
  note('候选: ' + JSON.stringify(dump.items.slice(-18)));
  await shot('E:/guangchang/docs/figures/xhs-v4-before.png', '点击前截图');

  // 选：文本恰为「发布」、y 在视口内、宽高可见、位置最靠下、层级最内
  const inView = dump.items.filter((e) => {
    const t = (e.text || e.raw || '').trim();
    return t === '发布' && e.y > 150 && e.y < dump.viewport.h && e.w >= 30 && e.h >= 15 && e.disp !== 'none';
  });
  note('可点击候选: ' + JSON.stringify(inView.slice(-6)));
  if (inView.length === 0) throw new Error('未找到视口内文本为「发布」的元素（dump 已落盘）');

  const target = inView.sort((a, b) => b.y - a.y || a.children - b.children)[0];
  const cx = Math.round(target.x + target.w / 2);
  const cy = Math.round(target.y + target.h / 2);
  note('点击目标: ' + JSON.stringify({ cx, cy, tag: target.tag, cls: target.cls, pe: target.pe }));
  await clickAt(cx, cy);
  note('已点击发布');
  await wait(7000);

  // 二次确认
  const confirm = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button, div, span')].find((e) => {
      const x = (e.innerText || '').trim();
      const r = e.getBoundingClientRect();
      return /^(确认发布|继续发布|确定|知道了|确认)$/.test(x) && r.width > 30 && r.height > 18 && r.y > 100;
    });
    if (!b) return { needed: false };
    const r = b.getBoundingClientRect();
    return { needed: true, text: (b.innerText || '').trim(), x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  });
  result.confirm = confirm;
  if (confirm.needed) {
    note('二次确认: ' + JSON.stringify(confirm));
    await clickAt(confirm.x, confirm.y);
    await wait(7000);
  }

  const after = await page.evaluate(() => ({
    url: location.href,
    text: (document.body?.innerText || '').slice(0, 1600),
    success: /发布成功|已发布|审核中|笔记已发布|发布中/.test(document.body?.innerText || ''),
    draft: (document.body?.innerText || '').match(/草稿箱\(\d+\)/)?.[0] || '',
  }));
  result.after = after;
  note('发布后: ' + JSON.stringify(after).slice(0, 700));
  await shot('E:/guangchang/docs/figures/xhs-v4-after.png', '点击后截图');
  result.published = after.success ||
    (!!after.url && !/publish\/publish/.test(after.url) && /success|published|note|manage/.test(after.url));
  result.postUrl = after.url;
} catch (e) {
  result.error = String(e?.message || e);
  note('异常: ' + result.error);
  await shot('E:/guangchang/docs/figures/xhs-v4-error.png', '异常截图');
}

fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
console.log('PUBLISHED=' + result.published);
await task.finish({ keep: [] });
