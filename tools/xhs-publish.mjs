// 小红书图文发布（2026-11-05）：预拒绝位置权限避免弹窗 → 上传 3 图 → 填标题/正文 → 发布 → 取链接。
// 内容严格取自 docs/xiaohongshu-post.md 草稿；发布前做内容硬校验，不通过不点发布。
const task = await taskSpace('gc-xhs-final-' + Date.now());
const page = task.page('p1');
const fs = await import('node:fs');
const OUT = 'E:/guangchang/docs/loop/xhs-publish.json';
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

try {
  // 预先拒绝位置权限，避免上次那种「用户接管 TaskSpace」的弹窗
  try {
    await page.cdp('Browser.setPermission', {
      permission: { name: 'geolocation' }, setting: 'denied',
      origin: 'https://creator.xiaohongshu.com',
    });
    note('位置权限已预拒绝');
  } catch (e) { note('权限设置跳过: ' + String(e?.message || e).slice(0, 80)); }

  await page.goto('https://creator.xiaohongshu.com/publish/publish', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await wait(4500);
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
  await wait(13000);

  const form = await page.evaluate(() => ({
    url: location.href,
    inputs: [...document.querySelectorAll('input')].filter((i) => i.type !== 'file').map((i) => ({
      type: i.type, ph: i.placeholder || '', max: i.maxLength, cls: (i.className || '').slice(0, 70),
    })),
    editables: [...document.querySelectorAll('[contenteditable="true"]')].map((e) => ({
      tag: e.tagName, cls: (e.className || '').slice(0, 70), ph: e.getAttribute('data-placeholder') || '',
    })),
    buttons: [...document.querySelectorAll('button')].map((b) => (b.innerText || '').trim()).filter(Boolean).slice(0, 50),
    text: (document.body?.innerText || '').slice(0, 1000),
  }));
  result.form = form;
  note('编辑态表单: ' + JSON.stringify({ inputs: form.inputs, editables: form.editables, buttons: form.buttons.slice(-12) }));

  // 填标题 + 正文（React 受控组件：native setter + input 事件）
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
    const editables = [...document.querySelectorAll('[contenteditable="true"]')];
    const bodyEl = editables.find((e) => /正文|描述|填写/.test((e.getAttribute('data-placeholder') || '') + (e.innerText || ''))) || editables[0];
    if (bodyEl) {
      bodyEl.focus();
      bodyEl.innerText = body;
      bodyEl.dispatchEvent(new InputEvent('input', { bubbles: true, data: body }));
      bodyEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return { title: !!titleEl, body: !!bodyEl, titleVal: titleEl?.value || '', bodyLen: bodyEl?.innerText?.length || 0 };
  }, { title: TITLE, body: BODY });
  result.filled = filled;
  note('填表: ' + JSON.stringify(filled));
  await wait(2500);

  const verify = await page.evaluate(() => ({
    title: [...document.querySelectorAll('input')].filter((i) => i.type !== 'file').map((i) => i.value || '').find((v) => v.length > 5) || '',
    body: [...document.querySelectorAll('[contenteditable="true"]')].map((e) => e.innerText || '').join(' ').slice(0, 400),
    imgs: document.querySelectorAll('img').length,
    buttons: [...document.querySelectorAll('button')].map((b) => (b.innerText || '').trim()).filter(Boolean).slice(-16),
    text: (document.body?.innerText || '').slice(0, 900),
  }));
  result.verify = verify;

  // 用完整页面文本判断话题标签（verify.body 被截断到 400 字，不能用于此校验）
  const ok = filled.title && filled.body && verify.text.includes('#Aholo黑客松') && verify.title.includes('3D');
  if (!ok) {
    result.error = '内容硬校验未通过，未点发布';
  } else {
    // 先关引导层并滚动，等 React 重渲染后再找发布按钮
    await page.evaluate(() => {
      const tip = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === '我知道了');
      tip?.click();
      window.scrollTo(0, document.body.scrollHeight);
      document.querySelectorAll('*').forEach((e) => {
        if (e.scrollHeight > e.clientHeight + 80) e.scrollTop = e.scrollHeight;
      });
    });
    await wait(3000);
    const publish = await page.evaluate(() => {
      const all = [...document.querySelectorAll('button, a, [role="button"], div, span')].filter((e) => {
        const t = (e.innerText || '').trim();
        const r = e.getBoundingClientRect();
        return ['发布', '发布笔记', '立即发布'].includes(t) && r.width > 0 && r.height > 0;
      });
      // 侧边栏也有「发布笔记」，真正提交按钮在最下方（top 最大）
      const sorted = all.sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);
      const b = sorted[0];
      if (b) b.click();
      return {
        clicked: !!b,
        label: (b?.innerText || '').trim(),
        candidates: all.map((e) => ({ tag: e.tagName, t: (e.innerText || '').trim(), top: Math.round(e.getBoundingClientRect().top) })),
      };
    });
    const clicked = publish.clicked;
    note('发布按钮: ' + JSON.stringify(publish));
    await wait(8000);
    const after = await page.evaluate(() => ({
      url: location.href,
      text: (document.body?.innerText || '').slice(0, 900),
      success: /发布成功|已发布|审核中/.test(document.body?.innerText || ''),
    }));
    result.after = after;
    result.published = clicked && (after.success || /笔记管理|发布成功|已发布/.test(after.text));
    result.postUrl = after.url;
    note('发布后: ' + JSON.stringify(after).slice(0, 400));
  }
} catch (e) {
  result.error = String(e?.message || e);
  note('异常: ' + result.error);
}

fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
console.log('PUBLISHED=' + result.published);
await task.finish({ keep: [] });
