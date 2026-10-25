# 逛厂经验沉淀（Lessons Learned）

> 本项目开发过程中踩坑与经验的集中沉淀，2026-10-25 ~ 10-27 首轮汇总。
> 跨会话的 Agent 记忆另存于本机 `~/.zcode/cli/memories/projects/guangchang-*/memory/`（不进仓库）；
> 本文件是团队/仓库内共享的经验源。**每次踩新坑，先查这里，修完往这里补一条。**

## 一、Aholo API 实战要点

| 事项 | 结论 |
|---|---|
| 鉴权 | `Authorization: <key>`，**不加 Bearer**；国内网关 `api.aholo3d.cn`；国内/国际 key 不通用 |
| 环境变量 | Lux3D 专用名 `LUX3D_CN_API_KEY`；World SDK 用 `AHOLO_API_KEY`；**两个都要设**（skill 上传器读前者、world SDK 读后者） |
| 任务模式 | 全部异步任务+轮询；**provider status=4 有偶发性**（绑骨首试失败重试即过），批量脚本默认带 3 次重试 |
| 内容审核 | **真钞/人民币主题必被拦**（实测 status=4），虚构货币（fantasy banknote）通过——"逛厂币"由此转正 |
| 重建素材 | World 重建硬校验 **≥20 张图或视频/.insv**；**定点摇镜视频不可用**（无平移视差，实测失败）——必须真实行走穿越素材 |
| World 生成 | 纯文案 ✓（652s，SPZ 仅 4MB）；带参考图模式两次一致失败（服务端问题） |
| 绑骨/动画 | auto-rig 吃 `.glb` 直链（生成产物是 zip，需下载解压再走 OUS 上传换直链）；retarget 动画 ID 从 `contracts/lux3d-generation.v1.json` 取；**行走动画要 `animateInPlace=true`**，否则根位移叠加导致滑步 |
| 产物体积 | 原始 GLB 16–43MB；gltf-transform（Draco+WebP）压 89–93%（21MB→2.2MB、43MB→3.1MB），全部进入移动端预算 |
| 单次耗时 | Lux3D 76–108s、World 652s → **资产必须全预生成**，滑杆不能等现场生成 |
| 生成模型尺寸 | 原始尺寸不可控 → 场景接入必须归一化（Avatar 定高 1.6m、道具 0.55m 贴地） |
| LuxReal | 网页创作工具、0.06 元/秒，交互式流程——Demo 视频走实机录屏更稳（官方要求真实运行画面） |

## 二、工程坑（前端/构建/媒体）

1. **MSYS 路径转换（T8 根因一）**：Git Bash 会把"路径形态"的环境变量（如 `VITE_BASE=/guangchang/`）自动改写成 `C:/Program Files/Git/guangchang/`。**凡是给构建传配置，用非路径令牌**（`VITE_BASE_TOKEN=ghpages`），在 vite.config 里映射。
2. **vite base 与资产路径（T8 根因二）**：`useGLTF('/assets/...')` 这类硬编码绝对路径不吃 base——必须经 `engine/asset.ts` 的 `assetUrl()` 拼 `import.meta.env.BASE_URL`；drei 的模块级 `preload` 若 404 会在启动时抛错**挂掉整个应用**。
3. **aholo-viewer worker**：与 Vite 依赖预打包不兼容（splat-worker 丢失）→ `optimizeDeps.exclude: ['@manycore/aholo-viewer']`。
4. **Draco 解码器**：走 jsdelivr（国内实测可达），不放本地（vendor 文件会被安全扫描误拦 SSRF）。
5. **three.js 版本**：0.169 的 examples/jsm 是裸导入 `three`——浏览器直用必须配 import map。
6. **ffmpeg**：帧序列宽必须是偶数（yuv420p 限制，奇数宽报 "external library" 错）；三输入 concat 滤镜图要统一帧率——**三步分段编码 + concat demuxer 最稳**。
7. **GLB 动画检查**：判断动画是否带根位移，别硬解析二进制——直接用官方参数重制（animateInPlace）最省事。
8. **Mimosa 安全约束**：外联下载脚本必须带 URL 白名单+私网/环回地址拦截；key 一律走 `.env`（勿硬编码，扫描会拦写入）；第三方代码放项目外（防扫描拦截 push）。
9. **egolite**：窗口最小化时截图会失败——`tools/restore-ego.ps1` 恢复；`selectOption` 不支持 label 参数，React 受控组件用 evaluate 派发 change 事件兜底；升级后任务空间会丢，登录态（cookie）在 profile 里不受影响。

## 三、部署铁律（每条都是事故换来的）

1. **受限资产禁止放 `web/public/`（构建输入）**——只删 dist 产物治标不治本，重建就会复漏（T7：InteriorGS PLY 二次泄露）。
2. **重新部署前检查 dist**：无 `*.ply`、index.html 的 src 路径含正确子前缀。
3. **部署后必须完整启动验收**（对着线上，不是本地）：DOM 挂载（root 有子节点）+ canvas 存在 + Runtime 零异常。**curl 200 ≠ 应用能跑**（T8 教训）。
4. 本地 dev 验证不出的坑：base 路径类问题（本地 base 是 `/`）——涉及部署配置的改动，验收必须在线上做。
5. 私有仓库 GitHub Pages 需要 Pro；公开仓库免费（本项目已转公开，源代码本就是加分提交项）。

## 四、事故档案（详见 docs/adversarial-review.md 附录）

- **T7**：受限资产二次泄露（数分钟窗口）——根源修复+404 验证；教训→铁律 1
- **T8**：线上白屏（MSYS 路径转换 + 资产路径不吃 base）——双根源修复+线上复验；教训→铁律 2/3/4

## 五、工作流纪律

- **实测先查** `docs/w1-api-test-checklist.md`（避免重复烧钱烧时间）；结论回写同文件 §6
- **每次生成必存档**（`docs/iterations/`：prompt+参数+成败都要，失败是报告书的好素材）
- **视觉验收用实拍**（本地 viewer + egolite 截图），不靠"构建通过"自我安慰；审美类改动前后各拍一轮对比
- **commit 勿用 -q**（会吞掉安全 hook 的拦截信息）；推送被拦先读 hook 输出再改，不硬闯
- 单人+Agent 协作模式：睡前可交办自主推进，醒来看汇总报告决策（待用户决策项单独列）

## 六、关键资产位置速查

| 资产 | 位置 |
|---|---|
| 迭代存档（含全部 prompt/成败记录） | `docs/iterations/`（大文件留本地，meta/截图入库） |
| 实拍验收截图 | `docs/iterations/app-acceptance/` |
| Demo 视频工程（帧序列+卡片+成品） | `docs/video/`（mp4 已部署线上） |
| InteriorGS 真实扫描办公室（受限，勿公开） | `assets/interiorgs-0024/`（gitignored） |
| Lux3D 官方 skill 仓库 | `C:\Users\dqy\tools\Aholo-Lux3D\`（项目外） |
| API key | `.env`（gitignored；`LUX3D_CN_API_KEY` 与 `AHOLO_API_KEY` 同值） |
| 生成/部署脚本 | `tools/gen_*.py`、`tools/make_video*.py`、`tools/restore-ego.ps1` |
