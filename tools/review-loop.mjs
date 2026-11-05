#!/usr/bin/env node
// 逛厂 · 立体参数沙盘重构：审查驱动的循环工作流引擎（2026-11-05）
//
// 目的：把「每轮审查结果」当作唯一输入，自动判定完成度、重排优先级与推进节奏，
//       输出「进度状态 / 调整依据 / 已闭环问题 / 下一轮待办」，并阻止重复处理已闭环问题。
//
// 用法（仓库任意目录执行，路径以本文件位置解析，不依赖 cwd）：
//   node tools/review-loop.mjs --review docs/loop/reviews/round-R1.json
//   node tools/review-loop.mjs --review docs/loop/reviews/round-R2.json --dry-run
//   node tools/review-loop.mjs --review docs/loop/reviews/round-R2.json --force   # 重算已入账轮次
//
// 输入（review JSON）：
//   { round, date, reviewer, milestone,
//     checks:  [{ id, item, verdict: pass|fail|blocked, evidence }],
//     problems:[{ id, title, severity: blocker|problem|concern, affects, suggestion,
//                 closed?, evidence? }],
//     blockers:[...同 problems...],
//     closedIds:["I-002"],            // 本轮把往期 open 问题闭环
//     suggestions:["..."],
//     scores: { visual: 7.2, spatial: 7.0 } | null,
//     evidence:["路径..."] }
//
// 输出：写回 docs/loop/state.json、docs/loop/latest.json、
//       docs/loop/rounds/<round>.json，并在 stdout 打印人话摘要。
//
// 循环契约：
//   1) 一轮只能入账一次（幂等），--force 才允许重算 → 杜绝「重复处理」。
//   2) 已 status=closed 的问题再次出现在审查里 → 记入 duplicateSkipped 并跳过。
//   3) 完成度按「里程碑权重 × 该里程碑验收项通过率」计算，不靠主观打分。
//   4) 阻塞项 / 门禁失败 / 时间盒超期 → 自动改变 mode 与 pace，不盲目推进。
//   5) 未闭环但影响未来里程碑的 concern → 进 deferred 登记，仍不进本轮待办。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const STATE_PATH = path.resolve(ROOT, 'docs/loop/state.json')
const LATEST_PATH = path.resolve(ROOT, 'docs/loop/latest.json')
const ROUNDS_DIR = path.resolve(ROOT, 'docs/loop/rounds')

const argv = process.argv.slice(2)
const arg = (key, fallback) => {
  const i = argv.indexOf(key)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback
}
const reviewPath = path.resolve(ROOT, arg('--review', 'docs/loop/reviews/latest.json'))
const dryRun = argv.includes('--dry-run')
const force = argv.includes('--force')

const fail = (msg) => {
  console.error(`[review-loop] ${msg}`)
  process.exit(1)
}
const readJson = (p) => {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch (e) {
    fail(`读取失败 ${p}: ${e.message}`)
  }
}
const SEV = { blocker: 3, problem: 2, concern: 1 }

const state = readJson(STATE_PATH)
const review = readJson(reviewPath)

for (const k of ['round', 'date', 'milestone']) {
  if (!review[k]) fail(`审查文件缺必填字段 ${k}: ${reviewPath}`)
}

// ── 幂等：同一轮不重复入账 ────────────────────────────────────────────
const priorIdx = state.rounds.findIndex((r) => r.round === review.round)
if (priorIdx >= 0 && !force) {
  fail(`第 ${review.round} 轮已入账（避免重复处理）。确需重算请加 --force`)
}
if (priorIdx >= 0 && force) {
  state.rounds.splice(priorIdx, 1)
}

const milestone = state.milestones.find((m) => m.id === review.milestone)
if (!milestone) fail(`未知里程碑 ${review.milestone}`)

const notes = []
const closedThisRound = []
const openedThisRound = []
const duplicateSkipped = []

// ── 1. 审查项 → 里程碑验收项 ─────────────────────────────────────────
let checkPass = 0
let checkFail = 0
for (const c of review.checks || []) {
  const crit = milestone.criteria.find((x) => x.id === c.id)
  if (!crit) {
    notes.push(`未知验收项 ${c.id}，已跳过（请核对 state.json 的 criteria）`)
    continue
  }
  crit.met = c.verdict === 'pass'
  crit.evidence = c.evidence || null
  crit.lastRound = review.round
  if (crit.met) checkPass++
  else checkFail++
}

// ── 2. 问题台账合并（含闭环去重） ────────────────────────────────────
const incoming = [...(review.problems || []), ...(review.blockers || [])]
for (const p of incoming) {
  if (!p.id) {
    notes.push('发现无 id 的问题项，已跳过')
    continue
  }
  const existing = state.issues.find((i) => i.id === p.id)
  const wantClosed = Boolean(p.closed) || p.status === 'closed'

  if (existing) {
    if (existing.status === 'closed') {
      duplicateSkipped.push({ id: p.id, reason: '已闭环，拒绝重复处理' })
      continue
    }
    existing.lastSeen = review.round
    if (p.suggestion) existing.suggestion = p.suggestion
    if (p.severity) existing.severity = p.severity
    if (wantClosed) {
      existing.status = 'closed'
      existing.closedIn = review.round
      existing.closedEvidence = p.evidence || '（未附证据）'
      closedThisRound.push(p.id)
    }
  } else {
    const issue = {
      id: p.id,
      title: p.title || '(无标题)',
      severity: p.severity || 'problem',
      affects: p.affects || review.milestone,
      suggestion: p.suggestion || '',
      status: wantClosed ? 'closed' : 'open',
      raisedIn: review.round,
      closedIn: wantClosed ? review.round : null,
      closedEvidence: wantClosed ? p.evidence || '（未附证据）' : null,
      lastSeen: review.round,
    }
    state.issues.push(issue)
    if (issue.status === 'closed') closedThisRound.push(issue.id)
    else openedThisRound.push(issue.id)
  }
}
// 显式闭环往期问题
for (const id of review.closedIds || []) {
  const it = state.issues.find((i) => i.id === id)
  if (!it) {
    notes.push(`closedIds 里的 ${id} 不存在于台账，已跳过`)
  } else if (it.status === 'closed') {
    duplicateSkipped.push({ id, reason: '已闭环，拒绝重复处理' })
  } else {
    it.status = 'closed'
    it.closedIn = review.round
    it.closedEvidence = (review.evidence || []).join('; ') || '（见本轮证据）'
    closedThisRound.push(id)
  }
}

// ── 3. 完成度（权重 × 验收项通过率） ─────────────────────────────────
const milestoneProgress = state.milestones.map((m) => {
  const total = m.criteria.length
  const met = m.criteria.filter((c) => c.met).length
  return { id: m.id, name: m.name, weight: m.weight, met, total, ratio: total ? met / total : 0 }
})
const completionPercent = Number(
  milestoneProgress.reduce((s, m) => s + m.weight * m.ratio, 0).toFixed(1)
)

// 里程碑状态推进
for (const m of state.milestones) {
  const p = milestoneProgress.find((x) => x.id === m.id)
  if (p.total > 0 && p.met === p.total) {
    if (m.status !== 'done') m.roundClosed = review.round
    m.status = 'done'
  } else if (p.met > 0) {
    m.status = 'in_progress'
    if (!m.roundOpened) m.roundOpened = review.round
  }
}
const activeMilestone =
  state.milestones.find((m) => m.status === 'in_progress') ||
  state.milestones.find((m) => m.status === 'pending') ||
  state.milestones[state.milestones.length - 1]
if (activeMilestone.status === 'pending') {
  activeMilestone.status = 'in_progress'
  activeMilestone.roundOpened = review.round
}

// ── 4. 决策：门禁 / 时间盒 / 阻塞 → mode 与 pace ─────────────────────
const policy = state.policy || {}
const gateMin = policy.gateMinScore ?? 7
const openIssues = state.issues.filter((i) => i.status === 'open')
const openBlockers = openIssues.filter((i) => i.severity === 'blocker')
const openProblems = openIssues.filter((i) => i.severity === 'problem')
const openConcerns = openIssues.filter((i) => i.severity === 'concern')

const basis = []
let mode = 'ADVANCE'
let killSwitch = false
let abort = false

if (review.scores && (Number(review.scores.visual) < gateMin || Number(review.scores.spatial) < gateMin)) {
  mode = 'KILL_SWITCH'
  killSwitch = true
  basis.push(
    `盲审较低项 ${Math.min(review.scores.visual, review.scores.spatial)} < ${gateMin}：按纪律当天中止重构，摘掉 diorama 入口，回 R19 轨道（报告 v3.6 + 小红书）`
  )
} else if (review.date > state.timebox.end) {
  mode = 'ABORT'
  abort = true
  basis.push(`审查日期 ${review.date} 超出时间盒 ${state.timebox.end}：自动放弃重构，回 R19 收尾`)
} else if (openBlockers.length) {
  mode = 'UNBLOCK'
  basis.push(`${openBlockers.length} 个阻塞项未清：本轮只做解阻，暂停新功能推进`)
} else {
  basis.push('无阻塞项、门禁未触发、时间盒内：按当前里程碑剩余验收项继续推进')
}

if (checkFail > 0) {
  basis.push(`本轮 ${checkFail} 个验收项未通过 → 这些项自动置顶为下一轮 P0`)
}
if (closedThisRound.length) {
  basis.push(`本轮闭环 ${closedThisRound.length} 个问题（${closedThisRound.join(', ')}），从待办中永久移除`)
}
if (duplicateSkipped.length) {
  basis.push(`拦截 ${duplicateSkipped.length} 条重复处理（已闭环问题被再次提交），未重复排期`)
}
const deferred = openConcerns
  .filter((i) => i.affects !== activeMilestone.id)
  .map((i) => ({ id: i.id, title: i.title, affects: i.affects, suggestion: i.suggestion }))
if (deferred.length) {
  basis.push(`${deferred.length} 个 concern 影响未来里程碑（${deferred.map((d) => d.affects).join('/')}）：登记为 deferred，本轮不排期也不遗忘`)
}
const nearConcerns = openConcerns.filter((i) => i.affects === activeMilestone.id)
if (nearConcerns.length) {
  basis.push(`${nearConcerns.length} 个 concern 直接影响当前里程碑 ${activeMilestone.id}：并入本轮待办`)
}

// 节奏：连续两轮受阻 → 收窄；连续两轮全清 → 加速；时间盒吃紧 → 保盲审
const history = state.rounds.slice(-1) // 本轮尚未 push
const last = history[history.length - 1]
let pace = 'normal'
if (mode === 'UNBLOCK' && last && last.mode === 'UNBLOCK') {
  pace = 'narrow'
  basis.push('连续两轮出现阻塞 → 节奏收窄为本轮只解阻，不并行开新功能')
} else if (checkFail === 0 && openedThisRound.length === 0 && last && last.checkFail === 0 && last.openedProblemCount === 0) {
  pace = 'accelerate'
  basis.push('连续两轮验收全通过且无新开问题 → 可提前拉取下一里程碑的低风险准备项')
}
const daysLeft = Math.round(
  (new Date(`${state.timebox.end}T00:00:00Z`) - new Date(`${review.date}T00:00:00Z`)) / 86400000
)
const preBlind = ['D1', 'D2', 'D3', 'D4'].includes(activeMilestone.id)
if (daysLeft <= 2 && preBlind && !killSwitch && !abort) {
  pace = 'triage'
  basis.push(`距时间盒结束仅 ${daysLeft} 天且仍在 ${activeMilestone.id}：砍范围保 D5 盲审，不做镀金`)
}

// ── 5. 下一轮待办（自动排序） ────────────────────────────────────────
const tasks = []
const addTask = (t) => {
  if (tasks.some((x) => x.key === t.key)) return // 同轮去重
  tasks.push(t)
}

if (mode === 'KILL_SWITCH') {
  addTask({ key: 'KILL-01', priority: 'P0', kind: 'kill-switch', text: '摘掉 diorama 入口，恢复 R19 轨道', acceptance: '默认 URL 与线上同构，diorama 不可达' })
  addTask({ key: 'KILL-02', priority: 'P0', kind: 'kill-switch', text: '回 R19 收尾：报告 v3.6 + 小红书', acceptance: '材料齐备，等用户确认后官网「修改提交」' })
} else if (mode === 'ABORT') {
  addTask({ key: 'ABORT-01', priority: 'P0', kind: 'abort', text: '时间盒到期：冻结重构，回 R19 收尾', acceptance: '线上 R19 未被改动' })
} else if (mode === 'UNBLOCK') {
  for (const b of openBlockers) {
    addTask({ key: `UNBLOCK-${b.id}`, priority: 'P0', kind: 'blocker', text: `[${b.id}] ${b.title}`, acceptance: b.suggestion || '阻塞解除并有可复现证据' })
  }
} else {
  // 未通过的验收项优先（P0），其后是当前里程碑剩余项（P1）
  const unmet = activeMilestone.criteria.filter((c) => !c.met)
  for (const c of unmet) {
    const failed = c.lastRound === review.round && !c.met
    addTask({
      key: c.id,
      priority: failed ? 'P0' : 'P1',
      kind: 'criterion',
      text: `[${activeMilestone.id}] ${c.item}`,
      acceptance: c.item,
      milestone: activeMilestone.id,
    })
  }
  // 影响当前里程碑的未闭环问题
  for (const p of [...openProblems, ...nearConcerns]) {
    if (p.affects !== activeMilestone.id) continue
    addTask({ key: `FIX-${p.id}`, priority: 'P0', kind: 'problem', text: `[${p.id}] ${p.title}`, acceptance: p.suggestion || '问题解决并有证据' })
  }
}

// 优先级排序：P0 在前，其次按 severity / 里程碑权重
const order = { P0: 0, P1: 1, P2: 2 }
tasks.sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9) || a.key.localeCompare(b.key))

const roundNum = Number(String(review.round).replace(/^R/, ''))
const nextRoundId = Number.isFinite(roundNum) ? `R${roundNum + 1}` : `${review.round}-next`
const output = {
  round: review.round,
  date: review.date,
  reviewer: review.reviewer || '(未署名)',
  mode,
  pace,
  progress: {
    completionPercent,
    activeMilestone: activeMilestone.id,
    daysLeft,
    milestones: state.milestones.map((m) => ({ id: m.id, status: m.status, met: milestoneProgress.find((p) => p.id === m.id).met, total: milestoneProgress.find((p) => p.id === m.id).total })),
    issues: {
      open: openIssues.length,
      closed: state.issues.length - openIssues.length,
      blocker: openBlockers.length,
      problem: openProblems.length,
      concern: openConcerns.length,
    },
  },
  adjustmentBasis: basis,
  closedThisRound,
  openedThisRound,
  duplicateSkipped,
  deferred,
  nextRound: { round: nextRoundId, focusMilestone: activeMilestone.id, taskCount: tasks.length, tasks },
  policyFlags: { killSwitch, abort, gateMinScore: gateMin, fallback: policy.fallback || 'R19' },
  notes,
  evidence: review.evidence || [],
}

// ── 6. 落盘 ──────────────────────────────────────────────────────────
state.rounds.push({
  round: review.round,
  date: review.date,
  reviewer: output.reviewer,
  milestone: review.milestone,
  checkPass,
  checkFail,
  blockerCount: openBlockers.length,
  openedProblemCount: openedThisRound.length,
  closedCount: closedThisRound.length,
  duplicateSkipped: duplicateSkipped.length,
  completionPercent,
  mode,
  pace,
})
state.lastUpdated = new Date().toISOString()

if (!dryRun) {
  fs.mkdirSync(ROUNDS_DIR, { recursive: true })
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n')
  fs.writeFileSync(LATEST_PATH, JSON.stringify(output, null, 2) + '\n')
  fs.writeFileSync(path.join(ROUNDS_DIR, `${review.round}.json`), JSON.stringify(output, null, 2) + '\n')
}

// ── 7. 人话摘要 ──────────────────────────────────────────────────────
console.log(`\n=== 审查驱动循环 · ${review.round}（${review.date}）===`)
console.log(`完成度 ${completionPercent}%  |  当前里程碑 ${activeMilestone.id}  |  模式 ${mode}  |  节奏 ${pace}  |  剩余 ${daysLeft} 天`)
console.log(`问题台账：open ${openIssues.length}（blocker ${openBlockers.length} / problem ${openProblems.length} / concern ${openConcerns.length}），closed ${state.issues.length - openIssues.length}`)
console.log('\n调整依据：')
basis.forEach((b, i) => console.log(`  ${i + 1}. ${b}`))
console.log(`\n已闭环：${closedThisRound.length ? closedThisRound.join(', ') : '（无）'}`)
console.log(`重复处理拦截：${duplicateSkipped.length ? duplicateSkipped.map((d) => d.id).join(', ') : '（无）'}`)
console.log(`延后登记（不进本轮、不遗忘）：${deferred.length ? deferred.map((d) => `${d.id}→${d.affects}`).join(', ') : '（无）'}`)
console.log(`\n${nextRoundId} 待办 ${tasks.length} 项（focus ${activeMilestone.id}）：`)
tasks.slice(0, 20).forEach((t, i) => console.log(`  ${i + 1}. [${t.priority}] ${t.text}`))
if (tasks.length > 20) console.log(`  ... 还有 ${tasks.length - 20} 项，见 docs/loop/latest.json`)
if (notes.length) console.log('\n备注：\n  ' + notes.join('\n  '))
console.log(dryRun ? '\n[DRY-RUN] 未写回状态文件。' : `\n已写回 docs/loop/state.json / latest.json / rounds/${review.round}.json`)
