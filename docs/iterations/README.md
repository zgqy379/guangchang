# 迭代存档规范（报告书硬性要求，从今天开始）

> 评审要求"关键资产迭代对比"——即同一资产的 v1→v2→v3 演进史。
> **只截成功图拼不出"迭代"**：每次生成必须同步保存 prompt、参数、失败结果。
> 最后一周补不回来。

## 目录结构

```
docs/iterations/
├── README.md                 # 本文件
├── prompt-log.md             # 全局生成日志（每次一行，见下方模板）
├── lux3d-avatar/             # 每条资产线一个目录
│   ├── 2026-10-26-v1/
│   │   ├── input.png         # 输入（自拍/参考图）
│   │   ├── output/           # 输出（模型/截图/预览）
│   │   └── meta.json         # 本次生成的完整参数
│   └── 2026-10-28-v2/
├── lux3d-props/              # 空间填充资产（桌椅/绿植/展台）
├── reality-office/           # 办公室重建
├── spatialgen-space/         # 空间生成
└── luxreal-video/            # Demo 视频迭代
```

## meta.json 模板（每次生成必填）

```json
{
  "date": "2026-10-26T14:30:00+08:00",
  "pipeline": "lux3d",            // lux3d | reality | spatialgen | luxreal
  "assetLine": "avatar-hairstyle", // 资产线名
  "version": "v1",
  "prompt": "完整的原始 prompt，一字不改",
  "negativePrompt": "",
  "params": { "mode": "pro", "seed": 123456 },
  "input": "input.png",
  "output": ["output/avatar.glb", "output/preview.png"],
  "result": "success | partial | failed",
  "notes": "发型边缘有破面，下一步加 negative prompt",
  "nextAction": "v2：seed 固定，改材质描述"
}
```

## prompt-log.md 每行模板

```
| 时间 | 资产线 | 版本 | 结果 | 一句话结论（给报告书直接引用） |
|------|--------|------|------|------------------------------|
| 10-26 14:30 | avatar-hairstyle | v1 | ⚠ | 边缘破面；风格偏写实，需加"stylized, Zepeto-like" |
```

## 报告书"迭代对比"页的最低要求

每个核心资产线（Avatar / 办公室 / 空间填充 至少各一条）：

1. 同一资产的 v1 / v2 / v3 截图并排（失败版本也是素材——"从写实到风格化的取舍"就是好故事）
2. 每版对应的 prompt 差异高亮
3. 一句话说明为什么迭代（发现了什么问题）

## 纪律

- **生成完立刻存档**，不当场记录的参数等于没生成
- 失败结果不删——报告书里"我们如何调 prompt"的过程比成功本身更有说服力
- 每周日例会检查：本周生成次数、存档完整率、有迭代对比的资产线数量
