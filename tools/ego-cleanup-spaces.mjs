// egolite TaskSpace 存量清理（2026-11-05）
// 事故：本任务早期所有采集/验收脚本结尾用了 task.finish({ keep: 'all' })，
// 且每个脚本用 taskSpace('gc-xxx-' + Date.now()) 新建空间，导致几十个空间+页签常驻。
// 技能规范（ego-browser skill v2.2.0 §User control and completion）：
//   - 一个用户目标只用 ONE TaskSpace，后续用同名/id resume
//   - 成功收尾默认 await task.finish({ keep: [] })，保留页签是例外且需用户明确要求
//   - finish() 只调一次，放在最终轮最后
// 本脚本只关闭 ownership=agent 且 name 以 gc- 开头（本次「逛厂」任务）的空间。
// 用户自己的空间（BOSS直聘 / 求职投递 1031 / 1104）一律跳过不动。
const fs = await import('node:fs');
const OUT = 'E:/guangchang/docs/loop/ego-cleanup-result.json';
const report = { before: [], closed: [], skipped: [], errors: [], tabsBefore: {} };

try {
  const spaces = await listTaskSpaces();
  report.before = spaces.map((s) => ({ id: s.id, name: s.name, ownership: s.ownership, createdBy: s.createdBy, titles: s.recentTabTitles }));

  for (const s of spaces) {
    const name = String(s.name || '');
    const mine = String(s.ownership) === 'agent' && /^gc-/.test(name);
    if (!mine) {
      report.skipped.push({ id: s.id, name, ownership: s.ownership, reason: '非本次任务创建 / 用户自有，保护不动' });
      continue;
    }
    try {
      const t = await taskSpace(s.id);
      const tabs = await t.tabs();
      report.tabsBefore[s.id] = tabs.map((x) => ({
        label: x.label || null, title: x.title || '', url: x.url || '', openedBy: x.openedBy || '',
      }));
      // 规范收尾：关闭所有 Agent 管理的页签，用户/未知来源页签受保护不会被关
      await t.finish({ keep: [] });
      report.closed.push({ id: s.id, name, tabs: tabs.length });
    } catch (e) {
      report.errors.push({ id: s.id, name, error: String(e?.message || e) });
    }
  }

  const after = await listTaskSpaces();
  report.after = after.map((s) => ({ id: s.id, name: s.name, ownership: s.ownership, titles: s.recentTabTitles }));
} catch (e) {
  report.errors.push({ fatal: String(e?.message || e) });
}

fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');
console.log('CLOSED=' + report.closed.length + ' SKIPPED=' + report.skipped.length + ' ERRORS=' + report.errors.length);
console.log(JSON.stringify({ closed: report.closed, skipped: report.skipped, errors: report.errors }, null, 2));
