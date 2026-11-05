// 小红书图文发布 · 终版（2026-11-05 第三轮）
// 诊断结论：底部红色「发布」是普通 div（不是 button / 无 publish class），
// 前两轮选择器把它漏掉，误点了侧边栏「发布笔记」菜单。
// 本轮：全元素扫文本 === '发布' 的可见叶子 → CDP 真实鼠标坐标点击 → 严格验证。
const task = await taskSpace('gc-xhs-pub-' + Date.now());
const page = task.page('p1');
const fs = await import('node:fs');
const OUT = 'E:/guangchang/docs/loop/xhs-final-publish.json';
const SHOT_BEFORE = 'E:/guangchang/docs/figures/xhs-before-publish.png';
const SHOT_AFTER = 'E:/guangchang/docs/figures/xhs-after-publish.png';
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
  } catch (e) { note(label + ' 失败: ' + String(e?.message || e).slice(0, 90)); }
};

try {
  try {
    await page.cdp('Browser.setPermission', {
      permission: { name: 'geolocation' }, setting: 'denied',
      origin: 'https://creator.xiaohongshu.com',
    });
    note('位置权限已预拒绝');
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
    return { titleVal: titleEl?.value || '', bodyLen: bodyEl?.innerText?.length || 0 };
  }, { title: TITLE, body: BODY });
  note('填表: ' + JSON.stringify(filled));
  await wait(6000);

  // 内容硬校验：完整页面文本（不截断）
  const check = await page.evaluate(() => {
    const t = document.body?.innerText || '';
    return {
      hasTitle: t.includes('把 offer 砌成一条 3D 招聘街'),
      hasTopic: t.includes('#Aholo黑客松'),
      hasDemo: t.includes('zgqy379.github.io/guangchang'),
      imgCount: document.querySelectorAll('.image-editor-info-trigger').length,
    };
  });
  result.check = check;
  note('内容校验: ' + JSON.stringify(check));
  if (!check.hasTitle || !check.hasTopic || !check.hasDemo) throw new Error('内容硬校验未通过，拒绝发布');

  // ── 全元素扫描：找文本恰好「发布」的可见叶子（排除侧边栏 y<150）──
  const find = await page.evaluate(() => {
    const hits = [];
    for (const e of document.querySelectorAll('*')) {
      if (e.shadowRoot) continue;
      const t = (e.innerText || e.textContent || '').trim();
      if (t !== '发布') continue;
      const r = e.getBoundingClientRect();
      if (r.width < 30 || r.height < 18 || r.y < 150) continue;
      const st = window.getComputedStyle(e);
      if (st.visibility === 'hidden' || st.display === 'none' || st.pointerEvents === 'none') continue;
      hits.push({
        tag: e.tagName, cls: String(e.className || '').slice(0, 90),
        x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
        children: e.children.length, html: (e.outerHTML || '').slice(0, 160),
      });
    }
    return hits;
  });
  result.find = find;
  note('发布按钮候选: ' + JSON.stringify(find));
  await shot(SHOT_BEFORE, '发布前截图');

  if (find.length === 0) throw new Error('底部「发布」按钮未找到，不误点其它元素');

  // 选最内层（children 最少）且最靠下的一个
  const target = [...find].sort((a, b) => a.children - b.children || b.y - a.y)[0];
  const cx = Math.round(target.x + target.w / 2);
  const cy = Math.round(target.y + target.h / 2);
  note('点击坐标: ' + JSON.stringify({ cx, cy, tag: target.tag, cls: target.cls }));

  // CDP 真实鼠标点击（React 可能只监听 pointer/mousedown）
  await page.cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx, y: cy });
  await wait(300);
  await page.cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', clickCount: 1 });
  await wait(120);
  await page.cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx, y: cy, button: 'left', clickCount: 1 });
  note('已点击发布');
  await wait(6000);

  // 若出现二次确认弹窗，点「确认发布 / 继续发布 / 确定」
  const confirm = await page.evaluate(() => {
    const t = document.body?.innerText || '';
    const has = /确认发布|确认|温馨提示|发布须知/.test(t);
    const b = [...document.querySelectorAll('button, div, span')].find((e) => {
      const x = (e.innerText || '').trim();
      const r = e.getBoundingClientRect();
      return /^(确认发布|继续发布|确定|知道了)$/.test(x) && r.width > 30 && r.height > 18;
    });
    if (has && b) {
      const r = b.getBoundingClientRect();
      return { needed: true, text: (b.innerText || '').trim(), x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    }
    return { needed: false };
  });
  result.confirm = confirm;
  if (confirm.needed) {
    note('二次确认: ' + JSON.stringify(confirm));
    await page.cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: confirm.x, y: confirm.y, button: 'left', clickCount: 1 });
    await wait(120);
    await page.cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: confirm.x, y: confirm.y, button: 'left', clickCount: 1 });
    await wait(7000);
  }

  const after = await page.evaluate(() => ({
    url: location.href,
    text: (document.body?.innerText || '').slice(0, 1500),
    success: /发布成功|已发布|审核中|发布中|笔记已发布/.test(document.body?.innerText || ''),
    draftText: (document.body?.innerText || '').match(/草稿箱\(\d+\)/)?.[0] || '',
  }));
  result.after = after;
  note('发布后: ' + JSON.stringify(after).slice(0, 700));
  await shot(SHOT_AFTER, '发布后截图');

  // 严格判定：明确成功文案，或 URL 离开 publish/publish 且含成功/管理语义
  result.published = after.success ||
    (!!after.url && !/publish\/publish/.test(after.url) && /success|published|note|manage/.test(after.url));
  result.postUrl = after.url;
} catch (e) {
  result.error = String(e?.message || e);
  note('异常: ' + result.error);
  await shot(SHOT_AFTER, '异常时截图');
}

fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
console.log('PUBLISHED=' + result.published);
await task.finish({ keep: [] });
