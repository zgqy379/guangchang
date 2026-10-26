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
6. **任何运行时第三方 CDN 依赖都要自托管**（T12）：Draco 解码器走 jsDelivr，本地 dev 有缓存看不出来，线上 `draco_wasm_wrapper.js` 直接 `ERR_CONNECTION_CLOSED` → 所有 Draco GLB（玩家/HR/钞票）解析失败、画布全黑。**"我这边能打开"不是验收**，要用新 profile/无缓存 + 真机。
7. **受限资产连"入口"都不能出现在公开构建里**（T12b）：InteriorGS 的 PLY 早已移出 `web/public/`，但办公室下拉框仍用 `!VITE_PUBLIC_DEPLOY` 判断，而构建从没设过这个变量——公开站点照样列出"真实扫描办公室（InteriorGS 0024 · PLY 57MB）"选项。改为 `import.meta.env.DEV`：只有本地 dev 才出现。同理，受限数据集的**截图**也不能进公开仓库（`docs/iterations/**/*interiorgs*` 已加进 .gitignore）。

## 四、事故档案（详见 docs/adversarial-review.md 附录）

- **T7**：受限资产二次泄露（数分钟窗口）——根源修复+404 验证；教训→铁律 1
- **T8**：线上白屏（MSYS 路径转换 + 资产路径不吃 base）——双根源修复+线上复验；教训→铁律 2/3/4
- **T12 "线上 3D 全黑 + 受限入口泄露"（10.26 合规审计发现）**：真实浏览器打开线上 Demo，画布黑屏、控制台 `ERR_CONNECTION_CLOSED` + `Uncaught (in promise)`（`_initDecoder`）。根因一：四处 `DRACO_PATH` 硬编码 jsDelivr，解码器包装文件拉不到 → 所有 Draco GLB 解析失败（本地 dev 因缓存而看不出来）。根因二：办公室下拉框的受限资产判断用 `!VITE_PUBLIC_DEPLOY`，而该变量从未在构建中设置 → 公开站点仍列出 InteriorGS 选项。修复：Draco 自托管到 `web/public/draco/`（`assetUrl('/draco/')`）、判断改 `import.meta.env.DEV`、受限截图移出公开仓库并加 .gitignore、新增 `THIRD_PARTY_NOTICES.md`。复验：线上 `draco/*.js|wasm` 200、控制台零报错、逛一家/街区/办公室三模式均渲染。**教训→铁律 6/7**
- **T9 "街区黑屏"**：初进街区全黑。排查弯路：怀疑渲染管线/ack/资源——**真相是初始相机 [13,4.5,9] 落在 lot0 办公楼包围盒内部**（黑盒内部特写=全黑），用户一句"点一下鼠标走出来就有画面"破案。双重教训：①**相机初始位必须对场景所有建筑包围盒做相交验证**（现采用两段式：初始鸟瞰全景 (0,34,26)→首次交互后第三人称跟随）；②**用户的一次真实观察胜过 Agent 的十轮工具推理**——早问用户能省一半排查时间。诊断工具链留存：场景图 dump（Canvas onCreated 挂 `window.__st`）+ 逐组件隐藏二分 + 包围球统计

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

## 七、街区版新增沉淀（10.25-10.26 第二轮）

### 7.1 场景/渲染

| 事项 | 结论 |
|---|---|
| 相机两段式 | 初始鸟瞰全景 `(0,34,26)+lookAt(0,0,0)` → 首次交互（点地面/导航柱）后启用跟随相机——既避免初始机位落进建筑，又自带"俯冲入场"运镜；**spawn 必须与跟随参考位一致**（曾出现 prop 与 ref 不一致导致跟随错位） |
| InstancedMesh 山体 | 每帧写矩阵的生长动画与逐实例旋转抖动可共存；**`ceil(sqrt(N))` 式布局有数学陷阱**（`ceil(sqrt(N))²≥N` 恒成立→任何量都只堆一层）——层数换算要用**固定层容量**（3×3=9），金额差才变成高度差 |
| 纸币质感 | canvas 生成贴图（纹样+¥+字样）+ `map`+`emissiveMap` 同图 + 逐实例 ±1.5° 旋转抖动，41MB→2MB 级后仍有"成捆钞票"读感 |
| 大屏 VideoTexture | `document.createElement('video')` 不进 DOM 也可作纹理源（muted+playsInline+loop）；egolite 环境渲染不了（见 7.3），真实浏览器正常 |
| 挂载安全 | **任何会在挂载后被对齐/缩放的 GLB 组件，加载期必须有用 Suspense 包裹的占位**；近景 LOD（18/26m 滞回切换）兼顾性能与观感 |

### 7.2 批量生成脚本（gen_v2_batch.py 模式）

1. **先 `mkdir` 再写文件**——首轮因此报废 3 次文生（各 ~90s API 配额）
2. **失败任务的 taskId 落盘后可恢复**：重查 query_task_status 拿产物 URL，不必重新生成（省 76-108s/次）
3. meta.json 的 upload 步骤**必须把 url 存下来**（只存 bytes 会导致补跑时重新上传）
4. provider status=4 偶发：生成/绑骨/重定向全链路每步 3 次重试 + 8s 退避；仍失败的单独补跑脚本（gen_hr_rig_retry.py 从本地 raw GLB 重传）
5. 纹理压缩加 `--texture-size 1024`（默认 2048 的 9 个 GLB 会把显存吃穿）

### 7.3 egolite 边界（重要）

- **egolite 渲染不了街区级 WebGL 场景**（2136 draw call）：canvas 出黑帧、页面 rAF 假活（fps 数字是页面级不是 canvas 级）、零 console 报错、context 未丢失——**误判为"渲染 bug"排查了数轮**。街区块验收/录屏改用：用户浏览器（实测正常）/ headless Edge（注意其 WebGL 截图受虚拟时间限制，不可靠）/ 相机修复后 egolite 重试
- egolite 被用户接管时（`Control of this task space is with the user`）命令全部暂停——**测试前先确认用户没在用**；任务空间会被回收，脚本要能新建空间自愈
- CDP screencast "只捕 1 帧" 的红鲱鱼：不是 ack 问题——是黑相机视图没有画面变化，CDP 按损伤发送自然只有 1 帧。**相机修好后同款代码 270 帧正常**

### 7.4 ModelScope 创空间部署

- git http 推送对 SDK 令牌一律 Access denied（写权限令牌也不行）——**正确通道 = modelscope Python SDK**：`HubApi.login(token)` + `upload_folder(repo_id, repo_type='studio', folder_path)`（pip install modelscope）
- 令牌要用**"写权限令牌"**类型（新建访问令牌下拉选择）；API 建令牌：POST `/api/v1/users/tokens` body=`{TokenName}`（需页面 cookie）；令牌明文在 `/api/v1/users/tokens/list` 可读
- static 空间经 `<user>-<space>.ms.show` **根域名** iframe 托管——vite base 必须是 `/`（按 `/studios/...` 前缀构建会白屏）
- **LFS 黑屏（2026-10-26 实测）**：SDK 默认把 >64KB 文件走 Git LFS；ms.show 静态托管**直接返回 LFS pointer（132 字节）**，主 JS 变 pointer → 两个浏览器都黑屏（GitHub Pages 同构建正常）。修复：上传前 set `MODELSCOPE_UPLOAD_LFS_FORCE_THRESHOLD=524288000`（500MB）+ `MODELSCOPE_UPLOAD_COMMIT_MAX_INLINE_BYTES=67108864`，上传报告必须是 `Normal committed 27 / LFS 0`；再点一次重新部署。验证：`curl ms.show/assets/index-*.js` 应是 1MB 级 JS，不是 `version https://git-lfs...`
- 文件更新后需 UI"重新部署→确认部署"才生效；状态轮询 `GET /api/v1/studio/{owner}/{name}/status`
- **E1020 大批次 commit 超时（2026-10-26 实测）**：`COMMIT_MAX_INLINE_BYTES=64MB` 时 31 文件/65MB 会合成 1-2 个大批次，魔搭服务端对超大批次 commit 一律 `Connection aborted / write timed out`（重试 5 次仍挂，且"瞬时故障"重跑也过不去）。修复：把 `MODELSCOPE_UPLOAD_COMMIT_MAX_INLINE_BYTES` 降到 **12MB**，同样 31 文件拆成 6 批，44.7s 全部 committed。经验：上传卡 E1020 先怀疑批次太大，不要干等重试
- **ms.show 直连会被弹回门户（2026-10-26 实测）**：浏览器顶层访问 `<user>-<space>.ms.show/` 会 302 回 `modelscope.cn/studios/...?mode=full`，应用实际跑在门户页 iframe 里（src 带**一次性 studio_token**，取自 iframe 属性后顶层直连也无效——token 绑定嵌入上下文）。线上验收正确姿势：打开门户 `?mode=full` 截图看 iframe 实况（GLB 角色渲染=Draco 链路通）；纯 `curl` 无 UA 会被 WAF 403，须带浏览器 UA
- 重部署 cookies 不必现导现用：egolite 配置文件自带魔搭登录态时，直接在 egolite 里 goto settings 页点"重新部署→确认部署"即可（`C:/Users/dqy/AppData/Local/Temp/ms-cookies.json` 被清理后照样能跑）

### 7.5 多 Agent 协作纪律

- **同一工作区禁止两个 Agent 会话同时运行**（本会话与另一会话在 StreetScene.tsx 上冲突三次、git stash 还把对方未提交工作一并卷走）——一个窗口收尾后再开下一个
- 跨会话交接靠两层：仓库文档（本文件）+ Agent 记忆（`~/.zcode/cli/memories/`，含未入档的调试线索）
- 设计评审用**独立盲审 Agent**（只看截图不知实现），上线门禁 ≥7/10；规格必须绑定截图证据

### 7.6 街区第二轮事故与修复（2026-10-26 晚）

> 本轮把"看起来能跑"的街区从截图层面拆开验收，发现多个**根因级**问题；均已修复或明确降级。

| 事故 | 根因 | 修复/处置 |
|---|---|---|
| **T10 HR 近景消失 / T-pose** | ① 街角摊位（起点 10m）与相邻街办公体块包围盒穿插（lot0 整个人在制造区办公楼里）；② **HR 自带 idle clip 是 T-pose**（模型本身直立；原以为是轴向/横躺） | 布局 `START_ALONG 10→14`、`SLOT_GAP 4.2→3.6`；隔离验证后用**玩家 Avatar 的 idle clip**驱动 HR 克隆（同为 52 根 Mixamo 骨），`NEAR=18` 恢复，近景真模验收通过；占位仅远距/加载回退 |
| T10 诊断方法 | 只看截图无法区分"没渲染/被遮挡/在墙里" | Canvas onCreated 挂 `window.__st/__cam` → 遍历 SkinnedMesh 投影到屏幕 → 强制红/绿材质 + `depthTest=false` → 逐层隐藏后方体块；**用户的一条"点一下走出来"式观察仍是最快线索** |
| **T11 窗面"涂鸦噪点"** | 办公楼窗、玻璃幕墙、门、LED 多层共面 z-fighting；远看像贴图损坏 | 拉开 z 层级（玻璃 2.66 / LED 2.70 / 灯带 2.74 / 窗 2.78 / 门 2.82 / 入口 2.86）+ 窗改 `MeshBasicMaterial` |
| **牌坊立柱立在路中** | `ArchWay` 旋转写反（顺街而非跨街） | `axisX ? Math.PI/2 : 0`，跨街 + 区色信标 |
| **64 盏路灯不生效** | InstancedMesh 矩阵写在 `useMemo`（首次 ref 为空，永不重跑） | 改 `useLayoutEffect`；加地面暖光池（假光，不增点光源） |
| **目标摊位被玩家挡住** | 越肩跟随的镜头/玩家/目标共线；名片挂在屏幕但 HR 在身后 | 新增 focus camera：靠近摊位且静止 → 3/4 侧前方 6m 特写（候选机位按"道路廊道"评分选边）；行走时回越肩 |
| 名片近景过大/出屏 | 3D `Html distanceFactor` 随距离放大，不适合交互卡 | 改屏幕停靠 DOM 卡（左下），世界层用地面光环锁定摊位 |
| 窗面/材质暗到消失 | 纯 meshStandardMaterial + 深色 + 局部光斑 | 3D 颜色接设计令牌；占位 HR 用可读色池；近摊位补光（灯放摊位正面而非 HR 中心） |

**盲审进展**：经过三轮独立盲审（只给截图），从视觉 6.5/空间 5.0 提升到视觉 6.7/空间 6.1；未达 8。剩余高性价比项：暗立面占比、3D 参数可视化（参数碑）、投递 3D 动效力度。**不要把"盲审没过 8"当成功能不可用**——它意味着商业级视觉还差一轮美术。

**工程纪律补充**：
1. 任何"新增摊位/建筑"改动先跑包围盒相交自检（或至少用鸟瞰+近景两张截图看穿模）
2. 生成资产（尤其 GLB）必须**近景实拍验收**，不能只信"加载成功"和远处截图；**先确认自带动画 clip 不是 T-pose**，同骨架可借用已验收的 clip
3. 隔离诊断页（?hrdebug=1 并排原始/克隆/换 clip/对照）比在完整街区里猜快得多；验证完即删，避免打包
4. 交互卡、导航标签不要用 3D `distanceFactor` 缩放；世界锚定用光环/信标，信息放屏幕
5. 设计令牌接入后，3D 颜色不要再写死 hex；新增颜色先加 `design/tokens.json` 再 `npm run tokens`

### 7.7 视频/HUD 第三轮（2026-10-26 13:xx）

- **切模式 HUD 清零**：`delivered/visited` 原本是 `StreetScene` 局部 state，进办公室/对比页会卸载重挂 → 进度归零。改为初始化读 `localStorage['gc-street-progress-v1']` + 变更时写回；实测投递后切办公室再回街区，15/50 XP 与投递数保留。演示/游戏类进度不要只放在会被卸载的 3D 页面里
- **真 HR 出现太晚**：`NEAR=18` 要等相机非常近才开始加载 GLB，走近的 1-2 秒仍是灰胶囊占位。放宽 `NEAR=26/FAR=34`，并在 `follow=true`（落地漫游）时 `useGLTF.preload` 9 个 HR GLB + 玩家 idle clip；共用 URL 只加载一次
- **egolite 最小化窗口**：`page.screenshot()` 报 "Cannot capture a screenshot while the window is minimized"，但 `Page.startScreencast` 仍能出帧（录屏不受影响）；要截图先跑 `tools/restore-ego.ps1`
- **screencast 帧率不是常数**：同一段代码，静态画面 5fps、复杂画面 8-17fps；直接按 12fps 编码会忽快忽慢。必须逐帧记录 `Page.screencastFrame` 的 `metadata.timestamp`，按真实时间重采样到固定 fps（`tools/resample_video.py`），加载遮罩用时间区间剪掉
- **3DGS 办公室取景**：房间类 splat 机位放在包围盒外只能看到扫描外壳（一团糊墙）；移到室内又容易怼在家具/植物上。当前 `office-promptonly.spz` 扫描质量有限，**视频不剪办公室段落**，报告图也不要再用那张糊墙截图，等换资产/裁剪方案后再上

### 7.8 街区美术收尾（2026-10-26 下午）

- **立面**：`facadeTexture(floors)` 程序化夜景窗格（512²，按楼层数缓存 4 张），用 `boxGeometry` 六个 `attach="material-N"`（四侧贴图 + 顶/底暗色）替换原先每摊 8 片纯色窗——鸟瞰侧墙不再是大黑块，也少 7 个 draw call/摊。夜间窗格用 `MeshBasicMaterial toneMapped={false}`，避免被 ACES 压暗
- **摊位可识别**：加雨棚（四柱+棚顶+棚下行业色面光）与侧招立柱；投递后棚下变绿 + "✓ 已投递" 浮标，投递在 3D 世界有痕迹
- **特写机位与雨棚冲突**：棚顶 y=2.36，特写机位若 `p.y+2.8` 会从棚顶往下看被挡；改人眼高度 `p.y+1.85`，并在 `refs.focus && !moving` 时把玩家 `visible=false`（移动立即恢复），否则玩家后背永远挡 HR
- **路面路牌**：四区名字画进道路（`districtSignTexture`，地面 y=0.026、`depthWrite=false`），配合细引导带（0.16m）比 0.8m 发光带干净
- **录像合成目录必须先清空**：`frames_cap_v8/` 残留上一轮帧会让片尾卡被顶掉（视频时长对不上）；渲染前删除 `f_*.jpg`
- **盲审分数因评审而异**：同一批截图三位评审给 6.5/6.1、6.0/6.0、5.5/4.5；共性问题是灯光电影感/摊位识别/地图导航。不要把单一分数当成硬指标，按共性清单逐项收

## 八、UI 层重构（2026-10-26 · 厂玻璃 v3）

### 8.1 本轮产出

| 产物 | 路径 | 说明 |
|---|---|---|
| 设计规格 | `docs/design/ui-system-v3.md` | IA / 导航 / 流程 / 视觉 / 组件 / 响应式 / 可访问性 / 落地清单 |
| 可交互原型 | `docs/design/prototype/gc-glass-v3.html` | 纯静态零依赖，双击打开；含桌面/平板/手机三档预览 |
| 令牌补丁 | `docs/design/prototype/tokens-glass-v3.json` | 可直接并入 `web/design/tokens.json` |

### 8.2 视觉方向：亮玻璃压在暗夜街区

- **决策**：UI 从"深色实心块"改为**亮色液态玻璃 + 深墨字**（`rgba(255,255,255,.82→.60)` + `backdrop-filter: blur(28px) saturate(180%)` + 1px 内高光 + 双层阴影）。夜景街区上亮玻璃天然成为视觉焦点，对比度从"勉强"提到"优秀"——这是本轮最大的视觉杠杆
- **玻璃厚度不靠更透明获得**，靠 模糊 + 内高光 + 双层阴影三者叠加，这是浏览器里做出可信玻璃的最小成本组合
- **配色硬约束（必须进 code review checklist）**：实心红按钮**必须** `#C23A2B`（5.41:1）——`#FF5A3C` 配白字仅 3.10:1 不达 AA；行业色**禁止**承载白字（互联网蓝配白字仅 2.76:1）；金色文字用 `#B8860B`（配浅玻璃），`#FFD24A` 只作进度条填充
- **场景自适应**：天空随下班时间变（黄昏↔深夜），玻璃需 `data-scene-tone` 三态（dark/dusk/light），明亮室内切深玻璃变体——阈值取自天空组件实际曝光参数，不另设魔法数

### 8.3 信息架构：把"演示形态"从"产品导航"里拆出来

- 顶栏原本把「逛一家 / A-B 对比 / 办公室漫游 / 招聘街区」四个 **Demo 形态**平级并置 → 观众分不清"我在哪个世界"。新方案顶栏只留产品级导航（招聘街区/对比/我的），形态切换收进右下**折叠式演示控制台**并标注"正式版将移除"
- **浮层职责互斥**：HUD 只答"我的进度如何"、名片卡只答"这一家怎么样"、导航器只答"我在哪+怎么过去"——三者信息不得重复（旧版 HUD 与名片同时显示行业标签）
- **术语统一**：旧版"收藏/对比篮/A-B 对比"三指一事 → 全站统一为**对比篮**
- **反馈收敛**：旧版一次投递 4 处反馈（toast+XP+绿章+摊位光）→ 改为 **1 主反馈（按钮态+绿章）+ 1 辅助（toast/XP）+ 1 世界反馈（场景层）**，UI 层只剩 2 处

### 8.4 三条布局铁律（原型实测得出，不跑真渲染必踩）

1. **同侧浮层必须共用一个 flex 栈**：齿轮与导航器各自 `position:fixed; right:12px` 时齿轮直接压在导航器面板上。改 `.nav-stack{display:flex;flex-direction:column;align-items:flex-end;gap:10px}` 包裹两者即彻底消除。**右下浮层会增长，不能靠各自 fixed 偏移手工避让**
2. **移动端 HUD 与名片卡必须垂直分区**：二者都贴底时 HUD 计数行被名片卡盖住（390px 实测 HUD 底 712px > 卡顶）。解法：HUD 上移为顶栏下方**横向胶囊条**（等级+XP+三计数一行），名片卡独占底部
3. **SVG 罗盘文字会被 viewBox 裁切**：区名放 `x=8`/`x=123` 时 `getBBox()` 超界即裁。标签内收到安全区（`x=19`/`x=113`），外圈半径 58→50 留文字空间

### 8.5 本机浏览器验证配方（与 egolite 互补）

- **Playwright 直接驱动系统 Chrome 可用**（绕过缺失的 headless shell）：
  `require('C:/Users/dqy/.workbuddy/binaries/node/workspace/node_modules/playwright')` + `chromium.launch({channel:'chrome'})`
- Windows 下 **ESM 导入需 `file://` URL**（`import ... from 'C:/...'` 报 `ERR_UNSUPPORTED_ESM_URL_SCHEME`）→ 用 CommonJS `.cjs`
- **纯 UI 原型用 `file://` 直接打开**即可，不需起服务器（后台服务器随命令结束被回收）
- **布局验证要量化而非目测**：`getBoundingClientRect()` 求交判定重叠 + `getBBox()` 查 SVG 越界 + `scrollWidth > innerWidth` 查横向溢出 + 遍历 button 量触控尺寸——这四项能自动抓出肉眼难察的问题

