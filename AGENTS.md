# 逛厂 GuǎngChǎng · Agent 操作契约

参数空间化 3D 求职招聘街区，群核 Aholo 全球 3D AI 黑客松参赛项目，提交截止 **2026-11-19 19:00**。

## 权威文档（动手前按序读）

- `project.md` — 唯一权威计划书，所有决策以它最新版为准
- `docs/lessons.md` — 踩坑与部署铁律（§3 铁律、§4 事故档案 T7–T12b、§7 街区版）
- `docs/adversarial-review.md` — 红队自审档案 · `docs/design/design-audit-2026-10-25.md` — 盲审制度
- `docs/handoff-2026-10-26.md` — 进度快照与待办（会过期，不作权威）

## 事实，别猜

- 平台 Windows + Git Bash；前端只有 `web/` 一个 npm 包（用 npm，勿换 pnpm/yarn）。Node 24、Python 3.14（`requests`）、typst 0.15
- 仓库是**公开仓库**（Pages 免费版需要）；两个部署目标：GitHub Pages（分支 `gh-pages`，无 CI）与魔搭创空间 `zgqy379/guangchang3d`
- 本机浏览器验证只走 egolite：`ego-browser nodejs < 脚本`（先例可抄 `C:/Users/dqy/ego/gc-review-20261025-1600/street-rec2.mjs`）。headless Edge 的 WebGL 截图不可靠

## 命令

```bash
cd web && npm install
npm run typecheck              # tsc --noEmit
npm run tokens                 # 改 design/tokens.json 后必须跑（prebuild 也会跑）
npm run build                  # tsc + vite，base '/'
npx vite preview --port 4173   # 本地预览 dist
typst compile report.typ report.pdf   # 在 docs/ 下
```

```bash
VITE_BASE_TOKEN=ghpages npm run build          # Pages：基路径只能靠这个令牌
cp ../docs/video/demo-video.mp4 dist/
npx gh-pages -d dist -b gh-pages
```

路径形态的 env 会被 MSYS 改写成 `C:/Program Files/Git/...`，导致线上白屏（T8）——所以只用 `ghpages`/`modelscope` 这种非路径令牌。魔搭上传必须先设 `MODELSCOPE_UPLOAD_LFS_FORCE_THRESHOLD=500MB` 与 `MODELSCOPE_UPLOAD_COMMIT_MAX_INLINE_BYTES=64MB`，报告须为 `Normal ... / LFS 0`，之后还要点"重新部署→确认部署"（配方 `docs/lessons.md` §7.4）。

## 风险控制

- **受限资产连构建输入都不能碰**：`*interiorgs*`、`*.ply` 不许进 `web/public/`；只删 dist 治标不治本，重建就复漏（T7、T12b）。私人照片素材目录、`.env`、迭代大二进制已在 `.gitignore` 封堵，勿解除
- 部署验收必须对着**线上**做完整启动确认（DOM 挂载 + canvas 存在 + Runtime 零异常），`curl` 200 不算数（T8）；运行时第三方 CDN 依赖一律自托管（T12）
- `commit` 勿用 `-q`（会吞掉安全 hook 的拦截信息）；推送被拦先读 hook 输出，不硬闯

## 写代码时的反直觉点

- 资产 URL 一律走 `assetUrl()`（`web/src/engine/asset.ts:5`）；硬编码 `/assets` 会 404 挂掉整个应用
- `@manycore/aholo-viewer` 必须留在 vite `optimizeDeps.exclude`，否则它的 splat worker 丢失
- InstancedMesh 矩阵写在 `useLayoutEffect`，不能写 `useMemo`（首渲染 ref 为空，64 盏路灯曾全叠原点）
- HR 动画必须用玩家 `avatar-idle.glb` 的 clip 驱动克隆；HR 自带 clip 是 T-pose，勿改回
- 共面装饰层（窗/玻璃/LED/门）z 间隔 ≥0.02m，否则远看是"涂鸦噪点"（T11）
- 钞票山层数换算用固定层容量（3×3=9），禁用 `ceil(sqrt(N))²`（金额差会变成不了高度差）
- 相机初始位必须对场景所有建筑包围盒做相交验证（T9：机位落在楼内 = 全黑视角）
- 街区布局常量 `START_ALONG=14`、`SLOT_GAP=3.6`；改回 10 街角摊位会被邻街办公楼吞（T10）
- 颜色唯一来源是设计令牌：CSS 用 `var(--color-*)`，3D 用 `generated/design-tokens.output.mjs`

## Aholo 素材生成

- 用已安装的 `aholo-lux3d` skill（OpenAPI 模式，国内区；`LUX3D_CN_API_KEY` 在 `.env`，`Authorization` 头**不加 Bearer**）。`tools/gen_*.py` 是既有存档管线，改动前先对齐 skill 的工作流
- 每次生成必存档到 `docs/iterations/`（prompt+参数+成败都记，失败是报告书素材）；批量脚本遵循 `tools/gen_v2_batch.py`：mkdir 先行、taskId 恢复
- `provider status=4` 偶发 → 每步重试 3 次；真钞主题必被服务端内容审核拦，一律用虚构"逛厂币"（合规依据 `project.md` 7.6）

## 协作纪律

- 同一工作区禁止两个 Agent 并发（历史上冲突三次）
- 视觉改动上线前走独立盲审，≥7 分放行（8+ 为冲刺目标）
- 重要分叉用选择题问用户，其余自主推进「迭代 → 盲审 → 过线 → 部署」
- 新经验写 `docs/lessons.md`、重大事故写 `docs/adversarial-review.md`，别往本文件堆
