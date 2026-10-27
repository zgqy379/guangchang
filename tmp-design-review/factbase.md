# 逛厂 · 视觉美术设计决策史与已知问题事实库

> 编写：研究员 Agent · 2026-10-27 · 供主代理综合评价用
> 方法：全部结论取自仓库一手文档与 `docs/iterations/` 存档（meta.json 逐个机器读取），未做外搜。证据等级标注：〔一手档案〕= 事件发生时的原始记录；〔规格文档〕= 设计意图；〔转述〕= 后置总结（与一手档案冲突处已注明）。文件引用格式 `路径:行号`（行号为本次实测）。
> 范围：`docs/design/`（art-style v3 / ui-system v3 / twin-style v4 / design-audit）、`docs/adversarial-review.md`、`docs/lessons.md`（§3/§4/§7 等）、`docs/handoff-2026-10-26.md`（仅时间线参考）、`docs/iterations/`。

---

## 1. 美术风格决策时间线（v1 → v3 → v4 转向）

| 日期 | 事件 | 证据 |
|---|---|---|
| 10-25 | 街区以**夜景**形态上线：程序化夜景窗格立面、64 路灯、四区牌坊、星空月亮、钞票山（暗红发光）成为存量资产（后续选型的沉没成本约束） | art-style-options-v3.md:24-36（约束 A） |
| 10-25 | 首轮独立盲审：街区视觉 5.5 / 空间 5（病因：黑地亮天光照断裂、摊位同构零细节）；同日修复光照基线（HemisphereLight #ffb08a/#1a2040 0.5 + 月光平行光 + ACESFilmic 曝光 1.15、门前动森式细节、天际线差异化），同日复检街区 7.5 / 单人 7.0 → **放行上线** | design-audit-2026-10-25.md:6-13、15-21、48-52〔一手档案〕 |
| 10-25 | 深度审查轮根因修复：钞票山单层平铺（C1）、天空细线（C2）、办公室怼墙（C3）、诚实标注挡相机改固定 DOM 角标（C4）、Avatar T-pose/暗衣（C5） | adversarial-review.md:79-92〔一手档案〕 |
| 10-26 下午 | 街区美术收尾：夜景窗格立面替换 8 片纯色窗、雨棚+侧招立柱、四区路面路牌、投递 3D 世界留痕、特写机位降人眼高度 1.85m、路灯灯头光晕、半球光 0.65→0.95、曝光 1.4→1.55 | design-audit-2026-10-25.md:73-80；lessons.md:147-155（§7.8） |
| 10-26 | 第三位独立盲审（夜景立面收尾后）：**视觉 5.5 / 空间 4.5**，仍未过 7 分门禁；三方共同指向三大差距 = 电影感灯光、摊位个体识别、地图导航。继续按"功能/视觉修复版"上线，不宣称通过设计门禁 | design-audit-2026-10-25.md:81-88〔一手档案〕 |
| 10-26 晚 | 游戏化 HUD 轮（真 HR 近景、参数碑、小地图、稀有度宝石、HUD 毛玻璃等 15 项已修）；本轮盲审视觉 6.5（上轮 6.5）/ 空间 6.1（上轮 5.0） | design-audit-2026-10-25.md:54-71；lessons.md:115-138（§7.6） |
| 10-26 | **UI 层定版「厂玻璃 Factory Glass」v3.0**：亮色液态玻璃 + 深墨字压暗夜街区（最大视觉杠杆）；信息架构重组（演示形态与产品导航分离、术语统一"对比篮"、投递反馈 4 处收敛为 2+1） | ui-system-v3.md:1-24、233-243；lessons.md:156-192（§八） |
| 10-26 | **场景风格 10 选 1**（art-style-options-v3 v1.0）：基于 Awwwards 2026 检索五条结论（克制第一、具体时空胜炫技、暗色+金铜、风格化优于超写实、光即材料）；文档推荐首选 ⑩ 暮色市井（盲审预期 7.5–8.2）、次选 ② 真实工时，⑨ 玻璃数字孪生当时被评为"无人情味、HR 资产贬值"（预期 7.0–7.8） | art-style-options-v3.md:59-71、276-317 |
| 10-26 | **最终决策转向：玻璃数字孪生 Glass Digital Twin（第 ⑨ 方向的深化）**，主题**白天浅色为主**、按系统时间自动切夜间；环境时间（系统时钟→天色/UI 主题）与参数时间（公司 offworkTime→门前下班光效）彻底分离；**当天落地**（theme.ts、sunPosition.ts、facadeTexture 双模式、UI data-theme 反相），实测白天 8.36/5.45/5.11:1、夜间 10.24/5.49/4.60:1 全部 ≥AA | twin-style-spec-v4.md:10-21、97-118、389-429〔一手档案：附录 C 实施结果〕 |
| 10-26 15:30–16:00 | 合规修复轮：Draco 自托管（T12）、受限入口出公开构建、受限截图移出公开仓库、THIRD_PARTY_NOTICES.md、报告书 v2 修订（删内部盲审分/自评分） | handoff-2026-10-26.md（"合规修复轮"节） |
| 10-27 | 双角色体系设计轮（role-flow-* 五份文档 + 报告书诚实降级段）：**只出设计文档未改生产代码**；随后实施阶段（ded1a26 + a104ef4）落地首屏角色选择门禁、underlay、ErrorBoundary；首屏 8.49MB→0.31MB、canvas 1→0 | handoff-2026-10-26.md（三·二、三·三节）；lessons.md:247-344（§十） |
| 10-27 | 文档审查更正（回写 twin-style-spec-v4 附录 C）：`sky.ts` 实为死代码（全项目零 import）；`offworkGlow` 未实现，附录 C 曾虚标 ✅ 已更正 | twin-style-spec-v4.md:391-405 |

**风格演进主线一句话**：夜景写实街区（10-25 上线）→ 盲审三轮不过 7 分 → UI 定「厂玻璃」（10-26）→ 场景经 10 方向选型后弃"暮色市井"改定**玻璃数字孪生 + 白天浅色为主 + 系统时间切主题**（10-26 决策并当天落地）→ 10-27 修对比度/首屏/角色门禁。**注意：v4 转向后，"夜景窗格/路灯/星空月亮"存量夜景资产进入"夜间主题复用"状态，白天主题靠材质双模式（同函数加 mode 分支）而非重做资产**（twin-style-spec-v4.md:25-36、285-296）。

---

## 2. UI 系统与 twin-style 版本演进

- **UI v3「厂玻璃」**（ui-system-v3.md，v3.0 2026-10-26）：
  - 核心论据"亮玻璃需要深背景才成立"（夜景街区上亮玻璃=悬浮舷窗）——但同文档 §6.5 已预留 `data-scene-tone` 三态（dark/dusk/light）。
  - 玻璃配方：白玻璃 `.82→.60` 渐变 + `blur(28px) saturate(180%)` + 1px 内高光 + 双层阴影；"厚度不靠更透明，靠模糊+内高光+双层阴影"（ui-system-v3.md:241-278）。
  - 色彩硬约束（进 code review checklist）：实心红按钮必须 `#C23A2B`（5.41:1），**禁 `#FF5A3C` 配白字**（仅 3.10:1）；行业四色**禁承载白字**（互联网蓝配白字 2.76:1）；金色文字用 `#B8860B`，`#FFD24A` 只作进度条填充（ui-system-v3.md:280-295）。
  - 数值可读性：核心数值（总包/下班/基数）从 13px 挤行改为 26px `tabular-nums` 数值瓷砖（ui-system-v3.md:296-313）。
  - 原型实测三条布局铁律：同侧浮层共用 flex 栈、移动端 HUD 与名片垂直分区、SVG 罗盘标签 viewBox 裁切（ui-system-v3.md:572-583）。
- **v4 转向后的连锁修正**（twin-style-spec-v4.md）：
  - `data-scene-tone` 三态统一为 `data-theme` 两态（light/dark）；**UI 玻璃随主题反相**：白天浅场景→深玻璃 `rgba(11,14,26,.72)`+白字；夜间深场景→亮玻璃+墨字（twin-style-spec-v4.md:70-96）。
  - 实施 3 坑（twin-style-spec-v4.md:422-430；lessons.md:225-240 §9.4）：① Style Dictionary v5 用 `match`+`transitive` 误伤 number 令牌 → 全部变 `"none"`、HUD 显示 **Lv.NaN**；修法=改 `filter` + 构建后自检 `process.exit(1)`。② 手动锁主题被 3s 防抖吞掉 → 锁定立即生效。③ 半透明玻璃对比度**不能按纯白/纯黑算**，真实底色是透出 3D 场景的合成结果。
- **10-27 最坏背景验算与 underlay 修正**（lessons.md:252-268 §10.1；handoff 三·二第 7 条）：
  - 按最坏背景（浅色主题压最亮天幕 `skyHorizon #f4f8fb`）验算：深玻璃 `.72` 下 secondary **4.48:1 ❌**、muted **4.20:1 ❌**（夜间主题无此问题）。此前 v1.0 报"不达标"、v1.2 自我更正"已达标"，主理人定论**两次都不完整**——半透明浮层的背景是变量。
  - 修复：全站垫 `--ui-glass-underlay` 实底（浅 `.86`/深 `.86`），`--ui-glass-fill` 语义不动另起新变量；修正后最坏背景 secondary 7.39 / muted 6.92。工程坑：`background-color` 必须写在 `background` 简写**之后**，否则被静默重置回 4.48:1（lessons.md:331-337 §10.11）。
  - 常态化自检脚本：`tools/check-contrast.mjs`。
- **令牌是唯一颜色来源**（全程有效）：UI 用 `var(--color-*)`，3D 用 `generated/design-tokens.output.mjs`；新增颜色先入 `web/design/tokens.json` 再 `npm run tokens`（lessons.md:155、336-340；ui-system-v3.md:639-667）。

---

## 3. 盲审分数变化（门禁 ≥7/10 放行，8+ 冲刺）

门禁机制：两位/多位**独立评审盲审**（只看截图不知实现），≥7 分才可上线上版（design-audit-2026-10-25.md:37-47）。

| 轮次 | 视觉 | 空间 | 备注 |
|---|---|---|---|
| 10-25 首轮 | 街区 5.5；单人 6；A/B 对比 6.5；3DGS 办公室 3 | 街区 5 | 病因：光照断裂、摊位同构、3DGS 取景入体（design-audit:6-13） |
| 10-25 同日复检 | 街区 7.5；单人 7.0（踩线达标） | — | ✅ 放行上线（design-audit:48-52） |
| 10-26 晚（游戏化 HUD 轮） | 6.5（上轮 6.5） | 6.1（上轮 5.0） | 门禁行另写"本轮视觉 **6.7** 低于 7"——同节内 6.5 与 6.7 并存（design-audit:54-71） |
| 10-26（第三位评审，夜景立面收尾后） | 5.5 | 4.5 | "前两轮 6.5/6.1 与 6.0/6.0 与本轮 5.5/4.5 出自不同评审、尺度不同"（design-audit:73-88） |

**口径出入（如实记录，不静默取其一）**：
- 第二轮分数在不同文档中为 6.0/6.0（handoff-2026-10-26.md、ui-system-v3.md:25-27 转述）与 6.5/6.1（design-audit 一手档案）不一致；lessons.md:139-146（§7.6 尾）又写"从视觉 6.5/空间 5.0 提升到视觉 6.7/空间 6.1"。
- 一手档案 design-audit 内部 6.5 与 6.7 并存。**综合评价时应以 design-audit 原始表为准，并承认"分数因评审而异，不要把单一分数当硬指标，按共性清单逐项收"**（lessons.md:147-155 §7.8 明示此原则）。
- 三轮共性差距（稳定结论）：**电影感灯光/辉光/湿反射、摊位个体识别（64 摊同构）、地图导航信息**（design-audit:88；art-style-options-v3.md:71）。
- **现状：从未通过 ≥7 的盲审门禁**（复检 7.5 为首轮修复后的单轮结果；v3/v4 大改后未再走独立盲审——twin-style-spec-v4.md:431-437 C.4 明列"独立盲审"为未完成项）。

---

## 4. 与视觉直接相关的事故及整改

### 4.1 事故档案 T7–T12b（编号沿用 docs/adversarial-review.md 附录）

| 事故 | 视觉表现 | 根因 | 整改 | 证据 |
|---|---|---|---|---|
| **T7**（10-26 晚） | 受限资产 InteriorGS PLY 54MB 二次泄露上 gh-pages（公开 URL 数分钟） | 上次只删 dist 产物，未清构建输入 `web/public/` | 移出 public + .gitignore + 干净重建 force push + 404 验证；**铁律：合规清理必须堵构建输入** | adversarial-review.md:62-68；lessons.md:35-44 §3 铁律 1 |
| **T8**（10-27 用户发现） | 线上电脑/平板全白屏 | ① MSYS 把路径形态 env `VITE_BASE=/guangchang/` 改写为 `C:/Program Files/Git/...`；② `useGLTF('/assets/...')` 硬编码不吃 base → drei 模块级 preload 404 抛错 → 整应用挂载失败 | 非路径令牌 `VITE_BASE_TOKEN` + `assetUrl()` 统一拼接；**"curl 200 ≠ 应用能跑"，线上完整启动验收入 checklist** | adversarial-review.md:69-78；lessons.md:23-24 |
| **T9**（街区黑屏） | 初进街区全黑 | 初始相机 [13,4.5,9] 落在 lot0 办公楼包围盒内部 | 相机初始位必须对全场景建筑包围盒做相交验证；两段式机位（鸟瞰 (0,34,26)→跟随） | lessons.md:45-51 §4；lessons.md:74-76 §7.1 |
| **T10**（10-26） | 摊位前只见蓝盒子和钱堆，HR 近景消失 | ① 街角摊位（起点 10m）与相邻街办公体块穿插；② 9 个真 HR GLB 自带 idle clip 是 T-pose | `START_ALOG 10→14`、`SLOT_GAP 4.2→3.6`；HR 与玩家同 52 根 Mixamo 骨 → 用玩家 `avatar-idle.glb` clip 驱动克隆（勿改回） | adversarial-review.md:93-99；lessons.md:116-120 §7.6 |
| **T11**（10-26） | 窗面远看斜纹"涂鸦噪点"，**盲审误判为贴图损坏** | 窗/玻璃/门/LED 多层共面 z-fighting | 各层拉开 ≥0.02m（玻璃 2.66→入口 2.86）+ 窗改 MeshBasicMaterial；个别角度轻微摩尔纹仍在视觉收尾清单 | adversarial-review.md:100-102；lessons.md:121-122 §7.6 |
| **T12**（10-26 合规审计） | 线上 3D 全黑：Draco 解码器走 jsDelivr 线上 `ERR_CONNECTION_CLOSED` → 玩家/HR/钞票 GLB 全部解析失败；同轮发现受限入口仍列 InteriorGS 选项（`!VITE_PUBLIC_DEPLOY` 从未设置，T12b） | 本地 dev 有缓存看不出来；变量从未在构建中设置 | Draco 自托管 `web/public/draco/`；判断改 `import.meta.env.DEV`；**运行时第三方 CDN 依赖一律自托管**；"我这边能打开"不是验收，用无缓存新 profile + 真机 | lessons.md:40-44 §3 铁律 6/7、§4 T12 条 |
| 钞票山单层平铺（C1，10-25） | 15 万不可见、100 万是一块"红地毯"，核心意象"山"不存在 | `ceil(sqrt(N))²≥N` 恒成立 → 任何金额只堆一层 | 固定层容量 3×3=9 + 逐层居中 + 锥度 + 高度感知增强 16×（角标声明）；15 万→可见红堆、58.3 万→层叠山、116.7 万→带增量帽钱塔 | adversarial-review.md:82；lessons.md:77 §7.1 |
| 64 盏路灯叠原点 | 灯不生效 | InstancedMesh 矩阵写在 `useMemo`（首渲染 ref 为空） | 改 `useLayoutEffect` + 地面暖光池 | lessons.md:123 §7.6 |
| 牌坊立柱立在路中 | 牌坊顺街而非跨街 | `axisX ? 0 : π/2` 写反 | 改 `axisX ? π/2 : 0` | lessons.md:124 §7.6 |
| Lv.NaN（HUD） | 等级显示 NaN | Style Dictionary v5 transform `match`+`transitive` 误伤 number 令牌 | `filter` 限定 + tokens.config.mjs 构建后自检 | lessons.md:225-232 §9.4 |
| 3DGS 办公室"糊墙" | 办公室漫游画面糊成噪点墙 | SPZ 资产本身精度低（薄壳），非机位问题（dense box 站近更糟，改全量包围盒 `dist=radius×1.6` 只能"看全"） | **视频不剪办公室段落**、报告不再用糊墙截图；根治=重新生成更好的办公室资产（P1 欠账） | lessons.md:145 §7.7；handoff 三·补 |
| 首屏 5.62MB | 超红线 12.4%；间接拖垮首屏视觉体验 | 3 处模块级 `useGLTF.preload`（AvatarActor 3.08MB / AssetProp 2.23MB / HRStand 16MB）+ `mode` 初始 'single' 首屏渲染 3D | **真根因=首屏挂了 `<Canvas>`**；删 preload 是必要不充分；角色选择门禁后首屏 0.31MB / canvas 0 | lessons.md:269-317 §10.2/10.8；handoff 三·三 |

### 4.2 验证工具边界（影响"视觉验收怎么做"）

- **egolite 渲染不了街区级 WebGL 场景**（2136 draw call）：canvas 黑帧、rAF 假活、零报错、context 未丢失——曾误判为"渲染 bug"排查数轮。街区验收/录屏改用用户浏览器或 headless Edge（**其 WebGL 截图受虚拟时间限制不可靠**）；CDP"只捕 1 帧"是黑相机无画面变化所致，相机修复后 270 帧正常（lessons.md:92-97 §7.3）。
- 本机浏览器验证只走 egolite `ego-browser nodejs < 脚本`（先例 `C:/Users/dqy/ego/gc-review-20261025-1600/street-rec2.mjs`）。
- **draw call 2136 vs 红线 ≤200**：静态归因上限 2712 > 实测 2136（差额=视锥剔除），收益须实测（handoff 三·二第 2 条）。M6a 占位人形 InstancedMesh 预计 2136→~1430（handoff 三·三待办 3）。
- 交互卡/导航标签勿用 3D `distanceFactor` 缩放（随距离放大出屏）；世界锚定用光环/信标，信息放屏幕 DOM（lessons.md:136 §7.6）。

---

## 5. 诚实性/合规对视觉呈现的硬约束

1. **全站禁止假进度条与"正在生成 3D…"文案**；回放必须常驻标注、剩余时间显示真实值；"被加速的是等待过程，不是生成结果"（AGENTS.md 操作契约；lessons.md:291-298 §10.5）。
2. **诚实降级三规则**：「演示回放」chip 常驻不可隐藏；剩余时间真实剩余；结果页标注为回放产物。裁定逻辑：主打"反画饼"的产品自己的 Demo 更不能画饼——诚实降级是论据不是扣分（lessons.md:291-298）。
3. **比例诚实标注**：钞票山水平 2.5× 放大 + 高度感知增强 16×，均需场景内角标声明（"等比放大展示 2.5×，真实换算见附录A"已修，红队 P2）（adversarial-review.md:40；handoff §七；lessons.md:77）。
4. **真钞/人民币主题必被 Aholo 服务端内容审核拦**（实测 status=4）→ 虚构货币"逛厂币"转正，合规依据 project.md 7.6（lessons.md:7-22 §一；AGENTS.md）。
5. **受限资产三重封堵**：InteriorGS PLY 不进 `web/public/`（构建输入）、`docs/iterations/**/*interiorgs*` 截图不进公开仓库、受限入口仅本地 dev 可见（`import.meta.env.DEV`）（lessons.md:35-44；handoff 合规修复轮）。
6. **隐私视觉语义**：作品私密档的正确表现是**不渲染**（不是灰显/占位图），且必须用截图核验"它不渲染"（lessons.md:305-309 §10.7）。
7. **可访问性硬约束**（WCAG 2.1 AA）：对比度按**最坏背景**验算（浅色主题压 skyHorizon、夜间压 skyTop）；状态不可只靠颜色（已投递=按钮文字+绿章+摊位信标三重编码）；触控 ≥44px；`prefers-reduced-motion` 全量降级；行业色禁承载白字、红按钮用 #C23A2B（ui-system-v3.md:280-295、584-599；twin-style-spec-v4.md:356-360；lessons.md:252-268）。
8. **报告书事实性**：文档说"已实现 X"必须能指到代码与线上证据（曾发生"求职者以 3D 形象漫游"实为第三人称视角的事实错误，已修正）（lessons.md:285-290 §10.4；handoff 三·二）。

---

## 6. 美术资产迭代轮次（docs/iterations/ 实测存档，25 个 meta.json 逐个读取）

| 资产线 | 版本与成败 | 说明 |
|---|---|---|
| **lux3d-avatar**（玩家形象） | v1/v2/v3 全 success（各含 glb+bundle.zip+preview.png）；img2avatar 两版（2025-11-/2026-02-）success；**rig-v1 failed → rig-v2 success（retry task 4346472）**；anim（含 avatar-walk-inplace.glb）success | 形象 3 版 + 照片转形象 2 版 + 绑骨 1 败 1 成 + 动画 1 轮；绑骨首试失败重试即过（provider status=4 偶发的实证） |
| **lux3d-hr**（HR 形象） | 2026-10-25-v2：hr-f01–f05、hr-m01–m04 共 9 个 success；**hr-m05 failed**（目录内无 idle.glb，仅 raw） | 对应报告口径"生成 10 / 上线 9"（handoff 合规修复轮）；HR 生成物自带 idle clip 为 T-pose（T10 教训：先确认自带动画不是 T-pose） |
| **lux3d-money** | fantasy-banknote（虚构逛厂币）success；gold-coins success | 真钞主题被审核拦的直接产物；gold-coins.glb（1.45MB）后成死资产（src 零引用，lessons §10.2 附带） |
| **spatialgen-space** | 2026-10-25-v2-industries：culture/finance/manufacturing 三行业 success（office.spz）；**2026-10-26-v1 failed**（含 retry-log.json） | 在线办公室四套下拉的来源之一；互联网区 spz 在 10-25 批次中未见独立 meta |
| **reality-office**（Aholo World 重建） | 2026-10-26-v1 **failed** | World 纯文案生成曾成功（652s，SPZ 4MB），但带参考图模式两次一致失败；红队自评弱点 1："自管重建（用户拍视频→World 重建）始终没有成功案例"[待W3]（adversarial-review.md:8-13） |
| **app-acceptance**（视觉验收截图） | 10-25 mountain-fix、10-26（aesthetic-*/live-*/mobile-emulated 等 16 张）、10-27（headless-street、live-fixed 等 4 张） | 验收截图序列构成视觉改动的时间线证据 |

**存档纪律缺口（可核对事实）**：iterations/README.md 要求全局 `prompt-log.md`（每次一行）——**该文件不存在**；且 25 个 meta.json 中多数的 `pipeline/assetLine/version/notes` 字段为空（仅 result 有值），模板执行不完整。README 明言这是"报告书硬性要求，最后一周补不回来"（docs/iterations/README.md）。→ 待证项：报告书"迭代对比"页素材是否够用，需按 README 最低要求（核心资产线各一条 v1/v2/v3 并排 + prompt 差异）盘点。

---

## 7. 待证项与建议下一步

1. **v4 转向后从未重走盲审**：twin-style C.4 与 handoff 三·三均把"独立盲审 ≥7"列为未完成。当前最新盲审分数仍是夜景版的 5.5/4.5（第三位评审）。白天孪生风格的视觉成绩是**未知数**——建议主代理把"白天/夜间各 4 张截图 → 独立盲审"排为美术线第一优先（twin-style-spec-v4.md:340-366 S9、431-437）。
2. **盲审分数口径**：第二轮 6.0/6.0 vs 6.5/6.1、单节内 6.5 vs 6.7 的出入无法从现有文档裁定；若需精确分数史，查 git 历史中 design-audit 的早期版本（`git log -p -- docs/design/design-audit-2026-10-25.md`）。
3. **`project.md` 7.6（逛厂币合规依据）未在本次阅读范围内核对原文**，引用时建议抽查。
4. **role-flow-visual-v1.md（2104 行）未读**：双角色视觉方向规格属 10-27 新增层，若主代理要评价"视觉未来时"，需补读（handoff 三·二列表）。
5. **美术收尾三大差距的当前状态**：光照层次/摊位个体识别/导航器信息量在 10-27 时点"已在并行进行"（handoff 三·三下一轮待办 1），本次未核对代码落地进度。
