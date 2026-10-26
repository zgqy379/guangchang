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
  [*在线 Demo*], [#link("https://zgqy379.github.io/guangchang/")[https://zgqy379.github.io/guangchang/]],
  [*Demo 视频*], [#link("https://zgqy379.github.io/guangchang/demo-video.mp4")[https://zgqy379.github.io/guangchang/demo-video.mp4]],
  [*魔搭创空间*], [#link("https://modelscope.cn/studios/zgqy379/guangchang3d")[modelscope.cn/studios/zgqy379/guangchang3d]],
  [*源代码*], [#link("https://github.com/zgqy379/guangchang")[github.com/zgqy379/guangchang]],
  [*团队*], [必胜客的汉堡最好吃（3FO4K4VY3D07 · 单人）],
)

= 问题概要：offer 谈判里的"感知错配"

求职谈判中，HR 用"薪资结构、五险一金基数、期权、弹性工时"四类话术包装 offer；求职者只能靠想象把数字换算成生活质量——而想象力天然偏向乐观。*画的饼很大，砌出来的山很小*：base 15 万的"年薪"在真实钞票体积下只有 15cm 高的一小摞，低基数社保被切走的部分、16 薪里藏着的加班夜晚，全部不可见。

*逛厂的回答：把参数砌成 3D 的山，把工时砌成天上的月亮。* 年薪越高、钱山越高；14/16 薪的增量必须用橙色分色分垒；五险一金缴费基数越低，被切走的"灰色切口"越大；下班时间越晚，太阳落下、月亮升高、整条街入夜。所有换算遵守附录 A 的真实钞票几何（百元钞 155×77×0.1mm，5 万一沓），水平等比放大 2.5×、高度做感知增强并在场景内诚实标注，公司之间的比例严格真实。

= 产品形态：3D 招聘街区（v2）

v1 是参数可视化单场景；v2 按用户洞察升级为*可逛的招聘会街区*——访客以 3D 形象在十字路口漫游：

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
  [Lux3D 文生 3D], [HR 形象生成 10 款、上线 9 款，全链路（生成→绑骨→Idle 重定向→Draco 压缩 41MB→1.7MB）、求职者形象、逛厂币（真钞 prompt 被内容审核拦截后合规转向虚构币）], [玩家与 HR 的近景 3D 形象（HR 共用玩家 idle 动画）；远景/加载期低模回退],
  [Lux3D 图生], [W1 实测图生形象 ×2，照片生成自己 3D 形象的链路已打通（本地后端脚本，未进公开 Demo）], [公开 Demo 使用预生成形象；自拍原图不入库、不上传],
  [Aholo API / MCP], [Lux3D 与 World 的批量生成、绑骨、资产回传与参数存档均走官方 API（Key 仅存本地 `.env`）], [迭代存档 `docs/iterations/`（prompt/参数/失败版本全留痕）],
  [SpatialGen 世界生成], [纯文案生成四行业办公室（互联网/金融交易大厅/智造展厅/文创 Loft）], [四大街区办公空间可进入参观],
  [Aholo Viewer], [3DGS 浏览器选型与接入], [办公室漫游渲染层（SPZ 4-5MB 移动端友好）],
  [Aholo Reality], [照片/视频重建实测：定点全景摇镜因无平移视差失败，待真实行走素材重测；另以 InteriorGS（HF gated 数据集）作真实扫描对照，本地 Viewer 渲染验收], [公开 Demo 不含 Reality 重建结果；受限资产与截图均不随公开仓库/部署分发],
  [LuxReal], [街区大屏宣传片的规划内容源（AI 视频创作）], [大屏组件已就绪，视频资产接入中],
)

*主要工具与素材授权*：前端与 3D 场景为 React + Vite + three.js / R3F（MIT）；Draco 解码器自托管（Apache-2.0，`web/public/draco/`）；角色 idle/walk 动画来自 Mixamo（Adobe 许可，嵌入 GLB 随项目使用，不作独立动画再分发）；Pexels 5483080 仅用于 World 重建的失败对照测试，未进入公开 Demo；Aholo 生成资产遵循 Aholo 服务条款；完整清单见仓库 `THIRD_PARTY_NOTICES.md`。

#figure(
  grid(
    columns: 3,
    gutter: 6pt,
    image("iterations/lux3d-avatar/2026-10-26-avatar-v2/preview.png", width: 100%),
    image("iterations/lux3d-avatar/2026-10-26-avatar-v3/preview.png", width: 100%),
    image("iterations/lux3d-money/2026-10-25-fantasy-banknote/preview.png", width: 100%),
  ),
  caption: [关键资产迭代（Lux3D）：同一 prompt 模板的两次形象生成（风格方差实测 → 锚定筛选，左为最终玩家形象）/ 逛厂币（真钞 prompt 被内容审核拦截后合规转向虚构币）],
) <fig-iteration>

= 诚实降级：为什么我们不假装能现场生成

逛厂的公开 Demo 里没有"上传一张照片，浏览器当场长出一个 3D 模型"。我们没有用假进度条把这件事盖过去，而是把整条链路拆成三段，并在界面上明确标出当前演示落在哪一段。

#quote(block: true)[
  本期公开 Demo 启用的是 `replay` 通道：它播放的是*真实链路*的阶段叙事与*真实耗时*，最终产物是预先生成的真实模型文件。它不是浏览器现场算出来的，我们不这么称。
]

== 三段通道与各自的适用场景

- *`replay` 演示回放（当前启用）*：预置产物 + 本地时间轴驱动。适用于没有后端的静态部署——公开 Demo、评审现场、录屏。等待态的阶段文案、进度算法、失败处理、退出机制与真实链路完全相同，只有"数据从哪来"不同。
- *`local` 本机脚本*：用户在自己的机器上跑 `tools/gen_*.py`，产物落盘后替换资源即生效。适用于开发者自测与愿意在本机等待的进阶用户。Lux3D 图生实测 76–108 秒，World 空间重建实测 652 秒。
- *`live` 实时 API*：由后端代理持有 Aholo Key 并轮询任务状态。适用于正式上线。当前 Demo 未部署后端，故未启用。

关键在于*等待态与数据源解耦*：三段通道进入的是同一套状态机，界面代码里没有一处按通道分支。因此接入后端时，等待态、进度条、阶段步骤条、失败文案、后台化与最小化胶囊*一行都不用改*——只需要换一个数据源。

== 三个必须主动说清的地方

*其一，我们确实没有在浏览器里现场生成的能力。* Aholo Lux3D 与 World 的生成是服务端任务，API Key 绝不能进前端（`web/src` 中无任何 Key 引用是本项目的安全底线）。若把预置产物包装成"正在生成"，就是当着评审的面画饼——与本项目的名字正好相反。

*其二，真实链路确实存在，而且跑通过。* 公开 Demo 改用回放，不是因为没做，而是因为没有后端：图生链路的实测耗时 76–108 秒，空间重建 652 秒（10 分 54 秒），现场演示既跑不完，也不该假装跑得完。整条链路的 prompt、参数与失败版本都留痕在 `docs/iterations/`，其中包括真钞 prompt 被内容审核拦截（provider status=4）后合规转向虚构"逛厂币"的完整记录。Demo 现场展示的全部资产都是这条链路真实产出的——被加速的是*等待过程*，不是*生成结果*。

*其三，我们把"要等多久"写在最显眼的位置。* 回放按 4.2 倍与 25 倍加速播放，但界面上的*剩余时间始终是真实剩余*——形象生成按 85 秒先验、空间生成按 652 秒先验，每秒刷新。观众同时看到"已经过了多久"与"真实链路还要多久"，而不是一个被压缩过、让人误以为很快的数字。回放徽标常驻且不可隐藏，完成页标注"此为预置的真实生成产物（回放），非本次即时生成"。

== 这与评分项的关系

*关于完成度*：Demo 里"照片到 3D 形象"这条线，我们提供的是纯前端能兑现的那一半——用户上传的照片被本地裁切、调色后作为面片贴进 3D 形象，全程在浏览器内完成、不上传、不留存，约 1 秒。这不是降级的妥协，而是真实能力；"把照片重建成 3D 网格"那一半，我们诚实地标注为回放。两者在界面上分开呈现，不混为一谈。

*关于技术栈运用*：Aholo Lux3D 负责形象与逛厂币的全链路生成（生成、绑骨、Idle 重定向、Draco 压缩，41MB 到 1.7MB），SpatialGen World 负责四行业办公室空间，Aholo Viewer 负责浏览器内 3DGS 漫游。回放机制本身也是这条技术栈的产物——预置产物的真实耗时与阶段划分来自实测，不是估算。

*关于产品哲学*：这个项目叫"把画的饼，砌成真的山"。*把没砌成的山说成砌成了，就是画饼。* 所以参数用真实钞票几何换算，生成能力用真实耗时标注——我们对别人的饼严格，对自己更严格。

= 工程事实与诚实声明

- 全部 64 摊位参数由*词典 JSON Schema 驱动*（`dictionary/*.json`），HR 面板、3D 渲染、名片浮板同源——改词典即改产品
- 防博弈规则写进渲染：期权视觉体积 ≤ base 山 ×2（超出封顶并标注）；base 与增量分色分垒不允许混山
- 性能：64 摊位 + 4 套 3DGS 按需加载；桌面实测 50–87fps（场景含 2136 draw call 基线，后续以实例化与 LOD 优化）；首屏 gzip 约 305KB
- *诚实声明（2026-10-26）*：HR 真 GLB ×9 的 *自带 idle clip 是 T-pose*（资产侧问题），近景验收曾整体消失；隔离验证确认 HR 与玩家为同一套 52 根 Mixamo 骨，运行时改用玩家 idle clip 驱动，近景真模已恢复（提包/西装/自然站姿），占位仅用于远景与加载回退。街角办公楼体块穿插已同步修复（摊位起点 10→14m）
- 安全与合规：API Key 仅存 `.env`（gitignored），历史提交经 `git log -p` 审计无泄漏；受限授权资产（InteriorGS）及其截图/渲染图均不进公开仓库与公开部署，公开 URL 验证 404；自拍原图不入库，公开 Demo 仅使用预生成形象；Demo 中公司与薪资均为虚构样例
- 视觉：本轮已补夜景窗格、摊位雨棚/侧招、四区路面路牌、投递世界标记与进度条化 HUD；规格与实拍存档 `docs/design/` 与 `docs/figures/`

= 展望

街区是产品的"逛"，词典是产品的"真"。下一阶段：接入真实 GitHub 数据的求职者地砖路（贡献热力=脚下的路）；HR 侧反向看求职者参数山（双向可视化）；多街区扩展与多人同游。

*别听他说，自己去看。*
