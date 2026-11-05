// 小红书发布：完整 DOM 诊断 + 精准点击真实发布按钮（2026-11-05 第二轮）
// 上一轮失败原因：把侧边栏「发布笔记」菜单（top 64~90）当成提交按钮。
// 本轮先把所有含「发布/存草稿/预览」的可点击叶子连同位置、disabled、shadow DOM 全部 dump，
// 再按「top > 150 且非侧边栏」规则选真实提交按钮；找不到就不点，绝不误报成功。
const task = await taskSpace('gc-xhs-diag-' + Date.now());
const page = task.page('p1');
const fs = await import('node:fs');
const OUT = 'E:/guangchang/docs/loop/xhs-diagnose.json';
const SHOT = 'E:/guangchang/docs/figures/xhs-editor-diagnose.png';
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
  try {
    await page.cdp('Browser.setPermission', {
      permission: { name: 'geolocation' }, setting: 'denied',
      origin: 'https://creator.xiaohongshu.com',
    });
    note('位置权限已预拒绝');
  } catch (e) { note('权限设置跳过: ' + String(e?.message || e).slice(0, 80)); }

  await page.goto('https://creator.xiaohongshu.com/publish/publish', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await wait(5000);

  // 点「上传图文」进入图文编辑态
  const entered = await page.evaluate(() => {
    const el = [...document.querySelectorAll('*')].find((e) => (e.textContent || '').trim() === '上传图文' && e.children.length === 0);
    if (el) { el.click(); return true; }
    return false;
  });
  note('进入图文上传: ' + entered);
  await wait(3500);

  const doc = await page.cdp('DOM.getDocument', { depth: 1 });
  const q = await page.cdp('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'input.upload-input' });
  if (!q?.nodeId) throw new Error('未找到图片上传控件');
  await page.cdp('DOM.setFileInputFiles', { nodeId: q.nodeId, files: FILES });
  note('3 张配图已提交上传');
  await wait(16000);

  // 填表
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
    const bodyEl = editables[0];
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
  await wait(3500);

  // 关引导层
  await page.evaluate(() => {
    const tip = [...document.querySelectorAll('button')].find((e) => (e.innerText || '').trim() === '我知道了');
    tip?.click();
  });
  await wait(2500);

  // ── 全量诊断 ──
  const diag = await page.evaluate(() => {
    const rectOf = (e) => {
      const r = e.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    const all = [];
    const walk = (root) => {
      const nodes = root.querySelectorAll('*');
      for (const e of nodes) {
        const t = (e.innerText || e.textContent || '').trim();
        if (!/发布|存草稿|草稿|预览|定时/.test(t) || t.length > 12) continue;
        const tag = e.tagName;
        if (e.children.length > 0 && !/BUTTON|A|SPAN|DIV/.test(tag)) continue;
        const r = e.getBoundingClientRect();
        all.push({
          tag, cls: String(e.className || '').slice(0, 90),
          text: t.slice(0, 12), rect: rectOf(e),
          disabled: !!e.disabled, hidden: r.width === 0 || r.height === 0,
          role: e.getAttribute('role') || '',
          html: (e.outerHTML || '').slice(0, 180),
        });
      }
      // shadow DOM
      for (const e of nodes) if (e.shadowRoot) walk(e.shadowRoot);
    };
    walk(document);
    return {
      url: location.href,
      bodyTail: (document.body?.innerText || '').slice(-1800),
      buttons: [...document.querySelectorAll('button')].map((b) => ({
        text: (b.innerText || '').trim().slice(0, 20), cls: String(b.className || '').slice(0, 70),
        disabled: !!b.disabled, rect: rectOf(b),
      })),
      candidates: all.slice(0, 80),
      iframes: [...document.querySelectorAll('iframe')].map((f) => f.src),
      scroll: { h: document.documentElement.scrollHeight, inner: window.innerHeight, y: window.scrollY },
      images: document.querySelectorAll('img').length,
      hasTopic: (document.body?.innerText || '').includes('#Aholo黑客松'),
      titleFilled: [...document.querySelectorAll('input')].some((i) => (i.value || '').includes('3D')),
    };
  });
  result.diag = diag;
  note('诊断: buttons=' + JSON.stringify(diag.buttons));
  note('诊断: candidates=' + JSON.stringify(diag.candidates.slice(0, 25)));
  note('诊断: bodyTail=' + diag.bodyTail.slice(-600).replace(/\n/g, ' | '));

  // 截图（CDP 直接取 base64，绕开 egolite artifact 路径接管）
  try {
    const cap = await page.cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.mkdirSync('E:/guangchang/docs/figures', { recursive: true });
    fs.writeFileSync(SHOT, Buffer.from(cap.data, 'base64'));
    note('截图已保存: ' + SHOT);
  } catch (e) { note('截图失败: ' + String(e?.message || e).slice(0, 100)); }

  // ── 精准选择真实发布按钮：排除侧边栏（y < 150）、隐藏、禁用 ──
  const pick = await page.evaluate(() => {
    const all = [...document.querySelectorAll('button, [role="button"], [class*="publish"], [class*="submit"], a')];
    const hit = all.filter((e) => {
      const t = (e.innerText || e.textContent || '').trim();
      const r = e.getBoundingClientRect();
      if (!/^(发布|发布笔记|立即发布|确认发布)$/.test(t)) return false;
      if (r.width < 30 || r.height < 18) return false;
      if (e.disabled) return false;
      if (r.y < 150) return false; // 侧边栏菜单
      return true;
    });
    return hit.map((e) => ({
      tag: e.tagName, text: (e.innerText || '').trim(),
      cls: String(e.className || '').slice(0, 80),
      y: Math.round(e.getBoundingClientRect().y),
      html: (e.outerHTML || '').slice(0, 160),
    }));
  });
  result.pick = pick;
  note('真实发布按钮候选: ' + JSON.stringify(pick));

  if (pick.length === 0) {
    result.error = '未找到符合条件的真实发布按钮（诊断已落盘，未误点侧边栏）';
  } else {
    const clicked = await page.evaluate(() => {
      const all = [...document.querySelectorAll('button, [role="button"], [class*="publish"], [class*="submit"], a')];
      const hit = all.filter((e) => {
        const t = (e.innerText || e.textContent || '').trim();
        const r = e.getBoundingClientRect();
        return /^(发布|发布笔记|立即发布|确认发布)$/.test(t) && r.width >= 30 && r.height >= 18 && !e.disabled && r.y >= 150;
      });
      const b = hit[hit.length - 1];
      if (b) { b.click(); return (b.innerText || '').trim(); }
      return '';
    });
    note('已点击: ' + clicked);
    await wait(9000);
    const after = await page.evaluate(() => ({
      url: location.href,
      text: (document.body?.innerText || '').slice(0, 1200),
      success: /发布成功|已发布|审核中|发布中/.test(document.body?.innerText || ''),
    }));
    result.after = after;
    // 严格判定：URL 跳到成功/笔记管理页，或页面出现明确成功文案
    result.published = !!clicked && (after.success || /success|published|note\/|管理/.test(after.url));
    result.postUrl = after.url;
    note('发布后: ' + JSON.stringify(after).slice(0, 500));
  }
} catch (e) {
  result.error = String(e?.message || e);
  note('异常: ' + result.error);
}

fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
console.log('PUBLISHED=' + result.published);
await task.finish({ keep: [] });
