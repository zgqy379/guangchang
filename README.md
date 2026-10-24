# 逛厂 GuǎngChǎng — 把画的饼，砌成真的山

参数空间化 3D 求职招聘平台 · 群核科技 Aholo 全球 3D AI 黑客松参赛项目

- **唯一权威文档**：[`project.md`](./project.md)（v1.1）——所有决策以它最新版为准
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

Demo 已通（脚手架 v0.1）：词典引擎驱动的 HR 参数面板、Instanced Mesh 钞票山
（base/增量分层）、薛定谔钞票（含防博弈封顶）、工时天空（夕阳/月亮）、A/B 对比模式。

## 当前进度与下一步

见 `project.md` 9.3 里程碑表。当前最大欠账：**官方报名组队** 与
**W1 Aholo API 实测**（清单：`docs/w1-api-test-checklist.md`，
Lux3D 经官方 skill 仓库当天可跑：`github.com/manycore-research/Aholo-Lux3D`）。
