# 逛厂 GuǎngChǎng — 把画的饼，砌成真的山

参数空间化 3D 求职招聘平台 · 群核科技 Aholo 全球 3D AI 黑客松参赛项目

**▶ 在线 Demo：<https://zgqy379.github.io/guangchang/>**（角色门 · 64 摊招聘街区 · 单人漫游 · A/B 对比 · 办公室 3DGS 漫游 · 作品廊）

**▶ Demo 视频：<https://zgqy379.github.io/guangchang/demo-video.mp4>**（2 分 09 秒实机录屏 + 旁白/操作字幕：角色门 → 招聘街区 → 投递 → 对比 → 夜街 → 单人 → Aholo 技术栈）

- **唯一权威文档**：[`project.md`](./project.md)（v1.4.1）——决策与历史以它为准；**最新审查与执行状态见 [`docs/adversarial-review-2026-10-28.md`](./docs/adversarial-review-2026-10-28.md)**
- **项目报告书**：[`docs/report.pdf`](./docs/report.pdf)（v3.3，9 页；源稿 `report.typ`）
- **提交清单**：[`docs/submission-checklist.md`](./docs/submission-checklist.md)（必交项 / 加分项 / 评审规则 / 进度）
- **Demo 视频工程**：[`docs/video/demo-v2/`](./docs/video/demo-v2/)（分幕旁白、overlay、VTT 与素材）
- **第三方素材授权**：[`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md)
- **提交截止**：2026-11-19 19:00

## 仓库结构

```
project.md                  # 项目总文档（Single Source of Truth）
dictionary/                 # 参数空间化词典（核心资产，schema 化）
  ├── dictionary.schema.json
  ├── hr-dictionary.json
  └── candidate-dictionary.json
web/                        # Demo 前端（Vite + React + R3F）
docs/
  ├── iterations/           # Aholo 资产迭代存档（报告书硬性要求，从第一天积累）
  ├── w1-api-test-checklist.md   # Aholo API 实测清单（10.26 前完成）
  ├── asset-manifest.md     # 资产预生成清单
  ├── demo-script.md        # 三家虚构公司 + 演示脚本
  ├── report-skeleton.md    # 报告书骨架（W2 起并行填写）
  └── content-plan.md       # 小红书传播计划
```

## 本地开发

```bash
cd web
npm install
npm run dev      # 开发服务器
npm run build    # 类型检查 + 构建
```

Demo v2（招聘街区版）：角色门、64 摊位四领域街区、游戏化 HUD 与投递进度、参数碑、
词典引擎驱动的 HR 参数面板、Instanced Mesh 钞票山（base/增量分层）、薛定谔钞票（含防博弈封顶）、
工时天空（夕阳/月亮）、A/B 对比模式、Aholo Viewer 办公室 3DGS 漫游、作品廊。
Draco 解码器与全部资产自托管，不依赖第三方 CDN（见 `THIRD_PARTY_NOTICES.md`）。

## 当前进度与下一步

参赛状态：**报名 / 组队 / 提交选题均已完成**（团队 3FO4K4VY3D07，单人队），作品提交入口已开。
交付物：**双端在线 Demo**（GitHub Pages / 魔搭，同源构建——基路径不同 bundle 哈希各异）、**2:09 Demo 视频**（旁白 + 操作字幕）、**9 页报告书 v3.3**、**公开源码（MIT）**、OG 分享图与第三方声明，均已就绪。
待办：**官网正式提交作品**（截止 2026-11-19 19:00；必交项 = Demo 视频/可运行链接 + 报告书 PDF）、小红书发布（#Aholo黑客松，5% 传播分）、移动端真机帧率。
最新状态以 [`docs/adversarial-review-2026-10-28.md`](./docs/adversarial-review-2026-10-28.md) 与 [`project.md`](./project.md) v1.4.1 为准。
