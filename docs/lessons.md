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

## 九、玻璃数字孪生重构（2026-10-26 · v4 风格转向）

> 决策：3D 街区美术风格定为**玻璃数字孪生**，主题**白天浅色为主**，按**系统时间**自动切换夜间深色。
> 规格：`docs/design/twin-style-spec-v4.md`（含实施结果附录 C）。距提交 11.19 约 24 天。

### 9.1 语义分离：环境时间 vs 参数时间

- **环境时间**（系统时钟）→ 天色、太阳/月亮、环境光、UI 主题（"现在几点"）
- **参数时间**（公司 `offworkTime`）→ 该公司门前的下班光效（"这家几点下班"）
- **旧版把两者混在一起**：`sky.ts` 的天色由 `offworkHour` 驱动，滑杆一动就改天色 → 语义混乱
- 改造后拖动下班时间滑杆**不改变天色**，两套语义彻底解耦

### 9.2 真实天文太阳位置（低成本高说服力）

- 用 NOAA/SunCalc 简化式算太阳位置（赤纬/时角/高度角/方位角），纬度取 31.23°、经度 120°
- **实测精度**：夏至正午 82.2°（理论 82.2°）、冬至 35.3°（理论 35.3°）、春分 58.2°（理论 58.3°）
- **踩坑**：真太阳时公式里 `solarTime` 已含经度时差修正，**不可再叠加 `4×longitude`**（重复修正会让正午时角变成 +120°，正午太阳跑到地下）
- 价值：场景从"随手设的角度"变成"某个具体时刻的某个具体地方"——这是全网案例的共同结论

### 9.3 UI 玻璃必须随场景反相（新增关键约束）

| 主题 | UI 玻璃 | 文字 | 合成底色 |
|---|---|---|---|
| 夜间（深场景） | 亮玻璃 `rgba(255,255,255,.72)` | 深墨 `#0b0e1a` | rgb(188,189,192) |
| 白天（浅场景） | 深玻璃 `rgba(11,14,26,.72)` | 浅色 `#e6edf3` | rgb(63,67,79) |

- **原 UI v3 方案的"亮玻璃需要深背景"前提，在白天浅色场景下会翻转**——这是风格转向带来的连锁影响，必须显式处理
- **半透明玻璃的对比度不能按纯白/纯黑算**：玻璃会透出 3D 场景，真实底色是合成结果
- 修正后的三级色阶（实测）：夜间 10.24 / 5.49 / 4.60:1，白天 8.36 / 5.45 / 5.11:1，全部 ≥ AA
- **已沉淀脚本 `tools/check-contrast.mjs`**——改色后直接跑，避免"以为达标其实不达标"

### 9.4 Style Dictionary v5 自定义 transform 的坑

- **症状**：注册 `shadow` 类型 transform 后，**所有 number 令牌变成 `"none"`**（`game.xp.*` 全废），HUD 显示 `Lv.NaN`
- **根因**：`match: token => token.$type === 'shadow'` + `transitive: true` 时，transform 会被套用到不匹配的令牌上；v5 要求用 `filter` 精确限定
- **修复**：① transform 改用 `filter`；② `tokens.config.mjs` 末尾加**构建后自检**——遍历所有 number 令牌，类型不对就 `process.exit(1)`，坏构建直接失败而不是静默上线
- **v5 API 差异**：`transforms: [...]` 传内联对象会报 `Unknown transform "[object Object]"`；必须用 `StyleDictionary.registerTransform({...})` 静态注册 + 传名称字符串
- 现有类型集只有 color / dimension / duration / number——**加 `shadow` 前必须先注册转换**（UI v3 §12 L2 风险点在此确认并修复）

### 9.5 主题化改造的实操顺序（有效）

1. 令牌层（`tokens.json` + `npm run tokens`）→ 2. 引擎层（`theme.ts` / `sunPosition.ts`）→ 3. 天空与光照 → 4. 材质双模式（`facadeTexture(floors, mode)` / `glassTexture(mode)`）→ 5. UI 反相 → 6. 实拍验证

- **关键技巧**：材质贴图**不重做资产**，而是**同一个函数加 mode 分支**（缓存 key 也要带 mode）——"玻璃数字孪生"风格恰好让这一点成立：半透明玻璃体在白天/夜晚的差别，远小于深色夜景贴图
- 深色材质硬编码要全部扫一遍（`grep 'color="#[0-9a-f]\{6\}"'`）：雨棚/桌布/坡屋顶/门框都是写死的深色，白天会变成突兀黑块
- 白天要**拉开明度层次**：地面更深、建筑更亮、线框可见、网格地面，否则会"灰平"（都在 90–190 明度区间挤在一起）

### 9.6 待完成（下一轮）

- 孪生数据体（参数以发光体块悬浮在建筑内）、实体头剪影差异化、办公室 3DGS 孪生叠加层、湿地面反射、独立盲审、双端部署

---

## 十、双角色体系设计轮的沉淀（2026-10-27 · UI 设计全栈专家团）

> 本轮 = 三阶段规格（视觉 / 流程 / 工程）+ 总纲 `docs/design/role-flow-master-v1.md`。
> 本节只记**可复用的坑与判定方法**，方案细节看总纲。

### 10.1 半透明浮层的对比度，必须按「最坏背景」验算

- **背景**：v4 twin 把 UI 玻璃在浅色主题反相成深玻璃 `rgba(11,14,26,.72)`，Phase 1 v1.0 报告"全站次级文字不达标"，v1.2 又自我更正为"已达标"
- **主理人两轮验算后定论**：**两次都不完整**——关键在于**玻璃是半透明的，背景是变量**。用单一背景算会漏掉真实缺陷
- **实际生效的令牌**（`web/src/styles.css:30-66`，不是设计文档里的历史值）：
  - 夜间：白玻璃 `.72` + `#0b0e1a` / `#39414d` / `#454c59`
  - 白天：深玻璃 `.72` + `#e6edf3` / `#b7c2cc` / `#b0bcc8`
- **按最坏背景验算的结论**：
  - **夜间主题全部达标**（最亮背景 skyHorizon 下 secondary 5.77 / muted 4.84）
  - **白天主题 3/6 背景不达标**——最亮的天幕 `skyHorizon #f4f8fb` 下合成底 `#4C5059` → secondary **4.48 ❌**、muted **4.20 ❌**；skyMid 下 muted 4.41 ❌；glassBody 下 muted 4.50 ❌（临界）
- **根因**：`.72` 透明度不足以在**最亮背景**上保证文字可读。玻璃越透明、场景越亮，越吃亏
- **修复**：**全站垫实底**——`--ui-glass-underlay`（浅 `rgba(11,14,26,.86)` → 合成 `#2B2F3A`；深 `rgba(255,255,255,.86)` → 合成 `#DEE0E4`）+ 保留 `--ui-glass-fill` 渐变面。修正后最坏背景下 secondary 7.39 / muted 6.92（白天）、7.80 / 6.54（夜间）
- **工程约束**：`--ui-glass-fill` 语义不动，**另起新变量**；`background-color` 必须写在 `background` 之后才压得住渐变
- **连带规则**：玻璃卡片内禁用 muted 色
- **验收**：按**最坏背景**取色复核（浅色主题压 skyHorizon、夜间主题压 skyTop），不是随便找个位置看
- **元教训**：① **设计文档与代码不同步时，文档里的数字是陷阱** ② **成员自我更正比首次结论更可信**——发现对方自我更正要立刻复核并回写，别让错误结论沉淀进文档

### 10.2 模块级 `useGLTF.preload` 是首屏体积的隐形杀手

- **实测**：首屏实际拉取 **5.62MB**（主 chunk 307KB gzip + `avatar-idle.glb` 3.08MB + `gc-bill-bundle.glb` 2.23MB），**超 5MB 红线 12.4%**
- **根因**：**3 处**模块级 preload —— `AvatarActor.tsx:183`、`AssetProp.tsx:45`、`HRStand.tsx:39-40`（后者一次性预载 9 个 HR GLB = 16MB）
- **机制**：`useGLTF.preload` 在**模块 import 时**执行 → 只要该模块进了首屏 chunk，资产就会被拉
- **修复**：删掉模块级 preload，改组件内 `useGLTF` 懒加载 → 首屏降到 **≈0.35MB**（进一步拆 three chunk 可到 ≈0.07MB）
- **两级台阶**：① 删 `AvatarActor.tsx:183` + `AssetProp.tsx:45` 两行 → 首屏 ≈0.35MB（**零风险，2 行代码**）② 再改 `HRStand.tsx:39-40` + three 拆独立 chunk → ≈0.07MB（需 `App.tsx` 的 `Scene` 抽出，**不额外花工时**——它在 M1 里本来就要做）
- **配套铁律**：**每个 `<Canvas>` 归属唯一场景**；禁止在 `main.tsx`/`App.tsx` 顶层 import 3D 组件
- **附带**：死资产要清——`public/assets/money/gold-coins.glb`（1.45MB）在 `src/` 中零引用

### 10.3 排期表必须做算术自检

- **症状**：Phase 3 排期表天数列合计 21.5 天，但工时列合计 156 人时（按 6h/人日 = **26 人日**）——**差 27 人时**，而结论写的是"21.5 天，留 3 天缓冲"
- **教训**：**排期表的"合计"必须能被表内数字反推出来**。跨阶段交接时最容易漏掉这一步——两阶段各自估的天数加起来未必等于总工期
- **做法**：表尾固定写「人时合计 → ÷6 → 人日 → vs 剩余工期」三行，让人能一眼验

### 10.4 事实错误 vs 没讲完，是两种不同性质的问题

- **案例**：报告书写"求职者以 3D 形象在十字路口漫游"，但公开 Demo 里玩家是**第三人称跟随视角**，求职者形象根本没进街区 → 这是**事实错误**，会被评审抓
- **判据**：文档说"已实现 X"→ 就要能指到代码与线上证据；说"规划 X"→ 只需讲清设计
- **动作**：交叉校对时优先查这一类

### 10.5 报告书里的"诚实降级"是加分项，不是功能缺失

- **背景**：浏览器端无后端 → "上传照片现场生成 3D"在纯静态 Demo 里做不到
- **裁定**：建立**生成通道 Channel 抽象**（`replay` / `local` / `live`），**等待态 UI 与数据源 100% 解耦**——将来接后端 UI 一行不改
- **诚实三规则**：① 「演示回放」chip 常驻不可隐藏 ② **剩余时间显示真实剩余**（不是压缩过的假数字）③ 结果页标注为回放产物
- **关键句**：**"被加速的是等待过程，不是生成结果"**——这句把降级变成了产品主张
- **通用教训**：一个主打"反画饼"的产品，**自己的 Demo 更不能画饼**。诚实降级在这个品类里是论据，不是扣分项

### 10.6 令牌命名的多词路径转换（已核实，无坑）

- **实测规则**：CSS 输出 **kebab-case**（`--color-scene-bill-red`）、mjs/d.mts 输出 **PascalCase**（`ColorSceneBillRed`），均由 style-dictionary 逐段转换，**不做内部连字符剥离**
- **结论**：`role.candidate.accent` → CSS `--role-candidate-accent`、mjs `RoleCandidateAccent`，**不会撞名**
- **用途**：省掉一次"多词路径会不会冲突"的空跑验证

### 10.7 隐私类功能必须用"不渲染"验，不能用"能显示"验

- 作品隐私三档（公开 / 仅 HR 可见 / 私密）中，**私密件的正确表现是不渲染**——不是灰显、不是占位图
- **验收方式**：截图核验"它不渲染"。用 DOM 查询或状态断言验不出"占位图还在"这类问题

### 10.8 首屏体积的真根因不是 preload，而是"首屏渲染了 3D"

- **现象**：删掉两处模块级 `useGLTF.preload` 后，实测首屏**仍然**拉 `gc-bill-bundle.glb` 2.23MB —— 因为 `App.tsx` 的 `mode` 初始值是 `'single'`，`<Scene>` 在首屏就渲染 → `CompanyPlot` → `AssetProp` → **渲染期** `useGLTF` 照样拉
- **关键区分**：`useGLTF.preload(url)` 在**模块 import 时**执行（首屏必拉）；`useGLTF(url)` 在**组件渲染时**执行（用到才拉）。两者都在 chunk 里留下字符串，但只有前者是首屏请求
- **结论**：**删 preload 是必要不充分条件**；真正让首屏归零的是"**首屏不挂任何 `<Canvas>`**"（角色选择门禁）
- **实测**：首屏 3D 资产 3 个 GLB → **0 个**；传输量 **8.49MB → 0.31MB**；canvas 数 1 → 0
- **判定命令**：`grep -rn "useGLTF.preload" web/src` → 结果必须全在函数体内（模块顶层即违规）

### 10.9 `focus()` 会滚动页面 —— 自动聚焦必须 preventScroll

- **现象**：角色门禁里 `buttonRef.current?.focus()` 导致移动端首屏被滚到 `scrollTop=463`，标题被推出视口（`rect.top = -439`），且滚不回来
- **根因**：`focus()` 默认把元素滚动到可视区；移动端首屏内容高于视口（两卡竖排 1275px > 844px）
- **修法**：`focus({ preventScroll: true })`；触屏（`<768px`）干脆不自动聚焦
- **通用教训**：**任何自动 focus 的代码都要考虑页面可滚动时的影响**，否则会制造"内容消失"且难以复现的怪 bug

### 10.10 flex 居中在内容超高时会把子元素推出视口上方

- **现象**：移动端内容 1275px > 视口 844px，`justify-content: flex-start` 单独用**不够** —— flex 的默认安全居中仍生效，子元素仍被推到视口外上方（top = -447），`overflow-y: auto` 也滚不回来
- **修法**：改用 `display: grid` + `place-items: center` + **`align-content: safe center`**（`safe` 关键字保证溢出时回退到起始对齐，可滚动到全部内容）
- **通用教训**：**"可滚动容器 + 居中"必须显式处理超高情形**，flex 与 grid 的默认行为都靠不住

### 10.11 CSS `background` 简写会重置 `background-color`

- **现象**：玻璃浮层垫实底写了 `background-color`，DevTools 显示 `bgColor=rgba(0,0,0,0)` —— 实底被静默清掉，对比度悄悄回落 4.48:1
- **根因**：CSS `background` 简写会重置 `background-color`。若 `background-color` 写在 `background` **之前**，会被后面的简写覆盖
- **铁律**：垫实底时 `background-color` 必须写在 `background` **之后**；或干脆只在独立文件里写 `background-color`（不重复写 `background` 简写）
- **验收**：用 DevTools 查计算样式确认 `background-color` 是实底色，不是 `rgba(0,0,0,0)`

### 10.12 全局元素样式会污染同名 class

- **现象**：`<header class="gc-role-gate__head">` 的标题与副标题被推到左右两端
- **根因**：全局 `styles.css` 的 `header { display: flex; justify-content: space-between; }` 命中了它
- **修法**：不要用语义标签承载纯布局，或给自定义 class 加显式 `display: block` 隔离
- **通用教训**：**新增组件时，先查全局样式表有没有同名元素选择器**（`header` / `footer` / `nav` / `p` / `span` 这类最危险）



---

## 十一、2026-10-27 视觉冲刺（polish9）新增经验

### 11.1 R3F 两颗潜伏雷：Canvas 内裸 `<div>` 与 data-* 属性（T13）

- **现象**：街区场景挂载即崩（`R3F: Div is not part of the THREE namespace` + `TypeError: Cannot read properties of undefined (reading 'work')`），ErrorBoundary 兜底成错误页
- **根因 1**：`CandidateBooth` 把裸 `<div style=...>` 直接写在 `<group>` 里——R3F 把 JSX 元素名当 THREE namespace 校验，DOM 元素必须走 drei `<Html>`
- **根因 2**：`WorkOrbit` 给 `<group>` 加了 `data-work-id` ——R3F 把 dashed key 当 pierce 路径 `['data','work','id']` 解析，`instance.data` 为 undefined 即崩
- **铁律**：Canvas 内只能渲染 THREE/drei 元素；DOM 用 `<Html>` 包；R3F 元素**永远不加 data-*/aria-* 属性**（标识用 React key 或实例字段）
- **事故面**：这两个雷随 4c774d9（01:46 候选人集成）进库，街区自那时起**从未成功渲染过**（typecheck 绿 ≠ 场景能渲染），直到 10-27 下午才被截图管线撞破

### 11.2 `material.vertexColors=true` + 无 color 顶点属性 = 纯黑（黑棚顶，M6b 起潜伏）

- **现象**：64 栋办公楼顶盖（cap）与棚顶在昼/夜景全是纯黑
- **根因**：`<meshStandardMaterial vertexColors />` 但 `BoxGeometry` 没有 `color` 顶点属性 → USE_COLOR 打开后 vColor 乘上未绑定 attribute（默认 0,0,0）→ 全黑；instanceColor 染色**不需要** vertexColors
- **定位法（红帽实验）**：运行时 `page.evaluate` 把嫌疑材质 `vertexColors=false` + `color=#ff0000`，截图看变不变红——三分钟内把「阴影/曝光/贴图/光照」四假设全部排除
- **修法**：删 vertexColors、保留 setColorAt（instanceColor 单独生效）；探针确认 instanceColor 实值一直是亮蓝（0.36,0.67,0.98）
- **通用教训**：给 InstancedMesh 上 instanceColor 时**不要顺手开 vertexColors**；看到"输入全对但渲染纯黑"先查 vertex/instance color 通道

### 11.3 「最新截图」与「最新代码」脱节五波（验收纪律）

- **事实**：`docs/figures/street-2026-10-27/` 的正式截图实际摄于 **10-26 20:08**（mtime 实测），而 M6b（23:19）/M6c（23:43）/湿反射（00:13）/0:35 批次/词典/候选人/画廊（01:03–01:56）五波提交全部发生在它之后——黑棚顶在这五波里**潜伏了两轮盲审周期**
- **铁律**：凡触碰街区渲染的提交，当轮必须重跑 `tools/shoot-street.cjs` 全套四图（它只要 90 秒），`git log` 里最近一次figures 时间戳早于最近一次渲染代码时间戳 = 视觉验收失效
- **连带坑**：`npm run build` 里 `tsc --noEmit && vite build`——tsc 失败时 **vite 不执行、dist 保持旧版**，截图管线照常出图（对着旧 bundle）；构建失败后必须看到新的 `✓ built` 再拍

### 11.4 egolite 边界复测结论（§7.3 的「相机修复后重试」兑现）

- **复测**：2026-10-27 用 `ego-browser nodejs` 跑 `tools/accept-street.mjs`：首屏 canvas=0 ✓ → 进街区 canvas=1、**draw calls 665**、零错误文本、截图完整非黑帧
- **结论**：§7.3 的「渲染不了」成立于 2136 draw call 时代；M6a/b/c 实例化（2136→611）之后 egolite 已能渲染街区。**诊断/验收通道回归 egolite 为主**；headed Chrome（playwright）管线保留用于 fps/draw call 实测与盲审截图（与历史基线同管线）
- **注意**：CLI 弹 onboarding ≠ 要重装——用桌面已初始化的实例（先开 ego lite 浏览器再跑 CLI）

### 11.5 玻璃墨色误用的扫描盲区（check-panel-ink 补课）

- **现象**：第二轮盲审两位评审同时点名「单人模式浅色主题滑杆标签近白压白底几乎不可读」
- **根因**：`forms/ParamForm.css` / `GcSlider.css` / `GcSelect.css` 用 `--ui-ink-*`（玻璃浮层专用墨色，浅色主题=浅灰）压在不透明面板上——**check-panel-ink.mjs 没扫 forms/ 目录**
- **修法**：表单墨色改 `--ui-page-fg` / `--ui-panel-fg-muted`（随主题反相的不透明面板专用色）
- **通用教训**：新增「不透明面板」组件时墨色只用 `--ui-page-fg` / `--ui-panel-fg-muted` / `--ui-panel-accent`；把 `forms/` 目录纳入 check-panel-ink 扫描范围

## 十二、2026-10-27 深夜（双端部署与指标可信度）新增经验

### 12.1 本地 preview 验 Pages 产物必须带同一个 base 令牌（T8 家族新成员）

- **现象**：`dist` 是 `VITE_BASE_TOKEN=ghpages` 构建（`index.html` 引 `/guangchang/assets/*`），直接 `npx vite preview` 起服务时页面**全空白、控制台零报错**，只有一条资源 404
- **根因**：vite 的 base 只在**构建期**烘进产物；`vite preview` 自己也要读 `VITE_BASE_TOKEN` 才把静态目录挂到 `/guangchang/` 下。不带令牌起预览 → 服务根路径，产物请求 `/guangchang/assets/*.js` 落到 SPA 回退页（返回 200 + 644B 的 index.html），模块解析失败但**没有任何红色报错**
- **铁律**：验 Pages 变体用 `VITE_BASE_TOKEN=ghpages npx vite preview --port NNNN` 并访问 `http://127.0.0.1:NNNN/guangchang/`；`--host 127.0.0.1` 必带（默认只监听 `::1`，浏览器按 IPv4 解析直接连不上，又一个"我这边能打开"陷阱）
- **踩坑实录**：同一轮里连撞三次（curl 200 却浏览器 404），最后一次才靠"页面内 `fetch` 同一 URL 返回 1MB 真内容 / `<script>` 加载返回 644B HTML"把嫌疑从"应用坏了"收窄到"取数姿势错了"

### 12.2 不可见页签把 fps 采成 1fps——历史"越肩 13–14fps"是测量污染

- **现象**：`tools/shoot-street.cjs` 记录的 polish9 指标是 hero 56.8fps / walk 14.5fps；同一构建静默复测得到 hero 83.3 / walk 45.5 / focus 44.2（白天）、hero 56.8 / walk 28.6 / focus 36.4（夜）。我另一次手测甚至拿到 **3fps**，再一轮拿到 `1fps`
- **根因**：headed Chrome 对**不可见/失焦页签**把 rAF 限流（实测可低到 ~1fps）。管线用 rAF 中位帧间隔算 fps，页签被遮挡时采样窗口整体劣化；三轮全被遮挡时中位数直接变成 1
- **判定证据**：`document.visibilityState === 'visible'` 与否是二分的——被遮挡时 `fpsRounds` 出现 `[1,1,1]`，置前后变成 `[41.2,41,38.3]`；同一机位三角面/draw call 完全一致，只有帧率跳变
- **修法（已落 `shoot-street.cjs`）**：① `measure()` 前 `page.bringToFront()`；② 采样从 3 轮加到 5 轮，**剔除中位帧间隔 >250ms 的限流轮次**，并在 JSON 里记 `throttledRounds`（不可信时能看出来）；③ 进街区后先用条件等待 `__gl.info.render.calls > 0` 等首帧，再等贴图/阴影稳定——固定 `waitForTimeout(4500)` 会在空帧上取数，产出 `DC=0 / fps=120.5`（屏幕刷新率）这种**看起来正常**的假指标
- **铁律**：任何 rAF 类指标（fps/帧间隔）都必须同时记账"页面可见性 + 限流轮次数"，否则不进报告。**"移动端 ≥45fps"这条红线目前仍未经真机证明**——桌面集显模拟 390×844 只到 41fps 量级，不等于中端手机

### 12.3 gh-pages 是第二个并发写通道；移动端导航器挂在 follow 态上

- **部署碰撞**：本轮 gh-pages 在 21:57（另一路）与 22:35（我，从基线 worktree 构建）之间被覆盖了两次，22:55 恢复到 `a98f2cb` 构建（`index-CiY9Bf6S.js`，与 21:57 同哈希）。**推之前必须重新 `git fetch` 并核对目标 HEAD**，不能拿会话开始时的 HEAD 快照；`gh-pages` 每次由源码整分支重建，覆盖无数据损失但有线上回退窗口
- **管线缺陷（非应用缺陷）**：`--mobile` 腿 `page.click('.gc-nav-toggle')` 超时。取证确认 390×844 下 `.nav-stack/.gc-nav-toggle/.lot-card-dock` **不在 DOM**，但 `.street-cta`（"点击地面开始逛"）在——因为 `GameMiniMap` 挂在 `{follow && ...}`（`StreetScene.tsx:1509`，两段式相机：首次交互后才出跟随态）。判别实验四种入口（CTA / 鼠标型 pointer / 触摸型 pointer / 原生 tap）全部能把 `follow` 打开，**应用移动端行为正确**
- **修法**：移动端腿在点圆钮前显式推进跟随态（点 `.street-cta` → `waitForSelector('.gc-nav-toggle')`），而不是假设它一定存在；两个都没有时大声失败
- **通用教训**：验收脚本"点了但没断言"是假通过的温床（同一条腿当时还报 `名片卡 = 0`、`!! 找不到投简历按钮` 却继续跑完）

---

## 十三、2026-10-29 街区验收与批次②视觉（egolite 实机取证）

### 13.1 离散采样窗口不足一帧 = "骨骼零变化"的假象（§12.2 的第二只鞋）

- **现象**：验收脚本两次采样玩家骨骼四元数，行走窗口（跨约 8 帧）读到 17–19 根骨骼变化，站定窗口（400ms）读到 **恰好 0.000**——一度被读成"IDLE 剪辑没播"
- **根因**：§12.2 已记"不可见页签把 fps 采成 1fps"。本次同一环境实测 `fps=3`（真实 AMD GPU，非软件渲染）。**1fps 下 400ms 不足一帧** → 两快照之间一帧都没渲染 → 骨骼当然一模一样
- **修法**：`tools/verify-street.mjs` 内置 fps 自检 + **采样窗口随 fps 自适应**（fps≥20 → 600ms，否则 2600ms）；结论必须同时给出 fps 与"采样期间玩家位移"，两者任一为 0 则该结论不成立
- **铁律**：离散量（骨骼四元数、帧间隔）不能用固定短窗口采样；**先量量具，再量被测物**

### 13.2 "缺资源"告警必须以加载完成为门槛

- **现象**：控制台报 `[AvatarActor] avatar-walk.glb 缺少动画剪辑 → WALK 不可用`，而实际该 GLB 带 `animation_1`（53 轨道、时长 1.33s），线上文件与本地同尺寸同哈希
- **根因**：walk.glb 是**惰性加载**（`WalkClipLoader`），组件挂载瞬间 `walkAnims` 必然为空；告警在加载完成前就触发 → 把"还没到"报成"没有"。实测时间戳：告警 t=12430ms，资产落地 t=12725ms，**早 295ms**
- **修法**：新增 `walkLoaded` 状态，只有"已回填且为空"才算缺失
- **通用教训**：**假告警比没有告警更坏**——它会让后续评审误判功能已坏（本轮就差点据此改报告口径）

### 13.3 世界锚定的 HTML 标签必须距离感知

- **现象**：drei `<Html>` 作品廊标签在鸟瞰时浮在远景屋顶上（看着像那一带的招牌）、特写时压在摊位名牌上方（空间指引自相矛盾，R16 评审 B 点名的真 bug）
- **根因**：`<Html position={...}>` 是**世界坐标锚点**，与相机距离无关；标签永远画在那个点的前面，不管前面挡着什么
- **修法**（`StreetScene.tsx` → `GalleryEntry`）：① 相机距入口 < 14m 才显示；② 聚焦摊位时让位给摊位自己的名牌；③ 入口立柱本体始终可见可点，标签只是提示
- **铁律**：任何世界锚定的 DOM 标签都必须有**距离可见性**与**互斥避让**；只做位移是治标

### 13.4 `vertexColors` 同根因复发：64 个远景人形全是黑剪影

- **现象**：远景占位 HR（`PlaceholderHRs`）的 4 个材质带 `vertexColors`，但几何体（capsule/sphere/box）**没有 color 顶点属性**
- **根因**：three.js 着色器 `vColor = vec3(1.0); vColor *= color;`——属性缺失时 WebGL 补 (0,0,0) → vColor 归零 → 纯黑。**与本仓库 T14「纯黑棚顶」完全同根因**（该文件里已把同样警告写在另外两个组件上，却漏了本组件）
- **修法**：删掉这 4 个材质的 `vertexColors`，颜色改由 `instanceColor` 单独承担（`setColorAt` 本来就在写 instanceColor）
- **铁律**：**凡用 `setColorAt` 染色的 InstancedMesh，材质一律不得再开 `vertexColors`**（除非几何体确实带 color 属性）

### 13.5 近白材质在鸟瞰读作"一排白药瓶"（同一根因两次命中）

- **现象**：鸟瞰图里橙色智造街区与灰色楼顶上排着一列白色「药瓶」形竖体，是全场最刺眼的元素
- **第一处（已修）**：雨棚立柱材质写死近白 `#cdd8e2` → 新增令牌 `scene.boothMetalDay`（中灰金属 `#6f7c8a`），立柱改用它；参数碑碑体同样从近白 `ThemeLightGlassHead` 改为 `ColorSceneGate`
- **第二处（真凶，2026-10-29 二次溯源）**：**智造行业楼顶的工业储罐**（`HRStand.tsx`：圆柱罐体 + 顶部球盖，屋顶偏移 `[2.1, h+0.9, 0.9]`）白天用 `ThemeLightGlassBody`（近白玻璃色）。水塔造型本身就是"药瓶"轮廓（直筒 + 半球顶），近白一叠加 = 一排白药瓶
- **溯源方法（可复用，别靠肉眼猜）**：① 3× 放大裁剪看清轮廓 → 圆柱 + 半球顶，排除全部 box/plane 候选；② 全量 grep `cylinderGeometry|sphereGeometry|capsuleGeometry` 列出候选；③ 代码里"圆柱身 + 球顶盖上下堆叠"的组合全库只有一处
- **修法（初版）**：新增令牌 `scene.tankDay`（工业镀锌灰 `#77838e`），罐体与顶盖都改用它 → **R17 复评判「灰胶囊柱」仍是屋顶噪点，R18 改为收分工业烟囱 + 行业橙**（剪影不再是药箱，且与橙屋顶同族），`scene.tankDay` 随之删除，令牌表不留死项
- **铁律**：**浅色场景里的结构件不能用近白**；鸟瞰是"剪影阅读"场景，剪影要有明度差。近白材质要按"面积 × 纯度"排清账，而不是只改第一眼看到的那个
- **补记（R18）**：近白清账不是一次到位——改深灰后仍会被读成"屋顶黑树"。**屋顶物件要么取行业色与屋顶同族，要么取中灰金属；深色会变成暗噪点，近白会变成白噪点**

### 13.6 R17 未过线 → R18 定向修复：盲审制度要留"失败轮次"

- **R17 结论**：两名独立盲审分别给 视觉 7.3 / 空间 6.8 与 视觉 7.2 / 空间 6.8——**未过 ≥7 门禁**。按 R16 先例**不部署**，原文入 `docs/design/reviews/r17-batch2-visual.md`，短板清单直接作为 R18 的施工单
- **R18 修复**（只修双评审共同点名的项，不重开艺术方向）：① 参数碑街面可读（碑高 0.7–2.4m → 0.8–3.2m + 金冠 + 顶灯球 0.09→0.19 + 灯条加粗）；② 屋顶降噪（储罐→收分烟囱+行业橙、金融尖顶→中灰金属、天窗设备箱→浅灰金属）；③ 小地图玩家箭头移到最上层（定位永不被区名糊掉）
- **R18 复评双双 PASS**：视觉 7.7 / 空间 7.0 与 空间 7.3 / 视觉 7.4 —— 两轮均取"两项较低者"作门禁，**7.0 与 7.3 都 ≥ 7**，才部署
- **铁律 1**：**评审的失败轮次必须和成功轮次一样入库**。只留"最终 7.5 分"的仓库等于伪造过程；R16/R17 的失败清单是 R18 的施工单，也是报告书里最硬的一段叙事
- **铁律 2**：**门禁取两项较低者**（视觉 + 空间），单项过线不算过线。两位评审互相独立，同一轮的分数不应取平均来"抬高"
- **铁律 3**：**部署的构建必须等于被评审的构建**。评审过线后不要再追加视觉改动，否则"过线的分"对应不上线上的画面；本轮因此把"小地图区名压字"降级为残差项，留给下一轮
- **残差项（诚实记录，未修）**：① 参数碑仍无刻字数字面（数值只在名片/HUD）；② 64 摊未按行业做原型差异化（鸟瞰仍是"64 根小棍"）；③ 鸟瞰尺度上 64 座碑只有 1–3 像素；④ 背景幕墙重复 + 街外空网格地板占 1/4 画面；⑤ 夜景 50% 像素近黑，紫/橙街谷无光；⑥ walk 图右侧那根饱和蓝竖杆读作脚手架

### 13.7 截图采集脚本的两条硬需求（egolite）

- **渲染就绪判定**：不能只等 `window.__st`——它远早于首帧。必须轮询到 `gl.info.render.calls > 0` 再截图，否则会拍到"无 HUD 半成品帧"（R18 复评点名 day-walk 缺 HUD，评审会读成漏版）
- **HUD 就绪判定**：HUD 有入场动画，要等 `.game-hud` 非零尺寸且 `opacity > 0.6` 再截；否则截到的是动画半途
- **CDP 超时容错**：`page.goto` 15s 硬超时、`page.evaluate` 15s、`page.screenshot` 15s——线上 45MB 包必然触发。**截图一律带重试**（6 次 × 4s），失败只记日志不中断整场采集
- **本地部署工具的坑**：`gh-pages` 用 `find-cache-dir` 定位缓存，**cwd 下没有 package.json 就返回 undefined 直接崩**——必须 `cd web/` 再跑（仓库根只有 `web/package.json`）
