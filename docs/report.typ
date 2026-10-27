// 逛厂项目报告书 v3.1（提交版 · 2026-10-28；v3.1 = 对抗审查后的事实口径修订：盲审轮数/DC 实测/replay 接线状态）
#set page(paper: "a4", margin: (x: 2.0cm, y: 2.2cm), numbering: "1 / 1")
#set text(font: ("Microsoft YaHei", "Noto Sans SC", "SimHei"), size: 10pt, lang: "zh", region: "cn")
#set heading(numbering: "1.1")
#set par(justify: true, leading: 0.78em)
#show heading.where(level: 1): it => { v(0.55em); text(size: 15pt, weight: 700, fill: rgb("#c23a2b"))[#it]; v(0.25em) }
#show heading.where(level: 2): it => { v(0.35em); text(size: 11.5pt, weight: 650)[#it]; v(0.15em) }

#align(center)[
  #image("figures/og-image.png", width: 100%)
  #v(0.55em)
  #text(size: 10pt, fill: rgb("#666"))[参数空间化 3D 求职招聘街区 · 项目报告书 v3.1]
  #v(0.1em)
  #text(size: 9pt, fill: rgb("#888"))[群核科技 Aholo 全球 3D AI 黑客松 · 2026-10-28 · 必胜客的汉堡最好吃（3FO4K4VY3D07 · 单人队）]
]

#v(0.5em)
#table(
  columns: (auto, 1fr),
  inset: 5pt,
  align: horizon,
  fill: (x, y) => if y == 0 { rgb("#f5f6f8") },
  [*在线 Demo*], [#link("https://zgqy379.github.io/guangchang/")[https://zgqy379.github.io/guangchang/]],
  [*魔搭创空间*], [#link("https://modelscope.cn/studios/zgqy379/guangchang3d")[modelscope.cn/studios/zgqy379/guangchang3d]],
  [*Demo 视频*], [#link("https://zgqy379.github.io/guangchang/demo-video.mp4")[https://zgqy379.github.io/guangchang/demo-video.mp4]],
  [*源代码*], [#link("https://github.com/zgqy379/guangchang")[github.com/zgqy379/guangchang]],
  [*素材授权*], [仓库 `THIRD_PARTY_NOTICES.md` · MIT License],
)

#v(0.4em)
#block(fill: rgb("#f7f8fa"), inset: 10pt, radius: 4pt)[
  *一句话*：逛厂把薪资 offer 从一张表格，变成一条可以走进去、逐家对照的 3D 招聘街区。\
  *四个可玩场景*：逛一家（参数→山）/ A/B 对比 / 办公室 3DGS 漫游 / 64 摊招聘街区。\
  *技术底座*：Aholo Lux3D 生成角色与钞票资产，SpatialGen 生成四行业办公室，Aholo Viewer 承载 3DGS 漫游；前端 React + R3F，全部资产预生成、滑杆实时驱动。\
  *本报告*：记录从创意、资产迭代、工程事故到十四轮 agent 盲审（含停止规则与视觉冻结）的完整过程——包括没做成的部分。
]

= 问题：offer 谈判里的“感知错配”

求职谈判中，HR 用“薪资结构、五险一金基数、期权、弹性工时”四类话术包装 offer；求职者只能靠想象把数字换算成生活质量——而想象力天然偏向乐观。*画的饼很大，砌出来的山很小*：base 15 万的“年薪”在真实钞票体积下只有 15cm 高的一小摞，低基数社保被切走的部分、16 薪里藏着的加班夜晚，全部不可见。

*逛厂的回答：把参数砌成 3D 的山，把工时砌成天上的月亮。* 年薪越高、钱山越高；14/16 薪的增量必须用橙色分色分垒；五险一金缴费基数越低，被切走的“灰色切口”越大；下班时间越晚，太阳落下、月亮升高、整条街入夜。所有换算遵守附录 A 的真实钞票几何（百元钞 155×77×0.1mm，5 万一沓），水平等比放大 2.5×、高度做感知增强并在场景内诚实标注，公司之间的比例严格真实。

#figure(
  table(
    columns: (2.4cm, 1fr, 1fr),
    inset: 5pt,
    align: horizon,
    fill: (x, y) => if y == 0 { rgb("#f5f6f8") },
    table.header([*产品*], [*3D 的角色*], [*信息如何表达*]),
    [招聘网站 / App], [无 3D], [文字、表格、标签；靠阅读与想象],
    [虚拟招聘会 / 元宇宙], [3D 展台是外壳], [点进去仍是文字/视频，3D 不承载信息],
    [*逛厂*], [*信息本身就是空间*], [参数→山高/碑灯/天色；可以走进去、并排对照、逐家验证],
  ),
  caption: [与招聘网站/虚拟招聘会的差异：3D 不是外壳，而是信息本身。],
)

#figure(
  grid(
    columns: 2,
    gutter: 5pt,
    image("figures/single-2026-10-27/single-high-polish9.png", width: 100%),
    image("figures/single-2026-10-27/single-low-polish9.png", width: 100%),
  ),
  caption: [同一套相机与材质，只改薪资参数：高总包是齐腰的山，低总包是脚边的一摞。山高严格线性，低薪不许虚高——这是“数据即景观”的诚实面，也是本项目的签名时刻。],
) <fig-signature>

= 产品：一条用数据砌成的街

v1 是参数可视化单场景；v2 按用户洞察升级为*可逛的招聘会街区*——访客以 3D 形象在十字路口漫游：

- *四大领域街区*：互联网 / 金融 / 智造 / 文创四条街自十字路口展开，共 *64 个招聘摊位*（每街两侧各 8 个），天际线按行业差异化（互联网平顶广告牌、金融尖顶、智造水塔、文创坡顶）
- *摊位三件套*：HR 的 3D 形象（Lux3D 批量生成 ×9 款、绑骨；HR 自带 idle clip 为 T-pose，运行时改用玩家同 52 骨 Mixamo idle，驱动近景真模）；参数具象化（钱袋堆 / 参数碑：碑高=总包、5 灯条=五险、顶灯=下班时间）；身后办公空间门面——点击进入该公司风格的 3DGS 办公室参观
- *交互闭环*：走近摊位弹名片（总包/下班/基数/招聘口号）→ 投简历（简历袋抛物线飞向钱山）→ 加入对比篮 → 一键进入 A/B 对比看两座山并排；中央导航柱一键传送四区；NPC 求职者在人行道往来
- *工时天空的街区级叙事*：把下班时间拖到 23:00，整条街只剩互联网区的窗还亮着——加班不再是数字，是街景
- *作品廊*：独立 Canvas 场景，求职者的作品环绕展位；从街区内路牌进入（“我的”页入口随双角色流程接入），与街区共用同一套资产与令牌

*第一屏不是 3D*：角色门是一道纯 SVG 的双龛选择——求职者 / HR 分别代入视角进入街区；默认焦点是“直接逛招聘街区”。它把首屏的 3D 资产请求归零（0 个 GLB / 0 个 canvas / 0.31MB），也让第一次点击就有明确的身份代入。（形象装配与照片贴入路径的组件已就绪，随双角色流程接入公开导航）进入后，四种模式共享同一套数据与 HUD：逛一家看参数如何长成山，A/B 把两家 offer 并排，办公室漫游进入 SpatialGen 的空间，招聘街区则是 64 家公司的可逛广场。

*街区里的反馈是空间因果，不是弹窗*：HR 不是一张卡片，而是一个可走近、可投递、可对比的 3D 角色；投递后，简历袋飞向钱山、绿标落在摊位上方、XP 在 HUD 里结算——每一次点击都能在场景里找到它的落点。

#figure(
  grid(
    columns: 2,
    gutter: 5pt,
    image("figures/street-2026-10-27/rolegate-street.png", width: 100%),
    image("figures/street-2026-10-27-polish9/mobile/mobile-expanded.png", width: 52%),
  ),
  caption: [第一屏角色门：求职者 / HR 双龛，纯 SVG、零 3D 资产、零 WebGL 上下文（首屏 canvas=0）/ 390px 移动端：顶栏两行、导航器折叠为圆钮、CTA 不被裁切。],
) <fig-gate>

#figure(
  grid(
    columns: 2,
    gutter: 5pt,
    image("figures/street-2026-10-27-polish9/hero.png", width: 100%),
    image("figures/street-2026-10-27-polish9/walk.png", width: 100%),
    image("figures/street-2026-10-27-polish9/focus.png", width: 100%),
    image("figures/street-2026-10-27-polish9/deliver.png", width: 100%),
  ),
  caption: [招聘街区实拍（2026-10-27 polish9）：鸟瞰四区与中央光柱 / 越肩漫游与游戏 HUD / 走近摊位的真 HR·钱堆·参数碑 / 投递结算（toast + XP + 世界内“已投递”绿标）],
) <fig-street>

#figure(
  grid(
    columns: 2,
    gutter: 5pt,
    image("figures/street-2026-10-27-polish9/night/hero.png", width: 100%),
    image("figures/street-2026-10-27-polish9/night/walk.png", width: 100%),
  ),
  caption: [夜间同一街区的两套光照：四区色带 + 路灯光池 + 中央光枢 / 入口霓虹门楼与地面投光字。颜色即导航，不必读字。],
) <fig-night>

= 数据即景观：把 offer 读成地形

*编码总表*是产品真正的“词典”：新增编码必须先入表，再做实现。

#table(
  columns: (2.2cm, 3.6cm, 1fr),
  inset: 5pt,
  align: horizon,
  fill: (x, y) => if y == 0 { rgb("#f5f6f8") },
  table.header([*数据维度*], [*空间载体*], [*诚实约束*]),
  [总包], [钞票山高度 / 体积], [严格线性映射；放大系数常驻披露],
  [五险一金], [碑身灯条格数], [一格=一档，禁连续渐变伪装精度],
  [下班时间], [碑顶灯色温], [18:00 暖 → 23:00 冷，连续可读],
  [行业], [四区色带 + 门楣 LED], [色相锚点间隔 ≥60°],
  [公司稀有度], [宝石 + 光柱档位], [S/A/B 三档，不做假连续],
  [投递状态], [绿信标 + ✓ 浮标], [全场景唯一绿色语义],
  [距离], [邻近米数 + 小地图], [三源互证：门牌 / 罗盘 / 米数],
)

*防博弈规则写进渲染*：期权视觉体积 ≤ base 山 ×2（超出封顶并标注“期权视觉体积按规则封顶”）；base 与增量分色分垒，不允许混山；五险一金低基数以“切口”呈现被切走的部分。规则不是文案提示，是几何约束——这正是“把没砌成的山说成砌成了，就是画饼”的反面。

*词典即引擎*：64 个摊位的参数全部由 `dictionary/*.json` 的 JSON Schema 驱动，HR 面板、3D 渲染、名片浮板同源；改词典即改产品，加词条零前端代码。求职者侧使用同一套词典绑定（`candidateDictionary`），为后续“双向反画饼”留出接口。

#figure(
  image("figures/street-2026-10-27-polish9/focus.png", width: 92%),
  caption: [特写同框：真 HR + 身后钱堆 + 参数碑（碑高=总包 / 灯条=五险 / 顶灯=下班）+ 左下名片三数值。一个画面同时回答“给多少钱、交多少金、几点下班”。],
) <fig-focus>

= Aholo 技术栈：唯一的内容生产引擎

逛厂把 Aholo 作为整个产品唯一的内容生产引擎，而不是“生成一张图当贴图”：

#text(size: 9pt)[
#table(
  columns: (2.5cm, 1fr, 4.4cm),
  inset: 4.5pt,
  align: horizon,
  fill: (x, y) => if y == 0 { rgb("#f5f6f8") },
  table.header([*能力*], [*逛厂用法*], [*产物 / 实测*]),
  [Lux3D 文生 3D], [HR 生成 10 款、上线 9 款；玩家 3 版；逛厂币], [76–108s/个；风格一致性可复现],
  [Lux3D 图生 3D], [照片→3D 形象链路打通（本地脚本）], [76.8s/个；自拍原图不入库],
  [Lux3D auto-rig / retarget], [角色绑骨 + Idle/Walk 动画重定向], [43MB → Draco 3.08MB],
  [SpatialGen / World], [纯文案生成四行业办公室], [652s/次；SPZ 4–5MB],
  [Aholo Viewer], [React 内嵌 3DGS 漫游，按需加载], [四套办公室，门面可点击进入],
  [Aholo API / MCP], [批量生成、绑骨、资产回传、参数存档], [prompt/参数/失败版本全留痕],
  [Aholo Reality], [照片/视频重建实测：摇镜无平移视差失败], [不进公开 Demo；失败记录保留],
  [LuxReal], [后续宣传片内容源（规划）], [本期未使用，不冒充],
)
]

== 关键资产迭代：失败也是资产

*真钞 → 逛厂币（最有故事的失败）*。最初用“Chinese 100 yuan banknotes”prompt 生成钞票山，服务端连续返回 `provider status=4`——与《人民币图样使用管理办法》的合规预判互证。随后用中性金币堆做对照（成功，107.8s / 16MB），再转向虚构“逛厂币”（成功，107.2s / 21MB），Instanced Mesh 几何不变、只换贴图。失败没有藏起来：三版 prompt、耗时、失败码全部存档在 `docs/iterations/lux3d-money/`。

*Avatar 风格锚定*。三款文生 Avatar 用同一模板改单变量（基础 / 眼镜 / 马尾）：Q 版卡通风格统一、结构完整无破面、单变量精确生效——批量生成的一致性前提成立。玩家形象最终选用 v3；v2 的写实方向被否决，理由与截图一起存档。

*HR 管线*。10 款 HR 生成后上线 9 款；资产自带 idle clip 是 T-pose（资产侧问题），但 HR 与玩家共用同一套 52 根 Mixamo 骨，运行时改用玩家 `avatar-idle.glb` 的 clip 驱动近景真模，占位低模只用于远景与加载回退。41MB 原始 GLB 经 Draco + WebP 压到 1.7MB。

#figure(
  grid(
    columns: 3,
    gutter: 5pt,
    image("iterations/lux3d-avatar/2026-10-26-avatar-v2/preview.png", width: 100%),
    image("iterations/lux3d-avatar/2026-10-26-avatar-v3/preview.png", width: 100%),
    image("iterations/lux3d-money/2026-10-25-fantasy-banknote/preview.png", width: 100%),
    image("iterations/lux3d-avatar/2026-10-26-rig-v2/preview-rigged.png", width: 100%),
    image("iterations/lux3d-money/2026-10-25-gold-coins/preview.png", width: 100%),
    image("iterations/lux3d-avatar/2026-10-26-img2avatar-2026-02-/preview.png", width: 100%),
  ),
  caption: [关键资产迭代（Lux3D）：Avatar v2→v3 的风格锚定 / 真钞被审核拦截后转向虚构逛厂币 / 绑骨结果 / 金币对照 / 图生形象。每一版 prompt、参数与成败都在 `docs/iterations/`。],
) <fig-assets>

== 四套办公室与 3DGS 的诚实边界

SpatialGen / World 以纯文案生成四套行业办公室，经 Aholo Viewer 在浏览器内以 3DGS 漫游（SPZ 4–5MB，按需加载）。*诚实边界*：3DGS 资产的精度仍是瓶颈——薄壳状点云、细节依赖滚轮缩放；我们修掉了“相机站在点云外壳内”的取景事故（改为全量包围盒外 `radius×1.6`），但没有把低精度资产说成“实景扫描级”。办公室模式的定位是“可以走进去感受空间气质”，不是“1:1 数字孪生”。

= 诚实降级：为什么不假装能现场生成

逛厂的公开 Demo 里没有“上传一张照片，浏览器当场长出一个 3D 模型”。我们没有用假进度条把这件事盖过去，而是把整条链路拆成三段，并在界面上明确标出当前演示落在哪一段。

#quote(block: true)[
  公开 Demo 展示的生成产物来自 `replay` 通道的预置资产：等待态播的是*真实链路*的阶段叙事与*真实耗时*，最终产物是预先生成的真实模型文件。它不是浏览器现场算出来的，我们不这么称。
]

- *`replay` 演示回放（Demo 数据源）*：预置产物 + 本地时间轴驱动。适用于没有后端的静态部署——公开 Demo、评审现场、录屏。等待态的阶段文案、进度算法、失败处理、退出机制与真实链路完全相同，只有“数据从哪来”不同。
- *`local` 本机脚本*：用户在自己的机器上跑 `tools/gen_*.py`，产物落盘后替换资源即生效。Lux3D 图生实测 76–108 秒，World 空间重建实测 652 秒。
- *`live` 实时 API*：由后端代理持有 Aholo Key 并轮询任务状态。当前 Demo 未部署后端，故未启用。

*关键在于等待态与数据源解耦*：三段通道进入的是同一套状态机，界面代码里没有一处按通道分支。接入后端时，等待态、进度条、阶段步骤条、失败文案、后台化与最小化胶囊*一行都不用改*——只需要换一个数据源。

*把“要等多久”写在最显眼的位置*：回放按 4.2 倍与 25 倍加速播放，等待态组件已实现“剩余时间 = 真实先验（形象 85 秒 / 空间 652 秒）随回放进度逐秒递减”，回放徽标常驻不可隐藏，完成页标注“此为预置的真实生成产物（回放），非本次即时生成”；该等待态随双角色流程接入公开导航。

*关于完成度*：照片到 3D 形象这条线，纯前端可兑现的那一半（本地处理、不上传不留存）是既定规格——组件骨架与隐私边界已就绪，本地裁切/调色在接入公开导航时完成；当前公开 Demo 的形象获取为预置资产选择。“把照片重建成 3D 网格”那一半，我们诚实地标注为回放。两条路径分开呈现，不混为一谈。

= AI agent 工作流：十四轮盲审与根因事故

这不是一个“agent 一次生成、人类点发布”的项目。街区从 10 月 26 日到 28 日经历了*十四轮独立盲审*（R1–R14）：每轮由未接触实现的临时评审只看截图（昼/夜/移动/单人，每轮 ≤8 图/人），给出短板；实现侧修复后重拍，再进入下一轮。十余名评审、两套截图管线（egolite / Chrome），评审与实现严格隔离；R12 触发“连续两轮不涨即停”规则，按方案 B 换靶两轮后于 R14 宣布视觉冻结。

盲审不是“给 agent 打分”，而是把“哪里不对”变成可执行的修复清单。它逼出了这些根因级事故：

#table(
  columns: (2.5cm, 3.3cm, 4.4cm, 1fr),
  inset: 4.5pt,
  align: horizon,
  fill: (x, y) => if y == 0 { rgb("#f5f6f8") },
  table.header([*事故*], [*现象*], [*根因*], [*定位与修复*]),
  [T13 Canvas DOM], [街区整页崩], [Canvas 内裸 `<div>` / R3F 元素加 `data-*`], [控制台 namespace 错误 → DOM 走 drei `<Html>`，标识改 React key],
  [T14 黑棚顶], [64 栋屋顶纯黑], [`vertexColors=true` 但几何体无 color 属性 → 乘 0], [红帽实验：运行时强制红色 → 删 vertexColors，保留 instanceColor],
  [focus 白幕], [特写全白，四轮未察觉], [64 块无贴图阴影面（3.2×3.2 纯白方块）夜间堆叠], [透明网格全量清单 + 隐藏二分 → 挂径向暗贴图],
  [旧 dist], [截图是旧画面], [tsc 失败时 vite 不跑，dist 保持旧版], [必须看到新的 `✓ built` 再拍；figures 时间戳晚于渲染代码],
  [GcSelect], [14 薪下拉仍显示 12 薪], [select 传展示 label，未传原始存储值], [ParamForm 改传存储值；表单墨色纳入扫描],
)

#figure(
  grid(
    columns: 2,
    gutter: 5pt,
    image("design/reviews/veil-A-allhidden.png", width: 100%),
    image("design/reviews/veil-B-even.png", width: 100%),
  ),
  caption: [白幕定位的隐藏二分：左 = 隐藏全部透明网格（白幕消失，锁定透明层）；右 = 只隐藏偶数层（白幕仍在）。再用 249 个透明网格的运行时清单逐层排除，最终定位到 64 块无贴图的阴影面——这类事故靠“看截图猜”四轮都没找到，靠探针 + 二分一次定位。],
) <fig-veil>

*停止刷分的裁定（R12–R14）*：参数、材质、构图的微调已经进入平台期——评审反复指向的是“统一曝光、阴影落地、立面夜景化、屋顶细节、场景构图”这类设计决策级改造。我们因此停止“刷分”（R12 触发停止规则、R14 冻结视觉），把剩余差距整理成可验收的美术轮次清单，交给设计决策；而不是继续用 agent 的随机微调假装在进步。

*这套过程本身也是作品的一部分*：在一个 AI 黑客松里，agent 不只是生成器，也可以是评审、探针、二分工具与事故记录者。我们把这套流程、失败与修复都留在仓库里（`docs/design/design-audit-2026-10-25.md`、`docs/lessons.md`、`docs/iterations/`），可复核、可复现。

= 工程事实、性能与合规

#figure(
  image("figures/engineering-gains.png", width: 100%),
  caption: [工程还债：首屏 3D 资产请求从 3 个 GLB / 8.49MB 降到 0 个 / 0.31MB；街区 draw calls 从 2136 降到 687。首屏靠“角色门不挂 Canvas”真正归零，而不是只删 preload。],
) <fig-gains>

- *首屏*：0 个 GLB、0 个 canvas；entry 1,017.04kB（gzip 288.42kB，2026-10-28 构建），OfficeViewer 1.95MB 按需加载；远低于 5MB 红线
- *街区*：64 摊 + 四区 + 4 套办公门面，687 draw calls（2026-10-28 实测；≤200 为产品期红线，已列入下一阶段 InstancedMesh / 材质图集 / LOD）；可见页签复测白天 hero 83 / 越肩 45 / 特写 44 fps（桌面集显；此前引用的“越肩 13.5fps”已判定为后台页签限流造成的测量污染，见 lessons §12.2）——移动端真机数据待补，这是已知差距，不藏
- *稳定性*：顶层 + 办公室 + 街区三层 ErrorBoundary；Draco 解码器自托管（4 个文件，无第三方 CDN）；对比篮与街区进度持久化；移动端 390px 顶栏两行、CTA 不裁切
- *安全与合规*：API Key 仅存 `.env`（gitignored），前端零 Key 引用；受限授权资产（InteriorGS、`*.ply`）及其截图/渲染图不进公开仓库与公开部署；公开站使用虚构公司与虚构“逛厂币”；Draco 自托管；第三方素材清单见 `THIRD_PARTY_NOTICES.md`
- *构建*：674 modules，`tsc --noEmit` + Vite；prebuild 自动跑设计令牌、对比度、面板墨色三道门禁；源码公开（MIT）。线上双端为视觉冻结基线（R14），仓库源码含其后的办公室取景修复，随下一轮盲审部署同步

= 评审映射与提交物

#table(
  columns: (1.2cm, 3.2cm, 1fr),
  inset: 5pt,
  align: horizon,
  fill: (x, y) => if y == 0 { rgb("#f5f6f8") },
  table.header([*权重*], [*维度*], [*本项目证据*]),
  [30%], [群核技术栈应用], [Lux3D 角色/钞票全链路、SpatialGen 四办公室、Aholo Viewer 3DGS、API/MCP 批量生产；资产迭代全程存档],
  [25%], [作品有趣程度], [四模式可玩闭环；投递五重同帧反馈；滑杆实时长山；对比篮→A/B；2–3 分钟实机视频],
  [20%], [创新性], [“数据即景观”签名；词典即引擎；防博弈几何；诚实降级三通道],
  [20%], [完成度], [双端在线；首屏 0.31MB；ErrorBoundary；移动端 390；源码公开；报告/视频/素材授权齐备],
  [5%], [传播], [小红书 \#Aholo黑客松（提交前发布）],
)

#table(
  columns: (2.6cm, 1fr),
  inset: 5pt,
  align: horizon,
  fill: (x, y) => if y == 0 { rgb("#f5f6f8") },
  table.header([*提交物*], [*状态 / 链接*]),
  [在线 Demo], [GitHub Pages + 魔搭创空间，双端同源构建（基路径不同、bundle 哈希各异：Pages `index-DBFYuFqn.js` / 魔搭 `index-DUpMgR-n.js`）],
  [Demo 视频], [2–3 分钟实机录屏 + 旁白/字幕，随本报告同目录/链接],
  [项目报告书], [本 PDF（v3.1，2026-10-28）],
  [源代码], [#link("https://github.com/zgqy379/guangchang")[github.com/zgqy379/guangchang]（MIT）],
  [第三方声明], [`THIRD_PARTY_NOTICES.md`：Aholo 能力/受限素材/Mixamo/Pexels/Draco/开源依赖/字体],
  [团队], [必胜客的汉堡最好吃（3FO4K4VY3D07 · 单人队）],
)

= 附录：换算、复现与过程证据

== A · 真实钞票几何与放大系数

- 百元钞 155×77×0.1mm；5 万元 = 500 张 = 一沓 5cm 高。
- 15 万 = 3 沓 = 15cm；100 万 = 20 沓 = 100cm。山高与总包严格线性。
- 水平方向等比放大 2.5×，高度方向做感知增强；放大系数在场景内常驻标注，公司之间的比例严格真实。
- 低薪场景不靠山体虚高解决：用地面等高线、刻度人偶、五险柱廊等道具群补空间叙事（下一阶段）。

== B · 复现与验证

#table(
  columns: (2.2cm, 1fr),
  inset: 5pt,
  align: horizon,
  fill: (x, y) => if y == 0 { rgb("#f5f6f8") },
  table.header([*项*], [*命令 / 证据*]),
  [构建], [`cd web && npm install && npm run build`（prebuild 自动跑令牌 / 对比度 / 面板墨色）],
  [本地预览], [`npx vite preview --port 4173`],
  [线上验收], [`tools/accept-live.mjs`：首屏 canvas=0 → 街区 canvas=1 / drawCalls / 零异常],
  [截图管线], [`tools/shoot-ego-street.mjs` / `tools/shoot-street.cjs`：昼 / 夜 / 移动 / 单人],
  [魔搭上传], [`tools/ms-upload-polish9.py` + `tools/ms-redeploy-ego.mjs`：LFS 0 后重新部署],
)

== C · 过程证据索引

- 设计盲审全文：`docs/design/design-audit-2026-10-25.md` 与 `docs/design/reviews/`（R1–R8 评审原文）
- 踩坑与部署铁律：`docs/lessons.md`（§11 R3F 两颗雷 / 黑棚顶 / 白幕 / stale dist）
- 资产迭代存档：`docs/iterations/`（prompt、参数、耗时、失败版本全留痕）
- 第三方素材：`THIRD_PARTY_NOTICES.md`；许可证：`LICENSE`（MIT）
- 提交清单：`docs/submission-checklist.md`（必交项 / 加分项 / 评审规则）

= 展望

街区是产品的“逛”，词典是产品的“真”。下一阶段：接入真实 GitHub 数据的求职者地砖路（贡献热力=脚下的路）；HR 侧反向看求职者参数山（双向可视化）；多街区扩展与多人同游；以及把街区的 draw call 压到 200 以内、把 3DGS 办公室换成更高精度的资产。

*别听他说，自己去看。*
