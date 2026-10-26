# 逛厂 · 双角色体系工程落地与重构评估 v1（Role Flow Engineering v1）

> 版本：v1.0（2026-10-27）
> 作者：frontend-engineer（前端工程专家）
> 阶段：**Phase 3 · 落地改造与重构评估**（只产出评估与实施方案，不改 `web/src` 生产代码）
> 上游（唯一权威，不得推翻）：
> - `project.md`（产品哲学 / 7.3 三档管线 / 7.5 性能红线 / 第九部分排期）
> - `docs/lessons.md`（部署铁律 §3、事故档案 §4、街区沉淀 §7、UI 重构 §8）
> - `docs/design/role-flow-visual-v1.md`（Phase 1 视觉规格）
> - `docs/design/role-flow-spec-v1.md`（Phase 2 流程规格）
> - `docs/design/ui-system-v3.md`（§12 落地清单 L1–L15）
> - `docs/design/twin-style-spec-v4.md`（§5 组件与代码改造清单）
> - `dictionary/hr-dictionary.json` / `dictionary/candidate-dictionary.json` / `dictionary/dictionary.schema.json`
>
> **本文件的写法约定**：所有结论基于实际读码，引用 `文件:行号`。工时单位 = 人时（单人 1 人天 = 6 人时）。
> 凡标注 **「不做」** 的条目 = 超出 24 天单人预算，直接砍，不进 Demo 期。

---

## 0. 阅读导航与本文铁律

| 铁律 | 本文对应条款 |
|---|---|
| 浏览器端**无后端**，Key 绝不能进前端（`web/src` 现无任何 Key 引用，必须保持） | §4.1 / §4.2 / §8-R05 / §8-R10 |
| 资产必须走 `engine/asset.ts` 的 `assetUrl()`（硬编码绝对路径不吃 vite base → T8 白屏） | §2.6 / §6.2 / §8-R12 |
| Draco 解码器**自托管**到 `web/public/draco/`，禁止运行时 CDN | §6.2 / §8-R12 |
| 构建配置用**非路径令牌**（`VITE_BASE_TOKEN=ghpages`），MSYS 会改写路径形态 env | §7.4 / §8-R13 |
| InstancedMesh 的矩阵写入必须用 `useLayoutEffect`（用 `useMemo` → 64 盏路灯不生效事故） | §6.3 / §7.4 |
| 相机初始位必须对场景所有建筑做包围盒相交验证（T9 黑屏事故） | §2.4 / §8-R17 |
| 任何会在挂载后被对齐/缩放的 GLB 组件，加载期必须有 Suspense 占位 | §2.6 / §7.2 |
| 3D 颜色禁止写死 hex，一律从 `generated/design-tokens.output.mjs` 读 | §2.7 / §3-T02 |
| 受限资产（InteriorGS PLY）连"入口"都不能进公开构建（用 `import.meta.env.DEV`） | §8-R11 |
| 诚实铁律：**全站 0 处假进度条 / 0 处暗示浏览器可现场生成** | §4.3 / §9 验收 G1 |
| 同一工作区禁止两个 Agent 会话同时运行 | §8-R15 |

---

## 1. 现状体检（基于实际读码）

### 1.1 文件清单 · 行数 · 职责 · 问题

> 行数为实际 `wc -l` 结果（2026-10-27）。**与任务书给出的数字有出入，以实测为准**：
> `HRStand.tsx` 实为 **751** 行（非 711），`StreetScene.tsx` 实为 **1199** 行（非 1180），
> `styles.css` 实为 **859** 行（非 817）。

| 文件 | 行数 | 职责 | 当前问题（耦合度 / 可复用性 / 风险） |
|---|---|---|---|
| `web/src/App.tsx` | **452** | 应用根：模式路由 + 参数状态 + 主题状态 + 对比篮 + 渐进加载 + 全部顶栏/侧栏 JSX | **耦合度最高**。详见 §1.2 |
| `web/src/components/street/StreetScene.tsx` | **1199** | 街区主场景：静态街景 + 参数碑 + 交互采样 + DOM 浮层 + 进度持久化 | **应拆**。详见 §1.3 |
| `web/src/components/street/HRStand.tsx` | **751** | 摊位三件套：HR 形象 + 参数悬浮 + 门面 + 贴图工厂 | **应拆**。详见 §1.4 |
| `web/src/components/street/GameHud.tsx` | 91 | 求职者 XP HUD（四区收集进度） | emoji 图标（📮🧺👁）违反 ui-system-v3 附录 B；XP 规则读 tokens 但 `rarityOf` 混在此文件（应归参数层） |
| `web/src/components/street/GameMiniMap.tsx` | 111 | 街区小地图（SVG 罗盘 + 摊位点 + 玩家朝向） | `placeLots()` 被**第二次**调用（:15）；无邻近摊位列表（Phase 2 要求"我在哪+附近有什么"）；SVG 文字有 viewBox 裁切史（lessons §8.4-3） |
| `web/src/components/HRPanel.tsx` | 82 | HR 词典驱动表单 | `FIELD_BY_ID` 硬编码 5 id（:13-19）。详见 §1.5 |
| `web/src/components/OfficeViewer.tsx` | 136 | Aholo Viewer 渲染 3DGS SPZ | **状态良好**。仅 `useEffect` 未做 `viewer.dispose()`（切模式后 WebGL 上下文可能残留，建议补） |
| `web/src/components/AvatarActor.tsx` | 184 | 玩家漫游演员（WASD + 点击行走 + Idle/Walk 切换） | **状态良好**。但**模块级 `useGLTF.preload`（:183）→ 首屏即拉 3.08MB**，违反 Phase 1「首屏零 3D 资产」 |
| `web/src/components/AssetProp.tsx` | 45 | 通用道具（带缩放归一化） | **模块级 `useGLTF.preload`（:45）→ 首屏即拉钞票 GLB 2.23MB**。且 `App.tsx:8 → CompanyPlot.tsx:19 → AssetProp` 是静态 import 链，preload 在 App import 时即触发 |
| `web/src/components/WorkdaySky.tsx` | 235 | 天幕 / 太阳月亮 / 光照（v4 孪生风） | **状态良好** |
| `web/src/components/RoamCamera.tsx` | 54 | 第三人称跟随相机 + 特写机位 | 状态良好 |
| `web/src/components/street/NPC.tsx` | 51 | 行人闲逛 | 状态良好 |
| `web/src/components/CompanyPlot.tsx` | 116 | 单公司展台（钞票山 + 切口 + 发光路 + 道具） | 硬编码引用 3 个 GLB 资产（:89-91） |
| `web/src/components/MoneyMountain.tsx` | 154 | 钞票山（InstancedMesh） | 实现良好；**未与词典 `mapping.type='moneyMountain'` 建立运行期联系** |
| `web/src/components/SchrodingerBills.tsx` | 91 | 薛定谔期权（半透明钞票） | 同上 |
| `web/src/components/CarvedZone.tsx` | 64 | 五险切口牌 | 硬编码 `ratio` 字符串分支，未读词典 antiGaming |
| `web/src/components/GlowPath.tsx` | 87 | 求职者贡献热力图地砖路 | **伪随机模拟**（`heatmap()` :12-20 固定 seed=7），**不读词典**；被 `CompanyPlot.tsx:87` 无条件渲染 |
| `web/src/components/AssetProp.tsx` | 45 | 通用道具（带缩放归一化） | **状态良好**（但 `:45` 的模块级 preload 必须改，见 §1.7） |
| `web/src/engine/dictionary.ts` | 85 | 词典类型 + 载入 + `entry()` + `formatValue()` | `candidateDictionary` 导出但**全项目零引用**；`entry()` **只查 HR 词典**（:58） |
| `web/src/engine/params.ts` | 90 | `CompanyParams` 模型 + 钞票山几何换算 | 字段名 camelCase 与词典 id snake_case **两套命名**，靠 `HRPanel.FIELD_BY_ID` 人工桥接 |
| `web/src/engine/theme.ts` | 103 | 系统时间 → 主题状态机（light/dark + 锁定） | 状态良好，但**逻辑被写在 App.tsx 里**（见 §1.2） |
| `web/src/engine/sunPosition.ts` | 159 | NOAA 简化式太阳/月亮位置 | 状态良好 |
| `web/src/engine/sky.ts` | 70 | 天色渐变 | 状态良好 |
| `web/src/engine/asset.ts` | 5 | `assetUrl()` | 状态良好 |
| `web/src/data/street-companies.ts` | 155 | 64 摊位数据 + 布局（`placeLots()`） | **纯函数但被 3 处重复调用**（`StreetScene.tsx:55` 模块级常量、`GameMiniMap.tsx:15` 的 `useMemo`、`GameHud.tsx:28` 遍历 `STREET_LOTS`）→ 应改单例 + 缓存 |
| `web/src/data/fictional-companies.ts` | 58 | 预设公司 | 状态良好 |
| `web/src/styles.css` | **859** | 全部样式（134 条规则，35 个 `var(--*)`） | 单文件；`src/` 内仍有 **69 处写死 hex**（`color="#xxxxxx"` / `'#xxxxxx'`） |
| `web/src/main.tsx` | 6 | 挂载 + 导入 tokens.css + styles.css | 状态良好 |
| `web/tokens.config.mjs` | ~130 | DTCG → css / mjs / d.mts + **number 令牌自检** | 状态良好（lessons §9.4 已修）；**缺"令牌引用完整性"自检**（见 §6.5） |
| `web/design/tokens.json` | — | 令牌唯一来源 | 无 `role.*` / `progress.*` / `focus.*` / `param.*` / `portfolio.*` / `preview.*` / `demo.*` 组（Phase 1 §6.1 要求） |
| `dictionary/hr-dictionary.json` | 519 | 15 词条 | 5 `implemented` / 10 `planned` |
| `dictionary/candidate-dictionary.json` | 120 | 8 词条 | **仅 1 个 `implemented`**（`expected_salary`），且**无任何 UI 入口** |
| `dictionary/dictionary.schema.json` | 130 | 词典契约 | `mapping.type` 20 值 enum（:96-116）；`input` **无 `bind` 字段** |

### 1.2 `App.tsx`（452 行）单体承担了什么

**实际承担的 9 项职责**（逐条定位）：

| # | 职责 | 位置 | 问题 |
|---|---|---|---|
| 1 | **模式路由** | `mode` state `:96`；分支 `:264 / :347 / :352 / :362 / :370 / :379` | 4 个值的枚举**同时**装了「产品级导航」（street / compare）与「演示形态」（single / office）。Phase 2 §1.3 要求 6 个场景 → 枚举必扩，但三元链会变成 6 层嵌套 |
| 2 | **参数状态（A/B 双份）** | `paramsA/paramsB/presetA/presetB` `:97-100`；写入 `:271-276`、`:323-328`、`:284-288`、`:336-340` | A/B 是**同一份 CompanyParams 的两份拷贝**，无共享结构 |
| 3 | **主题状态机** | `lockMode/envHour/theme/pendingTheme` `:107-110`；轮询 effect `:113-123`；防抖 effect `:126-133`；`cycleLock` `:140-152` | **134 行 UI 逻辑与 4 个 state 混在路由组件里**，与场景无关却随每次 mode 切换重渲染 |
| 4 | **对比篮** | `basket/nameA/nameB` `:165-167`；`addBasket` `:168`；`applyBasketAndCompare` `:170-182` | **不持久化**（刷新即丢）。Phase 2 附录 D 要求 `gc-street-basket-v1` |
| 5 | **办公室场景选择** | `officeScene` `:102`；`OFFICE_SCENES` 常量 `:34-39`；下拉框 `:241-259` | `enterOfficeFromStreet`（`:155-162`）**用 industry 字符串拼 spz 文件名**：`` `${lot.industry}.spz` ``。隐式约定，加第 5 个行业即断 |
| 6 | **渐进加载边界** | `OfficeViewer` lazy `:15-17`；`StreetScene` lazy `:19-21` | 只有 **2 个** lazy 边界。**首屏（single 模式）必然同步加载 `CompanyPlot` → `AssetProp` → 钞票 GLB 2.23MB**（`MoneyMountain` 是程序化 InstancedMesh，无 GLB） |
| 7 | **增长动画触发** | `growthKey` `:101`；按钮 `:229-231` | 场景无关但挂在这里 |
| 8 | **场景内 Canvas 封装** | `Scene` 组件 `:41-93` | 与 `StreetScene` **各写一套 `<Canvas>` + 相机 + 控制器**（:64 / :1093）。两套相机参数不共享 |
| 9 | **全部页面 JSX** | header `:191-261`、aside `:264-344`、section `:346-397`、footer `:400-403`、`StreetSceneLoader` `:408-452` | 452 行里 **JSX 占 ~230 行**，逻辑 ~220 行 |

**额外风险**：
- **无 ErrorBoundary**。`OfficeViewer` 的 aholo-viewer 一旦抛错 → 整个 React 树白屏（与 lessons §4 T8 同类事故）。
- `data-theme` 挂在 `<div className="app">`（`:190`），任何未来新增的**根级 portal**（抽屉/Toast）若渲染在 `.app` 之外 → 主题失效。
- `mode` 切换时**整棵子树卸载重挂**（`:370-396`），`paramsA` 等靠 `useState` 才保住 —— 这正是 lessons §7.7 "切模式 HUD 清零" 事故的成因，说明**状态所有权放错层**的代价已经被付过一次。

### 1.3 `StreetScene.tsx`（1199 行）里的静态场景元素该不该拆

**当前文件混装 4 类内容**：

| 类别 | 组件 | 行数区间 | 合计 |
|---|---|---|---|
| **静态街景元素**（无交互、可 InstancedMesh 化） | `Roads` | :87-145 | |
| | `RoadLanes` | :309-347 | |
| | `DistrictRoadSigns` | :377-394 | |
| | `DistantSkyline` | :397-443 | |
| | `StreetLamps` | :462-576 | |
| | `ArchWay` | :599-649 | |
| | 小计 | | **≈ 322 行** |
| **参数可视化** | `ParamSteles`（4 个 InstancedMesh） | :174-269 | |
| | `RarityGems` | :272-306 | ≈ 140 行 |
| **交互/动画** | `DeliveryFX` | :652-708 | |
| | `NearSampler` | :711-754 | |
| | `NearRing` | :757-809 | |
| | `NavPillar` | :877-990 | ≈ 227 行 |
| **DOM 浮层** | `LotCard` | :812-874 | ≈ 63 行 |
| **状态与持久化** | `loadProgress` / `saveProgress` | :37-53 / :1034-1040 | |
| | toast / deliveries / delivered / visited | :1027-1051 | ≈ 90 行 |
| **主组件** | `StreetScene` | :993-1199 | 207 行 |

**结论：静态元素该拆，但理由不是"文件太长"，而是"它们的资源策略不同"**——
静态街景元素是**一次性构建、恒定不变**（InstancedMesh，零 per-frame 成本）；
`LotCard`/`GameHud`/`GameMiniMap` 是**DOM 层**，应该能单独被 §3 的玻璃组件替换；
`loadProgress` 是**持久化**，应该进 `engine/progress.ts`（ui-system-v3 §12 L15 已列）。

### 1.4 `HRStand.tsx`（751 行）混杂了哪些关注点

| 关注点 | 内容 | 行数 | 可否独立 |
|---|---|---|---|
| **贴图生成 + 缓存** | `facadeTexture(floors, mode)` :52-137 · `glassTexture(mode)` :142-218 · `shadowTexture()` :222-235 · `spillTexture()` :238-252 · `deliveredTexture()` :255-275 · `cashTexture(base,dark)` :278-306 | **≈ 255 行（34%）** | ✅ 全部是**无 React 依赖的纯工厂**，可整块搬到 `engine/textures/` |
| **材质/配色池** | `OUTFITS` / `HAIRS` :44-45 | 6 行 | ✅ 移 `data/avatar-pool.ts` |
| **LOD 策略** | `NEAR=26 / FAR=34` :35-36；`useFrame` 距离采样 + 滞回 :464-472 | ≈ 18 行 | ✅ 应独立成 hook `useNearLod()` |
| **交互回调** | 门面 LED 点击 → `onEnterOffice` :738-747；`document.body.style.cursor` 副作用 :742-743 | ≈ 12 行 | ✅ 提到门面组件 |
| **门面几何** | 门面 group :594-748（建筑体块 + **6 个 `attach="material-N"`** :621-664 + 玻璃幕墙 :677-680 + LED :682-685 + 灯带 :687-693 + **4 种行业屋顶变体** :695-724 + 门 :728-735） | **≈ 155 行（21%）** | ✅ 独立成 `components/street/OfficeFacade.tsx` |
| **角色演员** | `RealHR`（GLB + skeletonClone + 材质提亮 + 归一化）:313-363 · `PlaceholderHR`（11 个 mesh 程序化人形）:366-422 | ≈ 110 行 | ✅ 独立成 `components/street/HRActor.tsx` |
| **名牌** | `useNameTexture(name, industry)` :425-447 | ≈ 23 行 | ✅ |
| **摊位装配** | `HRStand` 主体 :449-750 | ≈ 300 行 | 拆分后剩装配层 |

**关键发现（性能级）**：`HRStand` 的门面用了 **`boxGeometry` + 6 个 `attach="material-N"`**（:621-664）。
一个带 6 个材质组的 box = **6 个 draw call**。64 个摊位 = **384 draw call**。
且 `PlaceholderHR` 有 **11 个 mesh**（:380-419），64 个摊位远景全用占位 = **704 draw call**。
→ 这两项合计 **~1090 draw call**，是 2136 实测值（lessons §7.3）的主要来源。详见 §6.3。

### 1.5 词典引擎的复用面 —— 与"词典即引擎"立意有多远

**实测三组数据**：

1. **`mapping.type` 从未在运行期被分发。**
   `dictionary.schema.json:96-116` 定义了 20 个 mapping type（`moneyMountain` / `schrodingerBills` / `gallery` / `salaryCloud` / `glowPath` / …）。
   全项目 grep：`mapping.type` 只出现在 `engine/dictionary.ts` 的**类型声明**里。
   `MoneyMountain.tsx` / `SchrodingerBills.tsx` / `CarvedZone.tsx` / `GlowPath.tsx` 各自**硬编码**被 `CompanyPlot.tsx:78-91` 直接调用。
   → **词典定义了契约，但没有引擎去执行契约。**

2. **HR 侧：15 词条里 5 个 `implemented`（33%），且靠人工桥接。**
   `HRPanel.tsx:13-19` 的 `FIELD_BY_ID` 把 5 个 snake_case id 映射到 camelCase 字段。
   这张表**必须手工维护** —— 词典加一条 `implementation: implemented` 的新词条，前端**不会**自动出现控件（因为 id 不在 `FIELD_BY_ID` 里，会被 `:26` 的 filter 静默过滤掉，只出现在 `:70-79` 的"planned 芯片"区）。

3. **候选人侧：8 词条里 1 个 `implemented`（12.5%），且**零 UI 入口**。**
   `candidateDictionary` 在 `engine/dictionary.ts:55` 导出后**全项目零引用**（grep 证实）。
   `entry(id)`（`:57-61`）**只查 `hrDictionary.entries`**，candidate 侧连查询函数都没有。
   唯一的 `implemented` 词条 `expected_salary`（`candidate-dictionary.json:88-104`）**没有任何 UI**。
   8 个词条中 7 个是 `planned`，其中 `portfolio_gallery`（:68-76）是用户明确要的核心交互。
   已存在的 candidate 映射组件 `GlowPath.tsx` **不读词典**，用固定 seed 的伪随机热力图（`heatmap()` :12-20），被 `CompanyPlot.tsx:87` 无条件渲染。

**距离结论（必须诚实）**：

> 词典目前是**一份高质量的、机器可读的参数契约 + 文档**，但**不是引擎**。
> "加词条零前端开发"（`HRPanel.tsx:2` 的注释）在**已实现的 5 个词条范围内**成立；
> 一旦加第 6 个 implemented 词条、或加第 2 个 candidate 侧控件，**注释即失效**。
>
> **差距 = 一个 registry（把 `mapping.type` 变成运行期分发的键）+ 一层 binding（把 id 变成字段的自动映射）。**

### 1.6 进度持久化：只有一个 key，且散落

- 全项目 `localStorage` 引用**仅 3 处**，全部在 `StreetScene.tsx`（`:41` 读 / `:1036` 写 / `:37` 常量）。
- 唯一的 key：`gc-street-progress-v1`（`StreetScene.tsx:37`），内容 `{ delivered[], visited[] }`。
- Phase 2 附录 D 要求 **12 个 key**；ui-system-v3 §12 L15 已列 `engine/progress.ts` 统一读写层。
- 当前实现的两个可复用点：`loadProgress()`（:39-53）**已有 try/catch 兜底**（隐私模式 → 空进度），这个模式应保留并复制到统一层。

**散落问题的具体后果**（不是洁癖，是有代价的）：
- 主题锁定 `lockMode` **不持久化** → 刷新后回到 auto，评审演示可能被系统时间打断（`App.tsx:107`）。
- 对比篮 **不持久化** → Phase 2 D12 硬要求"跨模式往返篮子不丢"，当前只在**同一会话**内成立，刷新即丢。
- 角色选择结果（`gc-role-v1`）、求职者档案（`gc-candidate-profile-v1`）、建厂进度（`gc-hr-factory-v1`）**全无** → Phase 2 §6 的状态机无法落地，因为状态无处安放。

### 1.7 首屏实测（`dist` 产物逐文件核对）—— 比"擦线"严重，是**超标**

> `web/dist/assets/` 实测（2026-10-27 构建产物）：

| chunk / 资产 | 原始大小 | 进入首屏？ | 说明 |
|---|---|---|---|
| `assets/index-Bq89jrDM.js` | **1068.0 KB** | ✅ 是 | 主 chunk。**内含 three.js + @react-three/fiber + drei**（因为 `App.tsx:2-3` 顶层静态 import 了 three 与 Canvas）→ gzip ≈ 330KB |
| `assets/StreetScene-BCzWmeoi.js` | 47.2 KB | ❌ 否 | 街区 lazy chunk（**很小，因为 three.js 被留在主 chunk 了**） |
| `assets/OfficeViewer-B8aRTKPc.js` | 1906.8 KB | ❌ 否 | aholo-viewer |
| `assets/index-Bg-_ZRaW.css` | 17.1 KB | ✅ 是 | 含令牌 CSS |
| `assets/avatar/avatar-idle.glb` | 3078.7 KB | ✅ **是** | `AvatarActor.tsx:183` **模块级** `useGLTF.preload` → **App import 时即拉** |
| `assets/money/gc-bill-bundle.glb` | 2229.8 KB | ✅ **是** | `AssetProp.tsx:45` **模块级** `useGLTF.preload`；`App.tsx:8 → CompanyPlot.tsx:19 → AssetProp` 是**静态 import 链** |
| `assets/money/gold-coins.glb` | 1445.8 KB | ❌ 否 | ⚠️ **死资产**：全项目（src / docs / tools）**零引用**，只出现在 `docs/iterations/lux3d-money/2026-10-25-gold-coins/meta.json`（A/B 对照实验产物）→ **可从 `web/public/` 删除，dist −1.45MB** |

**首屏传输量实测（gzip 文本 + 二进制原样）**：

```
主 JS chunk        1068.0 KB 原始 → gzip ≈ 330 KB
CSS                 17.1 KB
HTML                  0.6 KB
avatar-idle.glb    3078.7 KB   ← 模块级 preload
gc-bill-bundle.glb 2229.8 KB   ← 模块级 preload
────────────────────────────────────────
首屏合计         ≈ 5.64 MB   ❌ 超过 5MB 红线
```

**两个根因（都可低成本消除）**：

1. **模块级 `useGLTF.preload`（2 处）** —— `AvatarActor.tsx:183` 与 `AssetProp.tsx:45`。
   preload 在**模块 import 时**执行，而 `App.tsx` 静态 import 了 `CompanyPlot` → `AssetProp`，
   所以哪怕首屏只渲染一个 DOM 角色卡，**两个 GLB 已经在拉了**。
2. **three.js 在主 chunk 里** —— `App.tsx:2-3` 顶层 `import * as THREE from 'three'` + `import { Canvas } from '@react-three/fiber'`，
   而 `<Canvas>` 所在的 `Scene` 组件就定义在 `App.tsx:41-93`。
   → **把 `Scene` 抽成 `components/scenes/CompanyScene.tsx` 并 `lazy()`（§3.2 M1 已列），
   `App.tsx` 顶层不再 import three → 主 chunk 缩到 ~140KB 原始（~45KB gzip），
   three.js 移入 lazy chunk（首屏不加载）。**
   **这一条是 §3.2-M1 的额外收益，不额外花工时。**

**改造后首屏**：JS ≈ 45KB(gzip) + CSS 17KB + HTML 0.6KB + **零 GLB / 零 SPZ / 零 WebGL 上下文** → **≈ 0.07 MB**。
首屏 5MB 红线**不是靠裁资产达成的，是靠"首屏不挂 Canvas + 消灭模块级 preload"达成的**（详见 §4.4）。

### 1.8 体检小结：三句话

1. **`App.tsx` 是一个"路由 + 状态 + 视图"三合一的手写 Store**，缺的是**归属分层**，不是缺功能。
2. **`StreetScene` / `HRStand` 的体量问题本质是资源策略混装**（静态 vs 交互 / DOM vs 3D / 贴图 vs 几何），拆分能直接换来 draw call 收益。
3. **"词典即引擎"目前是 1/3 的实现度**：`mapping.type` 没有运行期分发，`FIELD_BY_ID` 靠人工，candidate 侧无入口。

---

## 2. 目标架构

### 2.1 推荐：分层折中，**不引入状态机库**

> **结论先给**：双角色流程**既不该继续塞进 `App.tsx` 的 mode 枚举，也不该引入 xstate / react-router 这类状态机库**。
> 推荐 **「场景枚举 + 一层 60 行的自定义路由 hook + Context 承载跨场景共享状态」**。

**理由（按权重）**：

| # | 理由 | 证据 |
|---|---|---|
| 1 | **24 天 / 单人，引入状态机库的成本远超收益**。xstate v5 + 持久化适配 ≈ +45KB gzip（首屏红线 5MB 里无所谓，但）+ 需重写全部现有交互 + 团队只有一个人 | Phase 2 §9.3 自己排了 23 天，零缓冲 |
| 2 | **复杂度不在"转移图"，而在"跨场景状态传递"**。现有 4 个场景没有一条真正的多步流程；Phase 2 的 D1–D14 大多是**单场景内的面板/抽屉**，不是状态机 | Phase 2 §6 状态机（8 个场景）的每个状态几乎都在同一个页面内 |
| 3 | **路由库解决的是 URL 同步，而本项目是 3D 单页 Demo**，演示时 URL 变化无意义甚至有害（GitHub Pages 子路径 + base 令牌已经踩过一次坑） | `vite.config.ts:21` 的 base 处理已够复杂 |
| 4 | **手写 hook 的可读性对"单人 24 天"是优势**：一个 60 行、纯 `useState` + `useRef` 的文件，任何时候打开就看懂，无中间件、无 devtools 依赖 | — |

**具体形态**：

```ts
// web/src/engine/scene.ts
export type SceneKey =
  | 'roleGate'      // 首屏角色选择（零 3D）
  | 'street'        // 招聘街区
  | 'gallery'       // 作品廊（新增，不进顶栏）
  | 'compare'       // 对比
  | 'mine'          // 我的（新增）
  | 'office'        // 办公室漫游
  | 'single'        // 单公司展台（演示形态）
  | 'hrFactory'     // HR 建厂向导（新增）

export interface ScenePayload {
  lotId?: string          // 从街区进办公室：带摊位 id
  workId?: string         // 从 HR 访客模式进作品详情
  officeKey?: string      // 办公室场景 key（替代 App.tsx 的 industry 拼串）
}

export interface SceneRouter {
  scene: SceneKey
  payload: ScenePayload
  go: (s: SceneKey, p?: ScenePayload) => void
  back: () => void
  /** 切场景时卸载上一棵 3D 子树 → GPU 资源自动释放 */
}
export function useSceneRouter(initial: SceneKey = 'roleGate'): SceneRouter
```

**路由只管"我在哪 + 我带着什么上下文"，不管业务状态**。业务状态（角色、档案、对比篮、进度）进 Context + `engine/progress.ts`。

### 2.2 作品廊（Gallery）怎么接入而不破坏现有四模式

**推荐：新增第 5 个 `SceneKey` + 独立 `<Canvas>` + 不进顶栏。**

```
App.tsx
 ├─ <RoleGate/>            ← scene==='roleGate'：纯 DOM，**不挂任何 Canvas**
 ├─ <StreetScene/>         ← scene==='street'：自带 Canvas（现状不动）
 ├─ <GalleryScene/>        ← scene==='gallery'：**自带独立 Canvas**（新增）
 ├─ <OfficeViewer/>        ← scene==='office'：aholo-viewer（非 R3F）
 └─ <CompanyScene/>        ← scene==='single' | 'compare'：从 App.tsx 的 Scene 抽出
```

**为什么各场景自带 Canvas 而不是共用一个**：

1. **R3F 的 `<Canvas>` 与其子树是一体的**：场景切换必须卸载整棵 3D 树才能释放 WebGL 上下文与纹理。若把 `<Canvas>` 提到 App 层、只换内容，几何/材质不会自动 dispose → 切几次场景显存就爆。
2. **作品廊是完全不同的场景**（环形走廊 + 我的展位 + 他人展位），与街区的十字路口 + 摊位无共享几何、无共享相机。
3. **Phase 2 §9.4 明确「作品廊不进首屏预算 · 独立懒加载」** —— 独立 lazy chunk 是最直接的达标方式。
4. **成本对比**：共用 Canvas 需要做 `scene.clear()` + 手动 dispose 清单（≈ +80 行、易漏）；独立 Canvas 是 **0 行**，卸载即回收。

**入口（Phase 2 §1.3 裁定）**：作品廊**不进顶栏**，入口 = ①街道路牌（`StreetScene` 加一块路牌 mesh）②「我的」页。
**顶栏三 Tab 保持不变** —— 这是 Phase 2 引用 ui-system-v3 §8.4 已验收组件（罗盘 + 四区进度行）的明确裁定，不推翻。

**"我的"页是新增的**：Phase 2 §1.3 把 `Mine` 列为顶层 Tab 之一。当前项目**没有"我的"页**。
→ **这是 Phase 3 必须诚实上报的缺口**：Phase 2 §1.3 的 6 个导航位里，`Mine` 与 `Gallery` **都尚不存在**。
工程建议：`Mine` 用**纯 DOM 页面**实现（进度 / 投递回执 / 档案 / 作品集管理），不建 Canvas → 成本最低（≈ 200 行）。

### 2.3 词典引擎如何扩展到双端

**分两步，第一步必做，第二步 Demo 期不做。**

#### 第一步（必做，约 5 人时）：**binding 层 —— 元数据驱动取代 `FIELD_BY_ID`**

```ts
// dictionary.schema.json 的 input 增加（向后兼容，可选）
"bind": {
  "type": "string",
  "description": "运行时字段名（camelCase），用于把词典词条绑定到参数对象字段；缺省 = id"
}

// dictionary/hr-dictionary.json 的 5 个 implemented 词条补：
//   annual_base_salary        → "bind": "annualBaseSalary"
//   salary_structure          → "bind": "salaryStructure"
//   social_insurance_base_ratio → "bind": "socialInsuranceBaseRatio"
//   equity_value              → "bind": "equityValue"
//   offwork_time              → "bind": "offworkTime"
```

```ts
// web/src/engine/dictionary-binding.ts（新增，~80 行）
export function bindField(e: DictEntry): string {
  return (e.input as { bind?: string }).bind ?? e.id
}
/** 按 side 取"可编辑词条"（排除 readonly），并给出字段名 */
export function editableEntries(side: 'hr' | 'candidate'): { entry: DictEntry; field: string }[]
/** 从参数对象按词典读值（自动处理 slider/select/toggle/readonly） */
export function readValue(e: DictEntry, values: Record<string, unknown>): unknown
/** 写值：返回不可变 patch */
export function makePatch(e: DictEntry, raw: unknown): Record<string, unknown>
```

**收益**：`HRPanel.tsx:13-19` 的 `FIELD_BY_ID` **删除**。词典加第 6 个 implemented 词条 → **零前端代码**自动出现控件。
**成本**：`dictionary.schema.json` + 2 个词典 JSON 各加字段 + 新增 1 个 80 行文件 + `HRPanel.tsx` 改为消费 binding。**不动 `CompanyParams` 的 camelCase 字段名** → 不破坏 `street-companies.ts` / `CompanyPlot` / `MoneyMountain` / `HRStand` 等 8 个消费点。

> **明确否决的替代方案**：把 `CompanyParams` 改成扁平 `Record<string, ...>`（key 直接用 snake_case id）。
> 虽然更"纯"，但要改 `params.ts` + `HRPanel` + `street-companies.ts` + `CompanyPlot` + `MoneyMountain` + `CarvedZone` + `SchrodingerBills` + `HRStand` + `GameHud` 共 **9 个文件**的字段名，
> 且 `HRStand.tsx:563-565` 这类 `lot.params.socialInsuranceBaseRatio === 'full'` 的**字符串字面量判断**遍布代码。
> 收益（命名统一）≪ 风险（改 9 处 + 回归面覆盖整条街区）。**不做**。

#### 第二步（Demo 期不做，产品期做）：**mapping registry —— 让 `mapping.type` 真正生效**

```ts
// web/src/engine/mapping-registry.ts（产品期，~200 行）
export interface MappingContext<P> {
  entry: DictEntry
  values: P
  field: string
  scene: 'companyPlot' | 'candidateBooth' | 'streetLot'
}
export type MappingRenderer = (ctx: MappingContext<any>) => ReactNode
export const MAPPING_REGISTRY: Record<string, MappingRenderer> = {
  moneyMountain: ..., schrodingerBills: ..., skyClock: ...,
  gallery: ..., salaryCloud: ..., glowPath: ..., nameplate: ..., /* … */
}
```

**Demo 期为什么不做**：
- schema 的 20 个 mapping type 里，**当前只有 5 个 HR 侧类型在渲染管线中真正被调用**，且都是**硬编码直调**。
- 做 registry 需把 `MoneyMountain` / `SchrodingerBills` / `CarvedZone` / `GlowPath` 重构成适配器（**4 个组件改造 + 1 个 registry + 1 套调用点迁移 ≈ 6–8 人时**），
  换来的是「未来加词条零代码」，而 **Demo 期不打算再加 P0 参数词条**。
- **更关键**：registry 的价值在"多端复用同一映射"。Demo 期 candidate 侧只新增 `expected_salary`（`salaryCloud`）与 `portfolio_gallery`（`gallery`）**两个**类型 →
  **为 2 个类型建 20 个槽的框架，收益为负**。
- 折中：**Demo 期只做"两个新类型的局部 registry"** —— 在 `CandidateBooth` 里用一张 `{ 'salaryCloud': SalaryCloudRenderer, 'gallery': GalleryRenderer }` 的小表（≤30 行），
  保留向完整 registry 演进的空间。**工时 1 人时，不建通用框架**。

### 2.4 令牌与样式如何组织

#### 令牌：单一来源，只扩不建

- **扩 `web/design/tokens.json`**：并入 Phase 1 §6.1 的 `role.*` / `focus.*` / `progress.*` / `param.*` / `portfolio.*` / `preview.*` / `demo.*` 七组（**约 45 个令牌**）。
- **Phase 1 §6.1 已警示 alias 风险**（DTCG alias 在 js 平台导出是否解析为字面量未验证）→ **一律用直接值**，不用 alias。
- `tokens.config.mjs` **无需改**：`shadow/css` 与 `glass/css` 两个 transform 已注册且已用 `filter` 限定（lessons §9.4 已修）。
  - 但 `role.*` 里含 `rgba(...)` 字符串 —— `glass/css` transform 只处理 `token.path[0] === 'glass'` 且支持 `{r,g,b,a}` 对象；
    `rgba(...)` 字符串会走 `String(v)` 分支原样输出 → **可以工作**，但需在并入后**跑一次 `npm run tokens` 验证导出值**（0.5 人时）。
- **3D 侧导出名对照**：Phase 1 §6.2 要求"写 3D 代码前必须逐个 grep 核对"。
  `tokens.config.mjs:88-96` 的 `walk()` 把路径转 PascalCase（`role.candidate.accent` → `RoleCandidateAccent`），**可预测**，但仍需 grep 确认。

#### 样式：`styles.css`（859 行）**建议重构，但不是"必须"**

**推荐两步走，不要一次全拆**：

| 步骤 | 动作 | 工时 | 理由 |
|---|---|---|---|
| **S1（推荐做）** | 抽出 `web/src/styles/glass.css`（玻璃基座：`.gc-glass` / `.gc-panel` / 焦点环 / toast / 抽屉），新组件 import 它；`styles.css` 保留其余 | 2 人时 | Phase 1/UI v3 的玻璃样式会被 **6+ 个新组件**共用，不能各自复制粘贴。**这是新增功能的必要前置**，不是洁癖 |
| **S2（可延后）** | 全拆 5 文件：`tokens.css` / `base.css` / `shell.css` / `street.css` / `role.css` | 2.5 人时 | CSS `@import` 必须在文件首部且顺序敏感，Vite 打包虽会合并但顺序需人工保证 → **回归风险 > 收益**。Demo 期不做 |

**改 `styles.css` 的另一个必要动作**：扫掉 `src/` 里的 **69 处写死 hex**（lessons §9.5 要求"深色材质硬编码要全部扫一遍"）。
优先级：**只扫新增组件**（角色卡 / 作品廊 / 访客模式），存量 3D 硬编码（`HRStand.tsx:490/495/511/561/565/586/704/711/715/722/730/734`）**Demo 期不动**
（它们已被 v4 孪生主题双分支覆盖，改动面 64 摊位 × 12 处，回归风险高）。

### 2.5 哪些保留 / 改 / 废

#### ✅ 原样保留（不要动）

| 文件 | 理由 |
|---|---|
| `engine/asset.ts` | 5 行，vite base 处理是 T8 事故的正确解 |
| `engine/theme.ts` | 主题判定 + 锁定，逻辑干净；只需把 App 里的 effect 搬走 |
| `engine/sunPosition.ts` | 实测精度达标（夏至 82.2° / 冬至 35.3°） |
| `engine/sky.ts` | 状态良好 |
| `data/street-companies.ts` | 确定性伪随机，录屏一致；只需加缓存单例 |
| `data/fictional-companies.ts` | 状态良好 |
| `components/OfficeViewer.tsx` | 3DGS 取景逻辑（dense box + 外壳半径）已实测；只补 `viewer.dispose()` |
| `components/AvatarActor.tsx` | 漫游 + 动画切换完整；只需把模块级 preload 改为按需 |
| `components/RoamCamera.tsx` / `components/WorkdaySky.tsx` / `components/street/NPC.tsx` | 状态良好 |
| `components/MoneyMountain.tsx` / `SchrodingerBills.tsx` / `CarvedZone.tsx` / `AssetProp.tsx` | 几何实现成熟，重构会引入包围盒/比例回归 |
| `components/GlowPath.tsx` | 可复用为 candidate 侧地砖路；只需把 `heatmap()` 换成可注入数据 |

#### 🔧 改造

| 文件 | 改什么 | 预估工时 |
|---|---|---|
| `App.tsx` | 拆成「场景路由 + 共享状态 Context + 外壳」三块；`mode` → `scene`；`Scene` 组件抽出；主题 effect 移入 `engine/useEnvTheme.ts`；加 ErrorBoundary | **6 人时** |
| `components/HRPanel.tsx` | 删 `FIELD_BY_ID`，改消费 `dictionary-binding`；改用 `GcSlider/GcSelect`（ui-system-v3 L11） | 3 人时 |
| `components/street/HRStand.tsx` | 拆 3 份（贴图工厂 / 门面 / 角色演员）；`OFFICE_SCENES` 移 `data/`；贴图工厂加 `mode` 分支缓存 | **7 人时** |
| `components/street/StreetScene.tsx` | 拆静态街景（6 组件 → `street/static/`）；DOM 浮层移出；`loadProgress` 换 `engine/progress.ts` | **7 人时** |
| `components/street/GameHud.tsx` | 去 emoji（ui-system-v3 附录 B）；`rarityOf` 移到 `engine/params.ts` | 2 人时 |
| `components/street/GameMiniMap.tsx` | 加邻近摊位列表（Phase 2 §8.5）；`placeLots()` 改单例 | 3 人时 |
| `components/street/NPC.tsx` / `WorkdaySky.tsx` | 不动 | 0 |
| `styles.css` | 抽 `styles/glass.css`；新增组件样式 | 2 人时 |
| `dictionary/*.json` + `dictionary.schema.json` | 加 `input.bind`；扩 `portfolio_gallery` 的 input 语义（Phase 2 附录 C） | 1.5 人时 |
| `design/tokens.json` | 并入 Phase 1 七组令牌（45 个） | 1.5 人时 |

#### ❌ 废（删除或替换）

| 对象 | 位置 | 替代 |
|---|---|---|
| `Scene` 内嵌组件 | `App.tsx:41-93` | → `components/scenes/CompanyScene.tsx` |
| `OFFICE_SCENES` 常量 | `App.tsx:34-39` | → `data/office-scenes.ts`（含 `key` 字段，替掉 industry 拼串） |
| `FIELD_BY_ID` | `HRPanel.tsx:13-19` | → `engine/dictionary-binding.ts` |
| `HR_POOL` 常量 | `HRStand.tsx:31-34` | → `data/avatar-pool.ts`（含 `key` + `file` + `displayName`） |
| `entry(id)` 只查 HR | `dictionary.ts:57-61` | → 泛化为 `entry(id, side?)`（候选侧需要） |
| `enterOfficeFromStreet` 的 industry 拼串 | `App.tsx:155-162` | → `data/office-scenes.ts` 的 `key → url` 映射 |
| 模块级 `useGLTF.preload(avatar-idle)` | `AvatarActor.tsx:183` | → 场景内 `useEffect` 触发（首屏零 3D 资产） |
| `styles.css` 里 `.game-hud` 旧式样 | `styles.css:579+` | → `GcProgressHud`（ui-system-v3 L8） |

### 2.6 目标目录结构（建议）

```
web/src/
├── engine/                              # 无 React 依赖的纯逻辑层
│   ├── asset.ts              (5)       ✅ 保留
│   ├── theme.ts            (103)       ✅ 保留
│   ├── sunPosition.ts      (159)       ✅ 保留
│   ├── sky.ts               (70)       ✅ 保留
│   ├── dictionary.ts        (85)       🔧 泛化 entry(id, side)
│   ├── dictionary-binding.ts (80)      🆕 词典 id ↔ 字段绑定
│   ├── params.ts            (90)       🔧 + rarityOf 迁入
│   ├── scene.ts             (70)       🆕 SceneKey + useSceneRouter
│   ├── progress.ts          (120)      🆕 12 个 localStorage key 统一读写层
│   ├── useEnvTheme.ts       (60)       🆕 主题状态机（从 App 抽出）
│   ├── fingerprint.ts       (90)       🆕 照片指纹（Phase 2 D2/D7 匹配依据）
│   ├── textures/                       🆕 从 HRStand 抽出的贴图工厂
│   │   ├── facade.ts        (90)
│   │   ├── glass.ts         (80)
│   │   ├── decals.ts        (60)       shadow / spill / delivered / name
│   │   └── cash.ts          (35)
│   └── office-map.ts        (40)       🆕 office key → { url, label }（替 App 的 industry 拼串）
├── state/                               🆕 跨场景共享状态（Context）
│   ├── SessionContext.tsx   (110)      角色 / 档案 / 主题锁定
│   ├── BasketContext.tsx    (80)       对比篮（持久化到 gc-street-basket-v1）
│   └── ErrorBoundary.tsx    (55)       🆕 3D/Viewer 崩溃兜底
├── components/
│   ├── shell/                            🆕 ui-system-v3 L4–L7 / L13
│   │   ├── GcTopBar.tsx     (120)
│   │   ├── GcBottomTabs.tsx  (90)       （移动端）
│   │   ├── GcDrawer.tsx     (140)
│   │   ├── GcToast.tsx      (70)
│   │   ├── GcDemoConsole.tsx(110)
│   │   └── GcBasketDock.tsx (100)
│   ├── forms/                            🆕 词典驱动双端表单
│   │   ├── ParamForm.tsx    (150)
│   │   ├── GcSlider.tsx      (70)
│   │   ├── GcSelect.tsx      (55)
│   │   └── CandidatePanel.tsx(90)
│   ├── role/                             🆕 Phase 1 §2 首屏
│   │   ├── RoleGate.tsx     (180)
│   │   ├── RoleNiche.tsx    (120)       纯 SVG 预览龛（零 3D）
│   │   ├── RoleCard.tsx     (110)
│   │   └── AvatarPanel.tsx  (220)       形象三路径 + 诚实降级
│   ├── candidate/                        🆕 求职者侧 3D
│   │   ├── CandidateBooth.tsx(180)      我的展位（地砖路+要价云+铭牌）
│   │   ├── WorkOrbit.tsx    (160)       作品环绕轨道（≤8 件）
│   │   └── SalaryCloud.tsx  (90)        要价云
│   ├── gallery/                          🆕 作品廊（独立 Canvas）
│   │   ├── GalleryScene.tsx (230)
│   │   ├── GalleryCorridor.tsx(140)
│   │   ├── VisitorMode.tsx  (120)
│   │   └── WorkDetailPanel.tsx(150)
│   ├── hr/                               🆕 HR 建厂
│   │   ├── FactoryWizard.tsx (200)
│   │   ├── FactorySteps.tsx  (160)
│   │   └── SpaceMatch.tsx    (120)       照片→空间 档①匹配 + 档②命令
│   ├── street/                           🔧 现有街区的拆分与改造
│   │   ├── StreetScene.tsx  (~260)      🔧 从 1199 拆到 ~260
│   │   ├── HRStand.tsx      (~150)      🔧 从 751 拆到 ~150
│   │   ├── OfficeFacade.tsx (~180)      🆕 从 HRStand 抽出
│   │   ├── HRActor.tsx      (~140)      🆕 从 HRStand 抽出（RealHR + PlaceholderHR）
│   │   ├── static/                      🆕 从 StreetScene 抽出
│   │   │   ├── Roads.tsx     (60)
│   │   │   ├── StreetLamps.tsx(120)
│   │   │   ├── ArchWay.tsx   (55)
│   │   │   ├── DistantSkyline.tsx(50)
│   │   │   ├── RoadLanes.tsx (45)
│   │   │   └── DistrictRoadSigns.tsx(45)
│   │   ├── ParamSteles.tsx  (~100)      🆕 从 StreetScene 抽出
│   │   ├── GameHud.tsx      (91)        🔧 → GcProgressHud
│   │   ├── GameMiniMap.tsx  (111)       🔧 → GcNavigator
│   │   ├── NearSampler.tsx  (45)        🆕
│   │   ├── NearRing.tsx     (55)        🆕
│   │   ├── NavPillar.tsx    (115)       🆕
│   │   └── DeliveryFX.tsx   (60)        🆕
│   ├── scenes/                          🆕 从 App 抽出
│   │   ├── CompanyScene.tsx (100)       🆕 替 App.tsx:41-93 的 Scene
│   │   └── MinePage.tsx     (200)       🆕 纯 DOM「我的」页
│   ├── HRPanel.tsx         (82)        🔧 → ParamForm 薄封装
│   ├── OfficeViewer.tsx    (136)       ✅ +dispose
│   ├── AvatarActor.tsx     (184)       🔧 preload 改按需
│   └── ...（其余保留）
├── data/
│   ├── street-companies.ts (155)       🔧 + 单例缓存
│   ├── fictional-companies.ts (58)     ✅
│   ├── office-scenes.ts     (40)       🆕
│   └── avatar-pool.ts       (35)       🆕
└── styles/
    ├── glass.css            (220)      🆕 玻璃基座
    └── role.css             (180)      🆕 角色卡 / 预览龛
```

**依赖方向（单向，禁止反向）**：

```
  App / main.tsx
      ↓
  components/{shell,role,gallery,hr,street,scenes,forms}
      ↓
  state/*Context            （只依赖 engine）
      ↓
  engine/*                  （零 React 依赖；可被 Node 脚本直接引用做校验）
      ↓
  data/*  →  engine/asset.ts
```

**铁律**：`engine/` 与 `data/` **不得 import 任何 `components/`**。这条能在 code review 里用一条 grep 卡住：
`grep -rn "from '.*components" web/src/engine web/src/data` → 必须为空。

---

## 3. 落地改造清单（文件级）

> 工时单位 = 人时（1 人天 = 6 人时）。「依赖前置」列写的是**必须先完成**的项。
> **总工时见 §7 分期表**（本表是全量清单，分期表才是 24 天内的执行序列）。

### 3.1 A 组 · 基础层（令牌 + 路由 + 持久化 + 异常兜底）

| 文件 | 动作 | 具体改什么 | 工时 | 风险 | 依赖前置 |
|---|---|---|---|---|---|
| `web/design/tokens.json` | 改造 | 并入 Phase 1 §6.1 七组令牌（`role.*` `focus.*` `progress.*` `param.*` `portfolio.*` `preview.*` `demo.*`，约 45 个）；**一律直接值，不用 DTCG alias**（Phase 1 §6.1 已警示） | 1.5 | 低 | — |
| `web/tokens.config.mjs` | 保留+微调 | 不改 transform（已用 `filter` 限定，lessons §9.4 已修）；**加一条"令牌引用完整性"自检**：扫 `src/**/*.tsx` 里的 `var(--xxx)` 与生成 CSS 对照，未定义即 `exit(1)` | 1.0 | 低 | tokens.json |
| `web/src/engine/scene.ts` | **新增** | `SceneKey` 8 值枚举 + `ScenePayload` + `useSceneRouter`（useState + useRef 栈，**零依赖**） | 1.5 | 低 | — |
| `web/src/engine/progress.ts` | **新增** | 12 个 key 的统一读写层（Phase 2 附录 D 全表）：`gc-role-v1` / `gc-onboard-v1` / `gc-street-progress-v1` / `gc-street-basket-v1` / `gc-avatar-gen-v1` / `gc-avatar-asset-v1` / `gc-candidate-profile-v1` / `gc-space-gen-v1` / `gc-hr-factory-v1` / `gc-inbox-v1` / `gc-quiet-mode-v1` / `gc-space-fingerprint-v1`；每个 key 声明 `{ read, write, onCorrupt }`，**损坏行为显式声明**（Phase 2 附录 D 逐行给了策略） | 2.0 | 中 | — |
| `web/src/state/ErrorBoundary.tsx` | **新增** | 3D/Viewer 崩溃兜底：捕获 → 渲染降级 UI（纯 DOM + 重试按钮）→ `console.error` 上报；**必须有**，否则 aholo-viewer 抛错 = 整站白屏 | 1.0 | 低 | — |
| `web/src/engine/useEnvTheme.ts` | **新增** | 把 `App.tsx:107-152` 的主题状态机（4 state + 2 effect + cycleLock）整体搬出，行为**一字不改** | 1.0 | 低 | — |

### 3.2 B 组 · 外壳与路由（App 拆解）

| 文件 | 动作 | 具体改什么 | 工时 | 风险 | 依赖前置 |
|---|---|---|---|---|---|
| `web/src/App.tsx` | 改造 | ① `mode` → `scene`（`SceneKey`）② 抽 `Scene` → `components/scenes/CompanyScene.tsx` ③ 抽 `OFFICE_SCENES` → `data/office-scenes.ts` ④ 主题 state 换 `useEnvTheme()` ⑤ 对比篮换 `BasketContext` ⑥ 顶层包 `ErrorBoundary` ⑦ 各场景用 `lazy()` 统一挂载 | **6** | **中** | A 组 |
| `web/src/state/SessionContext.tsx` | **新增** | 角色（candidate/hr）、求职者档案、建厂进度；写 `progress.ts` | 2.0 | 中 | A 组 |
| `web/src/state/BasketContext.tsx` | **新增** | 对比篮（容量 2）；持久化 `gc-street-basket-v1`；满态处理（Phase 2 D12） | 1.5 | 低 | A 组 |
| `web/src/components/shell/GcTopBar.tsx` | **新增** | 产品级导航（招聘街区 / 对比 / 我的）+ 品牌 + 主题锁定按钮（ui-system-v3 L4）；**形态切换移出** | 3.0 | 中 | A 组 + tokens |
| `web/src/components/shell/GcDemoConsole.tsx` | **新增** | 右下折叠式演示控制台，标注"正式版将移除"（ui-system-v3 L13） | 2.0 | 低 | GcTopBar |
| `web/src/components/shell/GcDrawer.tsx` | **新增** | 通用抽屉（参数详情 / 控制台 / 移动列表） | 3.0 | 中 | styles/glass.css |
| `web/src/components/shell/GcToast.tsx` | **新增** | 统一 toast + XP 上浮；**全站唯一 toast 出口**（Phase 2 §1.4 浮层职责互斥） | 2.0 | 低 | styles/glass.css |
| `web/src/components/shell/GcBasketDock.tsx` | **新增** | 底部对比篮坞（A/B 双槽 + 交换） | 2.5 | 低 | BasketContext |
| `web/src/components/shell/GcBottomTabs.tsx` | **新增** | 移动端底部 Tab | 2.0 | 低 | GcTopBar |
| `web/src/styles/glass.css` | **新增** | 玻璃基座：`.gc-glass` / `.gc-panel` / 焦点环（`focus.inner` + `focus.outer` 双环）/ 抽屉 / toast；双主题反相（`data-theme`） | 3.0 | 中 | tokens.json |

### 3.3 C 组 · 词典双端化

| 文件 | 动作 | 具体改什么 | 工时 | 风险 | 依赖前置 |
|---|---|---|---|---|---|
| `dictionary/dictionary.schema.json` | 改造 | `input` 各分支加可选 `bind: string`；**新增 mapping enum 值** `salaryCloud`（已存在）无需改；`portfolio_gallery` 的 `input` 需支持"用户上传"语义（Phase 2 附录 C：`input.type` 扩展） | 1.0 | 中 | — |
| `dictionary/hr-dictionary.json` | 改造 | 5 个 implemented 词条补 `input.bind` | 0.3 | 低 | schema |
| `dictionary/candidate-dictionary.json` | 改造 | `expected_salary` 补 `input.bind` + `params.exposeMode`；`portfolio_gallery` 的 `input` 从 `readonly` 改为可写语义 | 0.7 | 中 | schema |
| `web/src/engine/dictionary-binding.ts` | **新增** | `bindField` / `editableEntries(side)` / `readValue` / `makePatch`（见 §2.3） | 1.5 | 中 | schema |
| `web/src/engine/dictionary.ts` | 改造 | `entry(id)` → `entry(id, side?)` 双词典查询；导出 `entryOf` | 0.5 | 低 | — |
| `web/src/components/forms/ParamForm.tsx` | **新增** | **通用词典表单**：按 `editableEntries(side)` 自动生成 slider / select / toggle / readonly；候选人侧与 HR 侧共用 | 3.0 | 中 | dictionary-binding |
| `web/src/components/forms/GcSlider.tsx` / `GcSelect.tsx` | **新增** | 玻璃控件（ui-system-v3 L11）；值样式升级、字段分组 | 2.5 | 中 | glass.css |
| `web/src/components/HRPanel.tsx` | 改造 | **删除 `FIELD_BY_ID`**；改为 `ParamForm` 薄封装（保留 `title` prop 兼容 App 调用点） | 1.5 | 中 | ParamForm |
| `web/src/components/forms/CandidatePanel.tsx` | **新增** | 求职者侧面板（`expected_salary` 滑杆 + 期望薪资暴露模式 + 铭牌） | 2.0 | 中 | ParamForm |

### 3.4 D 组 · 首屏角色选择（Phase 1 §2 / Phase 2 D1）

| 文件 | 动作 | 具体改什么 | 工时 | 风险 | 依赖前置 |
|---|---|---|---|---|---|
| `web/src/components/role/RoleGate.tsx` | **新增** | 首屏双龛舞台 + 两张角色卡 + 逃生口（误选修正三路，Phase 2 §2.3）+ 回访折叠（Phase 2 §2.2）；**零 3D 资产 / 零 WebGL 上下文** | 4.0 | 中 | GcTopBar + glass.css + tokens |
| `web/src/components/role/RoleNiche.tsx` | **新增** | 预览龛：**纯 SVG/CSS**，影棚背景渐变 + 径向暗角 + 发光剪影；**不建 WebGL**（Phase 1 §2.2.1 硬约束） | 3.0 | 中 | tokens |
| `web/src/components/role/RoleCard.tsx` | **新增** | 角色卡（实底 + 玻璃双层、焦点环双环、触控 ≥44px、五重编码） | 2.5 | 中 | RoleNiche |
| `web/src/components/role/AvatarPanel.tsx` | **新增** | 求职者形象面板（Phase 1 §3）：四条路径 + **生成通道抽象**（`replay`/`local`/`live`）+ 诚实降级文案 + **「演示回放」徽标常驻** | 5.0 | **高** | engine/fingerprint |
| `web/src/engine/fingerprint.ts` | **新增** | 照片指纹（16×16 灰度降采样 + 余弦相似度），供"照片→形象/空间"档①匹配；**不联网、不调 API** | 2.0 | 中 | — |

### 3.5 E 组 · 作品廊与求职者 3D（Phase 2 D3/D4/D5）

| 文件 | 动作 | 具体改什么 | 工时 | 风险 | 依赖前置 |
|---|---|---|---|---|---|
| `web/src/components/candidate/CandidateBooth.tsx` | **新增** | 我的展位：地砖路（复用 `GlowPath` + 注入数据）+ **要价云**（`salaryCloud`）+ 铭牌 | 4.0 | 中 | ParamForm + tokens |
| `web/src/components/candidate/SalaryCloud.tsx` | **新增** | 头顶要价云（金额 → 云体体积/密度）；`exposeMode: 'band'\|'exact'` 分档（Phase 2 附录 C） | 2.5 | 中 | tokens |
| `web/src/components/candidate/WorkOrbit.tsx` | **新增** | 作品环绕轨道（**≤8 件单层**、四类载体、隐私三档、私密件**不渲染**）；`useFrame` 缓动 | 5.0 | **高** | Phase 1 §3.4 |
| `web/src/components/gallery/GalleryScene.tsx` | **新增** | 作品廊场景（**独立 `<Canvas>`**、环形走廊、我的展位 + ≤1 他人展位）；**相机初始位必须做包围盒相交验证**（T9 铁律） | 5.0 | **高** | CandidateBooth + scene.ts |
| `web/src/components/gallery/GalleryCorridor.tsx` | **新增** | 环形走廊几何（不与街区共享） | 2.5 | 中 | — |
| `web/src/components/gallery/WorkDetailPanel.tsx` | **新增** | 作品详情板（右侧）；拾起四段转场（Phase 1 §5.1） | 3.5 | 中 | WorkOrbit |
| `web/src/components/gallery/VisitorMode.tsx` | **新增** | HR 访客标记 + 权限校验（私密作品无残影） | 3.0 | 中 | WorkDetailPanel |
| `web/src/components/scenes/MinePage.tsx` | **新增** | 「我的」纯 DOM 页（进度 / 投递回执 / 档案 / 作品集管理）；**作品廊永久入口** | 4.0 | 中 | SessionContext |

### 3.6 F 组 · HR 建厂（Phase 2 D6/D7/D8/D9）

| 文件 | 动作 | 具体改什么 | 工时 | 风险 | 依赖前置 |
|---|---|---|---|---|---|
| `web/src/components/hr/FactoryWizard.tsx` | **新增** | 建厂五步向导（认证可跳过 / 照片匹配 / **词典表单** / 预览 / 发布）；**表单由词典自动生成，零手写** | 5.0 | 中 | ParamForm |
| `web/src/components/hr/FactorySteps.tsx` | **新增** | 分步容器 + 进度指示 + 断点续建（`gc-hr-factory-v1`） | 3.0 | 中 | progress.ts |
| `web/src/components/hr/SpaceMatch.tsx` | **新增** | 照片→空间**诚实降级**：档①指纹匹配（可读匹配依据）+ 档②**本地命令可复制**；**禁止假进度条** | 3.5 | 中 | fingerprint.ts |
| `web/src/components/street/HRStand.tsx` | 改造 | 拆分 + **`officeFacade` 挂到新摊位位**；门面点击 → `onEnterOffice(lot)` 改走 `office-scenes.ts` 映射（替掉 industry 拼串） | 4.0 | 中 | E 组 |
| `web/src/data/office-scenes.ts` | **新增** | `office key → { url, label, industry }`；替代 `App.tsx:34-39` 与 `:155-162` 的字符串拼串 | 0.5 | 低 | — |
| `web/src/components/street/StreetScene.tsx` | 改造 | 加"新开张"位（HR 发布后的摊位）；**C5 硬验收**：街区 64 摊位是**已发布快照**，街区里拖滑杆不产生任何重算（draw call 增量 = 0） | 3.0 | 中 | — |

### 3.7 G 组 · 街区与 HUD 重构（ui-system-v3 L8–L10）

| 文件 | 动作 | 具体改什么 | 工时 | 风险 | 依赖前置 |
|---|---|---|---|---|---|
| `web/src/components/street/GameHud.tsx` | 改造 | → `GcProgressHud`：**去 emoji**、改玻璃、值 26px tabular-nums；`rarityOf` 移到 `engine/params.ts` | 2.0 | 低 | glass.css |
| `web/src/components/street/GameMiniMap.tsx` | 改造 | → `GcNavigator`：加**邻近摊位列表 + 直达**；罗盘**保持四臂**（Phase 2 §1.3 明确不得改五臂，否则重踩 SVG 裁切坑） | 3.0 | 中 | GcDrawer |
| `web/src/components/street/LotCard.tsx` | **新增** | 从 `StreetScene.tsx:812-874` 抽出 → `GcCompanyCard`（380 宽玻璃 + 26px 数值瓷砖 + 三按钮） | 2.0 | 低 | glass.css |
| `web/src/components/street/static/*.tsx` | **新增** | 从 `StreetScene.tsx` 抽出 6 个静态组件（Roads / StreetLamps / ArchWay / DistantSkyline / RoadLanes / DistrictRoadSigns） | 4.0 | **中** | — |
| `web/src/components/street/HRStand.tsx` → `HRActor.tsx` + `OfficeFacade.tsx` + `engine/textures/*` | 改造 | 拆 3 份（见 §2.5），贴图工厂补 `mode` 分支缓存 | **7** | **中** | — |
| `web/src/components/street/StreetScene.tsx` | 改造 | 目标从 1199 → ~260；`loadProgress`/`saveProgress` 换 `engine/progress.ts`；`placeLots()` 改单例 | **7** | **中** | static/ |
| `web/src/data/street-companies.ts` | 改造 | `placeLots()` 加模块级缓存（现在被 `StreetScene.tsx:55` / `GameMiniMap.tsx:15` 各调一次） | 0.5 | 低 | — |

### 3.8 H 组 · 性能收敛（§6.3）

| 文件 | 动作 | 具体改什么 | 工时 | 风险 | 依赖前置 |
|---|---|---|---|---|---|
| `web/src/components/street/HRStand.tsx` | 改造 | **InstancedMesh 化**：摊位台 / 雨棚 4 柱 / 棚顶 / 棚面 / 咨询桌 / 侧招 / 名牌 → 分类 InstancedMesh | **5** | **中** | G 组拆分 |
| `web/src/components/street/OfficeFacade.tsx` | 改造 | 建筑体块 **6 个 `attach="material-N"` → 2 个**（顶底暗色靠 group 合并），再按 4 行业 InstancedMesh 化 | 3.0 | 中 | G 组 |
| `web/src/components/street/HRActor.tsx` | 改造 | `PlaceholderHR` 11 mesh → InstancedMesh（4 段 + 配件） | 3.0 | 中 | G 组 |
| `web/src/components/street/HRStand.tsx` | 改造 | 钱袋堆 / 切口牌 → InstancedMesh（层数用 scale） | 2.0 | 中 | G 组 |
| `web/src/components/AvatarActor.tsx` | 改造 | **模块级 `useGLTF.preload`（:183）→ 场景内 `useEffect` 触发**；移动端 dpr 锁 1.5 | 1.0 | 低 | — |
| `web/src/components/AssetProp.tsx` | 改造 | **模块级 `useGLTF.preload`（:45）→ 场景内触发**（否则首屏必拉钞票 GLB 2.23MB） | 0.5 | 低 | — |
| `web/src/App.tsx` | 改造 | `Scene` 抽出后 **顶层不再 import three** → three.js 移出主 chunk（主 chunk 1068KB → ~140KB） | 0.5 | 低 | §3.2 M1 |
| `web/public/assets/money/gold-coins.glb` | **删除** | 死资产（全项目零引用，仅存于 A/B 实验归档） | 0.2 | 低 | — |
| `tools/check-bundle.mjs` | **新增** | 构建期体积守门（见 §6.5） | 2.0 | 低 | — |

### 3.9 I 组 · 资产与 Aholo 工具链

| 文件/资产 | 动作 | 具体改什么 | 工时 | 风险 | 依赖前置 |
|---|---|---|---|---|---|
| `tools/gen_avatar.py` | **新增/改造** | 复用 lessons §7.2 批量模式（先 mkdir / 3 次重试 / meta.json 存 URL / gltf-transform Draco+WebP 压 89–93%）；**确认 clip 非 T-pose**、**同 52 根 Mixamo 骨**（T10 教训） | 2.0 | 中 | — |
| `tools/gen_space.py` | **新增** | World 生成脚本：**≥20 图/视频硬校验**（不足直接报错退出）、**定点摇镜不可用**、纯文案模式（实测 652s 可过，带参考图模式两次失败） | 2.5 | **高** | — |
| `web/public/assets/avatar/` | 改造 | 新增 2 个 Photo 派生形象（每个 ~2.1MB Draco 后） | 1.5 | 中 | gen_avatar |
| `web/public/assets/promo/` | 保留 | 现有 0.58MB | 0 | 低 | — |
| `web/public/assets/hr/` | **裁剪** | **9 → 6 个**（省 5.5MB）：64 摊位循环用，视觉重复感可控 | 0.5 | 低 | — |
| `web/public/assets/office/` | **裁剪** | **4 → 3 套 SPZ**（省 4MB）：保留 finance / manufacturing / office-promptonly | 0.3 | 低 | — |

---

## 4. Aholo 工具链落地路径

### 4.0 硬前提（不可协商）

1. **浏览器端不能调 Aholo API**：`web/src` 现无任何 Key 引用，这是**必须保持的安全底线**（lessons §二.8：key 一律走 `.env`，扫描会拦写入）。
2. **无后端**：无 server 目录、无服务端框架。GitHub Pages 与魔搭创空间都是**纯静态托管**（lessons §7.4：static 空间根域名 iframe 托管）。
3. **生成耗时不可接受**：Lux3D 图生 Avatar **76–108s**、World 办公空间 **652s**。→ **资产必须全预生成**，滑杆不能等现场生成（lessons §一）。
4. **诚实铁律**：全站 **0 处假进度条、0 处暗示浏览器可现场生成**（Phase 2 §9.2 G1）。「演示回放」徽标常驻不可隐藏（Phase 1 §0）。

### 4.1 照片 → Avatar：三条路径

| # | 路径 | 成本 | 风险 | Demo 期结论 |
|---|---|---|---|---|
| **A** | **本地脚本离线生成 + 资产入库**<br>`python tools/gen_avatar.py --photo <img> --out <key>` → Draco+WebP → `web/public/assets/avatar/` | 每次 **76–108s** API + 人工备图 + 压资产 ≈ **0.5 人时/个** | ① provider status=4 偶发（需 3 次重试，lessons §7.2-4）<br>② 绑骨/动画需用官方参数重制 `animateInPlace=true`，否则滑步（lessons §一）<br>③ 产物尺寸不可控 → 必须归一化（定高 1.6m）<br>④ **Demo 期现场给评审者生成不了** | ✅ **做，但只做"预生成 2 个 + 提供脚本"** |
| **B** | **后端代理**<br>Cloudflare Worker / Vercel Function 持 Key，前端 POST 照片 → 返回任务 id → 轮询 | **8–12 人时**（Worker 部署 + 鉴权 + 配额 + CORS + 轮询） | ① **GitHub Pages / 魔搭创空间都是静态托管，放不了代理**（需另找部署渠道 = 双端部署风险）<br>② Key 进服务端 = 新的 Key 管理面（lessons §二.8 的 key 只在 `.env`）<br>③ 12 词条反刷分规则（Phase 1）要求上传需鉴权<br>④ **单人 24 天做完后端 = 一次性吃掉 25% 预算** | ❌ **不做**（Phase 2 §9.1 已把"真实 Lux3D/World 生成接入"列为 P1 延后） |
| **C** | **预置形象池**<br>扩展现有 `avatar-photo-01.glb`（2.09MB，Photo→Avatar 的**真实产物**）为 3–5 个预置形象 + 剪影兜底 | **1.5–2 人时**（生成 2 个 + 剪影 + 选择器 UI） | ① 池小 → 重复感（可用"形象指纹"匹配缓解）<br>② **必须诚实标注"演示回放"** | ✅ **做**（Demo 期的实际主路径） |

**Demo 期结论 = A（脚本）+ C（预置池）并行，B 不做。**

**Demo 期的用户可见流程**（Phase 2 D2）：
1. 用户上传照片 → **本地**算指纹（≤2s，`engine/fingerprint.ts`）
2. 指纹与预置池匹配 → 展示匹配结果 + **匹配依据**（可读，不是黑箱）
3. 面板显示**「演示回放」徽标** + 明确的通道标签（`replay` / `local` / `live`）
4. 同时提供**本地生成指引**（可复制的命令行 + 产物入库路径说明），让"真的能生成"这件事**在仓库层面成立**，而不是在浏览器里假装
5. **不允许**任何形式的进度条模拟 AI 生成

### 4.2 照片 → 办公空间：三条路径

| # | 路径 | 成本 | 风险 | Demo 期结论 |
|---|---|---|---|---|
| **A** | **本地脚本离线生成**<br>`python tools/gen_space.py --input <dir-with-20+-media>` → World → SPZ → 入库 | 素材准备（**≥20 图/视频**）是主要成本；生成 **652s/套** | ① **World 重建硬校验 ≥20 张图或视频/.insv**（lessons §一）<br>② **定点摇镜视频不可用**（无平移视差，实测失败）→ 必须真实行走穿越素材<br>③ 素材难收集（真实拍摄或素材库）<br>④ 带参考图模式两次一致失败（服务端问题）→ **纯文案模式才稳** | ⚠️ **可选做**（若手里有 ≥20 张素材；产出 1 套"真实照片→空间"作为 Demo 高光） |
| **B** | **后端代理** | 同 §4.1-B | 同 §4.1-B | ❌ **不做** |
| **C** | **预置空间池 + 诚实降级**<br>档①**指纹匹配**（照片 → 与 3 套预置 SPZ 的视觉指纹比对 → 匹配依据可读）<br>档②**本地命令可复制**（把 `python tools/gen_space.py --input <dir>` 给用户复制到本地跑） | **3.5 人时**（`SpaceMatch.tsx` + `fingerprint.ts`） | ① 匹配准确度有限 → **必须把匹配依据写清楚**，不能装作"这就是你的办公室"<br>② 素材门槛要在 UI 上明说 | ✅ **做**（Phase 2 D7 正解；Phase 2 §9.1 明确"档①若成本过高可退化为手动从预置列表选择，**但仍需保留匹配依据文案位**"） |

**Demo 期结论 = C（必做）+ A（有余力则做 1 套），B 不做。**

### 4.3 必须预生成并入 `web/public/assets/` 的资产

| 资产 | 现状 | Demo 期需要 | 增量 | 说明 |
|---|---|---|---|---|
| 求职者 Avatar（默认） | `avatar-idle.glb` 3.08MB | ✅ 已有 | 0 | 但**首屏不得加载**（`AvatarActor.tsx:183` 的模块级 preload 必须改按需） |
| 求职者 Avatar（Photo 派生） | `avatar-photo-01.glb` 2.09MB | ✅ 已有 1 个 | 0 | **必须是 52 根 Mixamo 骨**才能借玩家的 idle clip（T10 教训） |
| 求职者 Avatar（新增） | — | 再加 **2 个** Photo 派生 | **+4.2MB** | §4.1 路径 A 生成 |
| 求职者剪影兜底 | 无（`RoleNiche` 是 SVG） | CSS/SVG 剪影 | 0 | **不生成 3D 剪影** |
| HR 形象池 | 9 个 GLB / 16.16MB | 裁到 **6 个** | **−5.5MB** | §3.9 |
| 办公空间 SPZ | 4 套 / 16.97MB | 裁到 **3 套** | **−4.0MB** | §3.9 |
| 钞票 / 金币 | 目录 3.67MB（钞票 2.23MB + 金币 1.45MB） | 保留钞票 `gc-bill-bundle.glb`（2.23MB，single/compare 模式才加载）；**删 `gold-coins.glb`（1.45MB，死资产，全项目零引用）** | **−1.45MB** | `AssetProp.tsx:45` 的模块级 preload 必须改按需（§1.7） |
| 作品集载体 | 无 | **8 件 = 4 类载体**（图像 / 视频 / 链接 / 文档） | **+0.8MB**（用 2 张真实图 + 1 段短视频 + 其余 SVG/DOM） | **不生成 3D 作品模型**（成本过高，且违反 Phase 1 §3.4.2 "形状本身即编码"——载体形状由类型决定，用 3D 模型反而破坏编码） |
| Draco 解码器 | `public/draco/` 753KB | 保留 | 0 | **必须自托管**，禁止 CDN（lessons §3.6 / T12） |

### 4.4 资产预算与首屏 5MB 怎么守住

**当前 dist = 49MB**（实测 `du -sh web/dist`）。

**当前首屏实况（实测，见 §1.7）**：
`App.tsx:8` 静态 import `CompanyPlot` → `CompanyPlot.tsx:19` 静态 import `AssetProp` → `AssetProp.tsx:45` **模块级 preload 钞票 GLB 2.23MB**；
`App.tsx:2-3` 顶层 import three → 主 chunk 1068KB（含 three.js，gzip ≈ 330KB）；
`AvatarActor.tsx:183` **模块级 preload 玩家 idle GLB 3.08MB**。
→ **首屏 ≈ 5.64MB**，**超过 5MB 红线**。

**改法（Phase 1 §2.2.1 零 3D 资产首屏）**：

| 场景 | 加载内容 | 实测/预估预算 |
|---|---|---|
| **角色选择（首屏）** | JS bundle（**不含 three**）+ CSS + 令牌 CSS + **零 GLB / 零 SPZ / 零 WebGL 上下文** | **≈ 0.07MB**（实测依据见 §1.7） |
| 街区 | three.js lazy chunk（≈1.02MB）+ 玩家 idle GLB（3.08MB，场景内触发） | +4.1MB 进街区 |
| 作品廊 | three.js chunk（**已缓存**）+ 求职者 Avatar（2.1MB）+ 作品素材（0.8MB） | +2.9MB |
| 办公室 | aholo-viewer chunk（1.91MB）+ 1 套 SPZ（3.9–5.1MB） | +7.0MB |
| single / compare | three.js chunk（**已缓存**）+ 钞票 GLB（2.23MB） | +2.2MB |

**守住 5MB 的三条硬规则**：
1. **首屏不挂任何 `<Canvas>`** —— `RoleGate` 是纯 DOM。**这是最大的一条**（直接省 5.31MB GLB）。
2. **消灭模块级 `useGLTF.preload`**（2 处：`AvatarActor.tsx:183`、`AssetProp.tsx:45`）→ 改场景内 `useEffect` 触发。
   **判定命令**：`grep -rn "useGLTF.preload" web/src` 应只返回**函数体内**的调用；模块顶层调用 = 违规。
3. **three.js 移出主 chunk** —— 把 `App.tsx:41-93` 的 `Scene` 抽成 `components/scenes/CompanyScene.tsx` 并 `lazy()`（§3.2 M1 已列此项）。
   → 主 chunk 从 1068KB 降到 ~140KB。

**改造后 dist 预估**：

```
现状                          49MB
− gold-coins.glb（死资产）    −1.5MB
− HR 池 9→6                  −5.5MB
− SPZ 4→3                    −4.0MB
+ 求职者 Avatar ×2            +4.2MB
+ 作品素材                     +0.8MB
+ 新增 JS/CSS chunk           +0.6MB
──────────────────────────────────────
改造后 dist                ≈ 43.6MB
```

**结论：改造后 dist 反而比现状小 5.4MB。**
首屏 5MB 的达成**不依赖**裁资产，**依赖**首屏零 3D + 消灭模块级 preload + three.js 出主 chunk。
（但裁资产仍值得做——它直接降低"进街区/进办公室"的首次下载量，且大文件进 GitHub Pages 有 LFS 风险，见 §8-R13。）


---

## 5. 重构评估（明确结论）

### 5.1 🔴 必须重构（不改会阻塞新需求 / 有技术债风险）

| # | 问题 | 重构动作 | 收益 | 成本 | 风险 |
|---|---|---|---|---|---|
| **M1** | **`App.tsx` 把「产品级导航」与「演示形态」混在同一个 mode 枚举**（`:96` + `:205-227`）。Phase 2 §1.3 要 6 个场景位 + ui-system-v3 L4/L12 要顶栏只留产品导航。**不改 → 新场景只能继续往枚举里塞，三元链变成 6 层嵌套** | ① `mode` → `SceneKey`（`engine/scene.ts`）② `Scene` 组件抽出 ③ 主题 state 抽出 ④ 对比篮进 Context ⑤ 顶栏换 `GcTopBar`，形态切换进 `GcDemoConsole` | 新场景接入成本从"改 5 处三元 + 1 处 state"降到"加一个枚举值 + 一个 lazy 组件"；主题/对比篮状态不再随场景切换重渲染 | **6（App）+ 5（shell 三件套）+ 2（Context）+ 2（scene.ts）= 15 人时** | **中**。回归点是"切模式状态不丢"——正是 lessons §7.7 事故现场，**必须带 `gc-street-progress-v1` 往返验证** |
| **M2** | **`mapping.type` 从无运行期分发**（schema 20 值枚举，运行时零 switch）→ 词典加第 6 个 implemented 词条时前端代码必须手改（`HRPanel.tsx:13-19` 的 `FIELD_BY_ID`）。**这直接否证了项目立意"词典即引擎"** | ① schema `input` 加 `bind` ② 新增 `engine/dictionary-binding.ts` ③ `HRPanel` 删 `FIELD_BY_ID` ④ 新增通用 `ParamForm` 供双端复用 | HR 侧"加词条零前端代码"在**所有**词条上成立（不只已实现的 5 个）；候选人侧第一个控件（`expected_salary`）有了载体 | **1（schema）+ 0.5（词典）+ 1.5（binding）+ 3（ParamForm）+ 2.5（控件）+ 1.5（HRPanel）+ 2（CandidatePanel）= 12 人时** | **中**。schema 改动会让 `dictionary.schema.json` 校验失败 → 必须同步改 schema（Phase 2 附录 C 已警示） |
| **M3** | **localStorage 只有 1 个 key，且散落在 `StreetScene.tsx:37/41/1036`**。Phase 2 附录 D 要 12 个；对比篮不持久化（当前只在同会话有效，刷新即丢，违反 Phase 2 D12 硬验收）；角色/档案/建厂进度**无处安放** | 新增 `engine/progress.ts`：12 个 key 统一读写，每个显式声明损坏行为 | 跨场景/跨刷新状态一致；Phase 2 §6 状态机有了落地载体；键名不再散落 | **2 人时** | **低**。必须保留 `loadProgress` 已有的 try/catch 兜底模式（隐私模式） |
| **M4** | **候选人侧词典 8 词条、仅 1 个 implemented、零 UI 入口**；`candidateDictionary` 在 `dictionary.ts:55` 导出后**全项目零引用**；`entry(id)` 只查 HR 词典（`:58`）。**项目最核心的交互（`portfolio_gallery`）在代码里是 `planned`** | ① `entry(id, side?)` 泛化 ② `CandidatePanel` 落地 `expected_salary` ③ `portfolio_gallery` 的 input 语义扩为可写 ④ `WorkOrbit` 落地作品环绕 | 求职者侧从"0 个控件"到"2 个 P0/P1 词条有真实 UI"；作品集从 planned → implemented | **10 人时**（见 §3.4/§3.5） | **高**。`portfolio_gallery` 的 input 语义变更要过 schema；作品环绕的隐私三档（私密件**不渲染**）必须截图核验 |
| **M5** | **无 ErrorBoundary**。`OfficeViewer` 用的是非 R3F 的 aholo-viewer，它一抛错 → 整个 React 树白屏。**与 lessons §4 T8（线上白屏）同类事故，教训已在册** | 新增 `state/ErrorBoundary.tsx` + App 顶层包裹 + 3D/Viewer 各自独立边界 | 单场景崩溃不再全站白屏；可给出可读降级页 | **1 人时** | **低**。高收益，**必做** |
| **M6a** | **draw call 2136（lessons §7.3 实测）vs 红线 ≤200，超标 10 倍** —— 拆两半做（主理人 2026-10-27 裁定）。**M6a = 只做 `PlaceholderHR` 的 11 mesh → 单 InstancedMesh**（64×11 = 704 → 5） | `HRActor.tsx` 的占位人形几何合并为**一个** InstancedMesh（躯干 / 双腿 / 头 / 发型 / 配件 5 段），按 `hrIndex` 复用西装与发型色 | 单项即省 **≈700 draw call（占 2136 的 33%）**，2136 → **≈1400**。这是**纯几何合并，不碰门面材质**，风险最低、收益最直接 | **5 人时** | **低**（纯几何，无材质改动）。InstancedMesh 矩阵写入**必须用 `useLayoutEffect`**（lessons §7.6 的 64 盏路灯事故：写在 `useMemo` 里 → 首次 ref 为空 → 永不重跑 → 路灯全灭） |
| **M6b** | 门面 6 个 `attach="material-N"`（64×6 = 384）+ 摊位静态件（64×11 = 704）→ 合计 ≈1088 | ① 建筑体块 **6 材质 → 2 材质**（顶底暗色靠 boxGeometry 的 group index 合并）② 摊位台 / 雨棚 4 柱 / 棚顶 / 棚面 / 咨询桌 / 侧招 → 分类 InstancedMesh | 再省 **≈1070**，≈1400 → **≈370**；配合 P5b（钱袋 / 切口 / 名牌 atlas）才到 **≤200** | **8 人时** | **中**。涉及门面材质合并，**有 T11 穿模 / 共面 z-fighting 前科**（lessons §7.6）。**主理人裁定：推迟到角色流程 P0 交付之后** |

### 5.2 🟡 建议重构（可延后但收益明确）

| # | 问题 | 重构动作 | 收益 | 成本 | 风险 |
|---|---|---|---|---|---|
| **R1** | `HRStand.tsx` 751 行里 6 个贴图工厂（≈255 行 / 34%）、门面几何（155 行 / 21%）、角色演员（110 行）三块独立关注点挤在一个文件 | 拆 `engine/textures/*` + `OfficeFacade.tsx` + `HRActor.tsx` | 贴图工厂可被作品廊/办公室复用（"玻璃幕墙"两处都用）；门面几何是 M6 InstancedMesh 化的**前置**（不拆无法干净改） | **7 人时** | 中 |
| **R2** | `StreetScene.tsx` 1199 行混装静态街景（322）/ 参数可视化（140）/ 交互（227）/ DOM 浮层（63）/ 持久化（90） | 抽 `street/static/*` + `street/ParamSteles.tsx` + `LotCard.tsx` + `NearSampler/NearRing/NavPillar/DeliveryFX` | 静态元素可独立做 InstancedMesh 优化；DOM 浮层可单独被玻璃组件替换 | **7 人时** | 中 |
| **R3** | `styles.css` 859 行单文件；`src/` 仍有 **69 处写死 hex** | S1：抽 `styles/glass.css`（玻璃基座，供 6+ 新组件共用）；S2（可选）：全拆 5 文件 | 玻璃样式一次定义多处复用，避免新组件复制粘贴；**S1 是新功能的必要前置**，S2 是纯收益 | **2（S1）+ 2.5（S2）** | 低（S2 中：CSS `@import` 顺序敏感，Vite 合并后顺序需人工保证） |
| **R4** | `GameHud`（emoji 图标）/ `GameMiniMap`（无邻近列表，`placeLots()` 重复调用）不满足 ui-system-v3 L8/L9 | 重写为 `GcProgressHud` / `GcNavigator`；`placeLots()` 改单例 | 术语与视觉统一；导航器能回答"附近有什么"（Phase 2 §1.4 浮层职责） | **5 人时** | 低。**罗盘必须保持四臂**（Phase 2 §1.3 明确） |
| **R5** | **两处**模块级 `useGLTF.preload` → 首屏即拉 **5.31MB**：`AvatarActor.tsx:183`（avatar-idle 3.08MB）+ **`AssetProp.tsx:45`（gc-bill-bundle 2.23MB，经 `App.tsx:8 → CompanyPlot.tsx:19` 静态 import 链触发）** | 两处都改场景内 `useEffect` 触发 | 首屏省 **5.31MB** | **1.5 人时** | 低 |
| **R6** | `HRStand.tsx` 的 `HR_POOL`（9 个文件）与 `App.tsx:34-39` 的 `OFFICE_SCENES` 是**内联常量**，assets/ 与 scenes 不可复用 | 移 `data/avatar-pool.ts` / `data/office-scenes.ts` | 换资产不用改组件；`office-scenes.ts` 顺带替掉 `App.tsx:155-162` 的 industry 拼串（隐式约定，加第 5 个行业即断） | **1 人时** | 低 |
| **R7** | `GlowPath.tsx` 用固定 seed 伪随机热力图（`:12-20`），不读词典；被 `CompanyPlot.tsx:87` 无条件渲染（HR 展台里出现求职者的贡献路径，语义错位） | 抽 `useHeatmap(data)`，数据可注入；`CompanyPlot` 不再无条件渲染 | 求职者侧可复用为展位地砖路（Phase 2 D3） | **1.5 人时** | 低 |
| **R8** | `OfficeViewer.tsx` 的 `useEffect` 无 `viewer.dispose()`（`:124-126` 只置 `stopped=true`） | 补 dispose + `url` 变更时重建 | 反复切场景不泄漏 WebGL 上下文 | **0.5 人时** | 低 |
| **R9** | `mapping.type` 的完整 registry（20 槽） | 推到产品期。Demo 期只在 `CandidateBooth` 用一张 2 槽小表（`salaryCloud` + `gallery`） | 保留演进空间，不为 2 个类型建 20 槽框架 | **1 人时**（小表） | 低 |

### 5.3 🟢 不要动（当前稳定，重构风险 > 收益）

| # | 对象 | 不动的理由 |
|---|---|---|
| **N1** | `engine/asset.ts` | 5 行，`assetUrl()` 是 T8 白屏事故的正确解。动它 = 动全部资产路径 |
| **N2** | `engine/theme.ts` / `engine/sunPosition.ts` / `engine/sky.ts` | 主题判定实测准确（夏至 82.2° / 冬至 35.3° / 春分 58.2°）；语义分离（环境时间 vs 参数时间）已落地。**只需把 App 里的 effect 搬走，逻辑本身不动** |
| **N3** | `data/street-companies.ts` 的布局参数 | `START_ALONG=14` / `SLOT_GAP=3.6` / `LOT_OFFSET=7.4` 是 **T10 穿模事故的修复值**（lessons §7.6）。**任何"新增摊位/建筑"改动先跑包围盒相交自检**（lessons §7.6 工程纪律 1） |
| **N4** | `MoneyMountain.tsx` / `SchrodingerBills.tsx` / `CarvedZone.tsx` / `AssetProp.tsx` | 几何实现成熟；`layerLayout` 的固定层容量 3×3=9 是 **`ceil(sqrt(N))` 数学陷阱的修复版**（`params.ts:56-59` 注释写明了）。重构成 registry 适配器收益低、回归面覆盖整条"逛一家"流程 |
| **N5** | `AvatarActor.tsx` 的漫游 / 动画切换逻辑 | WASD + 点击行走 + Idle/Walk 交叉淡化完整。只改 preload 触发时机，不动逻辑 |
| **N6** | `RoamCamera.tsx` / `WorkdaySky.tsx` / `NPC.tsx` | 状态良好。`WorkdaySky` 是 v4 孪生风的单一光照真源（lessons §9.5 改造顺序） |
| **N7** | `OfficeViewer.tsx` 的取景算法 | dense box + 全量外壳半径的双重判定是**实测踩坑后的产物**（lessons §7.7：只按 dense box 定距离 → 糊成噪点）。只补 dispose，不动算法 |
| **N8** | `tokens.config.mjs` 的 `shadow/css` / `glass/css` transform | 已用 `filter` 精确限定（lessons §9.4 的 `match+transitive` 事故已修）。**不要动**，只加自检 |
| **N9** | `web/src/data/fictional-companies.ts` | 状态良好 |
| **N10** | 已部署的双端配置（`vite.config.ts` 的 base 令牌、`optimizeDeps.exclude`、Draco 自托管路径） | 每一行都是一次事故的代价（lessons §二.3 / §三.6 / T8 / T12） |

#### N10 已部署的双端配置**不要动**——但它带一条**必须进 code review checklist** 的规则：

> **【code review checklist · 硬规则】任何新增环境变量一律用「非路径形态」令牌。**
> 形如 `VITE_BASE=/guangchang/` 的**路径形态** env 会被 Git Bash（MSYS）自动改写成
> `C:/Program Files/Git/guangchang/` → vite `base` 错 → 线上脚本 404 → **整站白屏（T8 根因一）**。
> **正确写法**：用 `VITE_BASE_TOKEN=ghpages` 这类**非路径令牌**，在 `vite.config.ts:9-13` 的
> `BASE_TOKENS` 白名单里映射成实际 base。
> **判定命令**：`grep -rn "VITE_[A-Z_]*=" web/ --include="*.ts" --include="*.mjs" --include="*.json" | grep "/"`
> → 命中任何**含 `/` 的 env 值** = 违规。

（同族硬规则，一并进 checklist）：
1. **禁止模块级 `useGLTF.preload`**（当前 2 处违规，见 §1.7 / R5）。
2. **每个 `<Canvas>` 归属唯一场景**，切换 = 卸载整棵 3D 树。
3. **禁止在 `main.tsx` / `App.tsx` 顶层 import 任何 3D 组件**（现状合规）。
4. **新增颜色先加 `design/tokens.json` 再 `npm run tokens`**，禁止在 3D 或 CSS 里写死 hex。
5. **InstancedMesh 矩阵写入用 `useLayoutEffect`**，不用 `useMemo`。

---

## 6. 性能与预算守则

### 6.1 懒加载边界（统一口径）

| 边界 | 触发 | 加载内容 | 预算（实测/预估） |
|---|---|---|---|
| **L0 首屏（角色选择）** | 应用挂载 | JS bundle（**不含 three**）+ CSS + 令牌 CSS。**零 GLB / 零 SPZ / 零 WebGL 上下文 / 零网络请求到 assets/** | **≈ 0.07MB**（实测推导见 §1.7；红线 5MB） |
| **L1 街区** | 用户选定角色 → 进入街区 | `StreetScene` chunk（**含 three.js ≈1.02MB**）+ 玩家 idle GLB（3.08MB，场景内触发） | +4.1MB；HR GLB 按近景 LOD 懒加载 |
| **L2 作品廊** | 点作品廊入口 | `GalleryScene` chunk（three 已缓存）+ 求职者 Avatar（2.1MB）+ 作品素材（0.8MB） | +2.9MB |
| **L3 办公室** | 点"参观办公室" | `OfficeViewer` chunk（**实测 1906.8KB**）+ 1 套 SPZ（3.9–5.1MB） | +7.0MB |
| **L4 单公司 / 对比** | 演示控制台切换 | `CompanyScene` chunk（three 已缓存）+ 钞票 GLB（2.23MB） | +2.2MB |

**统一规则（写进 code review checklist）**：
1. **每个 `<Canvas>` 归属唯一场景**，切换场景 = 卸载整棵 3D 树（GPU 自动回收）。
2. **禁止模块级 `useGLTF.preload`**（`AvatarActor.tsx:183` 是现存唯一一处违规）——preload 在模块 import 时执行 = 首屏必拉。
3. **禁止在 `main.tsx` / `App.tsx` 顶层 import 任何 3D 组件**（现状合规）。
4. **资产 URL 一律 `assetUrl()`**（lessons §二.2）。
5. **每个场景自己的 chunk 独立**（`lazy()` 边界 = chunk 边界）。

### 6.2 体积与网络守则

| 项 | 规则 |
|---|---|
| 首屏总量 | **≤ 5MB**（Phase 2 §9.4；本次口径收紧到 **≈0.1MB**，因为零 3D） |
| 首屏可交互 | **≤ 3s**（角色卡可点**不等**任何 3D 首帧） |
| 主 chunk（不含 three） | gzip ≤ 60KB（当前 1068KB → 拆出 three 后 ~45KB gzip） |
| 3D chunk（three.js） | raw ≤ 1.1MB，**必须 lazy**（首屏不得触发） |
| `OfficeViewer` chunk | raw ≤ 2.0MB（当前实测 1906.8KB），必须 lazy |
| 每个 CSS chunk | gzip ≤ 60KB（当前 17.1KB） |
| dist 总量 | ≤ 50MB（改造后预估 43.6MB，见 §4.4） |
| 单个资产 | ≤ 3MB（GLB）/ ≤ 5.5MB（SPZ）/ ≤ 0.6MB（视频） |
| 死资产 | **每次构建前查零引用**（`gold-coins.glb` 1.45MB 就是漏网的） |
| Draco | **必须自托管** `public/draco/`（753KB），禁止运行时 CDN |
| 图片 | 全部 WebP；`<img>` 必须带 `width`/`height`（防 CLS）；头像用 `loading="lazy"` |
| 字体 | 现状无自定义字体 → **保持无**（不引入字体 CDN，lessons 铁律） |
| GitHub Pages base | `assetUrl()` 统一处理；**新增 env 变量用非路径令牌** |

### 6.3 Draw call 估算

> ⚠️ **口径说明（读表前必读）**
> **实测基线 = 2136**（lessons §7.3，鸟瞰机位）。
> 下表的「现状」列是**归因上限**——它假设 64 个摊位**全部部件都在渲染**，
> 因此逐项相加得 **≈2712 > 2136**：差额来自**视锥剔除**（鸟瞰机位下远景摊位不渲染）。
> **结论：下表的「节省」是上限，实际节省必须实测核验。**
> **每做一步都要用 `window.__st` + `renderer.info.render.calls` 在两个机位各测一次**
> （① 鸟瞰全街机位 ② 近景摊位机位 —— 近景摊位数少但部件全，两个数一起看才知道真实成本）。
> **不要用「表里减一减」代替实测。**

**现状 2136**（lessons §7.3 实测）。拆解与优化后估算：

| 来源 | 现状 | 优化后 | 手段 |
|---|---|---|---|
| 地面 / 路面 / 斑马线 | ~15 | 15 | 已合批；斑马线 12 个 plane 可再合 1 |
| 路面虚线 `RoadLanes` | 1 | 1 | ✅ 已 InstancedMesh |
| 区域路牌 | 4 | 4 | 可合 1 |
| 远景天际线 | 1 | 1 | ✅ 已 InstancedMesh |
| 路灯（柱/头/光晕/光池） | 3 | 3 | ✅ 已 InstancedMesh |
| 牌坊 `ArchWay` ×4 | ~32 | 32 | 可合（4 行业 InstancedMesh）→ 4 |
| 参数碑 4 组 | 4 | 4 | ✅ 已 InstancedMesh（**不动**） |
| 稀有度宝石 | 1 | 1 | ✅ 已 InstancedMesh |
| **摊位静态件**（台/雨棚 4 柱/棚顶/棚面/咨询桌 3/侧招 2） | **64 × ~11 = 704** | **7**（分类 InstancedMesh） | M6 |
| **门面建筑体块**（6 material attach） | **64 × 6 = 384** | **8**（2 材质 × 4 行业 InstancedMesh） | M6 |
| 门面装饰（LED/灯带/玻璃幕墙/门/屋顶） | 64 × ~6 = 384 | 64 × 6 = 384（**降级为 4 行业合批 → 24**） | M6 |
| 名牌 sprite（各自 CanvasTexture） | 64 | 64（Demo 期不 atlas 化） | 后续可选 atlas → 1 |
| **钱袋堆**（2–7 层/摊） | **64 × ~4 = 256** | **1** | M6（层数用 scale） |
| **五险切口牌** | 64 × 2 = 128 | **1** | M6 |
| **占位人形**（11 mesh × 64） | **704** | **5**（4 段 + 配件 InstancedMesh） | M6 |
| 真 HR GLB（近景 ≤4 摊） | ~4 | 4 | 保持（LOD 已有） |
| NPC ×4 | ~8 | 8 | 保持 |
| 玩家 + 地面圈 | 2 | 2 | 保持 |
| 天空 / 雾 | ~3 | 3 | 保持 |
| 引导带 + 转盘 + 光柱 | ~10 | 10 | 保持 |
| **合计** | **≈ 2136** | **≈ 160–190** | |

**分步预期（配合 M6a / M6b 拆分，主理人 2026-10-27 裁定）**：

| 做完哪一步 | 省（上限） | 实测预期 | 离 ≤200 还差 |
|---|---|---|---|
| 现状 | — | **2136**（lessons §7.3 实测） | 1936 |
| **M6a**（占位人形 704→5） | ≈700（**33%**） | **≈1400** | 1200 |
| **+ M6b**（门面 384→8 + 静态摊位 704→7） | 再 ≈1070 | **≈370** | 170 |
| **+ P5b**（钱袋 / 切口 InstancedMesh + 名牌 atlas） | 再 ≈440 | **≈170–200 ✅** | 达标 |

**结论**：M6a + M6b ≈ **83% 的节省上限**；要真正压到 ≤200 红线，**M6a、M6b、P5b 三步都要做**（合计 ≈26 人时）。
**若只做 M6a**（5 人时），draw call 预估 **≈1400**（仍超红线 7 倍）→
**必须在报告里如实写明实测值与差距原因，不得隐瞒**（lessons 的诚实铁律同样适用于性能数字）。
**若再做名牌 atlas（2048×1024，4×16 网格，per-instance UV 偏移）→ 再省 63 → ≈107**（**Demo 期不做**，需 3–4 人时 + 自定义 shader，风险偏高）。

**移动端 ≥45fps 的其他必需项**：
- `dpr={[1,2]}` → 移动端锁 `[1, 1.5]`（`App.tsx:64` / `StreetScene.tsx:1094`）
- 阴影贴图降到 1024 或移动端关闭
- 雾 `fogNear=40 / fogFar=200`（`StreetScene.tsx:1110`）→ 移动端收到 `30/120`
- 近景 LOD 阈值 `NEAR=26/FAR=34`（`HRStand.tsx:35-36`）→ 移动端 `NEAR=20/FAR=26`

### 6.4 什么该继续被保护（不为了数字牺牲体验）

- **4 个 InstancedMesh 的参数碑**（body/band/bars/lamps）：已优化到极致，**不要再动**（lessons §7.1 的层容量数学陷阱）。
- **近景 LOD 滞回**（`HRStand.tsx:464-472` 的 0.4s 冷却 + NEAR/FAR 双阈值）：保持，避免闪烁。
- **特写机位时隐藏玩家**（`AvatarActor.tsx:142`）：保持，这是 7.8 轮修的成果。

### 6.5 CI / 构建期体积自检建议

**A. `tools/check-bundle.mjs`（新增，2 人时）** —— 在 `npm run build` 后执行：

```
断言 1  dist/assets/index-*.js   gzip ≤ 60KB（首屏主 chunk，必须不含 three.js）
断言 2  dist/assets/index-*.css  gzip ≤ 60KB
断言 3  dist 总计 ≤ 50MB
断言 4  dist/** 不含 *.ply                      （受限资产铁律 §3.1）
断言 5  dist/** 不含 *.insv / interiorgs        （受限资产铁律 §3.7）
断言 6  首屏 chunk（index + css）不含 .glb/.spz 引用
断言 7  draco/*.{js,wasm} 存在且非空             （T12 铁律 §3.6）
断言 8  index.html 的 script src 含 base 子前缀   （T8 铁律 §3.2）
断言 9  dist/assets/office/*.spz ≤ 3 套、dist/assets/hr/*.glb ≤ 6 个
断言 10 dist 中每个 .glb 在 src/ 有引用（死资产拦截 —— gold-coins.glb 1.45MB 就是漏网的）
```

**B. 令牌自检扩展（`tokens.config.mjs`，+1 人时，与 M1 同一项）**：
- 现有：number 令牌不得被破坏（lessons §9.4）→ **保留**
- 新增：扫 `src/**/*.tsx` 的 `var(--xxx)` 与 `generated/design-tokens.output.css` 对照，**未定义变量即 `exit(1)`**
  （当前 35 个 CSS 变量引用 + Phase 1 的 45 个新令牌，回归风险实在）

**C. 词典自检（`tools/check-dictionary.mjs`，1 人时，可延后）**：
- 校验 `dictionary/*.json` 过 `dictionary.schema.json`
- 校验 **每个 `implementation: implemented` 的词条都有 `input.bind`**（否则又回到 `FIELD_BY_ID` 手动维护的老路）
- 校验 **`mapping.type` 都在 schema enum 里**（Phase 2 附录 C 已警示）

**D. 部署后线上验收（不可省，lessons §3.3）**：
- **curl 200 ≠ 应用能跑**（T8 教训）。必须：DOM 挂载 + canvas 存在 + **Runtime 零异常**
- 用**新 profile / 无缓存**（本地 dev 有缓存看不出来）
- 首屏 Network 面板**不得出现** `.glb` / `.spz` / `.ktx2` / `.ply`（Phase 1 §8.1）
- 记录 `renderer.info.render.calls`（`window.__st` 已有诊断钩子，`StreetScene.tsx:1099`）→ **必须 ≤ 200**

---

## 7. 交付分期与最小可交付切片

> Phase 2 §9.3 自己排了 **23 天**（D1–D10），而总工期 **24 天** —— **零缓冲**。
> 且该排期**未计入** Phase 1 视觉落地、Phase 3 重构、盲审、录屏、报告补图、双端部署。
> **本节的工程排期是对 Phase 2 的必要修正（不是推翻）**：把 Phase 2 的 10 个 D 步骤重新切成 8 个 P 步骤，总计 **17.5 天 + 资产 2 天 + 部署/报告 1.5 天 = 21 天，留 3 天缓冲**。

### 7.1 分期表（分「必保 / 争取 / 有余力」三档，**总工时如实标出**）

> **先说结论**：Phase 2 的 D1–D14 全量落到工程侧 = **131 人时 = 21.8 人日**（纯前端，三档全做），
> 加资产 1.5 天 + 部署/报告 1.5 天 = **24.8 人日 > 24 天工期**。
> **且这是"还没算 Phase 1 视觉落地 + 美术收尾冲盲审 7 分"的前提** —— 那两项在轨道 A 上，不在本表内。
> **所以本表不是"按顺序全做"，而是按档位取舍。**
> 工时单位 = 人时（1 人日 = 6 人时）。

| 期 | 档位 | 范围 | 改哪些文件 | 可验证产出（能跑起来看到什么） | 工时 | 回滚方案 |
|---|---|---|---|---|---|---|
| **P0** | 🔴 **必保** | 首屏角色选择 + 场景路由 + 令牌 | `design/tokens.json`（+45 令牌）· `tokens.config.mjs`（+引用自检）· `engine/scene.ts`🆕 · `engine/useEnvTheme.ts`🆕 · `state/ErrorBoundary.tsx`🆕 · `components/role/RoleGate.tsx`🆕 · `RoleNiche.tsx`🆕 · `RoleCard.tsx`🆕 · `App.tsx`（mode→scene）· `styles/glass.css`🆕 | 打开就是**双龛角色选择页**（纯 SVG，无任何 3D 资产）→ 选"求职者"进街区 / 选"HR"进 HR 入口 → 顶部可切回首屏。**Network 面板零 `.glb`/`.spz` 请求** | **21** | `VITE_ROLE_GATE=off`（非路径令牌）→ 顶栏模式切换原样可用；新增文件删掉即回滚 |
| **P1** | 🔴 **必保** | 词典双端化 + 进度统一层 | `dictionary.schema.json` · `dictionary/*.json`（+`input.bind`）· `engine/dictionary-binding.ts`🆕 · `engine/dictionary.ts` · `engine/progress.ts`🆕 · `components/forms/ParamForm.tsx`🆕 · `GcSlider/GcSelect`🆕 · `HRPanel.tsx` · `StreetScene.tsx`（localStorage→progress.ts） | ① 在 `hr-dictionary.json` 加**一条** implemented 词条 → **刷新后 HR 面板自动多一个滑杆，零前端代码**<br>② 对比篮刷新后不丢<br>③ 主题锁定刷新后保持 | **12** | `ParamForm` 保留旧 `HRPanel`，`VITE_PARAMFORM` 开关切换 |
| **P2** | 🔴 **必保** | 求职者形象面板 + 作品集轨道 | `components/role/AvatarPanel.tsx`🆕 · `engine/fingerprint.ts`🆕 · `components/candidate/SalaryCloud.tsx`🆕 · `WorkOrbit.tsx`🆕 · `CandidatePanel.tsx`🆕 · `GlowPath.tsx`（数据可注入） | 求职者选完角色 → **上传照片 → 本地指纹匹配 → 匹配依据 + 预置形象**（带「演示回放」徽标）→ 进街区后**自己的 3D 形象头顶浮着要价云**，拖滑杆实时变 | **17** | 新增文件可整体移除；`GlowPath` 用 `useHeatmap(data)` 保留原无参调用 |
| **P5a** | 🔴 **必保** | **M6a：占位人形 11 mesh → 单 InstancedMesh**（纯几何，不碰门面材质） | `HRActor.tsx`🆕（从 HRStand 抽出）+ 占位人形 InstancedMesh 化 | draw call 2136 → **≈1400**（省 ≈700 = 33%）；摊位远景更干净 | **5** | `VITE_PERF_INSTANCING` 开关切回旧渲染路径 |
| **P6a** | 🔴 **必保** | **体积守门 + 首屏 preload 修复** | `tools/check-bundle.mjs`🆕 · `AvatarActor.tsx`（preload 改按需）· `AssetProp.tsx`（preload 改按需）· `App.tsx`（`Scene` 抽出 + lazy） | **首屏 ≈0.07MB**、主 chunk gzip ≤60KB、10 条守门断言全绿 | **6** | preload 改动各 0.5 人时，易回滚 |
| **P7** | 🔴 **必保** | 盲审 + 录屏 + 报告 + 双端部署 | `docs/iterations/**` · `docs/video/**` · 部署脚本 | **独立盲审 ≥7/10**；录屏按 `metadata.timestamp` 重采样；**GitHub Pages + 魔搭线上验收**（无缓存 + 新 profile + 零异常） | **15** | 魔搭失败 → 保留 GitHub Pages（加分项非必需） |
| **P5b** | 🟢 **有余力** | **M6b**：门面 6 材质合并 + 静态摊位实例化（**主理人裁定：推迟到 P0 交付之后**）+ 钱袋/切口 InstancedMesh + 名牌 atlas | `OfficeFacade.tsx` · `HRStand.tsx` · `LotCard.tsx` | draw call ≈1400 → **≈370**（M6b）→ **≈170–200 ✅**（加钱袋/切口/名牌） | **13** | 可整组延后；**延后则报告书如实写实测值**（lessons 诚实铁律适用于性能数字） |
| **P3** | 🟡 **争取** | 作品廊（**只做"我的展位"**，不做他人展位/访客模式） | `components/gallery/GalleryScene.tsx`🆕 · `GalleryCorridor.tsx`🆕 · `CandidateBooth.tsx`🆕 · `WorkDetailPanel.tsx`🆕 · `App.tsx`（+gallery 场景）· `StreetScene.tsx`（+作品廊路牌） | 从街道路牌或"我的"页进作品廊 → 环形走廊 → **我的展位**（地砖路 + 要价云 + 铭牌 + 环绕作品）→ 点作品 → 拾起转场 → 详情板 | **15** | 作品廊路牌置灰 + `gallery` 移出可达集合；**独立 chunk 保证不进首屏** |
| **P4** | 🟡 **争取** | HR 建厂（**4 步**：砍"发布到街区新开张位"）+ 访客模式 | `components/hr/FactoryWizard.tsx`🆕 · `FactorySteps.tsx`🆕 · `SpaceMatch.tsx`🆕 · `data/office-scenes.ts`🆕 · `data/avatar-pool.ts`🆕 · `App.tsx`（删 industry 拼串） | HR 角色 → 建厂 4 步（词典表单自动生成 → 3D 预览 → 发布到"我的"页）；**照片→空间走档①匹配 + 档②可复制命令，无假进度条** | **16** | 建厂入口隐藏（`gc-role-v1 === 'hr'` 才显示） |
| **P6b** | 🟢 **有余力** | 无障碍 + 异常走查 + HUD/小地图重写 + 外壳三件套 | `GameHud.tsx` → `GcProgressHud` · `GameMiniMap.tsx` → `GcNavigator` · `GcToast/GcDrawer/GcBasketDock/GcBottomTabs`🆕 · `tools/check-dictionary.mjs`🆕 | E1–E20 逐条走查 0 个未处理边界；**纯键盘完成投递全流程**；对比度全达标 | **11** | 各件套独立，可单独不做 |

#### 工时汇总（三档收敛）

| 档位 | 包含期 | 工时 | 人日 |
|---|---|---|---|
| 🔴 **必保（Tier A）** | P0 + P1 + P2 + P5a(M6a) + P6a + P7 | **76** | **12.7** |
| 🟡 **争取（Tier B）** | P3 + P4 | **31** | **5.2** |
| 🟢 **有余力（Tier C）** | P5b(M6b) + P6b | **24** | **4.0** |
| **全量** | A + B + C | **131** | **21.8** |
| 附加 | 资产生成与入库 1.5 天 + 双端部署/报告 1.5 天 | | **+3.0** |
| | **Tier A + 附加** | | **≈ 15.7 天** ✅ 留 8.3 天缓冲 |
| | **Tier A + B + 附加** | | **≈ 20.9 天** ✅ **推荐目标**，留 3.1 天缓冲 |
| | **全量 + 附加** | | **≈ 24.8 天** ❌ **超期 0.8 天** |

**结论（必须写进排期）**：
- **Tier A（12.7 天）+ 资产 + 部署 = 15.7 天** → 必保，留 8.3 天缓冲（**这 8.3 天要留给轨道 A 的美术收尾与盲审**）。
- **Tier A + Tier B + 附加 = 20.9 天** → **推荐目标**，留 3.1 天缓冲。
- **全量 24.8 天 > 24 天** → **Tier C（P5b / P6b）默认不做**，只有在 Tier A+B 提前完成时才启动。
- **Tier C 里优先级最高的是 P6b 的"纯键盘完成投递 + 对比度"**（Phase 2 D14 硬要求，也是评审会看的），
  若只能做 Tier C 的一半，**做 P6b 的无障碍部分，砍 P5b**（draw call 250–500 的差距写进报告，比无障碍缺项好交代）。


### 7.2 「如果只有 3 天」的最短路径

> ⚠️ **本节已被 §7.4 Q2 取代**（2026-10-27 拍板后的最终版）。
> **最终版 = 11 人时 ≈ 2 人日，三件事**：① M2 binding 层（2.5h）② P0 降级版首屏（3.5h）③ 还债包 4 件套（5h）。
> 理由与逐项交付物见 **§7.4 Q2**；下面保留的是**早期版本**（含作品环绕的"宽度优先"路线），供对照。

---

**（早期版本 · 保留对照）目标**：让评审者看到"双角色"这件事成立，并让求职者侧有真实可交互的内容。HR 侧全部延后。

| # | 做什么 | 产出 | 工时 |
|---|---|---|---|
| 1 | 令牌扩展（只加 `role.*` 中必需的 8 个：accent/accentUi/accentUiDark/tint ×2 角色 + `cardBase` + `nicheVignette`） | CSS 变量可用 | 1.5 |
| 2 | `engine/scene.ts`（SceneKey 4 值 + `useSceneRouter` 60 行） | 场景路由骨架 | 1.5 |
| 3 | `components/role/RoleGate.tsx` + `RoleNiche.tsx`（**纯 SVG 龛 + 两张卡**） | **首屏双角色选择页** | 6 |
| 4 | `components/candidate/WorkOrbit.tsx` + `SalaryCloud.tsx`（8 件作品环绕 + 要价云，**静态占位、不做上传**） | 求职者 3D 形象 + 环绕作品 | 5 |
| 5 | `App.tsx` 接线（scene 切换 + 首屏不挂 Canvas + `Scene` 抽出 + `AvatarActor`/`AssetProp` 两处 preload 改按需） | 端到端跑通 + **首屏 ≈0.07MB** | 4 |
| | **合计** | | **18 人时 = 3.0 人日** |

**3 天版本能看到什么**：
> 打开 → **双龛角色选择页**（求职者冷色 / HR 暖色，纯 SVG，零 3D 资产）→ 选「求职者」→ 进街区 →
> **街上出现"你"**（3D 形象 + 环绕的 8 件作品 + 头顶要价云）→ 选「HR」→ 进街区 → **看到另一个求职者站位**（访客视角）。

**3 天版本刻意不做的**（并明确告诉评审）：
- ❌ 真实照片 → 3D 形象生成（**不做假进度条**；改为"演示回放"徽标 + 预置形象池）
- ❌ HR 建厂向导
- ❌ 作品上传（作品是预置 8 件）
- ❌ 照片 → 办公空间
- ❌ 词典双端化（P1 未做 → **候选人侧滑杆是硬编码的**，HR 侧仍是 `FIELD_BY_ID`）
- ❌ draw call 优化（2136 → 仍超标，**在报告里如实写**）
- ❌ 作品廊（我的展位）

> ⚠️ **3 天版本的最大代价**：**P1（词典双端化）没做** → 项目的核心立意"词典即引擎"在 3 天版本里**没有被证明**。
> 如果评审最可能问的就是这条（见 §8-R18），**那么 3 天版本应把 P1 的 binding 层（2.5 人时）挤进来**，
> 代价是砍掉作品环绕（5 人时）→ 3 天版本变成"角色选择 + 词典即时生效"，**更窄但更硬**。
> **这个取舍请主理人决定**：宽度（作品环绕的视觉冲击）vs 深度（词典即引擎的立意证明）。

**3 天版本的回滚**：所有新增都是**新文件** + `App.tsx` 的 `mode` → `scene` 替换。
`git revert` 单个 commit 即可完全回到现状（前提：P0 单独成一个 commit）。
**建议把 P0 单独成一个 commit**，让回滚成本 = 1 次 revert。

### 7.3 砍掉什么（必须砍，Phase 2 已列但工程侧再确认）

| 砍掉项 | 依据 | 替代 |
|---|---|---|
| 真实 Lux3D / World 生成接入 | Phase 2 §9.1 P1 已列延后 | 预置池 + 本地脚本 + 诚实降级 |
| 多人在线 / 评论 / 真实投递通知 | Phase 2 §9.1 产品期 | 演示数据 |
| GitHub OAuth 真实接入 | Phase 2 §9.1 P2 | 伪随机热力图 + 预置档案 |
| 作品 > 8 件 / 双层作品塔 | Phase 2 §9.1 P3 | 单层 8 件 |
| 作品廊 > 2 展位 | Phase 2 §9.1 P4 | 我的 + 1 他人 |
| HR 自建摊位入街内任意位 | Phase 2 §9.1 P7 | 中心"新开张"位 |
| **完整 mapping registry（20 槽）** | §2.3 论证：只为 2 个类型建 20 槽框架收益为负 | 2 槽小表 |
| **styles.css 全拆 5 文件** | CSS @import 顺序风险 > 收益 | 只抽 `glass.css` |
| **名牌 sprite atlas 化** | 需自定义 UV shader，3–4 人时，Demo 期 draw call 已够 | 保留 64 sprite |
| **存量 3D 硬编码 hex 全扫** | 64 摊位 × 12 处，回归面过大 | 只扫新增组件 |

---

### 7.4 工程侧取舍裁定（回答 Phase 2 §9 的四个问题 · 主理人 2026-10-27 提问）

> **前置事实（已核验，非推断）**
> ① 主文档 §9.1：Pages 与魔搭**双端已上线并经真实浏览器验收**（控制台零报错）、视频 **39.9s 实机录屏**、报告书 v2 已编译 3 页、源码已转公开。
> ② lessons §7.7：**`office-promptonly.spz` 扫描质量有限**——"视频不剪办公室段落，报告图也不要再用那张糊墙截图"。
> ③ 本 Phase 实测（§1.7）：首屏 **5.64MB**，**超过 5MB 红线**。
> ④ 本 Phase 实测（§6.3）：街区 draw call **2136**，**超过 ≤200 红线 10 倍**。

---

#### Q1 · 「角色流程 D 序列」与「必须重构 M 序列」里，哪些是提交必需、哪些是加分项？

**裁定：两者都不是"提交必需"。提交必需的是第三类 ——「提交物欠账维护」。**

| 类别 | 内容 | 工时 | 时限 | 判据 |
|---|---|---|---|---|
| 🟥 **提交物欠账维护**<br>（**提交必需**） | ① 部署零回归：每次改动后**线上**验收（DOM 挂载 + canvas + Runtime 零异常，lessons §3.3）<br>② 体积/合规守门（`tools/check-bundle.mjs` 10 条断言）<br>③ 报告书补图 + **「诚实降级」独立小节**<br>④ 录屏重录（UI 有变则必须）<br>⑤ **修「办公室糊墙」欠账**：换一套 SPZ（World 纯文案模式 652s，实测可过）+ 办公室孪生叠加层 | 资产 4h<br>UI 3h<br>报告 3h<br>录屏 3h<br>验收 1h | **11.19 前** | 这五项**不做，提交物就有洞** |
| 🟧 **还债包**<br>（**提交必需**，但零新功能） | M5 ErrorBoundary(1h) + R5 两处 preload 改按需(1.5h) + M3 progress.ts(2h) + R8 dispose(0.5h) | **5h** | **11.19 前** | 四项**都是已存在的缺陷**，不是新功能带来的。**修它们 = 不让现有 Demo 变差**，与"加不加角色"无关 |
| 🟩 **双角色流程 + M1/M2/M4/M6**<br>（**纯加分，可延后**） | M1 路由分层(15h) · M2 binding(12h) · M4 候选人侧(10h) · M6a(5h) · M6b(8h) · P0–P4 | — | 提交后首版 | Phase 2 §9.1 已把"真实生成接入/多人/作品>8/展位>2"等列为产品期。**延后不损失任何已承诺的交付物** |

**Q1 的关键结论（三条，都与直觉相反）**：

1. **M1 不是其他项的前置。**
   M1（App.tsx 场景路由解耦，15h）只被**新场景**需要，**不被 M2 / M3 / M4 / M6a 需要**。
   M2 只动 `dictionary.ts` + `HRPanel.tsx` + 新增 `dictionary-binding.ts` + `ParamForm.tsx`；
   M4 只动 `dictionary.ts` + `CandidatePanel` + `WorkOrbit` —— **两者都可以在不动 `App.tsx` 架构的前提下独立完成**。
   → **所以"M1 最重"不构成"必须先做 M1"。**

2. **P0（首屏角色选择）也可以降级为非侵入式实现。**
   完整 P0 需要 `engine/scene.ts` + Context 重构（21h）；但**首屏门禁只需要"在 mode 之前多一态"**：
   在 `App.tsx` 顶部加 1 个 `roleGate` state + 条件渲染（**≈3 行逻辑 + 2 个新文件**），
   即可先出双龛角色选择页，而 `mode` 枚举**暂时不动**。
   → **降级 P0 ≈ 8 人时（含 RoleGate/RoleNiche/RoleCard/接线），省掉 13 人时的架构前置。**
   完整 M1 留到作品廊/建厂真正要接的时候再做。

3. **M2 的 12 人时是"立意项"里性价比最高的。**
   它同时满足：修掉**已存在**的技术债（`FIELD_BY_ID` 手工维护）· 是 M4 的前置 ·
   **可当场演示**（改 JSON → 刷新 → 控件出现 → 3D 跟着变）· 报告书"词典即引擎"章节从此有活证据。

---

#### Q2 · 「如果只有 3 天」的最短路径，具体是哪 3 项、各多少工时、交付后能看到什么？

> **总 11 人时 ≈ 2 人日**（留 1 天给首屏验收 + 录屏）。

| # | 做什么 | 工时 | 交付后**能演示什么**（可当场操作给评审看） |
|---|---|---|---|
| **1** | **M2 的 binding 层**（不做完整 ParamForm，只做：`schema` 加 `input.bind` + `engine/dictionary-binding.ts` + `HRPanel` 删 `FIELD_BY_ID` 改消费 binding + 2 个词典 JSON 补 `bind` 字段） | **2.5h** | **打开 `dictionary/hr-dictionary.json`，加一条 `annual_bonus`（slider 0–50 万），保存，刷新页面 → HR 面板自动多出一个滑杆 → 拖它 → 场景跟着变。** 全程不改任何前端代码 —— **这是"参数空间化"这个产品概念唯一的活证据** |
| **2** | **P0 降级版首屏**：2 个新文件（`RoleGate.tsx` + `RoleNiche.tsx`，**纯 SVG 龛，零 3D 资产**）+ 令牌扩 8 个 + `App.tsx` 顶部加 1 个 gate state（**不动 mode 枚举**） | **3.5h** | **打开就是双龛角色选择页**（求职者冷青 / HR 暖橙，纯 SVG 影棚背景 + 发光剪影）→ 点「求职者」→ 进街区；点「HR」→ 进 HR 入口。**Network 面板零 `.glb` / `.spz` 请求** |
| **3** | **还债包 4 件套**：M5 ErrorBoundary(1h) + R5 两处 preload 改按需(1.5h) + M3 progress.ts(2h) + R8 dispose(0.5h) | **5h** | ① **首屏从 5.64MB → ≈0.07MB**（主 chunk 1068KB → ~140KB，two 处 preload 消失）<br>② **投递 3 家 → 切办公室 → 回街区 → 15/50 XP 与投递数还在**（lessons §7.7 事故现场回归通过）<br>③ 3D 崩了不再整站白屏<br>④ **对比篮刷新后不丢** |

**3 天版本刻意不做（并明确写进报告书）**：
❌ 真实照片→3D 形象生成（**不做假进度条**；改「演示回放」徽标 + 预置形象池）· ❌ HR 建厂向导 · ❌ 作品上传（预置 8 件）· ❌ 照片→办公空间 · ❌ 作品廊 · ❌ **draw call 优化（2136 → 仍超标，报告里如实写实测值）** · ❌ 无障碍专项与 E1–E20 全量走查（只保留 G1/G2）。

**⚠️ 3 天版本的最大代价（请主理人知情）**：P1（完整 ParamForm + 双端）与 M4（候选人侧 `expected_salary` 控件）**没做** →
**求职者侧在 3 天版本里仍然没有真实控件**（`expected_salary` 虽已是 `implemented`，但没有 UI 入口）。
**这意味着"双角色"在 3 天版本里是「两个入口」而不是「两套体验」**。
→ **若只能 3 天，我建议把第 1 项扩到 6h**（binding 层 + 最小 `ParamForm` + `CandidatePanel`），
**砍掉第 2 项的 HR 卡**（只留求职者卡 + 一个「我是 HR」文字链接）→ 换来"求职者侧有一个真滑杆"。

**回滚**：第 1、2、3 项**全是新增文件 + 局部改动**，且**建议各成独立 commit** → 回滚 = 3 次 `git revert`，粒度最细。

---

#### Q3 · 如果只能做 **1 项**，选哪个？

**选 M2 的 binding 层（2.5 人时）。**

| 判据 | M2 binding 层（2.5h） | M6a 占位人形 InstancedMesh（5h） |
|---|---|---|
| 命中什么 | **项目立意本身**（"词典即引擎" / "参数空间化"） | 一条性能红线 |
| 能否当场演示 | ✅ 改 JSON → 刷新 → 控件出现（**评委能自己动手**） | ❌ 只能看 fps 数字，**无法判断好坏** |
| 是新功能还是还债 | **还债**（`FIELD_BY_ID` 手工维护是已存在的缺陷） | 还债（2136 是已存在的超标） |
| 不做会怎样 | **立意被否证**：评委问"加个参数要改多少代码"→ 答"要改前端"→ 全场失分 | 报告里写"draw call 2136，超红线 10 倍"→ 难看但**诚实**，可解释（远景占位 + 门面多材质），可写"已定位、已排期" |
| 是否阻塞别人 | ✅ **是 M4 的前置**（不做 M4 无法开工） | ❌ 不阻塞任何人 |
| 成本 | 2.5h | 5h |
| 唯一选它的条件 | — | **如果已知评审会拿中端手机真机跑** → 改选 M6a（移动端帧率是"有趣 25%"的生死线） |

**一句话**：M2 修的是**"这个项目到底成不成立"**；M6a 修的是**"这个项目跑得动不动"**。
**在"能跑"已经达标的前提下，先修"成不成立"。**

---

#### Q4 · 四份提交物是否已达标？新角色流程是"加法"还是"换法"？

**裁定：选「加法」，但加法的第一刀必须是「还欠账」而不是「做角色选择页」。**

##### Q4.1 四份提交物逐份体检

| 提交物 | 形式 | **内容欠账（评审能直接看出）** | 双角色流程能否顺带还？ |
|---|---|---|---|
| **可运行链接** | 双端已上线、控制台零报错 ✅ | **首屏 5.64MB，超 5MB 红线**（移动端首印象直接受影响） | ✅ **能顺带还**（消灭 2 处 preload + `Scene` 抽出 → 0.07MB） |
| **视频 39.9s** | 实机录屏 ✅ | **没有办公室段落**（lessons §7.7 明令不剪）；HR 摊位三件套只演示了「形象 + 参数悬浮」，**第 ③ 件「身后门面 → 进去参观」没演** | ❌ **不能顺带还**（资产质量与流程无关） |
| **报告书 v2** | 3 页已编译 ✅ | **「参观办公室」无实拍图**（同一张糊墙截图不能用）；未讲双角色；**未讲「词典即引擎」的活证据** | ⚠️ 半能（立意章节靠 M2；办公室实拍图**不能**） |
| **源码公开** | 已公开 ✅ | `HRPanel.FIELD_BY_ID` 手工桥接 · `candidateDictionary` 零引用 · 无 ErrorBoundary · 2136 draw call · 2 处模块级 preload | ✅ **能顺带还**（M2/M4/M5/R5 全部命中） |

##### Q4.2 裁定理由（三条）

1. **欠账是"独立存在"的，不会因为不做双角色而消失。**
   三处欠账（首屏超标 / 办公室糊墙 / 源码技术债）**互相独立于双角色流程** ——
   即使完全不做双角色，这三处**也该修**。
   → 所以「不做双角色」**不等于**「欠账自动消失」，只等于「欠账原样带进提交物」。

2. **"换法"风险收益完全不对称。**
   现有街区（64 摊 + 参数碑 + 四区导航 + 真实太阳 + 漫游 + 对比篮 + 投递 + 游戏化 HUD）
   是**已经调到盲审 6.7/空间 6.1 的资产**。换掉它 = 把唯一的"有趣 25%"也一起重写，
   而新写的双角色流程**还没有任何盲审分数**。**拿 6.7 分的确定资产去换 0 分的不确定资产 = 净亏损。**

3. **最优解是"加法 + 借道还债"，因为改造点与欠账高度重叠。**
   | 欠账 | 还它的动作 | 顺带完成了哪个加分项 |
   |---|---|---|
   | 首屏 5.64MB | 消灭 2 处 preload + `Scene` 抽出 lazy | **M1 的一部分**（`Scene` 抽出） |
   | 源码技术债 | M2 binding / M4 / M5 | **M2 + M4 + M5 本身就是加分项** |
   | 视觉一致性 | `HRStand` 拆贴图工厂 | **R1**（作品廊复用玻璃幕墙生成器） |
   | draw call | `OfficeFacade` 拆分（门面材质合并的载体） | **M6b** 的前置 |
   | 办公室糊墙 | **换 SPZ + 叠加层** | ❌ **与双角色零交集 → 必须单独立项** |

##### Q4.3 最终建议（给用户的落地顺序）

> **加法。但第一刀不是"做角色选择页"，而是"还三处欠账"** ——
> 因为**欠账是评审不用点开就能看到的**（首屏慢、视频缺一段、报告缺一张图、源码被读），
> 而**双角色流程是点开才看到的**。
>
> ```
> 第 0 刀（5 人时 · 1 天）  还债包 4 件套
>                        → 首屏 5.64MB → 0.07MB（链接欠账 ✅）
>                        → 进度往返不清零（源码欠账 ✅）+ 不白屏
> 第 1 刀（7 人时 · 1.2 天）换 SPZ + 办公室孪生叠加层
>                        → 视频可剪办公室段落（视频欠账 ✅）
>                        → 报告书有真实办公室实拍图（报告欠账 ✅）
>                        ⚠️ 唯一不能用双角色顺带还的欠账，必须单独立项
> 第 2 刀（2.5 人时 · 0.5 天）M2 binding 层
>                        → 报告书「词典即引擎」章节有活证据（报告欠账 ✅）
>                        → 现场可演示"改 JSON 就出控件"（立意 ✅）
> ─────────────────────────────────────────
> 合计 ≈ 14.5 人时 ≈ 2.5 人日
> ```
>
> **这 3 刀做完，24 天即使全部被别的事占满，四份提交物也已经没有明显洞。**
> 剩下的时间再做完整双角色流程（P0 完整版 21h → M1 15h → M4 → 作品廊 → 建厂）也不迟。

##### Q4.4 唯一需要向上申报的**取舍**

**办公室糊墙（视频 + 报告两份提交物的共同缺口）需要 7 人时 + 一次 World 生成（652s）**。
如果这 7 人时也拿不出来，**替代方案**（成本 ≈1h）：
→ 报告书与视频**都不用办公室**（现状即如此），但**必须明确写一句**：
「办公空间为 Aholo World 生成的 3DGS 演示资产，当前扫描质量有限，**正式版将替换为真实行走穿越素材重建**」。
**这句话本身就是诚实性加分项**（Phase 2 §9.2 G1），比放一张糊墙图更安全。

---

### 7.5 Phase 1 转来的三条对齐项（主理人代转 · 2026-10-27）

> Phase 1 在封版前转来 5 条工程侧问题，其中 E2/E4/E5 属本节，E1/E3 需工程判断（见 §7.6）。

#### E2 · P6a 的首屏修复要分两级台阶

| 台阶 | 动作 | 首屏 | 触发条件 | 工时 |
|---|---|---|---|---|
| **台阶 1** | 删 `AvatarActor.tsx:183` + `AssetProp.tsx:45` 两行**模块级** preload | **≈0.35MB** | 无需动 `App.tsx` 架构 | **0.5h** |
| **台阶 2** | 台阶 1 + `Scene` 抽出为 `CompanyScene.tsx` 并 `lazy()`（`App.tsx:2-3` 顶层不再 import three → 主 chunk 1068KB → ~140KB raw / ~45KB gzip） | **≈0.07MB** | **台阶 2 就是 M1 里本来要做的 `Scene` 抽出，不额外花工时** | 并入 M1 |

> **台阶 1 已足以达标**（5MB 红线）。台阶 2 是顺手多拿 0.28MB。
> **建议 P6a 并入 M1 一起做**，而不是独立排 6 人时——台阶 1 单独做只需 0.5h，台阶 2 搭 M1 的车。

**第三处 preload 不在首屏**：`HRStand.tsx:39-40` 在 `preloadHRModels()` **函数体内**，由 `StreetScene.tsx:1024-1026` 的 `useEffect` 按 `follow` 条件触发 → **不进首屏**，但 = **进街区后首次开始漫游时一次性预载 9 个 HR GLB（≈16MB）**。
→ 它属于 **L1 街区预算**，影响的是"进街区后第一次漫游"的手感，与首屏无涉。
→ **R11 的改造方向不是删 preload，而是「只 preload 最近 3–5 个 + 按距离增量加载」**——直接删会退回 lessons §7.7 的"真 HR 出现太晚"（走近 1–2 秒仍是占位）。

#### E4 · 执行清单 D11–D14 的工作量归属

| # | 交付物 | 落在哪期 | 工时 | 已在 Tier A 内 |
|---|---|---|---|---|
| **D11** | 投递 + 回执（回执文本 + HR 侧三态演示数据） | P4（HR 侧） / P2（求职者侧回执入口） | 2d | ❌ Tier B |
| **D12** | 对比篮持久化 + 术语统一 | **M3 `progress.ts`**（2h）+ R4 术语 | 1d | ✅ 部分（M3 在还债包） |
| **D13** | 边界走查 E1–E20 | P6（验收期） | 2d | ❌ Tier C |
| **D14** | 无障碍（纯键盘完成投递 + 对比度复核） | P6 | 2d | ❌ Tier C |

> **注意**：D13/D14 是 ui-system-v3 §13 的**既有验收项**，但落在 Tier C。**若 Tier C 不做，这两项要在报告书里如实写"本轮未做"**，不能默认通过。

#### E5 · P4 的 HR 端三条边界（必须一次性讲清，别混）

| # | 概念 | 是什么 | 不是什么 |
|---|---|---|---|
| ① | **摊主替身** vs **HR 角色入口** | 摊主替身 = 摊位上的 HR 形象（Phase 1 §4.4，常驻摊位、非真人实时在场）；HR 角色入口 = **建厂向导** | 二者是不同东西。摊主替身不是"HR 的账号在线" |
| ② | **访客模式**如何进入 | HR 以访客标记**定向探访某一个**求职者空间（收到投递后 / 检索到某地址后） | **不是**"逛作品廊"——浏览全部求职者等于排行榜，违反 project.md 3.3 |
| ③ | HR 建厂后摊位出现在**哪里** | 街区**中心「新开张」位**（≤4 个） | **不是** 64 摊里的任意位（那要重跑包围盒相交自检，lessons §7.6 铁律） |

**P4 的可验证产出应写成三条可判定验收**：
- 「HR 角色入口」打开的是**建厂向导**（不是摊位界面）
- 访客模式下，**HR 只能进入一个指定求职者空间**，无法列出作品廊全部展位
- 建厂发布后，摊位出现在**中心新开张位**，且 `placeLots()` 的 64 摊布局常量**未被改动**（`START_ALONG=14` / `SLOT_GAP=3.6` / `LOT_OFFSET=7.4` 是 T10 穿模事故的修复值）

---

### 7.6 待工程判断的两条（E1 / E3）

**E1 · M6a 的实测收益与 Tier A 表述冲突** —— M6a 独立做只省 ~700（2136→~1430），~1796 是三项合计（→~340）。但 Tier A 把 P5a（13 人时，三项合并）列为必保。
→ **需裁定**：若只做 M6a 而做不了 P5a 全量，红线 200 仍差 ~7 倍。必须有一个"降级后的可接受状态"——M6a 单独做完的移动端帧率预期（能否达 ≥45fps）、以及是否在报告书如实写"draw call 仍超标"。

**E3 · 三个 3DGS 资产需重建（此前排期未含）** —— `finance.spz` / `culture.spz` / `manufacturing.spz` 现有资产精度低，而"求职者点击 3D 办公空间漫游"强依赖其可用性。
→ **需裁定**：① 重新生成耗时与成功率（World 纯文案 652s/次、带参考图两次失败）② 来不及时的降级策略（只保留一套 + 标注"其余行业空间生成中"）③ 办公室孪生叠加层（twin-style v4 §6.2）是否应升为**必保项**——"写实点云 + 孪生线框 = 数字孪生教科书表达"，评审会买。

---

## 8. 风险登记表

> 概率：高 / 中 / 低 · 影响：高 / 中 / 低 · 触发阈值 = **什么信号出现就要调整方案**。

| # | 类别 | 风险 | 概率 | 影响 | 缓解措施 | 触发阈值 |
|---|---|---|---|---|---|---|
| **R01** | 技术 | **draw call 2136 远超 ≤200 红线**（lessons §7.3）。**M6a/M6b 拆分后，只做 M6a（5h）只能到 ≈1400，仍超 7 倍** | 高 | 高 | ① **M6a 先做**（占位人形 704→5，5h，低风险，省 ≈700）② M6b 推迟到 P0 之后 ③ 名牌 sprite 先不 atlas ④ **每步都用 `window.__st` + `renderer.info.render.calls` 在鸟瞰 + 近景两个机位各测一次**（§6.3 口径说明：归因是上限，必须实测）⑤ **兜底：移动端降级为"只渲染近景 12 个摊位 + 远景用参数碑"**（`HRStand` 不渲染，只留 `ParamSteles`） | ① M6a 实测后仍 > 1500 → 优先做 M6b ② M6a+M6b 后仍 > 400 → 启用移动端降级档 ③ 工时超预算 → **报告书如实写实测值与差距原因，不隐瞒** |
| **R02** | 技术 | **首屏 5MB 当前超标**（**实测 5.64MB**：`AvatarActor.tsx:183` + `AssetProp.tsx:45` 两处模块级 preload 拉 5.31MB GLB，主 chunk 1068KB 内含 three.js） | 高 | 高 | ① 首屏改纯 DOM 角色选择（零 WebGL）② 消灭 2 处模块级 preload，改场景内触发 ③ `Scene` 抽出 + `lazy()` → three.js 出主 chunk ④ 删死资产 `gold-coins.glb` | 首屏实测 > 5MB → 立即把 `single` 模式的钞票 GLB 改成纯几何；主 chunk gzip > 60KB → 检查 three.js 是否还在主 chunk |
| **R03** | 技术/进度 | **World 重建硬校验 ≥20 图/视频 + 定点摇镜不可用 + 652s/套** → "照片→空间"在 Demo 期几乎不可能真实成立 | 高 | 中 | ① 档①指纹匹配 + 档②本地命令可复制（诚实降级）② 匹配依据必须可读 ③ 素材不足就明确告知门槛 | 素材收集超过 1 天仍不足 20 张 → **放弃路径 A，只做 C** |
| **R04** | 技术/进度 | **Lux3D 图生 Avatar 76–108s + provider status=4 偶发 + 绑骨需重制 animateInPlace** | 中 | 中 | ① 复用 lessons §7.2 的 3 次重试 + meta.json 恢复机制 ② **先确认自带 clip 不是 T-pose**、同 52 根 Mixamo 骨（T10 教训）③ 生成脚本先在 1 张照片上跑通再批量 | 单张图生成连续失败 3 次 → 停止消耗配额，只用已有 `avatar-photo-01.glb` |
| **R05** | **合规** | **浏览器端承诺可现场生成 = 虚假承诺**（违反 Phase 2 G1 诚实性审查；评审若发现即是硬伤） | 中 | **高** | ① 生成通道抽象 `replay`/`local`/`live` ② 「演示回放」徽标常驻不可隐藏 ③ **全站 0 处假进度条** ④ 建厂/形象面板的等待态只做**可复制命令**与**本地步骤指引** | ① 文案审查命中 1 处"AI 已还原/生成中"类表述 → 立即改 ② 发现任何模拟进度条 → 删除 |
| **R06** | **合规** | **Aholo API Key 泄露进前端**（lessons §二.8：扫描会拦写入） | 低 | **极高** | ① `web/src` 现无 Key 引用 —— **保持零引用** ② 后端代理方案直接不做 ③ 部署前扫 `dist` 与源码：`grep -ri "api[_-]?key\|lux3d\|aholo_api" web/dist web/src` | 命中 1 处 → 立即 `git rm --cached` + 换 Key + 检查 git 历史 |
| **R07** | **合规** | **受限资产（InteriorGS PLY 57MB）入口泄露到公开构建**（T12b 事故：用了从未设置的 `!VITE_PUBLIC_DEPLOY`） | 中 | **高** | ① 判断一律用 `import.meta.env.DEV`（`App.tsx:253` 现状正确）② 新增 `tools/check-bundle.mjs` 断言 `dist/**` 无 `*.ply` / `*interiorgs*` ③ 受限截图继续在 `.gitignore` | `dist` 命中 `*.ply` → **阻断部署**（铁律 §3.1） |
| **R08** | **合规** | **公开仓库是黑客松评分项**，源码里出现硬编码路径、调试钩子残留、`.mimosa` 状态文件、`.env` | 低 | 中 | ① **已核验**：`git ls-files \| grep -E "\.env$\|mimosa\|\.ply$"` **当前零命中**；根 `.gitignore:4` 已含 `.mimosa/`、`:14-16` 含 `.env`、`:22/:26` 含 ply ② `window.__st` / `__cam` 诊断钩子（`StreetScene.tsx:1099`）**保留但必须与 `?debug=1` 门控**（否则生产构建带调试入口）③ 部署前仍需跑一次 `git ls-files` 断言 | `git ls-files` 命中任一敏感文件 → 移出索引 + 检查 git 历史 |
| **R09** | 进度 | **Phase 2 §9.3 排期 23 天 vs 总工期 24 天 = 零缓冲**，且未计入视觉落地 / 重构 / 盲审 / 录屏 / 部署。**工程侧全量实为 24.8 天（§7.1），超期 0.8 天**，且未算轨道 A 的美术收尾 | 高 | **高** | ① §7.1 的**三档分层**（Tier A 必保 12.7 天 / B 争取 5.2 天 / C 有余力 4.0 天）② **Tier C 默认不做** ③ 每期结束做一次"能否演示"的判定，不能演示就砍范围不砍时间 ④ §7.3 的砍掉清单**现在就执行** | ① 任一期超期 > 1 天 → 砍下一期的 Tier B 项 ② 剩 7 天时若 P5a 未完成 → **放弃 draw call 优化，保首屏 5MB 与诚实性**（诚实性是评审硬门槛，性能超标可以写进报告） ③ 剩 3 天 → **只做 P7**（盲审 + 录屏 + 部署），其余冻结 |
| **R10** | 进度 | **单人 + Agent 协作纪律**：同一工作区两个 Agent 同时跑 → 曾在 `StreetScene.tsx` 上冲突 3 次、git stash 卷走对方未提交工作（lessons §7.5） | 中 | **高** | ① **一次只开一个 Agent 会话** ② 每期一个分支/commit，禁止跨期混改 ③ 每个 commit 前 `git status` 确认 | 发现两个会话同时改 `web/src` → **立刻停止其中一个**，先 `git status` + `git stash list` 核对 |
| **R11** | 技术/部署 | **新增 GLB 漏走 `assetUrl()` 或 Draco 漏自托管** → 线上白屏（T8 / T12 同款事故） | 中 | **高** | ① 新资产一律 `assetUrl()`（code review grep 卡）② Draco 已在 `public/draco/` 自托管 ③ 守门脚本断言 `draco/*.js` 存在 ④ **部署后必须线上验收**（curl 200 ≠ 能跑） | 线上验收出现 `ERR_CONNECTION_CLOSED` 或 canvas 全黑 → 按 T12 流程排查 Draco 链路 |
| **R12** | 技术/部署 | **新增环境变量用路径形态** → MSYS 改写成 `C:/Program Files/Git/...` → base 错 → 白屏（T8 根因一） | 低 | **高** | ① 只用非路径令牌（`VITE_BASE_TOKEN=ghpages`）② 新 env 一律 `VITE_*_TOKEN` 命名 ③ `vite.config.ts:21` 的 `BASE_TOKENS` 白名单模式**不改** | 部署后 `index.html` 的 script src 不含 `/guangchang/` → 检查 env 名 |
| **R13** | 部署 | **魔搭创空间 LFS pointer 变黑屏**（>64KB 文件走 LFS，`ms.show` 返回 132 字节 pointer）；大批次 commit E1020 超时 | 中 | 中 | ① `MODELSCOPE_UPLOAD_LFS_FORCE_THRESHOLD=524288000` + `MODELSCOPE_UPLOAD_COMMIT_MAX_INLINE_BYTES=67108864` ② **大文件拆批**（≤12MB/批，lessons §7.4-6）③ 上传报告必须 `Normal committed 27 / LFS 0` ④ `curl ms.show/assets/index-*.js` 应是 1MB 级 JS | 上传报告 LFS > 0 → 改环境变量重传；E1020 → 降 `COMMIT_MAX_INLINE_BYTES` 到 12MB |
| **R14** | 技术/验收 | **egolite 渲染不了街区级 WebGL**（2136 draw call → canvas 黑帧、页面 rAF 假活、零 console 报错）→ **误判为渲染 bug**（lessons §7.3，已误判数轮） | 中 | 中 | ① 街区验收走**用户浏览器**或 headless Edge ② egolite 只用于 DOM/文本/布局验收 ③ **"用户的次真实观察胜过 Agent 的十轮工具推理"**（T9 教训） | egolite 截出黑帧 → **不要改代码**，换验收环境 |
| **R15** | 技术/事故 | **新场景（作品廊）相机初始位落进建筑/模型内部 → 全黑**（T9 事故同款） | 中 | 高 | ① 作品廊相机初始位**必须对所有几何做包围盒相交验证**（lessons §7.6 工程纪律 1）② 采用两段式：初始鸟瞰 → 首次交互后跟随 ③ **先出鸟瞰 + 近景两张截图看穿模** | 首帧黑屏 → 先查相机包围盒，**不要查渲染管线**（T9 弯路） |
| **R16** | 技术 | **状态机与 3D 场景耦合导致"切模式进度归零"**（lessons §7.7 已发生一次：`delivered/visited` 原本是 `StreetScene` 局部 state） | 中 | 高 | ① 进度统一进 `engine/progress.ts`（M3）② 场景路由**不持有业务状态**（§2.1）③ 每次场景改动后**必测**：投递 → 切办公室 → 回街区，计数保留 | 往返后计数归零 → 检查是否又出现局部 state |
| **R17** | 评审 | **盲审分数不达标**（历史：视觉 6.7 / 空间 6.1，多轮未达 8；lessons §7.6 末） | 中 | 中 | ① 走**独立盲审 Agent**（只看截图不知实现），≥7/10 放行 ② 按**共性清单**逐条收，不按单一分数当硬指标 ③ Phase 1 的角色色是新增视觉区分手段（评审重点） | 盲审 <7/10 → 只修共性问题，不做全面返工（时间不够） |
| **R18** | 评审/合规 | **词典即引擎的立意被质疑**：Phase 1/2 的核心叙事是"词典驱动"，但当前 `mapping.type` 无运行期分发、`FIELD_BY_ID` 手工、candidate 侧 8 词条仅 1 implemented | 中 | **高** | ① M2 + M4 是**必做**项，不是"建议" ② Demo 期至少做到：**HR 加词条零代码 + 求职者 `expected_salary` 有真实控件 + 作品集真能上传并环绕** ③ 报告里**如实写清**"词典驱动的边界" | 演示时评委问"加个参数要改多少代码" → 现场演示：改 JSON → 刷新 → 控件出现（M2 的验收动作） |
| **R19** | 技术 | **`dictionary.schema.json` 改动导致 schema 校验失败**（Phase 2 附录 C 已警示"新增 mapping type 必须同步扩 enum"） | 中 | 中 | ① 任何 schema 改动**必须同步改词典文件** ② `tools/check-dictionary.mjs` 断言 ③ 改 schema 后立刻跑一次校验 | 校验失败 → schema 与词典**必须一起改**，不允许只改一边 |
| **R20** | 技术 | **`styles.css` 拆分引入 CSS 顺序回归**（`@import` 必须在首部；Vite 合并后顺序需人工保证） | 低 | 低 | ① Demo 期**只做 S1**（抽 `glass.css`，其余不动）② S2 全拆**推迟到产品期** ③ 若真要拆，用 `@layer` 显式声明顺序而非依赖文件顺序 | 出现样式丢失 → 回滚到单文件 |

---

## 9. 验收清单

> 每期可勾选，尽量量化。**G1/G2/G3 是每期都要过的三条（Phase 2 §9.2）。**

### 9.0 每期通用（Phase 2 §9.2）

- [ ] **G1 诚实性审查**：导出全站文案逐条对照 → **0 处**虚假承诺（假进度条、"AI 已还原"、隐瞒 10 分钟等待）
- [ ] **G2 反羞辱审查**：截全站关键帧 → **0 处**求职者的并排对比 / 排行；任一帧可见求职者展位 ≤ 1
- [ ] **G3 无障碍审查**：拔掉鼠标 + 屏幕阅读器走完"选角色 → 逛 → 投递" → 全流程可完成；对比度全部达标

### 9.1 P0 🔴 · 首屏角色选择 + 场景路由

- [ ] 首屏 **Network 面板零** `.glb` / `.spz` / `.ktx2` / `.ply` 请求（Phase 1 §8.1）
- [ ] 首屏 **0 个 WebGL 上下文**（`canvas.getContext('webgl2')` 返回 null）
- [ ] 首屏可交互 **≤ 3s**；首屏传输 **≤ 0.5MB**（实测推导目标 ≈0.07MB）
- [ ] **`grep -rn "useGLTF.preload" web/src` 结果全部在函数体内**（模块顶层调用 = 违规，当前 2 处：`AvatarActor.tsx:183`、`AssetProp.tsx:45`）
- [ ] **主 chunk gzip ≤ 60KB**（即 three.js 已移出主 chunk；当前 1068KB）
- [ ] 角色选择 → 进入街区 **≤ 2 次点击**
- [ ] 五档宽度（375 / 390 / 768 / 1024 / 1440）**无重叠、无溢出、无横向滚动**
- [ ] 预览龛在浅/深两个主题下**都读得出**（发光强调色对影棚背景 ≥ 5.5:1，Phase 1 §2.3.3）
- [ ] 焦点环在玻璃上可见，**双环**（内层随主题反相，外层 `#C23A2B`）
- [ ] 实心按钮一律 `#C23A2B` + 白字（5.41:1）；**0 处** `#FF5A3C` 配白字
- [ ] 误选三路可修正，**无死路**（Phase 2 §2.3）
- [ ] 顶部 3D 模式仍可用（`VITE_ROLE_GATE=off` 回滚路径验证通过）
- [ ] `renderer.info.render.calls` 在街区 **≤ 200**（见 P5，回归检查）

### 9.2 P1 🔴 · 词典双端化 + 进度统一层

- [ ] **HR 侧加词条零前端代码**：在 `hr-dictionary.json` 加 1 条 implemented 词条 → **刷新后表单自动出现控件**（截图前后对比）
- [ ] `HRPanel.tsx` 中 **0 处** `FIELD_BY_ID`
- [ ] `input.bind` 缺失的 implemented 词条数 = **0**
- [ ] 12 个 localStorage key 全部经 `engine/progress.ts` 读写；`src/` 中**裸写 localStorage 的行数 = 0**
- [ ] 每个 key 的**损坏行为**符合 Phase 2 附录 D 逐行声明（逐个塞垃圾数据验证）
- [ ] 隐私模式（localStorage 抛错）→ **应用不崩**，退回默认值
- [ ] 对比篮：加入 2 家 → **刷新页面 → 篮子仍在** → 切到对比模式 → A/B 正确
- [ ] 主题锁定：锁夜间 → **刷新 → 仍锁夜间**
- [ ] `npm run tokens` 后无报错；number 令牌自检仍绿；**新增的"令牌引用完整性"自检绿**（0 个未定义 `var(--*)`）

### 9.3 P2 🔴 · 求职者形象面板 + 作品集轨道

- [ ] 上传照片 → **本地指纹匹配 ≤ 2s**，匹配依据**可读**
- [ ] 面板显示 **「演示回放」徽标**且**不可隐藏**
- [ ] **0 处**模拟 AI 生成的进度条
- [ ] 提供**可复制的本地生成命令**（路径 A 存在）
- [ ] `expected_salary` 滑杆 → 要价云 **≤ 16ms** 反馈
- [ ] 作品环绕 **≤ 8 件单层**；四类载体形状可区分
- [ ] 隐私三档生效：**私密件不渲染**（截图核验，0 残影）
- [ ] 求职者形象 = 52 根 Mixamo 骨的 idle clip（**非 T-pose**，近景实拍核验）
- [ ] `salaryCloud` 的 `exposeMode: 'band' | 'exact'` 两档都可用

### 9.4 P3 🟡 · 作品廊（只做"我的展位"）

- [ ] 从街道路牌与「我的」页**两个入口**都能进作品廊
- [ ] 作品廊**不进顶栏**（顶栏仍 3 Tab）
- [ ] 罗盘**仍是四臂**（不得改五臂，Phase 2 §1.3）
- [ ] 任一截图可见求职者展位 **≤ 1**
- [ ] 作品详情打开 **≤ 1 次点击**；拾起转场四段完整
- [ ] 作品廊 chunk **不进首屏**（首屏 Network 面板无该 chunk 请求）
- [ ] 作品廊相机初始位**通过包围盒相交自检**（T9 铁律）
- [ ] **私作品在详情板无残影**
- [ ] 街区 64 摊位数值**未被作品廊影响**（draw call 增量 = 0）

### 9.5 P4 🟡 · HR 建厂（4 步）+ 访客模式

- [ ] 建厂 5 步 **≤ 5 分钟**走完
- [ ] 参数表单**零手写**（全部由词典生成）
- [ ] **C5 硬验收**：街区里拖滑杆 → **draw call 增量 = 0**（街区 64 摊位是已发布快照）
- [ ] 发布后摊位出现在"新开张"位；**只出现 1 个**
- [ ] 照片→空间：档①匹配依据可读 + 档②命令可复制；**0 处假进度条**
- [ ] HR 访客模式下点求职者作品 → 拾起 → 详情板
- [ ] **参观办公室**：退出回到**原机位**（核验）；误触**不计入**参观数
- [ ] 参观计数 = 停留 ≥8s **且** 移动 ≥3m；参观**不触发** HR 通知
- [ ] 新增摊位**包围盒相交自检通过**（lessons §7.6-1）

### 9.6 P5a 🔴 / P5b 🟢 · 性能收敛

**P5a（Tier A 必保 = M6a：占位人形 11 mesh → 单 InstancedMesh）**

- [ ] `renderer.info.render.calls` **≤ 1500**（P5a 后目标；原始 2136 → 省 ≈700）
- [ ] **鸟瞰机位 + 近景机位各测一次**，两个数都记录（§6.3 口径）
- [ ] 首屏传输 **≤ 0.5MB**；首屏 **0 个 WebGL 上下文**
- [ ] 主 chunk gzip **≤ 60KB**（three.js 已在 lazy chunk）；`OfficeViewer` chunk ≤ 2.0MB 且不首屏触发
- [ ] `grep -rn "useGLTF.preload" web/src` → **无模块顶层调用**（2 处已改按需）
- [ ] `dist` 总量 **≤ 50MB**；`gold-coins.glb` 已删除
- [ ] `dist/**` **无** `*.ply` / `*interiorgs*`
- [ ] `draco/*.{js,wasm}` 存在且非空
- [ ] 移动端 dpr ≤ 1.5；LOD 阈值按移动端收紧（`NEAR=20 / FAR=26`）
- [ ] 中端手机实跑 **≥ 45fps**（用户浏览器，非 egolite）
- [ ] 切场景 5 次后 **无 WebGL 上下文泄漏**（`renderer.info.memory` 不持续增长）

**P5b（Tier C 有余力才做 = M6b：门面 6 材质合并 + 静态摊位实例化 + 钱袋/切口 + 名牌 atlas）**

- [ ] M6b 后 `renderer.info.render.calls` **≤ 400**
- [ ] 全做完 `renderer.info.render.calls` **≤ 200**（红线达标）
- [ ] 名牌 sprite 由 64 draw call → **≤ 4**（图集 + per-instance UV）
- [ ] 钱袋堆 / 切口牌各 **1 个** InstancedMesh
- [ ] ⚠️ **若 P5b 未做**：在报告里**如实写明** draw call 实测值与差距原因，不隐瞒

### 9.7 P6a 🔴 / P6b 🟢 · 守门 + 无障碍 + 异常

**P6a（Tier A 必保：体积守门 + 首屏 preload 修复）**

- [ ] 守门脚本 **10 条断言全绿**（含"dist 无 ply"、"draco 存在"、"index.html base 前缀正确"、"主 chunk ≤60KB gzip"、"无零引用资产"、"HR ≤6 / SPZ ≤3"）
- [ ] 首屏 Network 面板 **零** `.glb` / `.spz` / `.ktx2` / `.ply`
- [ ] 首屏主 chunk gzip ≤ 60KB（three.js 已出主 chunk）

**P6b（Tier C 有余力才做：无障碍 + 异常 + HUD/小地图重写 + 外壳三件套）**

- [ ] 词典校验脚本绿（schema 通过 + 每个 implemented 词条有 `input.bind`）
- [ ] Phase 2 §7 的 **E1–E20 逐条走查** → **0 个未处理边界**
- [ ] **纯键盘完成投递全流程**（Tab 序可达 + 焦点可见 + Enter/Space 可触发）
- [ ] 所有正文对比度 **≥ 4.5:1**（用 `tools/check-contrast.mjs` 复核，lessons §9.3）
- [ ] 图标按钮均有 `aria-label`；SVG 有 `role="img"` + `<title>`
- [ ] `prefers-reduced-motion` 下无位移/缩放动画
- [ ] 全站术语统一：0 处"收藏"、0 处"A/B 对比"混称（统一为**对比篮**）
- [ ] 单次投递 UI 反馈 **≤ 2 处**（卡片状态 + toast/XP）+ 世界反馈 1 处
- [ ] `GameHud` 无 emoji；`GameMiniMap` 罗盘**仍是四臂**且带邻近摊位列表

### 9.8 P7 🔴 · 盲审 + 录屏 + 部署

- [ ] **独立盲审 ≥ 7/10**（只给截图、不告知实现）
- [ ] 录屏帧率按 `metadata.timestamp` **重采样到固定 fps**（lessons §7.7）
- [ ] 加载遮罩段按时间区间剪掉
- [ ] **GitHub Pages 线上验收**：DOM 挂载 + canvas 存在 + **Runtime 零异常**（**无缓存 + 新 profile**）
- [ ] **魔搭创空间线上验收**：门户页 iframe 内 GLB 角色渲染正常（DRACO 链路通）
- [ ] 上传报告 `Normal committed N / LFS 0`
- [ ] 报告补图（作品廊 / 建厂 / 访客模式各 ≥ 1 张实拍）
- [ ] 提交前 `git ls-files` 无 `.env` / `.ply` / `mimosa` / 限制资产

---

## 10. 结论摘要（给主理人）

### 10.1 三档重构结论速览

| 档 | 条目 | 工程量 |
|---|---|---|
| 🔴 **必须重构** | **M1** App.tsx 场景路由分层（含 `Scene` 抽出 + three.js 出主 chunk）· **M2** 词典 binding 层（删 `FIELD_BY_ID`）· **M3** 进度统一层（12 key）· **M4** 候选人侧词典落地（8 词条仅 1 个有控件）· **M5** ErrorBoundary（防全站白屏）· **M6a** 占位人形 InstancedMesh（5h，2136 → ≈1400）· **M6b** 门面 + 静态摊位实例化（8h，→ ≈370，**推迟到 P0 后**） | **53 人时 ≈ 8.8 人日**（M6a+M6b = 13h） |
| 🟡 **建议重构** | **R1** HRStand 拆 3 份 · **R2** StreetScene 拆静态元素 · **R3** styles.css 抽 glass.css（全拆延后）· **R4** HUD/小地图重写 · **R5** AvatarActor + AssetProp preload 改按需 · **R6** 内联常量外移 · **R7** GlowPath 数据可注入 · **R8** OfficeViewer dispose · **R9** 2 槽 mapping 小表 | **26 人时 ≈ 4.3 人日** |
| 🟢 **不要动** | **N1** asset.ts · **N2** theme/sunPosition/sky · **N3** 摊位布局参数（T10 修复值）· **N4** MoneyMountain/SchrodingerBills/CarvedZone/AssetProp · **N5** 漫游逻辑 · **N6** RoamCamera/WorkdaySky/NPC · **N7** 3DGS 取景算法 · **N8** tokens transform · **N9** fictional-companies · **N10** 部署配置 | **0** |

> 注：M/R 条目与 §3 的 A–I 组、§7 的 P 期**有重叠**（同一次改动被两条清单引用），
> **以 §7.1 的分期工时为准**（Tier A 必保 76 人时 / 全量 131 人时）。
> **§7.4 的取舍裁定是排期的最终依据**：提交物欠账维护 + 还债包（5h）必须单列，双角色流程整体可延后。
> **M6 已按主理人裁定拆为 M6a（5h，低风险，必保）/ M6b（8h，中风险，推迟到 P0 交付后）**。
> **只做 M6a 时 draw call ≈1400（仍超红线 7 倍）→ 报告书必须如实写实测值与差距原因。**
> **M1（15h）不是 M2/M3/M4/M6a 的前置** —— 若要砍，M1 可推后并把 P0 降级为"App 顶部加 1 个 gate state"（≈8h，见 §7.4 Q1）。

### 10.2 最小可交付切片（3 天版本 = 11 人时 ≈ 2 人日 · 详见 §7.4 Q2）

**三件事**：① **M2 的 binding 层**（2.5h）→ 改 JSON 刷新即出控件 ② **P0 降级版首屏**（3.5h，纯 SVG 龛 + App 顶部加 1 个 gate state，**不动 mode 枚举**）③ **还债包 4 件套**（5h）→ 首屏 0.07MB / 进度不丢 / 不白屏 / 篮子不丢。
**产出**：双龛角色选择页 + 可当场演示的"改 JSON 就出控件" + 四份提交物的三处欠账（首屏体积 / 进度丢失 / 白屏）同时还清。
**⚠️ 代价**：求职者侧仍无真控件（`expected_salary` 无 UI 入口）→ "双角色"是**两个入口**而非**两套体验**。
**回滚**：三项各成独立 commit → 3 次 `git revert`。

### 10.3 最可能被低估的 3 个风险 + 1 个新发现

1. **🔴 首屏 5MB 当前是超标的（实测 5.64MB），不是擦线 —— 且根因有两处，不是一处。**
   实测 `dist/assets/`：主 chunk **1068KB**（内含 three.js，因为 `App.tsx:2-3` 顶层 import）+ **`AvatarActor.tsx:183` 模块级 preload 拉 3.08MB** + **`AssetProp.tsx:45` 模块级 preload 拉 2.23MB**（后者经 `App.tsx:8 → CompanyPlot.tsx:19` 静态 import 链触发）。
   所有人都在谈"如何懒加载 3D 资产"，但**首屏根本没打算加载 3D**（Phase 1 §2.2.1 已定"零 WebGL 上下文"）。
   **判定命令**：`grep -rn "useGLTF.preload" web/src` —— 结果必须全在函数体内；模块顶层调用 = 违规（当前 2 处）。
   **附带发现**：`gold-coins.glb`（1.45MB）是**死资产**，全项目零引用，却随 dist 发布 → 顺手删。
   —— **这条一旦漏掉，后面所有懒加载优化都白做。**

2. **🔴 "词典即引擎"目前是名义而非实现，评审会问到。**
   `mapping.type` 的 20 个枚举值在运行时代码里**从未被 switch 过**；`FIELD_BY_ID` 靠人手维护；candidate 侧 8 词条只有 1 个 implemented 且**零 UI 入口**。
   这是**项目立意**层面的缺口，不是代码风格问题。**M2 + M4 是必做项，不是"建议"。**
   —— 判定：演示时改一条 JSON → 刷新 → 控件出现；这一条能直接堵住最可能的评审提问。

3. **🟡 Phase 2 自己的排期已经超了，而且还没算 Phase 1 + Phase 3 + 盲审 + 录屏 + 部署。**
   Phase 2 §9.3 排了 **23 天**，总工期 **24 天**，且未计入视觉落地、重构、盲审、录屏、报告、双端部署。
   **本 Phase 实测算出的全量工程量是 24.8 天（131 人时 + 资产 1.5 天 + 部署 1.5 天）→ 超期 0.8 天**；
   **且这还没算轨道 A 的美术收尾与盲审冲分。**
   §7.1 的三档分层是必要的修正，§7.3 的砍掉清单**现在就要执行**。
   —— 判定：剩 7 天时若 P5a 未完成 → **放弃 draw call 优化，保首屏 5MB 与诚实性**（诚实性是评审硬门槛，性能超标可以写进报告）。

4. **🟠 新发现（2026-10-27 拍板后补）：「提交物欠账」是与双角色流程正交的一整类工作，容易被漏排。**
   三处欠账 —— **首屏 5.64MB 超标** / **办公室 3DGS 糊墙**（lessons §7.7：视频不剪该段、报告图不能用）/ **源码 5 项技术债** ——
   **全部独立于双角色流程**：即使完全不做双角色，这三处**也该修**；做了双角色，只能顺带还其中两处。
   **"不做双角色"≠"欠账自动消失"**，只等于"欠账原样带进提交物"。
   → **排期时必须单列这一类**（§7.4 Q1 的 🟥 提交物欠账维护 + 🟧 还债包），不能混进 P 序列。
   —— 判定：距 11.19 剩 14 天时若这一类还没开工 → **立刻砍掉全部 Tier B/C，先还债**（详见 §7.4 Q4.3 的三刀顺序）。

---

*（完）*
