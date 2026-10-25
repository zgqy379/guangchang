// 逛厂项目报告书 · Typst 版（提交用 PDF）
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
  #text(size: 10pt, fill: rgb("#666"))[参数空间化 3D 求职招聘平台 · 项目报告书]
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
  [*源代码*], [link("https://github.com/zgqy379/guangchang")[github.com/zgqy379/guangchang]],
  [*团队*], [必胜客的汉堡最好吃（3FO4K4VY3D07 · 单人）],
)

= 问题概要

招聘行业的核心矛盾是：*信息的表达方式（文字/数字）与人类的感知方式（空间/体积/光线）严重错配。*

“年薪 30 万”“弹性工作制”“快速发展中”——这些文字需要大脑翻译，而翻译过程就是“画饼”的生存空间。人类对空间量的感知是本能的、瞬时的、难以修饰的：一摞到膝盖的钞票和一人高的钞票塔之间的差距，不需要任何解释。

逛厂做的不是“把简历搬进 3D 场景”（形式 3D 化），而是*把信息本身翻译成空间语言*（信息 3D 化）：薪酬变成脚下真实比例的钞票山（15 万＝15cm，100 万＝1m），下班时间变成天空的夕阳或凌晨的月亮，期权变成半透明的“薛定谔钞票”。

= 方案与差异化

- *参数空间化词典*（仓库 \`dictionary/\`，schema 化核心资产）定义“参数→空间”映射规则；HR 面板表单由词典 JSON 自动生成，新增词条零前端开发
- *防博弈设计*（词典 antiGaming 字段与渲染同源）：期权透明度上限 45%、缩放系数 0.5、视觉体积封顶 base×2；14/16 薪增量层强制异色；五险一金缴费基数→“切走部分”随档位缩放
- *双向反画饼*：求职者 GitHub 贡献生成发光地砖路（断更＝断路），与 HR 钞票山同框——“我的森林，换你的山”
- 竞品（直聘系/虚拟招聘会/元宇宙办公）信息仍是文字；逛厂是“信息 3D 化”品类空白

= Aholo 技术栈应用

*逛厂把 Aholo 作为整个产品唯一的内容生产引擎。*

#table(
  columns: (1fr, 1.6fr, 1.4fr),
  inset: 5pt,
  fill: (x, y) => if y == 0 { rgb("#f7e9e7") },
  [*能力*], [*逛厂用法*], [*实测数据*],
  [Lux3D 文生 3D], [Avatar 三款（同模板改单变量）、逛厂币、金币], [76–108s/个；风格锚定通过],
  [Lux3D 图生 3D], [参考照片 → 3D 形象], [76.8s/个，GLB ~20MB],
  [Lux3D auto-rig], [Avatar 自动绑骨], [43MB 带骨骼 GLB],
  [Lux3D retarget], [Idle / Walk / Talking 三动画], [Draco 压至 3.07MB，Demo 实播],
  [World 生成], [纯文案 → 3DGS 办公室], [652s，SPZ 仅 4.1MB],
  [Aholo Viewer], [React 内嵌 3DGS 漫游], [AI 生成/真实扫描双来源],
  [OUS 资产上传], [本地 GLB → 公开直链], [19.6MB 一次通过],
)

== 关键资产迭代对比

*迭代 A：钞票资产“真钞 → 逛厂币”的转向（最有故事的失败）*

#table(
  columns: (auto, 1.6fr, 1.2fr),
  inset: 5pt,
  fill: (x, y) => if y == 0 { rgb("#f0f0f0") },
  [*版本*], [*Prompt 要点*], [*结果*],
  [v1], [Chinese 100 yuan banknotes（真钞）], [✗ provider status=4，疑似货币内容审核],
  [对照 A], [金币堆（中性主题）], [✓ 107.8s · GLB 16MB],
  [对照 B], [fantasy banknote（虚构货币）], [✓ 107.2s → *“逛厂币”转正为视觉锤*],
)

失败本身即产品洞察：真钞可视化存在合规红线（与《人民币图样使用管理办法》预判互证），虚构币面成为主路径，Instanced Mesh 几何不变只换贴图。

*迭代 B：Avatar 风格锚定*——同模板改单变量生成三款（基础/眼镜/马尾），并排截图验证：Q 版卡通风格统一、无破面、单变量精确生效。

*迭代 C：办公室双来源*——AI 生成（World SPZ 4.1MB）与真实扫描（InteriorGS 最强办公室场景 0024）在 Aholo Viewer 中可切换。

== 工程 KPI

#table(
  columns: (1.4fr, 1.2fr, 1.2fr),
  inset: 5pt,
  fill: (x, y) => if y == 0 { rgb("#f0f0f0") },
  [*指标*], [*数值*], [*结论*],
  [首屏主包], [gzip 305KB（Viewer 1.95MB 按需）], [远低于 5MB 红线],
  [冷加载可交互（模拟 3G+4×CPU）], [1.1s（shell）], [完整资产约 5.7MB 流式加载],
  [模拟移动端帧率（4×CPU 节流）], [稳定满帧], [红线 ≥45fps 达标],
  [资产压缩管线], [21MB→2.23MB（-89%）；43MB→3.07MB], [全部进入移动端预算],
  [单次生成耗时], [Lux3D 76–108s；World 652s], [全部预生成，滑杆实时驱动],
  [Demo 视频], [32s 实机录屏（含字幕）], [线上可直接访问],
)

= 技术实现

- *架构*：Vite + React 18 + R3F（可视化）+ #raw("@manycore/aholo-viewer")（3DGS，按需加载）
- *词典引擎*：\`dictionary.schema.json\` DSL（含 antiGaming 字段）+ HR/求职者双词典；表单与渲染同源驱动
- *钞票山*：Instanced Mesh 万级实例单次 draw call；金字塔逐层隆起生长动画；感知放大系数 2.5×（比例关系不变）
- *Avatar 漫游*：点击行走 + WASD + 第三人称跟随 + Walk/Idle 交叉淡化；Walk 动画以 animateInPlace 重制，杜绝根位移叠加
- *工程坑记录*：aholo-viewer worker 与 Vite 预打包不兼容（\`optimizeDeps.exclude\` 解决）；Draco 解码器走 jsdelivr（国内可达）；provider status=4 偶发需重试；生成模型尺寸不可控需归一化（Avatar 1.6m/道具 0.55m）

= 信任机制与长期愿景

双山对比（声明值 vs 实测值，差值高亮渲染）→ Offer 回填 + 在职员工匿名校准（月亮自己从 18:00 滑向 21:30）→ 离职潮检测 → 诚实激励（偏差小于 5% 获"实心山"认证、搜索加权）。每个新用户都让数据更准，这是长期护城河。

= 团队与过程

单人团队（单人预案执行）。AI Agent 深度协作开发流程：全部 API 实测先查清单避免重复、每次生成必存 prompt+参数+成败（\`docs/iterations/\`，报告素材即过程存档）。里程碑：W1 全 API 能力验证 → W2 核心可视化+部署+Demo 视频（32s 实机录屏，线上可访问）→ W3 整合打磨、真机数据。

#v(1em)
#align(center)[#text(size: 9pt, fill: rgb("#888"))[本报告随项目持续更新 · 提交截止 2026-11-19 19:00]]
