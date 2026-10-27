# 逛厂 GuǎngChǎng 视觉美术独立评审（2026-10-27）

评审人：独立审阅 Agent（只读评审，未改动 web/ 与 docs/ 任何现有文件）
基线：任务四块证据 + 项目操作契约（颜色唯一来源是令牌、玻璃垫实底、不透明面板用 --ui-page-fg/--ui-panel-*、对比度按最坏背景验算、盲审 ≥7 分门禁）。

## 结论：7/10，可交付但有 2 处必须修

系统化程度高于典型黑客松作品（令牌单源、对比度方法论、主题反相均工程化且有自动门禁），最新截图的可读性与信息层级明显好于盲审时期的记录；扣分在移动端顶栏破损、一处与自身规范矛盾的对比度缺陷、白天材质分离度偏低，且视觉盲审门禁（≥7）历史上从未通过（6.5/6.1、5.5/4.5，见 design-audit-2026-10-25.md）。

## 优点（最有证据支撑的 3 条）

S1 令牌单源贯通 UI 与 3D。唯一色源 web/design/tokens.json → generated/design-tokens.output.{css,mjs,d.mts}。UI 侧 styles.css 常规颜色全走 var(--color-*)；3D 侧 12+ 个组件直接 import generated mjs（CompanyPlot.tsx:21、MoneyMountain.tsx:19、GlowPath.tsx:12、StreetScene.tsx:52、BoothHardwareInstanced.tsx:28、GameHud.tsx:14、HRStand.tsx:21、LotMarkers.tsx:27、OfficeFacadeInstanced.tsx:23、PlaceholderHRs.tsx:11、TwinEnvironment.tsx:29、WorkdaySky.tsx:43、data/street-companies.ts:9）。grep 全部 3D 组件的 0x 色值字面量为 0（仅命中随机数哈希常数 0xffffffff/1664525）。main.tsx:3 引入 generated css，链路完整。

S2 反相玻璃体系 + 最坏背景对比度方法论成体系，且真实落地。--ui-glass-underlay 双主题定义（styles.css:40、styles.css:75）并在多处实际垫底：GcSelect.css:21、GcSlider.css:31（background-color 写在 background 之后）、ParamForm.css:37、styles/glass-underlay.css:40、navigator.css:35-50（还带同值兜底）。对比度按玻璃合成底色验算并注释在代码里（styles.css:33-38、62-66、74-80、174、285）。node tools/check-panel-ink.mjs 本轮实跑通过：「没有不透明面板误用玻璃墨色」。截图侧昼夜反相正确：night/hero.png 亮玻璃+墨字（Lv.1 用深金 --ui-accent-gold），focus.png 深玻璃+白字，与 twin-style-spec-v4.md §2 矛盾 A 的解法一致。App.tsx:236 data-theme 接线真实存在。

S3 信息设计与「诚实」表达可上镜验证。名片三数值瓷砖（focus.png 左下：总包80万/下班22:30/五险基数0.6，对应 ui-system-v3.md P2 修复）；罗盘+邻近摊位距离（4m/5m/8m）+四区进度导航器（focus.png 右下，对应 P5）；投递状态多重编码（deliver.png：按钮「✓已投递」+世界浮标+导航器对勾）；HUD 诚实图例「牌高=总包，灯条=五险，顶灯=下班」。昼夜同一几何、两套光照（tokens.json theme.light/dark + twin.* 参数），跨端主题一致性有截图支撑。

## 短板

### 必须修（2 条）
M1. 玻璃面上的品牌金对比度缺陷。styles.css:810 `.game-toast b { color: var(--color-brand-gold) }`，载体 .game-toast 用 --ui-glass-fill-strong（深色主题 = 亮玻璃 rgba(255,255,255,.86)）。项目自己在 styles.css:62 标注「亮玻璃（深色主题）上品牌金仅 1.13:1」并在别处（.street-cta、.game-hud-level）改用 --ui-accent-gold，此处漏改；StreetScene.tsx:1359-1361 渲染「已投给 X · <b>+10 XP</b>」，两主题都会出现。影响：夜间主题投递 toast 的金字几乎不可见，且直接违反自己写的「对比度必须按最坏背景验算」铁律。方向：改用 var(--ui-accent-gold)。注：依据为代码与项目自测比例，截图未捕获该 2.2s 瞬间（deliver.png 时 toast 已消失）。

M2. 移动端 390px 顶栏挤压重叠。mobile/mobile-expanded.png：logo 文案截断（「把画的」）、角色/演示按钮重叠、红色主按钮被导航器面板遮挡。styles.css 的两条媒体查询（~860px、~720px）只适配 .controls/.planned/.game-hud/.lot-card-dock，header 与 .mode-switch 无任何窄屏规则；ui-system-v3.md §3.1 规划的移动端底部 Tab 也未实现。影响：评委用手机打开的第一屏即破版——而 v3 自己定义目标用户就是「单手竖屏、通勤」。

### 值得考虑（2 条）
C1. 令牌外硬编码色值散落 styles.css，违背「颜色唯一来源是设计令牌」：:122-126（#d98a00/#7fa8ff/#8a5a00/#1f5a96）、:178-183（.replay #4ade80/#14532d、.roam-btn #8fb4d9/#2c4a63，#4ade80 非令牌绿 #3ddc97）、:335（.cap-note #d4a72c = state.warning 值的字面量）、:347（#0d1117 = neutral-1 值字面量）、:383/:411（#2a3038）、:634（#58a6ff = state.info 值字面量）。同值字面量在改令牌时会静默漂移。建议收进令牌或改 var()；--ui-* 系反相变体是有注释的例外，不算此列。

C2. 白天孪生风立面与天空分离度低：twin-2026-10-26/day-street.png 左侧白色体块几乎融进浅色天空、近景白墙占比大；对照 twin-style-spec-v4.md §3.3 的「淡青描边」实际观感偏弱。夜景光层次反而更好（twin-2026-10-26/night-street.png 的智造区牌坊与灯池成立）。盲审三轮共指「暗立面/光层次/摊位个体识别」仍未清零。

### 仅记录
- 夜景下顶栏未激活演示按钮辨识度很低（night/hero.png 顶部）；根因是 v3 P1「演示形态收进控制台」未实施，顶栏仍四形态平级（所有 10-27 截图可见）。
- HUD 术语仍是「收藏」，v3 §5.3 统一术语「对比篮」未落地（focus.png/night hero）。
- 一次投递可见反馈仍约 4 处（deliver.png），v3 §5.4 收敛目标为 UI 2 处，偏多但未到伤害级。
- 盲审视觉门禁 7 分从未通过且文档如实记录（design-audit-2026-10-25.md），对外口径保持「功能/修复版」是正确的。
- navigator.css:31-50 的兜底值与全局 --ui-glass-underlay 同值双写，漂移时不易察觉。

## 审阅范围与未覆盖
已核：四份设计文档（ui-system-v3 全文前 473 行、twin-style-spec-v4 前 180 行、design-audit 全文、art-style-options-v3 未读）；styles.css 全文（917 行）、tokens.json 全文、generated 管线存在性与引用面；7 张截图（street-2026-10-27 的 hero/focus/deliver/night hero/night focus/mobile-expanded，twin-2026-10-26 的 day-street/night-street）；check-panel-ink.mjs 实跑。
未核/未验证：未本机起 vite preview 复跑渲染（WebGL 实机表现未独立复测，依赖截图为证）；art-style-options-v3.md 全文未读；M1 的 1.13:1 引自项目自测注释，未独立用脚本重算；rolegate-street.png/walk.png/mobile-collapsed.png/night walk 等未逐张看。
