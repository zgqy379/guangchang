# 接手提示词：逛厂「立体参数沙盘」重构（2026-11-05）

> 你是接手本任务的 AI Agent。这份文档是你唯一需要的上下文——按顺序读完再动手。
> 本项目一切决策以 `project.md` 最新版为准；工程铁律以 `AGENTS.md` 为准；暗坑以 `docs/lessons.md` 为准。
> 本文与上述三份冲突时，**三份原文赢**（本文是任务书，不是宪法）。

---

## 0. 一句话任务

把已上线、已提交的 3D 求职招聘街区，重构为低多边形 diorama 形态的「立体参数沙盘」——**6 天时限，不过盲审门禁就中止回退，线上已提交版永远兜底**。

## 1. 项目事实（别猜，都验证过）

- **产品**：逛厂 GuǎngChǎng，参数空间化 3D 求职招聘街区。64 家虚构公司（4 行业×16）的总包/五险/下班时间等参数被做成 3D 可视物
- **赛事**：群核 Aholo 全球 3D AI 黑客松，**提交截止 2026-11-19 19:00**（还剩 14 天）
- **当前成绩状态**：**已正式提交第 1 版**（2026-11-04 23:16，状态「已提交·进入资格与完整性审核」）。提交物=魔搭链接 + 报告 PDF + 赛道「游戏应用奖、空间设计应用奖」+ 源码链接。官网可多次提交，以截止前最后一次为准
- **当前线上版 = R19**：Pages `https://zgqy379.github.io/guangchang/`（`index-6A6MFh1z.js`）+ 魔搭 `modelscope.cn/studios/zgqy379/guangchang3d`，双端同构，盲审 7.2/7.2/7.0 过线
- **源码状态**：R19 全部改动已提交本地 `feat/debt-reduction-week1` 分支（commit `954a28a`），**未 push**；`main` 分支落后于此
- **环境**：Windows + PowerShell（**无 heredoc**，写脚本用文件）；前端仅 `web/` 一个 npm 包（npm，勿换）；Node 24；typst 0.15（报告）；仓库公开
- **构建命令**（全部在 `web/` 下）：
  - `npm run typecheck` / `npm run tokens`（改 `design/tokens.json` 后必须跑）/ `npm run build`
  - `npx vite preview --port 4173` 本地预览 dist
  - Pages：`$env:VITE_BASE_TOKEN='ghpages'; npm run build` → `Copy-Item ../docs/video/demo-video.mp4 dist/` → `npx gh-pages -d dist -b gh-pages`（网络偶发 408/SSL 抖动，重试即可）
  - 魔搭：`$env:VITE_BASE_TOKEN='modelscope'; npm run build` → `python ../tools/ms-upload-r19.py`（SDK 通道，令牌在 `.env`，报告须 `Normal committed N / LFS 0`）→ egolite 跑 `tools/ms-redeploy-ego.mjs` 点「重新部署→确认部署」→ 轮询 `GET /api/v1/studio/zgqy379/guangchang3d/status` 到 `Running`
- **浏览器验证只走 egolite**：`& "C:\Users\dqy\.local\share\ego\active_version_dir\ego-browser.exe" nodejs -e "await import('file:///绝对路径.mjs')"`。先例：`tools/shoot-street-r19-day.mjs`（采集）、`tools/accept-live-r19.mjs`（线上验收，抗主线程阻塞版）。headless 截图不可靠。**console.log 会丢，结果写文件再读；一个目标一个 TaskSpace；结束 `task.finish({keep:'all'})`**

## 2. 重构的来龙去脉（为什么掀桌子）

R15–R19 五轮十位独立盲审，分数收敛在 7.2–7.7，共性短板雷打不动：**昼间灰平、材质塑料感、楼体像素模**。用户（项目主理人）2026-11-05 提出：审美差、功能多余、自嗨、要彻底重构。Agent 评估后确认：美术撞了「程序生成」天花板（全部 canvas 程序纹理 + Box 拼装），但工程质量不差（686 draw calls / 零异常 / 双端同构）；「自嗨」的解剖学根因是**系统忠于数据、不忠于问题**（总包被编码了 4 次：碑高/灯条/顶灯/楼高，用户要解码 10 种视觉语言才能回答「谁给得多」）。用户听完「美术重定向」替代方案后**仍坚持重构**，并定调两个方向：

1. **从第一性原理出发**：求职者和招聘者想如何可视化参数、如何更好的交互、视听如何更好
2. **美术方向：低多边形 diorama**

概念已于 2026-11-05 经用户批准（见 §4），当日（D1）开工。

## 3. 重构三纪律（不接受谈判）

1. **兜底不动**：R19 已提交版永远在线。重构版只有过了同一套双盲审门禁（两位评审、取两项较低者、均 ≥7）才走官网「修改提交」刷新；不过线 = 昂贵实验，成绩无损
2. **时间盒**：重构只烧 6 天（11-05 D1 → 11-10 D6）。11-10 晚没有可评审的完整画面 = 自动放弃，回 R19 收尾
3. **暗坑清单随身带**：`docs/lessons.md` 的 T7–T12b 与 AGENTS.md 反直觉点，重构版每条给出规避答案，不许用「这次不会那么倒霉」糊弄

## 4. 已批准概念：「逛厂 · 立体参数沙盘」

diorama 不是皮肤，是答案本身——**整个街区做成桌上微缩模型，一屏看全，不用走路**。低多边形把「只能程序生成几何」的现实洗成风格。

**第一性原理**：求职者 3 分钟只问三个问题，招聘者只想摊位值得走进来。**每个问题一个视觉信道，不多开一个**：

| 问题 | 视觉答案 | 编码 |
|---|---|---|
| 谁给得多 | 楼体**体量** | 质量感（高×宽联动），一眼排序 |
| 钱怎么构成 | 楼身**色带分段** | 底薪=楼身主色 / 增薪=冠 / 期权=顶珠 |
| 累不累 | **窗灯** | 早下班=暖灯亮起，晚下班=黑窗冷玻璃 |
| 五险诚实度 | **地基台** | 足额=完整石台，打折=缺口/缩台 |

**交互**：轨道环绕 + 点选（OrbitControls，drei 已在依赖里）。**不要走路**（走路是 R17–R19 评审始终无感的部分）。hover 出公司卡；点选拉近；最多钉 3 家并排对比——真实行为是「筛 3 家细看」不是「走 64 个摊位」。

## 5. 砍 / 留清单

**砍**（下线或隐藏，代码不删、入口先摘）：A/B 对比页、逛一家、办公室漫游（3DGS 糊墙欠账一起埋）、走路模式、HR 深流程（角色门保留求职者单入口）
**留**（直接复用，别重造）：
- 数据模型 `web/src/data/street-companies.ts`（64 lot + 参数 + `buildingHeight()` + `placeLots()`）
- 参数换算 `web/src/engine/params.ts`（`totalPackage` 等）
- Instancing 纪律与样式基元：`web/src/components/street/instancedUv.ts`（图集选帧补丁）、`OfficeFacadeInstanced.tsx` / `BoothHardwareInstanced.tsx` 的实例池写法
- HUD 框架 `web/src/components/street/GameHud.tsx` / `GameMiniMap.tsx`（简化改造，不是照抄）
- 设计令牌管线（`web/design/tokens.json` → `npm run tokens` → `generated/design-tokens.output.mjs`；**颜色唯一来源是令牌**）
- 部署管线与验收脚本（§1 命令）
- 主题/时间系统 `web/src/engine/theme.ts` + `web/src/components/WorkdaySky.tsx`（光照写法参考）

## 6. 六天计划（2026-11-05 D1 → 11-10 D6）

| 天 | 交付 | 验收 |
|---|---|---|
| D1（今天） | 设计定稿落盘 + 沙盘骨架：新模式 `diorama` 挂进 App（懒加载）、轨道相机、光照基调、桌台地基、四区地块 | typecheck+build 过；egolite 截图能看到沙盘底 |
| D2 | 64 楼体量生成器：体量=总包（高×宽联动）、四区落位、InstancedMesh 池 | draw calls ≤ 150（沙盘规模应远小于街区的 686） |
| D3 | 交互：hover 公司卡 / 点选拉近 / 钉选 ≤3 家对比；HUD 简化（进度/图例） | 全流程可点通 |
| D4 | 细节层：窗灯（下班时间）、色带/地基台编码、树/广场/黄昏氛围 | 四张评审图（对标 R19 机位：昼鸟瞰/夜鸟瞰/近景/对比态） |
| D5 | 性能审计 + 首版截图 + **双盲审第一轮** | ≥7 继续；<7 执行 kill switch |
| D6 | 定向修复 + 第二轮盲审；过线→双端部署→官网「修改提交」 | 门禁通过才部署 |

**Kill switch**：D5 首轮盲审任一较低项 <7 → 当天中止重构，`diorama` 入口摘掉，回 R19 轨道（报告 v3.6 + 小红书）。这不是失败，是纪律。

## 7. 工程接线点（D1 直接照做）

- **模式注册**：`web/src/App.tsx:179` mode union `'single'|'compare'|'office'|'street'|'gallery'` → 加 `'diorama'`；导航按钮区在 ~350-375 行（照「🏙️ 招聘街区」按钮样式加「🗺️ 参数沙盘」）；渲染分拨在 495-559 行，**照 `StreetSceneLoader` 的懒加载 + `SceneErrorBoundary` + `Suspense` 模式包**（铁律：禁止顶层 import 3D 组件、禁止模块级 `useGLTF.preload`、首屏不挂 Canvas）
- **新场景文件**：`web/src/components/diorama/DioramaScene.tsx`（新目录）。相机：drei `OrbitControls` + 低 FOV（25–35°）高机位 35–40° 俯角出微缩感；禁止初始机位落进任何体块（T9 教训：先做包围盒相交验证）
- **配色**：新增 `diorama.*` 令牌段到 `web/design/tokens.json` → `npm run tokens`；**不许在组件里写死色值**（现有违规反例不要学）
- **体量映射**：复用 `street-companies.ts` 的 `INDUSTRY_TOTAL_RANGE` 思路，总包行业内归一化 → 高×宽联动缩放；R19 实测教训：**±14% 读不出，±26% 才过线**——感知阈值比直觉大，起手就给足量程
- **四区落位**：可以复用 `placeLots()` 的十字四街，也可以重排成 2×2 象限盘（沙盘语汇下象限盘更成立——这是重构许可范围内的自由）

## 8. 盲审流程（门禁，同 R19 规程）

1. egolite 采集 4 张 1600×900 实拍（?hour=10 昼 / ?hour=21 夜，脚本照抄 `tools/shoot-street-r19-*.mjs` 改输出目录）
2. **两名全新独立评审**（新会话、只看图、不知实现、互不见结论）：视觉总监（打视觉分）+ 空间体验设计师（打视觉+空间分）。评审 prompt 先例见 R19 会话，归档格式见 `docs/design/reviews/r19-residuals.md`
3. **门禁取两项较低者均 ≥7**；失败轮次必须和成功轮次一样入库（`docs/lessons.md` §456-459 铁律）；**部署的构建必须等于被评审的构建**——过线后不许再追加视觉改动
4. 部署后必须对**线上**做完整启动验收（DOM 挂载 + canvas + drawCalls 非零 + 零异常文案），`curl` 200 不算数

## 9. 协作偏好（用户画像）

- 中文沟通；回答直接、别捧场；用户要的是判断不是附和
- 重要分叉用选择题问用户，其余自主推进「迭代 → 盲审 → 过线 → 部署」
- 提交纪律：`git add <具体文件>`（禁止 `git add .`）；提交前 `git status` 复核；**禁止 `--amend`**；禁止 `git checkout <commit> -- <file>` 做基线还原（用 worktree）；commit 不用 `-q`；**push / 合 main 必须先问用户**
- 新经验写 `docs/lessons.md`，重大事故写 `docs/adversarial-review.md`，别往 AGENTS.md 堆
- 真实账号动作（官网提交、发布）一律先停下等用户确认

## 10. 交接时的未完事项（与重构并行，别忘）

- **报告书 v3.6**：现提交的是 v3.5（R18 口径）。若重构过线，报告需换沙盘实拍图 + 重构叙事，重新走官网「修改提交」上传 PDF
- **小红书发布**（5% 加分，需用户本人账号，#Aholo黑客松）——发布后官网「修改提交」补登记链接
- **移动端真机数据**（加分素材，需用户手机）
- 源码 push / 合 main：等用户发话

## 附录：关键文件地图

| 路径 | 作用 |
|---|---|
| `project.md` | 唯一权威计划书 |
| `AGENTS.md` | 工程铁律（动手前必读） |
| `docs/lessons.md` | 暗坑档案（§7.4 魔搭部署、§13 盲审规程） |
| `docs/submission-checklist.md` | 提交清单与最新状态（2026-11-04 已提交+R19 已部署） |
| `docs/design/reviews/r19-residuals.md` | 最近一轮完整盲审档案（含三轮 FAIL→PASS 教训） |
| `docs/figures/street-2026-11-04-r19/` | R19 评审图（对标机位参考） |
| `web/src/App.tsx` | 模式注册/导航/渲染分拨 |
| `web/src/data/street-companies.ts` | 64 lot 数据 + `buildingHeight()` + `placeLots()` |
| `web/src/components/street/` | 现行街区实现（instancing 范例库，非照抄对象） |
| `tools/shoot-street-r19-*.mjs` | egolite 采集脚本范例 |
| `tools/accept-live-r19.mjs` | 线上验收脚本（抗阻塞版） |
| `tools/ms-upload-r19.py` | 魔搭 SDK 上传（改 commit_message 即可复用） |
