# 截图配方与验收工具侦察（tmp-design-review · 2026-10-27）

侦察范围：`tools/`、`docs/figures/`、`docs/iterations/app-acceptance/`、`web/src`（App/params/theme）。只读侦察 + 存在性 dry-run（`web/dist` 存在、playwright 绝对路径存在），未启动任何服务。

## 0. 管线总览（谁产出过哪些图）

| 目标目录 | 产出脚本 | 状态 |
|---|---|---|
| `docs/figures/street-2026-10-27/{hero,walk,focus,deliver}.png` + `metrics-*.json` | `tools/shoot-street.cjs`（label=final，light，1280×720） | **已提交、可复现** |
| `docs/figures/street-2026-10-27/night/` | 同上，`--theme dark --label final-night`（metrics 实证 theme=dark） | 可复现 |
| `docs/figures/street-2026-10-27/mobile/` | 同上，`--mobile --label final-mobile`（390×844，含 mobile-collapsed/expanded） | 可复现 |
| `docs/figures/twin-2026-10-26/*.png`（4 张） | 仓库内**无生成脚本**；twin 文档 `docs/design/twin-style-spec-v4.md` 也不含配方 | 一次性，不可直接复现 |
| `docs/iterations/app-acceptance/2026-10-26/aesthetic-*` 等 17 张 | 无 README、无脚本存档（仅 `2026-10-25-mountain-fix/` 有 README）；`live-*.png`≈5KB 疑似黑帧 | 一次性；生成脚本疑在 ego 工作区（仓库外，本机读被权限拒） |
| `tools/accept-street.mjs`（未跟踪） | egolite 诊断版验收脚本，**不是截图管线**：打到 `localhost:4175`（≠契约 4173）、截图落 `C:/tmp/`、只输出 DOM/canvas/draw-call 诊断 | 仅诊断用 |

## 1. 主命令（盲审级截图 = shoot-street.cjs）

前置（一次性）：`cd web && npm install && npm run build`。playwright 从绝对路径 `C:/Users/dqy/.workbuddy/binaries/node/workspace/node_modules/playwright` 加载（已验证存在）；CommonJS `.cjs` 是 Windows ESM 限制（lessons §8.5）。

```bash
# 终端 A：本地预览（必须，等 dist 起来）
cd /e/guangchang/web && npx vite preview --port 4173

# 终端 B：在 web/ 目录下跑
node ../tools/shoot-street.cjs --label final
node ../tools/shoot-street.cjs --theme dark --out ../docs/figures/street-2026-10-27/night --label final-night
node ../tools/shoot-street.cjs --mobile --out ../docs/figures/street-2026-10-27/mobile --label final-mobile
```

- 默认 URL `http://localhost:4173/`（`--url` 可覆盖）；默认 1280×720，`--mobile` 固定 390×844。
- 一条命令产出 4 张：hero（鸟瞰）→ walk（越肩，脚本自动点地面 (14,3.9)）→ focus（摊位 3/4 特写，等 `__roam.target` 清空）→ deliver（点「投简历」）；外加每张的 draw call/fps 实测（3×60 帧取中位）+ 布局量化验收 + `metrics-<label>.json`。
- 自动处理：角色门 `.gc-role-gate` → 点 `.gc-role-card--candidate`（App.tsx:122 起角色门 v1.4；Playwright 每次全新 context，localStorage 空，门必现、行为确定）；再点「招聘街区」（App.tsx:301）；等 `window.__st` + 4.5s 资产稳定。
- **不能把 `--out` 指到 docs/ 之外也行**：`--out` 任意目录皆可（盲审喂图建议另开 tmp 目录，避免混入正式 figures）。

## 2. 主题切换与参数注入

- **昼/夜**：`.theme-lock` 按钮循环 `auto → light → dark → auto`（App.tsx cycleLock）；手动锁**立即生效**，auto 跟系统时间且 3s 防抖。脚本化 = 点 1 次得 light、点 2 次得 dark（shoot-street.cjs 内置），验收看 `.app[data-theme]`。注意主题锁会写 localStorage（`engine/progress.ts:30`），复用持久 profile 时要清理；auto 档随拍摄时刻变，**配方一律显式点锁**。
- **参数注入：无 URL/localStorage 通道**，`paramsA` 是纯 React state（App.tsx:124），注入只有两条路：
  1. **预设芯片（推荐，确定性）**：点 `.chip-btn` 文本「慢山文旅」= 低薪样本（`web/src/data/fictional-companies.ts:21-31`：年薪 15 万/12 薪/18 点下班/社保 0.8，「山只到小腿」）。单机模式下截图前 `page.getByRole('button', { name: /慢山文旅/ }).click()` 即可；另有「不眠星云科技」（50 万卷王）作高薪对照。
  2. **滑杆**：HRPanel/ParamForm 的 `<input type=range>`，按 dictionary 词典 min/max 拖（`setParamsA`，App.tsx:361）。
  - 街区 64 摊位是**加载时算好的发布快照**，滑杆不进街区（契约红线）；单人/对比页才响应滑杆。
- **单人模式**：默认 mode='single'（App.tsx:118），选完求职者角色即落此页，**无现成专用脚本**——最小做法：shoot-street.cjs 复制改跳过「进街区」，或手工点芯片后 `page.screenshot`；10-26 的 `aesthetic-single*.png` 即此类一次性产物。

## 3. 可靠性结论（哪条线适合盲审）

- **盲审级 = `shoot-street.cjs`（headed Chrome）**：10-27 正式 figures 即它产出；自带 draw call 红线数值（M6c 后 ~611，commit 1b8fd20）与 console error 采集，是唯一「截图+量化验收」一体且已入库的管线。
- egolite（`ego-browser nodejs`）**渲染不了街区级 WebGL**（lessons §7.3：canvas 黑帧、rAF 假活、零报错）；适合 DOM 流程/部署验收/诊断（`accept-street.mjs`）与 screencast 录屏（相机修复后 270 帧正常；最小化窗口要 `page.screenshot` 前跑 `tools/restore-ego.ps1`）。headless Edge WebGL 受虚拟时间限制，**弃用**。
- twin-2026-10-26 与 aesthetic-* 两批**复现流程已失传**（脚本不在仓库），只作历史对照，勿当配方引用。

## 4. Git 基线

- 分支 `feat/debt-reduction-week1`；工作区有上一会话 32 文件未提交批次（M 31 + D `web/src/engine/sky.ts`），另未跟踪 `.arts/`、`tmp-design-review/`、`tools/accept-street.mjs`、`web/src/components/hr/`。
- 最近 10 条 log --oneline（新→旧）：
  ```
  e9947da feat(gallery): 作品廊集成到 App 路由 + 街道入口
  d56f21a feat(gallery): P3 作品廊 — 独立 Canvas 场景，环形走廊 + 求职者展位 + 他人展位
  4c774d9 feat(street): 集成求职者展位 CandidateBooth 到街区中央
  4e8daab feat(candidate): P2 求职者形象面板 — 照片贴入/预设/演示回放/稍后定制
  f3d76eb feat(dict): P1 词典双端化 — 删除 FIELD_BY_ID 硬编码，词典加词条零前端代码
  f670357 feat(street): 夜间湿反射带 + 增强路灯辉光，提升光层次
  1b8fd20 feat(street): M6c 摊位硬件 InstancedMesh 化，draw calls 1336→611
  654c7af feat(street): M6b 门面 InstancedMesh 化，draw calls 1547→1336
  4b32fc1 fix(street): 修复街区不加载 + M6a draw call 优化生效
  96680b4 feat(debt): week-1 还债项 — 对比篮持久化 + M6a 占位人形 InstancedMesh + 删死资产
  ```
- 风格：conventional commits，`feat(scope)/fix(scope): 中文描述`，scope ∈ {street, gallery, candidate, dict, debt}，标题里直接带量化指标（如 1336→611）。

## 5. 部署验收命令清单（抄录备用）

**GitHub Pages（分支 gh-pages，无 CI）**——契约命令块：

```bash
cd web
VITE_BASE_TOKEN=ghpages npm run build      # 基路径只认非路径令牌（路径形 env 会被 MSYS 改写 → 线上白屏 T8）
cp ../docs/video/demo-video.mp4 dist/
npx gh-pages -d dist -b gh-pages
```

**魔搭创空间 `zgqy379/guangchang3d`**——lessons §7.4 配方：

- 通道 = Python SDK（git http 推送一律 Access denied）：`HubApi.login(token)` + `upload_folder(repo_id, repo_type='studio', folder_path)`（pip install modelscope；令牌须「写权限令牌」类型）。
- 上传前必须设：
  ```bash
  MODELSCOPE_UPLOAD_LFS_FORCE_THRESHOLD=524288000   # 500MB，防主 JS 变 LFS pointer 黑屏
  MODELSCOPE_UPLOAD_COMMIT_MAX_INLINE_BYTES=67108864 # 64MB；E1020 批次超时则降到 12MB
  ```
  上传报告必须是 `Normal committed N / LFS 0`。
- 文件更新后需「重新部署→确认部署」：脚本化 `ego-browser nodejs < tools/ms-redeploy.mjs`（读 `C:/Users/dqy/AppData/Local/Temp/ms-cookies.json` 登录态，任一关键步骤失败 exit 1）。
- 验收：顶层 `ms.show` 会 302 回门户 `?mode=full`（iframe 托管）；`curl ms.show/assets/index-*.js` 应为 1MB 级 JS 而非 LFS pointer，且纯 curl 须带浏览器 UA（WAF 403）。**部署验收必须对线上做完整启动确认（DOM 挂载 + canvas + Runtime 零异常），curl 200 不算数（T8）**。

## 6. 待证项

- twin-2026-10-26 与 aesthetic-* 的实际生成脚本：建议查 `C:/Users/dqy/ego/` 下 10-26 时段任务空间（本机仓库外读取被权限拒，主代理可直接看）。
- `accept-street.mjs` 的 4175 端口与 10-27 当天验收的对应关系：疑为当天 egolite 会话自起 preview 的临时端口，未在 lessons 记录。
