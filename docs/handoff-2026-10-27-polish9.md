# 交接文档 · polish9 视觉冲刺（2026-10-27 深夜）

> 写给下一个 AI agent 的全面接手提示词。本文档 = 状态快照 + 操作手册 + 待办清单 + 可粘贴提示词正文。
> 权威序：`AGENTS.md`（操作契约）> `project.md` > `docs/lessons.md` > 本文。本文过期不作数，以 git log 与 design-audit 为准。

## 零、交付物更新（2026-10-28 00:45，接手先读）

应用代码仍是 R7/R8（未重新构建）；提交物已补齐：

- **Demo 视频**：`docs/video/demo-video.mp4`，2 分 09 秒，1600×900，中文旁白 + 真实操作幕字幕（m02–m05）。工程源 `docs/video/demo-v2/`（narration / config / overlay / VTT）。已单独更新到 gh-pages（`7085316`），线上 `https://zgqy379.github.io/guangchang/demo-video.mp4`。
- **报告书**：`docs/report.pdf` v3，9 页；新增当前街区/单厂视觉、Aholo 资产迭代、八轮盲审过程、工程还债、评审映射与附录；源 `docs/report.typ`。
- **合规**：MIT `LICENSE`、`web/index.html` OG 元标签、`web/public/og-image.png`（1200×630）；`docs/submission-checklist.md` 已入库。
- **源码**：`main` 与 `feat/debt-reduction-week1` 已推送；当前 HEAD 以 git log 为准。
- **未完成**：① 魔搭应用仍是 R7/R8，但其 `demo-video.mp4` 可能仍是旧 40s——若以魔搭为主链接，需重新上传 dist（同时更新视频）并重部署；② 官网正式提交（0/2 必交项）；③ 小红书 #Aholo黑客松；④ 移动端真机帧率。
- **并发提醒**：`web/src/App.tsx`、`WorkdaySky.tsx`、`TwinEnvironment.tsx`、`web/src/engine/time.ts`、`tools/shoot-street.cjs` 有另一个会话的未提交改动（昼夜光照轮次）。不要直接构建/部署当前工作区，先确认该轮次已提交或收尾。

## 一、我是谁、刚做完什么（30 秒版）

我是 polish9 视觉冲刺 agent。用户目标「把皮补到 9 分」——即把盲审视觉分从 6.5–7.0 推向 9。我跑了 **八轮独立盲审**（每轮 2 名未接触实现的临时评审、只看截图）、实施约 20 项修复、修复 3 起根因级事故，最终 **视觉稳定在 7.0 平台（空间 7.25–7.5），未达 9 也未稳定过 7 门禁**。主理人已拍板 **(a) 按「功能/视觉修复版」口径立即部署**——gh-pages 与魔搭均已部署并验收通过。剩余四项美术清单（见 §五）需要设计决策级美术轮次，是本轮未完成、交给你继续的工作。

## 二、当前状态快照（接手第一件事：逐条核对）

- **分支**：`feat/debt-reduction-week1`；提交链 `a2e89c7(基线) → … → 9bc66a4(部署) → 66f7474(交接) → 67129ef(评分准则) → a98f2cb(R1–R8 评审入库)`；`main` 与 `feat/debt-reduction-week1` 均已推送 origin（2026-10-27 23:2x，origin/main 此前落后 42 个提交）。工作区仅 `.arts/` 未跟踪；`tmp-design-review/` 已 gitignore；另有未跟踪设计草稿 `docs/design/{charter,gap-report,signature}.md`，归属设计冲刺，勿误删。
- **部署**：
  - gh-pages：**当前为 a98f2cb（R7/R8）构建 `index-CiY9Bf6S.js`**，已通过线上完整启动验收（首屏 canvas 0 → 街区 canvas 1 / 672 drawCalls / 零异常）。注意 Pages HTML 有 10 分钟缓存，验收 URL 加 `?v=Date.now()`
  - 魔搭 `zgqy379/guangchang3d`：**当前同为 `index-CiY9Bf6S.js`（1,020,830B 真 JS，非 LFS pointer）**，Draco 192,420B 与 avatar-idle.glb 3,078,664B 均 200；门户 `?mode=full` 在 egolite 截图里 iframe 不渲染（捕获层怪癖）——需在桌面浏览器人工终验一眼。
  - **部署事故（勿重演）**：22:35 gh-pages 曾被 34c1efe 的 R5/R6 基线构建（`index-DxLFAF67.js` / 666 DC）误覆盖，22:55 已恢复 R7/R8。**禁止直接发布基线 worktree 的 dist**；部署必须从目标 HEAD 构建，发布后比对双端 bundle 哈希与角色门字符串。
- **验收工具链**：`tools/shoot-ego-street.mjs`（egolite 14 张全流程，内建窗口自愈 CDP+ShowWindow）、`tools/shoot-street.cjs`（Chrome 管线，长跑更稳，egolite 渲染进程连跑多场会挂起——挂起时换它）、`tools/shoot-single.cjs`（Chrome，单人 3 图）、`tools/accept-live.mjs`（线上验收）、`tools/ms-upload-polish9.py` + `tools/ms-redeploy-ego.mjs`（魔搭上传+重部署，免 cookie）
- **验证命令**：`cd web && npm run build`（tokens+tsc+vite；**tsc 失败时 vite 不跑、dist 保持旧版**——截图前必须看到新的 `✓ built`）；`node tools/check-contrast.mjs`、`node tools/check-panel-ink.mjs`（后者建议把 forms/ 目录纳入扫描——本次 GcSlider/GcSelect 墨色漏检的教训）

## 三、八轮盲审数据（勿重跑，直接引用）

视觉：R1 7.5/6.5 → R2 7.0/7.0 → R3 6.5(稳定化前) → R4 7.0 → R5 7.0 → R6 7.0 → R7 夜专项 7.0 → R8 昼/夜 6.5/6.5。空间：7.0–7.5 稳定。评审原文在 `tmp-design-review/review-*.md`（gitignore 未跟踪，本地在）。截图：`docs/figures/street-2026-10-27-polish9/`（14 张）+ `docs/figures/single-2026-10-27/`（3 张）+ 基线 `docs/figures/street-2026-10-27/`。图片事实索引：`tmp-design-review/figure-facts.md`。

**结论（八轮、十余名评审、两套管线共同证明）**：agent 的参数/材质/构图微调在 7.0 平台震荡不收敛；剩余差距需要设计决策级美术轮次。

## 四、已根治的事故（勿回退，勿重蹈）

1. **T13a**：Canvas 内裸 `<div>` → R3F「Div is not part of THREE namespace」→ 街区整页崩。DOM 必须走 drei `<Html>`
2. **T13b**：R3F 元素加 `data-*` 属性 → dashed key 被 pierce 解析 `['data','work','id']` → 崩。标识用 React key
3. **黑棚顶（M6b 起潜伏）**：`material.vertexColors=true` + 几何体**无 color 顶点属性** → USE_COLOR 乘未绑定 attribute = 纯黑。instanceColor 染色**不需要** vertexColors
4. **focus 白幕（潜伏四轮）**：BoothHardware 阴影面**无贴图** = 纯白方块 3.2×3.2 ×64，夜 0.9 低机位堆叠成白幕。已挂径向暗贴图。定位法：透明网格全量清单探针 + 隐藏二分（`tools/bisect-veil2.cjs`、`tools/probe-scene.cjs` 走 `window.__st`）
5. **stale dist**：tsc 失败 → vite 不跑 → dist 旧版照常出图。构建失败后必须看到新 `✓ built` 再拍
6. **stale figures**：正式截图滞后代码五波差点漏掉黑棚顶。**凡碰街区渲染的提交，当轮重跑 shoot 全套四图**
7. **GcSelect 传 label 不传值**：select 控件 value 必须=原始存储值（14），传展示 label（"14 薪"）会回落第一项
8. **check-panel-ink 盲区**：forms/ 目录漏检——GcSlider/GcSelect 墨色 `--ui-ink-*` 误用已修，建议把 forms/ 纳入扫描

## 五、你的主任务：美术轮次清单（R7/R8 处方式验收语言，按此逐项做+单项盲审）

1. **昼间光照与投影**（R8：天空泛白无投影、物体平贴）——统一曝光架构、阴影落地（二次烘焙已做仍弱，需 TA 评估 shadow map 策略：分辨率/范围/bias）、天空加层次
2. **屋顶与四区色距**（R8：左上米色/左下橙红空屋顶占近半、色相相近难辨）——屋顶加细节（天窗/设备/边缘线）并拉开四区色距
3. **街道纵深**（R6/R8：左半空旷、沿街立面空置）——行道树/车辆/路人/橱窗内容，InstancedMesh 预算内
4. **单厂低值端叙事**（R6：低参数近黑空场）——参数化道具群（刻度人偶/五险柱廊/期权云耦合）
5. **HR idle 观感**（R6：双臂平展似 T-pose）——换 idle 动画或加手部姿态偏移
6. **focus 前景清理**（R8：散落箱体立柱、青字压浅底）——杂物组织化 + 低对比浮字改色

**工作方式**：每项 = 设计决策 → 实现 → egolite/Chrome 重拍 → 2 名拆分制临时盲审（8 图内，16 图会让子代理过载失败）→ design-audit 归档。**预期**：单项过 7.5–8 即有效；四项全做完预估 8–9。

## 六、部署（已完成，若需再部署照此）

gh-pages：`cd web; $env:VITE_BASE_TOKEN='ghpages'; npm run build; Copy-Item ../docs/video/demo-video.mp4 dist/ -Force; npx gh-pages -d dist -b gh-pages`（推送后 **Pages HTML 缓存 10 分钟**，验收 URL 加 `?v=` 击穿，并轮询线上/本地 bundle 哈希一致后再验收）。魔搭：`python tools/ms-upload-polish9.py`（LFS 阈值 500MB + 批次 12MB，报告须 Committed N / **LFS 0**）→ `cmd /c "ego-browser nodejs < E:\guangchang\tools\ms-redeploy-ego.mjs"`（免 cookie，egolite 自带登录态；**「重新部署」控件非标准 button，用全元素精确文本匹配取最内层**）→ 状态 API `GET /api/v1/studio/zgqy379/guangchang3d/status`。魔搭门户 `?mode=full` 在 egolite 截图 iframe 不渲染（捕获怪癖）——人工终验一眼。

**发布前置检查（22:35 事故后新增）**：① `dist` 必须来自目标 HEAD 的构建（看新的 `✓ built` 与 `dist/index.html` 的 bundle 哈希）；② 发布后同时比对 Pages 与魔搭 index.html 指向的 bundle 哈希，双端必须一致；③ 校验 bundle 含「直接逛招聘街区」且不是 132B 的 LFS pointer；④ **基线 worktree 的 dist 一律不得直接发布**。

## 七、可粘贴提示词正文（发给下一个 agent 的开场白）

> 你接手「逛厂 GuǎngChǎng」（E:\guangchang，群核 Aholo 黑客松 3D 求职街区，截止 2026-11-19）。先读 `docs/handoff-2026-10-27-polish9.md`（上一棒的完整交接）与 `AGENTS.md`（操作契约，优先级最高），再读 `docs/design/design-audit-2026-10-25.md` 末尾的 R1–R8 八轮盲审记录与「距 9 分清单」。
> 现状：`feat/debt-reduction-week1` 分支，工作区干净；gh-pages 与魔搭均已部署 polish9 修复版并验收通过；盲审视觉稳定 7.0 平台（空间 7.25–7.5），主理人已拍板「先部署、美术清单继续」。你的任务 = 完成 design-audit 归档的美术轮次清单四项（昼间光照与投影 / 屋顶与四区色距 / 街道纵深 / 单厂低值端叙事 / HR idle 观感 / focus 前景清理），每项走「设计决策 → 实现 → egolite 重拍（tools/shoot-ego-street.mjs，注意先跑 tools/restore-ego2.ps1 防窗口最小化）→ 2 名拆分制临时盲审（≤8 图/人）→ 归档 design-audit → 提交」。
> 铁律提醒：AGENTS.md 全部有效；额外注意本次新增五条——① Canvas 内禁裸 div 与 data-* 属性（T13）；② instanceColor 不需要 vertexColors，开了必黑（T14）；③ 阴影面必须挂径向暗贴图（白方块=白幕）；④ tsc 失败 dist 不更新，截图前必须见新 `✓ built`；⑤ 凡碰街区渲染的提交当轮重跑 shoot 四图。盲审不收敛（连续两轮 7.0）就停下向主理人呈报，不要硬刷分数。部署口径 = 修复版，对外不宣称设计门禁。
