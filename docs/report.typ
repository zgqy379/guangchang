// 逛厂项目报告书 v2（街区版叙事 · 提交用 PDF）
#set page(paper: "a4", margin: (x: 2.2cm, y: 2.4cm), numbering: "1 / 1")
#set text(font: ("Microsoft YaHei", "Noto Sans SC", "SimHei"), size: 10.5pt, lang: "zh", region: "cn")
#set heading(numbering: "1.1")
#set par(justify: true, leading: 0.8em)
#show heading.where(level: 1): it => { v(0.6em); text(size: 15pt, weight: 700, fill: rgb("#c23a2b"))[#it]; v(0.3em) }
#show heading.where(level: 2): it => { v(0.4em); text(size: 12pt, weight: 650)[#it]; v(0.2em) }

#align(center)[
  #text(size: 24pt, weight: 800, fill: rgb("#c23a2b"))[逛厂 GuǎngChǎng]
  #v(0.2em)
  #text(size: 13pt)[把画的饼，砌成真的山]
  #v(0.2em)
  #text(size: 10pt, fill: rgb("#666"))[参数空间化 3D 求职招聘街区 · 项目报告书 v2]
  #v(0.1em)
  #text(size: 9pt, fill: rgb("#888"))[群核科技 Aholo 全球 3D AI 黑客松 · 2026-10]
]

#v(0.6em)
#table(
  columns: (auto, 1fr),
  inset: 6pt,
  align: horizon,
  fill: (x, y) => if y == 0 { rgb("#f0f0f0") },
  [*在线 Demo*], [link("https://zgqy379.github.io/guangchang/")[https://zgqy379.github.io/guangchang/]],
  [*魔搭创空间*], [link("https://modelscope.cn/studios/zgqy379/guangchang3d")[modelscope.cn/studios/zgqy379/guangchang3d]],
  [*源代码*], [link("https://github.com/zgqy379/guangchang")[github.com/zgqy379/guangchang]],
  [*团队*], [必胜客的汉堡最好吃（3FO4K4VY3D07 · 单人）],
)

= 问题概要：offer 谈判里的"感知错配"

求职谈判中，HR 用"薪资结构、五险一金基数、期权、弹性工时"四类话术包装 offer；求职者只能靠想象把数字换算成生活质量——而想象力天然偏向乐观。*画的饼很大，砌出来的山很小*：base 15 万的"年薪"在真实钞票体积下只有 15cm 高的一小摞，低基数社保被切走的部分、16 薪里藏着的加班夜晚，全部不可见。

*逛厂的回答：把参数砌成 3D 的山，把工时砌成天上的月亮。* 年薪越高、钱山越高；14/16 薪的增量必须用橙色分色分垒；五险一金缴费基数越低，被切走的"灰色切口"越大；下班时间越晚，太阳落下、月亮升高、整条街入夜。所有换算遵守附录 A 的真实钞票几何（百元钞 155×77×0.1mm，5 万一沓），水平等比放大 2.5×、高度做感知增强并在场景内诚实标注，公司之间的比例严格真实。

= 产品形态：3D 招聘街区（v2）

v1 是参数可视化单场景；v2 按用户洞察升级为*可逛的招聘会街区*——求职者以 3D 形象在十字路口漫游：

- *四大领域街区*：互联网 / 金融 / 智造 / 文创四条街自十字路口展开，共 *64 个招聘摊位*（每街两侧各 8 个），天际线按行业差异化（互联网平顶广告牌、金融尖顶、智造水塔、文创坡顶）
- *摊位三件套*：HR 的 3D 形象（Lux3D 批量生成 ×9 款、绑骨；HR 自带 idle clip 为 T-pose，运行时改用玩家同 52 骨 Mixamo idle，驱动近景真模）；参数具象化（钱袋堆/参数碑：碑高=总包、5 灯条=五险、顶灯=下班时间）；身后办公空间门面——点击直接进入该公司风格的 3DGS 办公室参观
- *交互闭环*：走近摊位弹名片（总包/下班/基数/招聘口号）→ 投简历（简历袋抛物线飞向钱山）→ 加入对比篮 → 一键进入 A/B 对比模式看两座山并排；中央导航柱一键传送四区；NPC 求职者在人行道往来
- *工时天空的街区级叙事*：把下班时间拖到 23:00，整条街只剩互联网区的窗还亮着——加班不再是数字，是街景

#figure(
  grid(
    columns: 2,
    gutter: 6pt,
    rows: 2,
    image("figures/street-2026-10-26/hero.png", width: 100%),
    image("figures/street-2026-10-26/focus.png", width: 100%),
    image("figures/street-2026-10-26/walk.png", width: 100%),
    image("figures/street-2026-10-26/deliver.png", width: 100%),
  ),
  caption: [街区实拍（2026-10-26）：鸟瞰四区（夜景窗格/路面区名）/ 走近摊位（真 HR·钱堆·参数碑·雨棚·名片同框）/ 越肩漫游与游戏 HUD / 投递反馈（toast + XP + 世界内“已投递”标记）],
) <fig-street>

= Aholo 官方能力运用（创作过程 × 项目成果）

#table(
  columns: (auto, auto, auto),
  inset: 6pt,
  [*能力*], [*创作过程*], [*项目成果*],
  [Lux3D 文生 3D], [HR 形象 ×10 全链路（生成→绑骨→Idle 重定向→Draco 压缩 41MB→1.7MB）、求职者形象、逛厂币（真钞 prompt 被内容审核拦截后合规转向虚构币）], [玩家与 HR 的近景 3D 形象（HR 共用玩家 idle 动画）；远景/加载期低模回退],
  [Lux3D 图生], [W1 实测图生形象 ×2，照片生成自己 3D 形象的链路已打通（Demo 期提供本地后端脚本）], [形象选择器样例],
  [SpatialGen 世界生成], [纯文案生成四行业办公室（金融交易大厅/智造展厅/文创 Loft）], [四大街区办公空间可进入参观],
  [Aholo Viewer], [3DGS 浏览器选型与接入], [办公室漫游渲染层（SPZ 4-5MB 移动端友好）],
  [Aholo Reality], [InteriorGS 真实扫描办公室接入与验收], [本地版"真实扫描"来源（受限授权不进公开部署，报告存档）],
  [LuxReal], [街区大屏宣传片的规划内容源（AI 视频创作）], [大屏组件已就绪，视频资产接入中],
)

= 工程事实与诚实声明

- 全部 64 摊位参数由*词典 JSON Schema 驱动*（`dictionary/*.json`），HR 面板、3D 渲染、名片浮板同源——改词典即改产品
- 防博弈规则写进渲染：期权视觉体积 ≤ base 山 ×2（超出封顶并标注）；base 与增量分色分垒不允许混山
- 性能：64 摊位 + 4 套 3DGS 按需加载；桌面实测 50–87fps（场景含 2136 draw call 基线，后续以实例化与 LOD 优化）；首屏 gzip 约 305KB
- *诚实声明（2026-10-26）*：HR 真 GLB ×9 的 *自带 idle clip 是 T-pose*（资产侧问题），近景验收曾整体消失；隔离验证确认 HR 与玩家为同一套 52 根 Mixamo 骨，运行时改用玩家 idle clip 驱动，近景真模已恢复（提包/西装/自然站姿），占位仅用于远景与加载回退。街角办公楼体块穿插已同步修复（摊位起点 10→14m）
- 安全：API Key 仅存 `.env`（gitignored），历史提交经 `git log -p` 审计无泄漏；受限授权资产（InteriorGS）不进公开部署，公开 URL 验证 404
- 设计品质由*独立设计评审盲审*持续把关（视觉总监 + 空间设计师，只看截图）；最新独立盲审视觉 5.5 / 空间 4.5（前两轮 6.5/6.1、6.0/6.0），仍未过 7 分门禁；本轮已补夜景窗格、摊位雨棚/侧招、四区路面路牌、投递世界标记与进度条化 HUD。剩余差距集中在电影感灯光/辉光、摊位个体识别度、小地图导航信息，规格与实拍存档 `docs/design/` 与 `docs/figures/`
- 自评分（按官方权重）：技术栈 27/30 · 有趣 21/25 · 创新 18/20 · 完成度 17/20 · 传播 0/5（小红书待发布）≈ *83/100*

= 展望

街区是产品的"逛"，词典是产品的"真"。下一阶段：接入真实 GitHub 数据的求职者地砖路（贡献热力=脚下的路）；HR 侧反向看求职者参数山（双向可视化）；多街区扩展与多人同游。

*别听他说，自己去看。*
