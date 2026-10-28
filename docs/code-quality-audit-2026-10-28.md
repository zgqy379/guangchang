# 逛厂 GuǎngChǎng · 代码质量评估报告

- **评估对象**：`web/src`（前端 3D 应用，React 18 + @react-three/fiber v8 + three.js + @manycore/aholo-viewer）
- **规模**：47 个 TS/TSX 文件，约 9,500 行代码；最大文件 `StreetScene.tsx` 约 67KB / 1,704 行
- **评估方式**：只读静态审计。结构/风格/重复由深度遍历得出，安全/性能/错误由模式扫描 + 关键文件精读交叉验证（已用 Grep 独立复核核心结论）。未修改任何文件。
- **评估日期**：2026-10-28

---

## 一、分项维度结论

### 1) 目录结构与模块划分
**结论：分层清晰、无循环依赖，但存在两个 God File 与工具函数外泄。**

- ✅ `engine/`（纯逻辑，零 UI 耦合）、`data/`（纯数据）、`state/`（仅 ErrorBoundary）、`components/`（UI）职责边界清楚。
- ✅ **无循环依赖**：`engine/`↔`data/` 互不 import `components/`；`components/` 单向依赖下层；组件间 import 全为单向。
- ⚠️ **`StreetScene.tsx`（1,704 行，约全仓 18%）是典型 God File**：单文件内同时承载 ① 8 个 Canvas 程序化贴图生成器（L64–853）；② 约 20 个场景子组件（Roads/WetReflectionBand/StreetLamps/…）；③ 游戏状态（投递/参观/XP/进度持久化，L1463–1505）；④ DOM 浮层（GameHud/GameMiniMap/LotCard/Toast，L1200–1701）。
- ⚠️ **`HRStand.tsx` 把工具函数 `export` 出去**，造成反向耦合：`OfficeFacadeInstanced.tsx:36,93` 与 `BoothHardwareInstanced.tsx:29-30` 反过来从组件文件 import 贴图/几何工具（`facadeTexture`/`glassTexture`/`cashTexture`/`CASH_TEXTURES`/`OUTFITS`/`preloadHRModels`）。组件文件应只负责渲染。
- 其余大型文件（`BoothHardwareInstanced`、`OfficeFacadeInstanced`、`WorkdaySky`、`FactoryWizard`、`RoleGate` 等）职责相对单一，不算 God File，但内部共享逻辑重复（见维度 6）。

### 2) 代码风格与命名规范
**结论：命名/导出/引号高度统一，仅存在 props 类型写法不统一等轻微问题。**

- ✅ 组件 PascalCase、函数/const camelCase、类型 PascalCase 全仓一致；仅 `App.tsx:171` 用 `export default`，其余全部 named export（无混用）；引号统一（TS 单引号 / JSX 双引号）；无 `React.FC` 用法；`strict` + `noUnusedLocals/Parameters` 已强制，`as any` 仅 0 处真实逃逸。
- ⚠️ **Props 类型写法三套并存**：内联 `({...}:{...})`、具名 `interface XxxProps`、`裸 interface Props`（出现在 `HRPanel.tsx:7`、`RoleGate.tsx:17`、`ErrorBoundary.tsx:12`）——后者歧义，三个模块都叫 `Props`。
- ⚠️ `type` 与 `interface` 混用（11 处 `export type` vs 10 处 `export interface`），缺统一约定；`App.tsx:22-45` 把 `lazy(...)` 插在 import 块中间、之后又出现 `import`，import 分组略乱。

### 3) 错误处理与异常边界
**结论：错误边界设计良好，但缺全局异步/事件兜底与 WebGL 上下文丢失处理。**

- ✅ `state/ErrorBoundary.tsx` 设计优秀：两级边界（全局 + `SceneErrorBoundary` 场景级）+ 可读降级页 + 重试；`engine/progress.ts` 的 localStorage 容错是教科书级（`storageAvailable()` 探测隐私模式、读写全 try/catch、内存兜底、内容损坏静默重置）。
- ⚠️ **无全局异步/事件错误捕获**：仅 `ErrorBoundary`（只覆盖 React 渲染期）；全仓无 `window.onerror` / `unhandledrejection` / `error` 监听。异步/事件回调里的未捕获异常会打到控制台并可致整树卸载，绕过降级 UI。
- ⚠️ **无 WebGL 上下文丢失（context loss）处理**：3D 重场景高频隐患（标签页后台/GPU 复位/上下文数超限），全仓无 `webglcontextlost` 监听，场景变黑无恢复路径。
- ⚠️ `main.tsx:9` `document.getElementById('root')!` 非 null 断言，找不到 `#root` 时边界外硬白屏；`App.tsx:519,529` 的 `single`/`compare` 场景分支仅受顶层边界保护，任一子场景抛错会触发整页全屏降级而非局部降级。
- ℹ️ `dictionary.ts:60` 缺词条直接 `throw` 属开发期契约，但渲染期抛错会被泛型降级页覆盖、缺针对性信息。

### 4) 测试覆盖率与测试用例质量
**结论：测试覆盖率为 0%，无任何自动化回归保护。**

- ❌ `package.json` 的 `scripts` 无 `test`；全仓无 `*.test.*`/`*.spec.*`/`__tests__`，无 jest/vitest/config；无 Playwright/Cypress 等 e2e 配置。
- ❌ 复杂且易错的纯逻辑层（`engine/`：asset/params/progress/time/sunPosition/dictionary）与资产/令牌生成逻辑完全无单测。与 AGENTS.md 中"诚实是硬门槛""盲审 ≥7 分"的高标准形成明显反差。

### 5) 依赖管理与配置文件
**结论：依赖版本自洽、lockfile 已跟踪、无未用依赖；但缺 linter/CI，且 engines 与 @types 不匹配。**

- ✅ 运行时 6 依赖全部实际 import；R3F 三件套（`fiber ^8.17.10` + `drei ^9.114.3` + `three ^0.169.0`）版本自洽（drei v9 是 R3F v8/React 18 正确配对，three 0.169 落在 peer 范围内）；lockfile 已纳入 git；`private:true` 已设。
- ⚠️ **`engines.node` 锁 `>=24 <25`，但 `devDependencies.@types/node ^26.6.5`** 面向 Node 26 API——类型契约与运行时不匹配，可能在 24 下"类型通过却用到不存在 API"。
- ⚠️ **无 ESLint / Prettier / .editorconfig**，无 `.github/workflows`（CI）。AGENTS.md 明示 Pages 部署"无 CI"——本地 prebuild 门禁（contrast/panel-ink/tsc）**不在部署路径强制**，直接 push `gh-pages` 可绕过。
- ✅ `vite.config.ts` 的 `VITE_BASE_TOKEN` fail-fast（未知令牌即 `throw`，规避 MSYS 路径改写导致线上白屏）、`optimizeDeps.exclude` 保留 aholo splat worker 均为良好实践；`tokens.config.mjs` 构建后自检 number 令牌未被破坏（`process.exit(1)` 失败）。

### 6) 重复代码 / 硬编码 / 魔法值
**结论：存在多处真实重复与未令牌化品牌色，是最值得先修的可维护性问题。**

- ⚠️ **行业→楼高三元式重复 5 处**（完全相同）：`HRStand.tsx:455`、`OfficeFacadeInstanced.tsx:84/199/219/239`。应抽 `BUILDING_HEIGHT: Record<Industry, number>`。
- ⚠️ **品牌青色 `#16C0B6`（浅色变体 `#5ee6dc`）硬编码 6 文件 9 处**：`CandidateBooth.tsx:104`、`WorkOrbit.tsx:63`、`RoleGate.tsx:33/34/41/42/61`、`GalleryCorridor.tsx:99`、`StreetScene.tsx:1648/1649/1659`——未入设计令牌，违反"颜色唯一来源是令牌"的治理约定。此外 `RoleGate.tsx` 把本有令牌的 `#d98e32`(ColorSceneBillOrange)、`#ffd4b0`(ColorSceneSun) 也直接写死。
- ⚠️ **街具布局无单一事实源**：`StreetScene.tsx` 内 `7 + i*4.2`（L212 WetReflectionBand、L686 StreetLamps 逐字复制）、`8.5+i*3.6`(L471)、`9.1+i*8.4`(L515)、灯臂 `side*6.4` 等全是独立魔法数，且 `data/street-companies.ts:124-126` 的 `START_ALONG/SLOT_GAP/LOT_OFFSET` 为模块私有、未导出，两套几何"事实源"互不知晓。
- ⚠️ **跨文件重复实现**：`instanceMatrixFor`（`BoothHardwareInstanced.tsx:35` 与 `OfficeFacadeInstanced.tsx:45`）+ `roofMatrixFor`（`:58`）；`billTexture`（`MoneyMountain.tsx:25`）与 `cashTexture`（`HRStand.tsx:310`）逻辑高度重复；`DOOR_OFFSET_Z=-3.6` 在 `OfficeFacadeInstanced.tsx:27` 定义却又在 `HRStand.tsx:504` 写死。
- ℹ️ 其他零散魔法值：`expectedSalary={450000}`（`StreetScene.tsx:1629` 与 `App.tsx:513`）、画廊入口 `[0,0,14]` 等写死；`WorkdaySky.tsx:367` 的 `fogNear=18/fogFar=60` 是未被使用的死参数（被 `StreetScene.tsx:1539` 的 46/200 覆盖）。

### 7) 性能瓶颈与安全隐患
**结论：安全面干净；性能短板主要是缺 `React.memo` 隔离与滑块拖动整树重算；可靠性短板是缺 context-loss 处理。**

- ✅ **安全面通过**：Grep 全仓 `dangerouslySetInnerHTML|eval(|new Function(|innerHTML` 仅 0 命中；唯一 `fetch`（`OfficeViewer.tsx:38`）URL 来自静态 `assetUrl()` 选项、同源、失败被 try/catch 转状态文案；无 `axios`/XHR、无 SSRF/开放重定向面；唯一受控文本输入 `FactoryWizard.tsx:182` 的 `companyName` 经 React 插值自动转义——且该组件是**死代码**，当前不可达；无 3D 文本注入面（名称走 drei `<Html>`，React DOM 自动转义）。**无硬编码密钥**：`LUX3D_CN_API_KEY`/`MODELSCOPE_TOKEN` 仅在 `.env`（已 gitignore），源码 0 命中真实密钥字面量。
- ⚠️ **全仓 0 处 `React.memo`**：昂贵 3D 子组件（MoneyMountain/CompanyPlot/OfficeFacadeInstanced/BoothHardwareInstanced/PlaceholderHRs/StreetScene 等）每次父级重渲染都重走协调；虽内部几何用 `useMemo` 缓解重算，但协调层与 R3F 仍重评。
- ⚠️ **滑块拖动驱动整树重算**：`GcSlider.tsx:59` `onChange` → `setParamsA` → App 重渲染 → MoneyMountain/CompanyPlot 的 `useMemo`（依赖 params）每次输入事件重跑 `layerLayout` 并重建 InstancedMesh 矩阵（`useLayoutEffect`）；密集拖动开销偏高。
- ✅ **性能稳健点**：InstancedMesh 矩阵严格写在 `useLayoutEffect`（非 `useEffect`，避免首帧叠原点）；无模块级 `useGLTF.preload`（预加载已收进 `preloadHRModels()` 函数、仅落地漫游时调用）；资源释放良好（MoneyMountain/CompanyPlot/OfficeViewer 均 dispose/destroy）；首屏 `RoleGate` 不挂任何 `<Canvas>`。
- ℹ️ `OfficeViewer.tsx:70-77` 主线程同步逐点遍历点云求包围盒，4–5MB SPZ 下可阻塞数十毫秒（首帧卡顿），低优先。

---

## 二、按严重程度分级的问题清单

| ID | 严重度 | 问题 | 位置 | 维度 |
|----|--------|------|------|------|
| Q1 | **High** | 测试覆盖率 0%：无测试框架、无测试文件、无 CI，复杂逻辑无回归保护 | 全仓（`package.json:10-19`） | 4 |
| Q2 | **High** | 缺自动化质量门禁（无 ESLint/Prettier/CI）；AGENTS.md 规则无自动强制，部署可绕过 prebuild 门禁 | 全仓 / 无 `.github/workflows` | 5 |
| Q3 | **High** | `StreetScene.tsx` God File（~1,704 行 / 18% 全仓），混合贴图/子场景/游戏状态/DOM 浮层 | `StreetScene.tsx` | 1,6 |
| Q4 | **Med** | 无全局异步/事件错误捕获 + 无 WebGL context-loss 处理（3D 重场景高频隐患） | `ErrorBoundary.tsx:33`；所有 `<Canvas>` | 3,7 |
| Q5 | **Med** | 重复/硬编码逻辑：楼高三元式重复 5×；街具布局魔法数多处且自成一派；矩阵/钞票贴图 helper 跨文件重复 | `HRStand.tsx:455`、`OfficeFacadeInstanced.tsx:84/199/219/239`、`StreetScene.tsx:212/686` 等 | 6 |
| Q6 | **Med** | 品牌青 `#16C0B6`（9 处/6 文件）及 `#d98e32`/`#ffd4b0` 等未令牌化写死，违反令牌唯一来源约定 | `CandidateBooth:104`、`WorkOrbit:63`、`RoleGate:33/34/41/42/61`、`GalleryCorridor:99`、`StreetScene:1648-1659` | 6 |
| Q7 | **Med** | 工具函数从组件文件 `export` 造成反向耦合（HRStand/OfficeFacadeInstanced 外泄贴图/几何工具） | `HRStand.tsx:39/72/174…`、`OfficeFacadeInstanced.tsx:36,93`、`BoothHardwareInstanced.tsx:29-30` | 1 |
| Q8 | **Med** | 街区几何无单一事实源：`START_ALONG/SLOT_GAP/LOT_OFFSET` 模块私有未导出，街具布局另立体系 | `data/street-companies.ts:124-126`、`StreetScene.tsx` 多处 | 6 |
| Q9 | **Med** | `engines.node` 锁 24，但 `@types/node ^26`（面向 Node 26 API），类型契约与运行时不匹配 | `package.json:7-9,30` | 5 |
| Q10 | **Low** | 全仓 0 处 `React.memo`；滑块拖动触发整树 InstancedMesh 重建 | `GcSlider.tsx:59` → `MoneyMountain`/`CompanyPlot` | 7 |
| Q11 | **Low** | 风格细节：props 写法三套并存（含裸 `Props`）；type/interface 混用；import 分组略乱 | `HRPanel:7`、`RoleGate:17`、`ErrorBoundary:12`、`App.tsx:22-45` | 2 |
| Q12 | **Low** | 死代码 `FactoryWizard.tsx`（~14KB，含受控输入）全仓从未 import/渲染；`OfficeViewer` 主线程同步点云循环 | `FactoryWizard.tsx`（仅自身引用）、`OfficeViewer.tsx:70` | 1,7 |
| Q13 | **Low** | 仓库卫生：`web/generated/` 令牌产物被纳入 VCS（未 gitignore）；`#root` 非 null 断言越界白屏点；single/compare 场景未单独隔离；词典缺词条直接 throw | `.gitignore`、`main.tsx:9`、`App.tsx:519/529`、`dictionary.ts:60` | 3,5 |

---

## 三、优先级改进建议

### P0（最高优先 · 建立防线）
1. **引入测试 + CI**：加 `vitest`，先给易测且高风险的纯逻辑层（`engine/`：asset/params/progress/time/sunPosition/dictionary）补单测；加一个最小 GitHub Actions，在 push 前跑 `tsc --noEmit` + prebuild 门禁（contrast/panel-ink）+ `vitest`。避免直接 push `gh-pages` 绕过质量门。
2. **加 ESLint（typescript-eslint + react 规则）+ Prettier**，并把"禁止模块级 `useGLTF.preload`""必须用 `assetUrl()`""颜色必须用设计令牌"做成自定义/约定规则，纳入 CI 或 pre-commit。

### P1（结构治理 · 降维护风险）
3. **拆分 `StreetScene.tsx`**：抽 `street/textures.ts`（贴图生成器）、各子场景独立文件、游戏状态抽 `useStreetGame()` hook/context。
4. **消除重复常量/逻辑**：抽 `BUILDING_HEIGHT: Record<Industry, number>`（放 `data/` 或 `engine/params.ts`）替换 5 处三元式；合并 `instanceMatrixFor`/`roofMatrixFor` 到 `engine/geo.ts`；合并 `billTexture`/`cashTexture`；街具布局常量集中到 `data/street-companies.ts` 或 `street/layout.ts` 一处定义并导出。
5. **令牌化品牌色**：`tokens.config.mjs` 增 `ColorBrandTeal`/`ColorBrandTealLight`，全局替换 9 处硬编码；复查 `RoleGate.tsx` 等已存在令牌却写死的颜色。
6. **收口工具耦合**：把 `HRStand`/`OfficeFacadeInstanced` 导出的贴图/几何工具移到 `engine/` 或 `street/` 子模块，组件文件只渲染。
7. **可靠性补强**：`main.tsx` 加 `window` `error`/`unhandledrejection` 兜底；给 `<Canvas>`/viewer 注册 `webglcontextlost` 监听与恢复；`single`/`compare` 场景用 `SceneErrorBoundary` 单独隔离。

### P2（打磨 · 性能与卫生）
8. **性能**：给 props 稳定的重 3D 子组件加 `React.memo`；滑块参数走 `requestAnimationFrame` 节流或"提交时重算几何"。
9. **风格统一**：统一 Props 写法（禁用裸 `Props`），统一 `type`/`interface` 约定，规范 import 分组（借 ESLint 自动修复）。
10. **仓库卫生**：`.gitignore` 加 `web/generated/`；删除或接线 `FactoryWizard`（若不做建厂向导则移除以免死代码陷阱）；`main.tsx` 的 `#root` 取不到时给可读降级而非硬白屏。

---

## 四、正面发现（资产到位，应予保持）

- ✅ 分层清晰、**无循环依赖**；`engine/` 纯逻辑零 UI 耦合。
- ✅ TS `strict` + `noUnusedLocals/Parameters` 强制，`as any` 真实逃逸 0 处。
- ✅ InstancedMesh 矩阵严格 `useLayoutEffect`；无模块级 `useGLTF.preload`；资源释放良好（dispose/destroy）。
- ✅ `assetUrl()` 全站统一、无硬编码 `/assets` 路径；`vite.config` 的 `VITE_BASE_TOKEN` fail-fast 规避线上白屏。
- ✅ **安全面干净**：无硬编码密钥、无 `dangerouslySetInnerHTML`/`eval`、输入经 React 转义、网络请求同源且不可用户控制、`.env` 已 gitignore。
- ✅ `ErrorBoundary` 与 `progress.ts` 的容错设计优秀（两级边界 + 重试 / 隐私模式探测 + 损坏静默重置）。

> 总体判断：项目在**架构分层、3D 渲染纪律、安全与容错**上达到较高水准；主要短板集中在**工程化防线（测试/CI/lint）缺失**与**少数巨型/重复文件的维护性风险**，均属"可逐步偿还的技术债"，无紧急安全漏洞。建议从 P0 两项（测试+CI+lint）切入，再推进 P1 结构治理。
