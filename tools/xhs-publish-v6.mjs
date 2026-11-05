// 小红书图文发布 v6（最终）：按红色按钮真实坐标点击。
// v5 定位结论：底部是 Web Component <xhs-publish-btn submit-text="发布" ...>，
// 文本在 closed shadow / attribute 里，DOM 文本扫描永远找不到；但 CDP 截图可见。
// 用像素反算：screenshot 2273x1397（dpr=1.5）→ 红按钮中心像素 (1170,1330)
// → CSS 坐标 (780, 887)，viewport 1515x931 → 比例 (0.5149, 0.9527)。
// v5 误点 (708,886) 打在「暂存离开」上，本轮修正 x。
// 合规（docs/lessons.md §13.13）：固定空间名、只调一次 finish({keep:[]}) 释放页签。
const task = await taskSpace('gc-xhs-final-v6');
const page = task.page('p1');
const fs = await import('node:fs');
const OUT = 'E:/guangchang/docs/loop/xhs-publish-v6.json';
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
const shot = async (p, label) => {
  try {
    const cap = await page.cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(p, Buffer.from(cap.data, 'base64'));
    note(label + ': ' + p);
  } catch (e) { /* 截图失败不阻断 */ }
};
const clickAt = async (x, y) => {
  await page.cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await wait(250);
  await page.cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await wait(120);
  await page.cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
};

let finished = false;
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
    const tip = [...document.querySelectorAll('button, div, span')].find((e) => (e.innerText || '').trim() === '我知道了');
    tip?.click();
    return { titleVal: titleEl?.value || '', bodyLen: bodyEl?.innerText?.length || 0 };
  }, { title: TITLE, body: BODY });
  note('填表: ' + JSON.stringify(filled));
  await wait(7000);

  const check = await page.evaluate(() => {
    const t = document.body?.innerText || '';
    const btn = document.querySelector('xhs-publish-btn');
    return {
      hasTitle: t.includes('把 offer 砌成一条 3D 招聘街'),
      hasTopic: t.includes('#Aholo黑客松'),
      hasDemo: t.includes('zgqy379.github.io/guangchang'),
      submitText: btn?.getAttribute('submit-text') || '',
      submitDisabled: btn?.getAttribute('submit-disabled') || '',
      viewport: { w: window.innerWidth, h: window.innerHeight },
    };
  });
  result.check = check;
  note('发布前校验: ' + JSON.stringify(check));
  if (!check.hasTitle || !check.hasTopic || !check.hasDemo) throw new Error('内容硬校验未通过，拒绝发布');
  if (check.submitText !== '发布' || check.submitDisabled === 'true') throw new Error('发布按钮不可用');

  // 按视口比例还原红色「发布」按钮中心（像素反算结果）
  const cx = Math.round(check.viewport.w * 0.5149);
  const cy = Math.round(check.viewport.h * 0.9527);
  note('点击坐标(比例反算): ' + JSON.stringify({ cx, cy, viewport: check.viewport }));
  await shot('E:/guangchang/docs/figures/xhs-v6-before.png', '点击前截图');
  await clickAt(cx, cy);
  note('已点击红色发布按钮');
  await wait(8000);

  // 二次确认（若有）
  const confirm = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button, div, span, input')].find((e) => {
      const x = ((e.innerText || '') + ' ' + (e.value || '')).trim();
      const r = e.getBoundingClientRect();
      return /^(确认发布|继续发布|确定|知道了|确认)$/.test(x) && r.width > 30 && r.height > 18 && r.y > 100;
    });
    if (!b) return { needed: false };
    const r = b.getBoundingClientRect();
    return { needed: true, text: ((b.innerText || '') + ' ' + (b.value || '')).trim(), x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  });
  result.confirm = confirm;
  if (confirm.needed) {
    note('二次确认: ' + JSON.stringify(confirm));
    await clickAt(confirm.x, confirm.y);
    await wait(8000);
  }

  const after = await page.evaluate(() => ({
    url: location.href,
    text: (document.body?.innerText || '').slice(0, 1600),
    success: /发布成功|已发布|审核中|笔记已发布|发布中/.test(document.body?.innerText || ''),
    draft: (document.body?.innerText || '').match(/草稿箱\(\d+\)/)?.[0] || '',
  }));
  result.after = after;
  note('发布后: ' + JSON.stringify(after).slice(0, 800));
  await shot('E:/guangchang/docs/figures/xhs-v6-after.png', '点击后截图');

  result.published = after.success ||
    (!!after.url && !/publish\/publish/.test(after.url) && /success|published|note|manage/.test(after.url));
  result.postUrl = after.url;

  // 发布成功后，去笔记管理页取回帖子链接
  if (result.published) {
    try {
      await page.goto('https://creator.xiaohongshu.com/publish/manage', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
      await wait(6000);
      const links = await page.evaluate(() => {
        const t = document.body?.innerText || '';
        const has = t.includes('把 offer 砌成一条 3D 招聘街');
        const hrefs = [...document.querySelectorAll('a')].map((a) => a.href).filter((h) => /explore|discovery|item|note/.test(h));
        return { has, hrefs: hrefs.slice(0, 12), text: t.slice(0, 700) };
      });
      result.manage = links;
      note('笔记管理页: ' + JSON.stringify(links).slice(0, 600));
      result.postUrl = links.hrefs.find((h) => /explore|item|note/.test(h)) || result.postUrl;
      await shot('E:/guangchang/docs/figures/xhs-v6-manage.png', '笔记管理截图');
    } catch (e) { note('取链接失败: ' + String(e?.message || e).slice(0, 100)); }
  }
} catch (e) {
  result.error = String(e?.message || e);
  note('异常: ' + result.error);
  await shot('E:/guangchang/docs/figures/xhs-v6-error.png', '异常截图');
} finally {
  // 规范收尾：释放空间与页签（本脚本不交还用户控制，出错也必须释放）
  if (!finished) {
    finished = true;
    try { await task.finish({ keep: [] }); note('空间已关闭：finish({keep:[]})'); }
    catch (e) { note('finish 失败: ' + String(e?.message || e).slice(0, 100)); }
  }
}

fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
console.log('PUBLISHED=' + result.published);
