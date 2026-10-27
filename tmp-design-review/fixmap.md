# 逛厂 · 视觉美术冲刺 9 分 —— 修复定位图（fixmap）

> 只读侦察产出 · 2026-10-27。基线 = **工作区现状**（feat/debt-reduction-week1 + 32 文件未提交批次），文中行号均为当日工作区实测（Select-String / 逐行读取），主代理独立提交该批次后不应漂移。
> 证据等级：〔实测〕= 本次逐行读取 / grep / git diff 核实；〔推断〕= 由代码结构推断、未运行验证；〔前档〕= 引自 tmp-design-review/audit.md、factbase.md 交叉印证。

---

## 0. 五条最关键结论

1. **390px 顶栏破版根因**：styles.css 对 `header` / `.mode-switch` **零媒体查询覆盖**（:432 的 860px 只管 .controls/.planned/.office-select，:852 的 720px 只管 .game-hud/.lot-card-dock），header:134 无 `flex-wrap`，.mode-switch（App.tsx:258-336）10 个 min-height:44px 控件含「漫游中（点击地面行走 / WASD）」长文案 → 390px 下堆叠爆高、遮挡 main。
2. **toast 金字**：styles.css:811 `var(--color-brand-gold)` 压深色主题亮玻璃（--ui-glass-fill-strong = rgba(255,255,255,.86)）≈1.13:1〔前档，项目自标〕；同文件 .street-cta:568、.game-hud-level:673 已用 `var(--ui-accent-gold)` 先例，照抄即可；同族缺陷 .xp-pop:681 一并修。
3. **硬编码色 14 处全数定位**（§3 表）。其中 #d4a72c/#0d1117/#58a6ff 有值完全相同的既有令牌可直换；theme-lock/replay/roam 的 4 组状态色**无对应令牌**且浅色主题下不达 AA（顺带发现的新缺陷），建议成对新增令牌。
4. **白天洗白根因有二**：① WorkdaySky:114-118 与 HRStand facadeTexture/glassTexture 的 day 调色板全硬编码；② v4 规格的 rim/wire/dataEdge 描边令牌 + twin.emissive/opacity/wireOpacity/rimStrength/glassOpacity/glassRoughness/shaftOpacity（7 组 15 个）**零消费**——「淡青描边」词汇根本没有渲染路径，纯调令牌救不回，必须动代码。
5. **64 摊个体识别可 +0~1 draw call 达成**：roof 材质改 vertexColors+setColorAt（行业色 × lotNo 哈希），flag/led/sign/glow 已是 instanceColor 只需加每摊扰动；唯一大池是 HRStand 每摊 6-11 个独立 mesh（≈400-700 DC）。

---

## 1. 顶栏 header DOM / .mode-switch / 媒体查询 / 390px 破版

**DOM 位置**〔实测〕：App.tsx:254-336。`<header>` 在 App 组件 roleGate 之后的 JSX 里；`.mode-switch` div 在 :258，内部依次为：theme-lock（:260-269）、角色切换（:271-279）、逛一家（:280-282）、A/B 对比（:283-285）、basket-badge 条件渲染（:286-288）、办公室漫游（:289-294）、招聘街区（:295-303）、replay 条件（:304-309）、roam 切换条（:310-319，single 模式）、office-select 条（:320-336，office 模式）。

```tsx
// App.tsx:254-258
      <header>
        <h1>
          逛厂 <span>把画的饼，砌成真的山</span>
        </h1>
        <div className="mode-switch">
```

```css
/* styles.css:134-147 —— header 全部规则：无 flex-wrap、无断点 */
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 18px;
  border-bottom: 1px solid var(--ui-panel-border);
  background: var(--ui-panel-bg);
  color: var(--ui-page-fg);
```

**现有规则覆盖**〔实测〕：`.mode-switch` **容器没有任何样式规则**（无 flex/无 wrap）——只有子元素规则：`.mode-switch .theme-lock`（:101-119，min-width:44px 触控目标）、`.mode-switch button`（:160-170，min-height:44px）、`.active`（:171-176）、`.replay`（:177-180）、`.roam-btn`（:181-184）、`.office-select`（:185-197，max-width:240px）。

**媒体查询覆盖范围**〔实测〕：
- styles.css:432-441 `@media (max-width: 860px)` → 仅 .controls（250px）、.planned（display:none）、.office-select（150px）；
- styles.css:852-875 `@media (max-width: 720px)` → 仅 .game-hud、.game-hud-level、.game-hud-counts、.district-label、.lot-card-dock；
- navigator.css:231-268（≤720px：导航器收成右侧圆钮 + 全屏浮层）；role-gate.css:333/353（门禁自身）。
- **header / .mode-switch / footer 在任何断点都零覆盖**〔实测 grep 全 src @media 仅以上 6 处〕。

**390px 破版根因**（三层叠加）：
1. header 是 `justify-content: space-between` 的单行 flex，无 wrap → h1（20px + 长副题 span）与 mode-switch 抢宽；
2. .mode-switch 无 flex 容器规则，按钮 inline 排布换行不受控；single+office 组合下最多 9 个控件 + 1 个 select，每个 min-height 44px → 换成 4-6 行、高约 260px+ 的顶栏，吃掉一半竖屏视口；「漫游中（点击地面行走 / WASD）」（App.tsx:315）单条文案即 ~220px 宽；
3. footer/controls 断点有规则而 header 没有 → 手机截图上「logo 截断、按钮重叠、红主按钮被导航器压住」〔前档 audit.md M2，mobile-expanded.png〕。

**改法建议**：
- styles.css 新增 `@media (max-width: 860px)` 与 `(max-width: 720px)` 的 header 块：header 允许 `flex-wrap: wrap`、h1 span 隐藏或缩为图标、`.mode-switch { display:flex; flex-wrap:wrap; gap:6px }`、按钮 padding 收窄；
- roam 按钮文案分态缩短（App.tsx:315「漫游中」+ title 提示操作方式）；
- ≥720px 底部 Tab 方案 v3 §3.1 已规划〔前档〕，属扩大范围，交主代理拍板。

---

## 2. .game-toast b 品牌金对比度

```css
/* styles.css:810-813 */
.game-toast b {
  color: var(--color-brand-gold);   /* #ffd24a */
  margin-left: 6px;
}
/* 载体 styles.css:788-809：background: var(--ui-glass-fill-strong) */
```

- 载体 `.game-toast`（:788-809）用 `--ui-glass-fill-strong`：深色主题 = **rgba(255,255,255,0.86) 亮玻璃**（:41），浅色主题 = rgba(11,14,26,0.86) 深玻璃（:73）。
- `--ui-accent-gold` 定义〔实测〕：styles.css:65（.app 默认/深色）`#6e5a00`（注释：按最坏亮玻璃合成底验算 4.55:1）；styles.css:92（light）`= var(--color-brand-gold)`（深玻璃上品牌原色可读）。
- 渲染点：StreetScene.tsx:1395-1397 `{toast.text} <b>+10 XP</b>`，两主题都会出现；深色主题下金字 1.13:1〔前档，项目自测注释 styles.css:61-62〕。
- **改法**：`.game-toast b { color: var(--ui-accent-gold); }`——与已修好的 .street-cta:568、.game-hud-level:670-674 完全同构。
- **同族缺陷**〔实测补报〕：.xp-pop（styles.css:677-686）`color: var(--color-brand-gold)` 挂在 .game-hud（同为亮玻璃）上，同病；建议一并改 `--ui-accent-gold`。xp-pop 的 rgba(255,210,74,…) 背景描边为装饰性可保留。

---

## 3. styles.css 令牌外硬编码色核查表

〔实测〕grep 全量核对，任务所列全部命中，另补 2 处同族（:595、:88）。逐条给最合适落点：

| 行号 | 现值 | 语义/选择器 | 建议落点 |
|---|---|---|---|
| :122 | #d98a00 | `.theme-lock--light` 文字（深色主题，不透明顶栏内） | **无既有令牌** → 新增 `--ui-panel-sun`（dark #d98a00 / light :125 #8a5a00 成对）；复用 --color-brand-gold 不行（#ffd24a 太亮） |
| :123 | #7fa8ff | `.theme-lock--dark` 文字 | **无既有令牌** → 新增 `--ui-panel-sky`（dark / light :126 成对）；--color-state-info #58a6ff 色相近但对比不够，不建议直接换 |
| :125 | #8a5a00 | 同 :122 light 变体 | 同 :122 成对入令牌 |
| :126 | #1f5a96 | 同 :123 light 变体 | 同 :123 成对入令牌 |
| :178 | #4ade80 | `.mode-switch button.replay` 文字 | 语义=success。--color-state-success=#3ddc97 **值不同**；且浅色主题白底上 #4ade80≈1.9:1 不达 AA（新发现的既有缺陷）→ 新增 `--ui-accent-success` dark/light 成对 |
| :179 | #14532d | .replay 边框 | 同上成对 |
| :182 | #8fb4d9 | `.roam-btn` 文字 | 语义=info；浅色主题白底 ≈2.2:1 不达 AA → 新增 `--ui-accent-info`（或 state-info 深变体） |
| :183 | #2c4a63 | .roam-btn 边框 | 同上成对 |
| :335 | #d4a72c | `.cap-note` 文字 | **值与 --color-state-warning 完全相同** → 直接 `var(--color-state-warning)`；浅色主题对比度问题另行处理（readout 底反相后白底 2.2:1） |
| :347 | #0d1117 | `.preset-b select` 背景 | 值 = var(--color-neutral-1)；**且 .preset-b 全项目零引用（死规则，实测 grep=0）** → 建议连规则一起删 |
| :383 | #2a3038 | `.scale-note` 边框（玻璃浮层） | `var(--ui-border-soft)` 或 `var(--color-border-subtle)`（#262c36），按最坏背景验算后取一 |
| :411 | #2a3038 | `.controls::-webkit-scrollbar-thumb` | `var(--color-border-strong)`（#30363d）或 neutral-5，视觉差异极小 |
| :595 | #1f5a96 | `.lot-card-actions button` 背景（任务清单未列，补报） | 深信息底（白字 5.5:1 OK）→ 与 :634 共用新令牌（如 `--color-info-deep`） |
| :634 | #1f5a96 | `.basket-badge` 背景 | 同 :595 新令牌 |
| :635 | #58a6ff | .basket-badge 边框 | **值 = var(--color-state-info)** → 直接换 |

附〔实测补报〕：App.tsx:88 单人场景 90×90 地板 `color="#10141a"`——3D 侧颜色应走 tokens.json `color.scene.*` → 建议新增 `scene.hallFloor`。

**流程提醒**：动 tokens.json 后必须 `npm run tokens`（prebuild 也会跑）；styles.css 内成对的 `--ui-*` 反相变量（:40-93）是带注释的合法例外，不算此列。

---

## 4. 白天主题链路（洗白根因）

**令牌源**：web/design/tokens.json `theme.light`（15 色：skyTop/skyMid/skyHorizon/sun/hemiSky/hemiGround/fog/ground/road/glassBody/glassHead/wire/dataEdge/rim/shaft/reflect）+ `twin.*`（33 数值）→ `npm run tokens` → web/generated/design-tokens.output.{mjs,css,d.mts}。

**消费图谱**〔实测 grep〕：
- **theme.light（ThemeLight\*）**：WorkdaySky.tsx:43-60（SkyTop/Mid/Horizon、Sun、HemiSky/HemiGround、Fog）；StreetScene.tsx:52-56（Ground/Road/GlassHead/GlassBody/SkyTop/Reflect）；TwinEnvironment.tsx:29-30（HemiGround）；HRStand.tsx:21（GlassBody）；OfficeFacadeInstanced.tsx:23（GlassHead）。
- **twin.\*（Twin\*）**：WorkdaySky（SunIntensityDay/Dusk、Hemi/FillIntensity、ShadowMapSize/Extent/Bias/NormalBias、SunGlowDay/Night）；TwinEnvironment（ExposureDay/Night、EnvIntensityDay/Night）；StreetScene（FogNear/Far、GridOpacityDay/Night、ReflectOpacityDay/Night、GroundEnvIntensity、RoadRoughnessDay/Night、GroundRoughnessDay）；HRStand（ContactOpacityDay）；LotMarkers（BeaconHeightS/A/B）。
- **死令牌（零消费，实测）**：`twin.emissiveDay/Night`、`opacityDay/Night`、`wireOpacityDay/Night`、`rimStrengthDay/Night`、`glassOpacityDay/Night`、`glassRoughnessDay/Night`、`shaftOpacityDay/Night`（7 组 15 个）+ **`ThemeLightRim` / `ThemeLightDataEdge` / `ThemeLightShaft`**（3 个，仅 ThemeLightWire 被 SchrodingerBills:74、ThemeLightReflect 被 StreetScene:124 消费）。→ v4 规格的「玻璃自发光/线框/rim 边缘光/光柱」词汇没有渲染路径。

**洗白根因**〔实测〕：
1. **WorkdaySky.tsx:114-118**——白天/黄昏天色硬编码 RGB 数组，与 ThemeLightSky\* 令牌并存（且 :123-124 非黄昏分支才用令牌）：
```ts
const topRgb = [0xdf, 0xe9, 0xf2]
const midRgb = [0xee, 0xf4, 0xf8]
const horRgb = [0xf7, 0xfa, 0xfc]
const duskMid = [0xf3, 0xd6, 0xb4]
const duskHor = [0xfa, 0xdc, 0xb0]
```
   另 :133-144 合成主光 alt/synthAz/强度硬编码（below 分支）。
2. **HRStand.tsx:72-166 facadeTexture day 调色板**（#dbe7f0→#c2d4e2 底、#8fb0c6/#cfe4f2/#a8c8dd/#8fb4cc 玻璃、#7d97ab 结构线）与 **:168-240 glassTexture day**（#b7d3e8/#94b8d4/#7ea4c2）全部硬编码——这是 64 栋楼立面的实际颜色来源。
3. **OfficeFacadeInstanced.tsx:188-195** body day 色 = ThemeLightGlassHead #f2f7fb（近白）× 天幕 #e4eef6/#f4f8fb——亮度带重叠，无分离。
4. **BoothHardwareInstanced.tsx** day 材质硬编码近白灰（#cdd8e2/:296、:303、#b6c3cf/:313、#94a4b3/:319、#c2cdd8/:325、#b4c1cd/:331、#aebfcc/:337 等 ~12 处）。
→ 建筑/天空/地面同处高亮度带 + 无 rim/描边 = 「洗白」。对照：夜景窗格/灯池成立〔前档 audit C2〕。

**纯令牌可调**（改 tokens.json + npm run tokens，不动代码）：TwinExposureDay、EnvIntensity、Sun/Hemi/FillIntensity、FogNear/Far、GlassRoughness（HRStand 无消费，无效）、Road/GroundRoughness、Grid/ReflectOpacity、ThemeLight\* 全部颜色值本身。
**必须动代码**：上述 1-4 的硬编码调色板；以及**新增 rim/wire 描边渲染**（edges lineSegments 或 onBeforeCompile Fresnel——HRStand.tsx:60-77 已有现成 Fresnel rim 实现范式可抄；注意 T11 共面 z 间隔 ≥0.02m）。

**未提交批次对这两个文件的改动**〔实测 git diff HEAD〕：
- **theme.ts**：删除 `offworkGlow()` / `themeLabel()` / `THEME_BOUNDS` / `DAWN_END`（净删 ~40 行），全项目零消费（grep 实测 0 命中）→ 干净清理，无构建风险；
- **WorkdaySky.tsx**：① skyTex 从 useMemo 副作用改为 useEffect + 卸载/依赖变化时 dispose（修复主题切换每次泄漏一张 GPU 纹理，:291-296）；② sunGlowTexture 模块级单例加「不可 dispose」注释（:188-193）；③ import 增加 useEffect。**无视觉参数变化**，纯内存治理。

---

## 5. 街区摊位渲染与 64 摊个体识别

**渲染方式清单**〔实测〕：

| 组件 | 方式 | per-instance 能力 |
|---|---|---|
| BoothHardwareInstanced.tsx | **15 个 InstancedMesh**（booth/shadow/glow/pole/sign/moneyBase/moneyCut/desk/carpet×2 实例/flagPole/flag + roof×4 按行业分组） | glow（:166-176 delivered 绿/行业色）、sign（:185-194 行业色）、flag（:235-245 行业色）已 setColorAt+instanceColor；roof 材质色按行业固定（:336-341，见下） |
| OfficeFacadeInstanced.tsx | **7 个 InstancedMesh**（body×4 按楼层数 3/4/6/9 + cap + glass + led） | cap（:139-151 行业色 lerp 玻璃头色）、led（:168-178 行业色）已 instanceColor；body 贴图 facadeTexture(floors, day/night)（:118-137） |
| LotMarkers.tsx | LotNumberDecals：8×8 编号图集 + `aCell` 实例属性 + onBeforeCompile UV 重映射，**64 块 = 1 DC**；LotBeacons：稀有度三档高度（TwinBeaconHeightS/A/B）+ 行业色，**1 DC** | 两者均 setColorAt |
| HRStand.tsx | 近景 RealHR GLB（LOD：NEAR=26/FAR=34 滞回，:29-30）+ **每摊独立 mesh 群**：阴影面/窗光外溢面/楼层灯带 0-4 条（:520-527，仅 h>6 的互联网/金融）/屋顶 1-2 mesh 按行业（:528-560）/门 3 mesh（:562-573）/进办公室点击板（:574-585）/**名牌 sprite**（:489-491）/已投递 sprite（:470-477） | 名牌 = **每摊一张独立 CanvasTexture**（useNameTexture :402-433，320×72，编号角标+公司名前 7 字） |
| PlaceholderHRs.tsx | **5 个 InstancedMesh**（身×3/头/发/胸牌/头顶），近景实例移到 y=-9999 | 衣色/发色按 hrIndex（:66-70） |
| BoothProps.tsx | BoothPoles（256 根 1 DC）+ MoneyStacks（2 DC） | 无颜色 |
| StreetScene 内 | ParamSteles 4 IM（碑体/金带/五险灯条×5/顶灯，后两者 instanceColor）、RarityGems 1、RoadLanes 1、DistantSkyline 1、StreetLamps 3（+夜：辉光 points 1 + 光池 1）、WetReflectionBand 4（夜） | ParamSteles bars/lamps 有 instanceColor |

**每摊可用数据字段**（street-companies.ts:11-20）〔实测〕：`id`（`${industry}-${i}`，BoothHardware 的哈希取 `parseInt(id.slice(-2))`）、`name`（每行业 16 个**唯一**公司名，:34-71）、`industry`、`industryLabel`、`tagline`、`params`（5 个词典字段）、`hrIndex`、`lotNo`（01-64 连号）。布局 placeLots()：START_ALONG=14 / SLOT_GAP=3.6 / LOT_OFFSET=7.4（:126-129）。

**现有 per-lot 哈希变化（「动森式门前细节」现状）**：仅两处——
1. 侧旗/旗杆朝向抖动 `rotY = (parseInt(pl.lot.id.slice(-2),10) % 7) * 0.02 - 0.06`（BoothHardwareInstanced:229-244）；
2. 占位人形西装/发色池 + 身高微差按 hrIndex（PlaceholderHRs:66-70 + HRStand:57-58 OUTFITS/HAIRS 各 9/5 色）。

**同构根因**：一切颜色/形状只按 `industry`（4 桶）分化；同一条街 16 摊完全同色同形，可分辨的只有编号牌、名牌、稀有度信标。

**最小 draw call 增量方案（推荐 +0~1 DC）**：
1. **棚顶变色（0 DC）**：roof 4 个 IM 材质加 `vertexColors`，在 :247-270 的分组循环里 `setColorAt` —— 颜色 = 行业色在 HSL 空间按 lotNo 哈希做 hue ±12° / lightness ±8% 扰动（`new THREE.Color(INDUSTRIES[ind].color).offsetHSL(...)`）：
```tsx
// BoothHardwareInstanced.tsx:336-341（现状：同行业同色）
<meshStandardMaterial
  color={night ? '#1b232c' : INDUSTRIES[ind].color}
  roughness={night ? 0.7 : 0.72}
  emissive={INDUSTRIES[ind].color}
  emissiveIntensity={night ? 0.3 : 0.08}
/>
```
2. **旗/门楣 LED/侧招/光环扰动（0 DC）**：这四处已是 instanceColor，把「纯行业色」改成同款哈希扰动（:166-194、:235-245 + OfficeFacade:168-178）。
3. **可选 +1 DC**：门楣下挂「公司色小横匾」InstancedMesh，64 实例 1 DC，图集 + aCell + onBeforeCompile 完全复用 LotMarkers.tsx:30-137 的现成模式（图集内容可按 name 首字/行业 icon）。
- 扰动源建议用 `lotNo`（稳定、连号、跨主题不变）；幅度控制在同行业仍读成「一族」（可访问性规则「状态不靠颜色单编码」不受影响——颜色仅装饰）。
- 改后用 tools/shoot-street.cjs 复测 draw calls / fps（§9）。

---

## 6. 投递反馈链 + 金色粒子挂点

**链路**〔实测〕：
1. 入口：LotCard「📮 投简历」按钮 → `onDeliver`（StreetScene.tsx:1194 附近）；
2. **handleDeliver**（StreetScene:1238-1247）：
```ts
setDeliveries((d) => [...d, { id: Date.now(), from: [p.x, p.z], to }])
setDelivered((s) => new Set([...s, lot.id]))
setXpFlash((f) => f + 1)
showToast(`简历已投递 · ${lot.name}`)
```
3. 世界层反馈：`<DeliveryFX>`（组件 :748-800：飞袋 0.85s 抛物线 + 金环爆开 + 金色 pointLight 26→0；挂载 :1341-1343）；
4. toast：DOM `.game-toast`（:1395-1397，showToast :1220-1228，2.4s 自动消失）；
5. XP：xpFlash → hudState（:1252-1257）→ GameHud.tsx:30-33 `.xp-pop`（+10 XP 浮字）+ .xp-fill 进度条（XP 公式来自 tokens.game.*，GameHud.tsx:19-21）；
6. 世界常驻信标：已投递绿章 sprite（HRStand:470-477，y=3.12）+ LotBeacons 行业色鳍；
7. 持久化：saveStreetProgress（StreetScene:1214-1216 → progress.ts:153-168）。

**「金色粒子从摊位飞向 HUD」自然挂点**（推荐 A+B 组合）：
- **A（世界层，瞬时 +1 DC）**：DeliveryFX 已持有 `d.to`（摊位坐标）并在 t∈[0.7,1.15] 播金环+点光——在同段加一个 `THREE.Points`（10-20 粒、ColorBrandGold、加性混合、depthWrite=false），起点摊位上方炸开随相机上升；粒子贴图直接复用 lampGlowTexture（StreetScene:543-556）。
- **B（屏幕层，0 DC）**：StreetScene 返回的相对定位 div（:1250 `position:'relative'`）内加 DOM 粒子：handleDeliver 时用 `cameraRef`（:1258 已保存 camera）把摊位世界坐标 `project()` 成屏幕坐标，动画一枚金点飞向 `.game-hud`（top:10 right:10，styles.css:640-652），落点与 xp-pop 出现对齐。与「诚实」铁律无冲突（反馈的是已发生的投递，非假进度）。

---

## 7. 单人模式相机与低薪构图崩溃

**相机定义**〔实测〕：mode='single' 渲染 `<Scene>`（App.tsx:393-401），Scene 内：
```tsx
// App.tsx:81 —— 固定机位，不随参数变
<Canvas dpr={[1, 2]} camera={{ position: [3.1, 2.1, 4.3], fov: 45 }}>
// App.tsx:108 —— 固定目标
<OrbitControls target={[-0.4, 0.7, 0]} maxPolarAngle={Math.PI / 2.1} />
```
（roam=true 时才换 RoamCamera，App.tsx:95-101。）

**钞票山包围盒从哪拿（不改 MoneyMountain/SchrodingerBills 内部）**：
- a) 解析式〔推荐〕：params.ts:43-49（BILL / yuanToStacks / MOUNTAIN_SCALE=2.5 / MOUNTAIN_HEIGHT_SCALE=16）+ layerLayout（:60-77）——CompanyPlot.tsx:62-69 的 `mountainH` 已经是同源计算（层数 × 0.005 × 16），footprint = min(3,n)×0.155×2.5；直接复用/上抛即可；
- b) 实测式：在 CompanyPlot 对 `<group key={growthKey}>`（:95）挂 ref，`new THREE.Box3().setFromObject(group)`——**组件外部**取包围盒，不动内部。

**低薪构图崩溃根因**〔实测 + 推断〕：
1. 山高线性于层数：默认 base=15万（dictionary/hr-dictionary.json:19 default=150000）→ 30 沓 → 4 层 → **0.32m**；6-10万 → 2-3 层 → 0.16-0.24m。相机/目标固定 → 主体占画面高 <8%，90×90 深色地板（App.tsx:85-89 `#10141a`）占 >80%；
2. **CompanyPlot.tsx:116-119 数据浮标引线定长 0.56m**：山 0.16m 时引线 = 山体 3.5 倍，读作「断线 + 悬空标签」：
```tsx
<mesh position={[-0.5, mountainH + 0.27, -1.5]}>
  <boxGeometry args={[0.014, 0.56, 0.014]} />
```
3. **SchrodingerBills.tsx:50-51 悬浮钞票固定 y 1.6-3.2（绝对高度）**：低薪山 0.2m 时蓝钞与红山完全脱接，「期权云」成无主漂浮物。
   ```ts
   out.push([Math.cos(a) * r, 1.6 + rand() * 1.6, Math.sin(a) * r])
   ```

**场景地面/背景装饰**（单人）：地板 App.tsx:85-89（#10141a 硬编码）；GlowPath 26 块砖 position=[-1.9,0,3.2]（GlowPath.tsx:57-60）；CarvedZone 灰钱堆 [1.6,0,-1.2]（CarvedZone.tsx:46）；AssetProp 逛厂币捆 [1.7,0,1.1]（CompanyPlot:99-101）；AvatarActor [-1.9,0,2.0]（CompanyPlot:105-109）；WorkdaySky 天幕穹顶。

**改法建议**（不动两个禁改组件内部）：
1. Scene（App.tsx:52-110）按 params 计算机位：target.y = clamp(0.35, mountainH×0.55, 0.9)、相机距离 = k × max(footprint, 2.2)；最小改法是只调 OrbitControls target 与 camera.position 初值，params/growthKey 变化时 lerp 过渡；
2. 浮标引线高度改 `max(0.56, mountainH*0.5)`（CompanyPlot:116-119）；
3. Schrodinger 悬浮带若要跟山耦合：在 CompanyPlot 给 `<SchrodingerBills>` 外包一层 `<group position={[0, mountainH - δ, 0]}>`（外壳变换，不进组件内部）。

---

## 8. focus 特写机位

**代码与当前参数**〔实测〕：RoamCamera.tsx:16-35（focus 分支全貌）：
```ts
// RoamCamera.tsx:27-34
const candA = { x: focus.x - fx * 5.8 + sx * 4.2, z: focus.z - fz * 5.8 + sz * 4.2 }
const candB = { x: focus.x - fx * 5.8 - sx * 4.2, z: focus.z - fz * 5.8 - sz * 4.2 }
// 优先落在道路廊道内（离任一道路中心线更近），避免钻进街角建筑
const roadness = (c) => Math.min(Math.abs(c.x), Math.abs(c.z))
const pick = roadness(candA) <= roadness(candB) ? candA : candB
desired.set(pick.x, p.y + 1.85, pick.z)   // 人眼高度
look.set(focus.x, p.y + 1.15, focus.z)
```
- focus 目标来源：NearSampler（StreetScene:876-882）把 8.5m 内最近摊位坐标写入 `refs.focus.current`；
- 四个可调数字集中在这 8 行：后退 5.8 / 侧偏 4.2 / 眼高 +1.85 / 视线高 +1.15。

**「横幅抬高 / 灯柱避让 / 前景淡出」落点**（⚠ 这三个词在代码中不存在〔实测 grep 0 命中〕，属规划语汇；以下为最可能实体的〔推断〕映射）：
- **横幅抬高** → 若指摊位雨棚/门楣压视线：棚顶 y=2.36 在 BoothHardwareInstanced（roof 矩阵 :255-270，立柱 2.32 在 BoothProps.tsx:18-59）；门楣 LED y=2.62 在 OfficeFacadeInstanced:171；若指区门牌坊横梁（y=5.6，StreetScene:718）。抬高 0.3-0.4m 即可让 +1.85m 眼高视线不穿棚顶；
- **灯柱避让** → 两个候选实体：① 路灯柱 across=±6.4（StreetScene:568-571）——机位通常落在 across≈1.6 走廊内不挡，但侧偏 4.2m 斜向时可能入画 → 在 RoamCamera:27-31 候选打分加「离最近灯柱距离」项；② **摊位侧旗杆/侧招柱**（局部 x=-1.3/-1.5，BoothHardware:200-245）在 candA 方向正处相机-名牌视线之间 → 避让 = 候选选择避开旗杆侧，或旗杆挪到局部 -z 角；
- **前景淡出** → 现状无任何淡出机制（材质 opacity 全固定）〔实测〕。最小实现：RoamCamera focus 分支驱动一个共享 fade 状态（refs/store），对「相机-焦点连线穿过」的元素做透明度——候选材质：BoothHardware glow（:313-317 已 transparent）/sign/flag、OfficeFacade glass（:207-211 已 transparent）、HRStand 名牌 sprite（:489-491）。注意 T11 铁律：新增透明层勿制造共面 z-fighting。

---

## 9. draw call 现状

**静态清单**（street 场景；组件结构〔实测〕，总数为〔推断〕估算）：
- InstancedMesh 池：PlaceholderHRs 5 + OfficeFacadeInstanced 7 + BoothHardwareInstanced 15 + LotMarkers 2 + BoothPoles 1 + MoneyStacks 2 + ParamSteles 4 + RarityGems 1 + RoadLanes 1 + DistantSkyline 1 + StreetLamps 3（夜 +2）+ WetReflectionBand 4（夜）≈ **46 DC**；
- Roads 组 ~18（地面/两条路/反射带/12 条斑马线/转盘/孪生网格）+ DistrictRoadSigns 4 + ArchWay 4×~11=44 + NavPillar ~10 + 引导带 4 + 点击面/画廊入口 ~3 ≈ **80 DC**；
- **HRStand 每摊独立 mesh 群 = 64 × (6~11) ≈ 400~700 DC —— 最大剩余池**（阴影面/外溢面/灯带 0-4/屋顶 1-2/门 3/名牌/已投递章）；
- NPC×4 + AvatarActor + CandidateBooth：GLB 内部 mesh 数未逐个数。
- 历史锚点〔前档 factbase §4.2〕：改造前实测 **2136 DC**（红线 ≤200）；M6a/b/c 后无实测记录 → 建议本轮改完复测留档。

**工具**〔实测〕：
- tools/shoot-street.cjs —— 1280×720 四机位（hero/focus/walk/deliver）+ `gl.info.render.calls` max/min 采样 + fps（:59-92）；
- tools/accept-street.mjs —— egolite 验收：首屏 canvas=0 → 点「招聘街区」→ 15s 后读 drawCalls → 截图 C:/tmp/gc-accept-street.png；
- **无独立 draw call 门禁脚本**（check-contrast.mjs / check-panel-ink.mjs 只管对比度与面板墨色）。
- 边界〔前档 lessons §7.3〕：egolite 渲染不了街区级 WebGL（2136 DC 黑帧）→ draw call 实测走 shoot-street.cjs（headless Edge）或真机，别用 egolite。

---

## 10. 附：新未跟踪文件说明

- **web/src/components/hr/FactoryWizard.tsx + FactoryWizard.css**：HR 建厂五步向导（P4 争取项：公司认证/传空间照片/结构化参数/预览闸门/发布；三档诚实降级通道 replay/local/live，「演示回放」chip 常驻）。**全项目零 import（grep 实测）——尚未接线**，不进任何 chunk，不影响现有构建。来源 = 上一会话 00:35 批次的产物，主代理提交时注意它目前未被使用。
- **tools/accept-street.mjs**：第 1 周还债项验收脚本（诊断版），见 §9。

---

## 11. 验证边界（本图的证据与未验项）

- **做了**：逐文件读取（App.tsx / styles.css 全文 / theme.ts / params.ts / sunPosition.ts / WorkdaySky / TwinEnvironment / CompanyPlot / MoneyMountain / SchrodingerBills / CarvedZone / GlowPath / StreetScene 全文 / BoothHardwareInstanced / OfficeFacadeInstanced / LotMarkers / HRStand / BoothProps / PlaceholderHRs / GameHud / RoamCamera / NPC / street-companies / accept-street.mjs / FactoryWizard 头部）；git diff HEAD（theme.ts、WorkdaySky.tsx）；Select-String 行号锚点；全 src grep（@media、硬编码色、Twin/Theme 令牌消费面、横幅/淡出/避让、preset-b）；与前会话 audit.md / factbase.md 交叉印证。
- **没做**（本任务只读侦察）：npm run typecheck、vite preview、浏览器渲染截图、draw call 实测、对比度脚本复算（1.13:1 等数字引自项目自测注释〔前档〕，未独立重算）。各节「改法建议」的验证步骤已就地标注。
- 修改侧红线提醒：动 tokens.json 必须 `npm run tokens`；3D 组件矩阵写 useLayoutEffect；共面装饰 z 间隔 ≥0.02m；`@manycore/aholo-viewer` 留在 optimizeDeps.exclude。
