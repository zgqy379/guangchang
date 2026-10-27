# 逛厂 对抗式审查（第二轮红队）· 2026-10-28

> 触发：主理人交办「深度仔细全面的对抗式审查」。
> 方式：三路独立只读审查代理（①代码铁律 20 条逐项核验 ②安全与仓库卫生 12 项 ③交付物一致性 10 项）+ 程序化校验（typecheck / tokens 自检 / 对比度门禁 / 面板墨色 / 完整构建）+ Mimosa 深度扫描（deep，封印报告见文末）+ 线上只读探测（GitHub Pages / 魔搭，GET/HEAD）。
> 审查快照：HEAD `801f749`（feat/debt-reduction-week1）。程序化校验全绿（674 modules，entry 1,017KB / gzip 288KB，对比度按最坏背景全达标）。
> ⚠️ **审查进行中检测到另一会话正在修改工作区**（office 相机巡览工作流），本报告按并发铁律只新增本文件、未改动任何现有文件、未做任何提交——提交与处置全部留待裁决。

---

## 0. 总评

- **可提交状态：高**。必交项（可运行链接 / 2:09 视频 / 9 页报告 v3 / 源码）全部在线且经只读探测证实；红队档案里的工程债 7 项已还 5 项（ErrorBoundary、对比篮持久化、词典驱动、首屏零 Canvas、模块级 preload）。
- **最大新风险是「三层错位」：部署跑在源码前面、文档跑在部署后面。** 循环①-⑥ 的 5 个提交未推送 origin，而双端线上跑的正是这批代码的构建；公开仓库 README/报告宣称"源码可复现"，评审对不上就失分。
- **工程铁律"事故复发类"条目整改扎实**（12/20 全过、注释可溯源）；系统性缺口集中在：`OfficeFacadeInstanced` 的 useEffect（首帧风险）、颜色令牌化只完成一半、draw call 红线口径失真、诚实链路整体躺在死代码里。
- **Mimosa 深度扫描 76 条 findings 分诊后：真源码 0 条，全部指向 `tmp-design-review/gh-pages-video/` 旧构建残留**（74MB，压缩后的 three.js/OfficeViewer bundle 被误判为服务端注入/SSRF）——该目录已从"扫描噪声"升级为"每次 deep 扫描必炸的污染源"，建议视频流程结束后清档。
- 红队自评（非官方，按官方权重）：技术栈 27/30 · 有趣 16/25 · 创新 18/20 · 完成度 17/20 · 传播 0/5 ≈ **78/100**。与 10.26 自评 79 持平，但结构显著变好（视频/完成度补强）；**传播是唯一零分项**，小红书仍是纯失分项。

---

## 一、P0 · 必须裁决（影响提交可信度）

### R1 公开源码落后于线上部署（4-5 个提交未推送）
- 本地 main 领先 origin/main 1 个提交（`23b5208` 视频/文档轮），feat/debt-reduction-week1 领先 origin 5 个提交（`bf291b2`/`0b40736`/`abe9ec1`/`801f749` 循环①-⑥ + draco stub + 评审归档）。
- 而 gh-pages（今晨 06:34 部署，`index-DBFYuFqn.js`）与魔搭（06:39 上传 / 06:50 重部署，`index-DUpMgR-n.js`）**跑的都是这批未推送代码的构建**。
- 连带失真：submission-checklist P0-8「已推送 ✅」、report.typ:252「源码与双端部署已同步」均已不成立；公开仓库此刻缺 draco stub 的源码（线上已换 stub 构建但 `web/public/draco/draco_decoder.js` 的 stub 版本在未推送提交里）。
- **处置**：并发会话收尾后一并提交推送（见 R3），推送时读 hook 输出。

### R2 魔搭端 demo-video.mp4 仍是旧 39.9s 片；且 dist 当前无视频文件（重传陷阱）
- 实测魔搭 repo：`demo-video.mp4 = 1,976,562B`（= v8 旧片逐字节，10-26 提交），2:09 新片（12,490,926B）只在 GitHub Pages。
- **陷阱**：当前 `web/dist/` **不含** demo-video.mp4。下次直接 `upload_folder(dist)` 会把魔搭上的旧视频**直接删掉**而不是更新——必须先 `cp ../docs/video/demo-video.mp4 dist/` 再传（部署配方已有此步，但它不在任何门禁里，靠记忆）。
- README「双端均已就绪」、checklist 警告与此事实部分矛盾。

### R3 并发会话正在实时修改工作区（10.27 事故模式复现风险）
- 审查 30 分钟窗口内实测：`OfficeViewer.tsx`、`CompanyPlot.tsx`、`MoneyMountain.tsx`、`tools/probe-office.cjs` 由干净变为已修改；新增未跟踪 `tools/orbit-office.cjs`、`tools/office-cam-sweep.cjs` 与 6 组 office/single 截图目录。
- 判断：另一会话正在做办公室相机巡览/录屏类工作（与 demo-video v2 的 office 场景同族）。**当前没有任何文件边界声明**，AGENTS.md「派多路前必须先画文件边界，双向声明」在执行层失效。
- 风险：①本报告新增文件可能被对方 `git add .` 卷走；②循环①-⑥ 若此刻由任一方提交，极易重演 10.27「amend 卷入 18 文件」事故；③`CompanyPlot/MoneyMountain` 属「不许动清单」邻接区，改动未过盲审门禁。
- **处置（留裁决）**：等对方收尾 → 双向确认边界 → 按「循环①-⑥ + 本次审查文件」分批 `git add <具体文件>` 提交，禁止 `-q`、禁止 amend。

### R4 InteriorGS 受限截图仍可从公开 git 历史提取（历史残留 vs 合规声明矛盾）
- `06936c2` 曾提交 `office-interiorgs.png`（1.0MB），`183efdf` 已删除并封堵 .gitignore，但该 blob 在公开仓库历史永久可达（`git show 06936c2:...` 可取回）。
- PLY 数据本身从未入库（`git log --all -- "*.ply"` 为空），泄露面=一张渲染截图；但 THIRD_PARTY_NOTICES.md 声明「数据、渲染截图均不进公开仓库」，与历史不符。
- **处置（留裁决）**：接受风险并在 NOTICES 中改为如实陈述；或 `git filter-repo` 历史重写 + force push（破坏性，需同步 Pages/魔搭与所有克隆，距截止 22 天建议不做）。

---

## 二、P1 · 代码与诚实（应修）

### R5 `OfficeFacadeInstanced` 用 useEffect 写实例矩阵（自家铁律唯一漏网）
- `web/src/components/street/OfficeFacadeInstanced.tsx:15,164,181`——姊妹文件 BoothHardwareInstanced 注释里写着「useEffect 会首帧叠原点」，本文件却在 count 与矩阵两处用 `useEffect`。64 栋立面首帧存在未就位/叠原点窗口，低概率但属 T10 同族。改 `useLayoutEffect` 一行事。

### R6 `GalleryCorridor` 内联 `new THREE.MeshStandardMaterial` ×4（GPU 材质泄漏）
- `web/src/components/gallery/GalleryCorridor.tsx:59,65,70,76`——JSX props 里每次重渲染新建材质且永不 dispose（主题切换 night prop 变化即触发）。同仓 WorkdaySky/CompanyPlot 有「缓存 + dispose」纪律先例。

### R7 「诚实链路」整体躺在死代码里，且埋着假进度（接线即违规）
- `AvatarPanel.tsx`、`FactoryWizard.tsx` 全仓无引用（死代码），但 report.typ:194-206 与词典描述把 replay 通道当作当前公开能力叙述。
- 死代码内部：①照片路径 `setTimeout 800ms` 显示「本地贴入中…」而注释自认无任何本地处理在跑（`AvatarPanel.tsx:116-124`，典型假进度——诚实是硬门槛）；②回放剩余时间用 `channel.elapsed`（恒 0）→「剩余 1:25」全程不变（`AvatarPanel.tsx:280`、`FactoryWizard.tsx:225`）。
- 活代码侧干净：无假进度条、无「正在生成 3D…」文案、加载遮罩 12s 兜底真实。
- **处置**：要么接线并修掉两处假值，要么在报告里把 replay 降级为「架构已就绪、UI 未接线」，二选一，不许两头叙述。

### R8 draw call 红线口径失真 + 帧率红线未真机证明
- 文档红线 ≤200（project.md 7.5），实测 687（life-v2 metrics，审查代理估算 650-850：HRStand 每摊 8-12 个独立 mesh ×64 ≈ 500-640 为主源）；report.typ 写 672——三个数字各说各话。
- `frameloop` 全部默认 `always`，无按需渲染/降帧策略；移动端 ≥45fps 红线仍只有桌面模拟数据（lessons 12.2 已自我声明）。
- **处置（裁决二选一）**：把红线改为「街区模式 ≤750、桌面实测口径」并全文档对齐；或立项第二轮实例化合并（ArchWay/名牌/楼层灯带）。报告 v4 用单一实测数字 + 测量条件（可见性、限流剔除）。

### R9 颜色令牌化只完成一半（「颜色唯一来源」FAIL）
- CSS 侧合规；3D 侧约 50 处硬编码 hex（WorkOrbit/GalleryCorridor/BoothProps/NPC/HRStand 换装色池/GameMiniMap HUD/TwinEnvironment/StreetScene 灯光等），且 `#ffd9a0` 在 NPC.tsx:54 与 HRStand.tsx:492 重复硬编码——正是令牌化缺失的直接后果。
- 主行业色/场景色已接令牌，漏网的是昼夜材质色与灯光色。建议按「先 HUD → 再昼夜材质 → 灯光」三批收敛，或把规则改述为「语义色必须令牌化，程序化贴图内 hex 豁免」。

### R10 相机包围盒验证未泛化（T9 规则只覆盖了一个特例）
- 初始鸟瞰 [26,36,26] 是手选特例；传送落点 `position*0.4`（StreetScene.tsx:1362、GameMiniMap.tsx:282）与 RoamCamera 特写机位均无包围盒相交验证；lessons:50 记录的旧机位 (0,34,26) 与实际代码不一致。tools/ 无通用校验脚本。（并发会话正在做的 office 相机 sweep 属同类问题域，建议顺手带上。）

### R11 调试钩子未门控 + 生产 console 泄漏 + context lost 零处理
- `window.__st/__cam/__gl/__roam` 挂在生产 window（StreetScene.tsx:1450,1522-1524、GalleryScene.tsx:75-77）；role-flow-engineering R08 要求 `?debug=1` 门控（公开仓库是评分项）。
- OfficeViewer.tsx:94 每次加载打印整段包围盒诊断 log。
- 全仓无 `webglcontextlost/restored` 监听——4 个渲染上下文 + 长会话移动端，丢上下文即整场景死无恢复。

### R12 低危代码债（速记）
- `WorkOrbit.tsx:56` 空 useFrame 白注册；`StreetScene.tsx:1499` 投递特效 key 用 `Date.now()`（同毫秒撞 key）；`MoneyMountain.tsx:71-91` 生长完成后仍每帧重写矩阵；RoamCamera/AvatarActor useFrame 内每帧 new Vector3（GC 压力）；`AvatarPanel.tsx:128` 硬编码 '/assets'（死代码内）；OfficeFacade 沿街发光边 z 间隔恰好压线 0.02（合规但无余量）。

---

## 三、P1 · 档案与文档一致性

### R13 project.md（唯一权威）滞后一天
- 9.4 仍写「视频 39.9s 1280×720 无音轨」「报告 v2 3 页」「魔搭 10-27 构建中」；v1.4 之后发生的报告 v3、2:09 视频、循环①-⑥/R9-R14、MIT、OG 图、v1.0-submission tag、Draco stub 全部未回写。**权威文档与实物脱节是评审可抓的把柄**。

### R14 report.typ v3 漂移点（出 v4 时一并修）
| 断言 | 实际 |
|---|---|
| 「双端同一构建 index-CiY9Bf6S.js」(:275) | 双端已换循环①-⑥ 构建且哈希因 base 不同必然不同（gh-pages DBFYuFqn / 魔搭 DUpMgR-n） |
| 「八轮盲审 R1-R8」(:35,210) | 实际已归档 14 轮（R13 7.2/7.5 首过 7；R14 6.8/7.1 视觉冻结）——出 v4 补「14 轮轨迹+冻结」叙事或注明报告截至时点 |
| 672 draw calls (:245,249) | 最新实测 687 |
| 作品廊「从街道路牌与『我的』页进入」(:76) | 「我的页」入口未实现（全源码仅街道路牌一条链路） |
| 首屏 entry 1,016.60kB / 0.31MB (:248,265) | 现构建 1,021,251B；循环①-⑥ 无新实测存档（漂移 ~0.5%，方向未证伪） |

### R15 归档缺口（过程证据断档）
- **设计四文档（benchmarks / gap-report / signature / charter）至今未纳入版本控制**（仅本地未跟踪文件）——e9c95d7 只提交了 award-track-prompt.md；与 charter「过程证据可复核」的自我定位不符。
- R9-R14 评审原文无独立文件（仅 design-audit 摘要；R1-R8 有 11 个原文档）；`docs/figures/street-2026-10-28-focus-night-v2/`（3.6MB）未提交造成循环③轨迹 v2 断档。
- docs/iterations/ 最晚 10-26 20:08——R9-R14 期间无 Aholo API 生成，属正常（视觉迭代无生成存档义务），不算违规。

### R16 工作区卫生
- `.arts/`（工具状态 json）、`ms-settings-diag.png` 等未跟踪路径未被 .gitignore 覆盖——`git add .` 会把工具态扫进公开仓库（本报告文件同理，故本文件也留待具体 add）。
- stash@{0}（baseline-1027-0035-pre-polish9，32 文件 +693/-316）大概率已被提交版覆盖，drop 前先 `git stash show -p` 复核。
- handoff-2026-10-26.md 自称「永远最新」与 AGENTS.md「会过期」矛盾；handoff-polish9 §零/§二/§三 三处已失效（下棒照做会误判状态）。

---

## 四、安全与合规核查（通过项事实清单）

1. **Secrets：干净**。471 个 tracked 文件敏感模式扫描仅命中变量名/文档引用；`.env` 未 tracked（.gitignore:14-16）；tools/ 逐脚本核查（gen_*/ms-*/rec-*/shoot-*/make_*）密钥一律走 `.env`/env，cookie 只在运行时本地文件；git 历史抽样 18 项（-S LUX3D_CN_API_KEY / MODELSCOPE_TOKEN / sk-）均无真实 key 值（sk- 命中全是 PNG 二进制字节）。
2. **受限资产：tracked 路径 0**。`*.ply`/interiorgs 零 tracked；磁盘 3 处 PLY 全被 ignore 覆盖（check-ignore 逐条验证）；web/public/assets 全为自有 Aholo 生成资产（4 spz + 3 avatar glb + 9 hr glb + bill bundle），与 THIRD_PARTY_NOTICES 一致（唯历史截图残留见 R4）。
3. **第三方 CDN：0**（T12 合规）。运行时唯一网络调用 OfficeViewer fetch 的 URL 来自 assetUrl 同源拼接；字体为系统栈。
4. **Draco：stub 方案自洽**。decoder.js=1,154B 显式 stub（头注释 INTENTIONALLY STUBBED，走 wasm 路径）、wasm wrapper 58KB+真实 wasm 192KB 自托管、注明来源 three@0.169 Apache-2.0；线上 200。
5. **外联脚本防护存在但强度不一**：URL 白名单+私网拦截齐全，但 gen_retarget/gen_recon_test/gen_walk_inplace/gen_hr_rig_retry 用裸 `assert`（`python -O` 会剥离）——对照 gen_v2_batch 的 raise ValueError 规范写法，建议统一。
6. **仓库体积**：pack 335.71MiB / 471 tracked 文件；docs/figures tracked 54.8MB（盲审截图多轮累积）——流程性膨胀，非安全问题；魔搭同步与克隆成本随之上升。
7. **信息卫生**：多个 tools 脚本硬编码 `C:\Users\dqy\...` / `E:\guangchang\...` 绝对路径（无密钥，仅隐私）。
8. **LICENSE=MIT、OG 1200×630 实测、index.html og/twitter 标签齐全。**

## 五、Mimosa 深度扫描分诊（封印报告）

- 扫描 `scan-2026-10-27T22-44-44.686Z-1eab67f393de`（deep，seal sha256:b161a344…）：**76 findings（high 18 / medium 58），分诊后 100% 位于 `tmp-design-review/gh-pages-video/` 旧构建 bundle**——压缩后的 three.js/OfficeViewer 客户端代码被误判为 command-injection / SSRF / mongo-sort-injection（客户端渲染器无服务端语义）。
- **web/src / tools / docs / draco / dist：0 条**。与 10.28 拉锯结论一致：误报模式已随 stub 清根；剩余噪声唯一来源是 74MB 的 `tmp-design-review/` 残留目录。
- 建议：demo-video v2 工作流确认结束后删除该目录（删除前与并发会话确认它不再是 gh-pages 服务目录）；删除后重跑一次 deep 扫描应得「接近零 findings」的干净封印报告，作为提交前安全存档。
- 扫描自身标注 runStatus=inconclusive（调用图部分不完整）、verdictEffect=none——定性为「无真实告警 + 覆盖声明如实」。

## 六、程序化校验记录（2026-10-28 审查时点）

| 项 | 结果 |
|---|---|
| `npm run typecheck` | ✅ 0 错误 |
| `npm run tokens` 自检 | ✅ 48 个 number 令牌类型正确；生成文件无 drift（git status 干净） |
| `tools/check-contrast.mjs` | ✅ 垫实底档：白天 secondary 7.37 / muted 6.90，夜间 7.66 / 6.42（全 ≥AA）；未垫实底档 secondary 4.46 ✗ 如实保留为「必须垫底」的证据 |
| `tools/check-panel-ink.mjs` | ✅ 无不透明面板误用玻璃墨色 |
| `npm run build` | ✅ 674 modules；entry 1,017KB(gzip 288KB)；OfficeViewer chunk 1,952KB(gzip 642KB) 未拆分（体积警告仅此二者） |

## 七、建议行动顺序（裁决后执行）

1. **并发收口**：等 office 工作流会话收尾，双向确认文件边界（我方新增：本报告）。
2. **提交推送**：分批 `git add <具体文件>`（循环①-⑥ 遗留 + 本次审查文件 + 对方 office 产出各自成提交），推送读 hook 输出；R1/R3 随此闭环。
3. **魔搭视频**：`cp ../docs/video/demo-video.mp4 dist/` 后重传（配方 §7.4，报告须 Normal/LFS 0），R2 随此闭环。
4. **小时级代码修复**：R5（useLayoutEffect 一行）、R6（材质缓存+dispose）、R11（console 删减 + `?debug=1` 门控）。
5. **文档回写**：project.md 9.4/9.3 时效字段 + report v4 决策（R14 表逐条）+ handoff 过时段落加「已失效」标注。
6. **裁决项**：R7 replay 接线与否、R8 红线口径二选一、R4 历史重写与否、tmp-design-review 删除时点。
7. **提交前最后一步**：重跑 deep 扫描留干净封印报告。

*本文件由审查会话新增（未提交、未动其他文件）。归档衔接：待裁决后可在 docs/adversarial-review.md 追加一行指向本文件。*
