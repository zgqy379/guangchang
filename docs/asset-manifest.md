# 资产预生成清单（Asset Manifest）

> 滑杆实时驱动 = 不能现场等生成。所有参数分支的资产必须提前批量生成并缓存。
> 本表是 W1 实测后开始填充的活文档；"状态"列：`待生成 / 已生成 / 已入库(web/public/assets)`。

## 生成预算估算

- 词典 P0 条目约 8 条 × 平均 4 档 = **~32 个核心资产**
- 按 W1 实测的单次耗时均值估算总工时；若 >10 小时，砍档位（如天空系统改为
  程序化渐变而非多套预渲染）

## P0 资产表

| 资产线 | 条目 | 档位 | 数量 | 格式 | 用途 | 状态 |
|--------|------|------|------|------|------|------|
| avatar | 风格化 Avatar 整体 | 3 款 | 3 | glb(+draco) | 求职者端选择 | 待生成 |
| avatar | 发型/配饰部件 | 3+3 | 6 | glb | 换装演示 | 待生成 |
| avatar | 待机/走路动画 | 2 | 2 | 内嵌 glb | 绑骨后导出 | 待生成 |
| money | 钞票捆贴图（风格可替换） | 2 套 | 2 | ktx2 | 实钞皮肤 + 逛厂币皮肤（7.6 B 方案） | 待生成 |
| money | 薛定谔钞票云 | 1 | 1 | glb | 期权可视化 | 待生成 |
| sky | 天空盒/渐变程序化 | 程序化 | 0 | shader | 夕阳→凌晨月亮连续插值，不预生成 | — |
| office | Reality 重建底稿 | 1 间 | 1 | 3dgs/glb | 示例公司办公室 | 待生成 |
| office | 空间填充物件（椅/桌/绿植/屏） | 4 类 | 4 | glb | 拼装三档管线 | 待生成 |
| props | 虚构公司铭牌 ×3 | 3 | 3 | glb | 9.7 三家公司 | 待生成 |
| props | 竞业旋转门 / 融资脚手架 | 2 | 2 | glb | P1 词典项 | 待生成 |

## 命名规范

```
web/public/assets/<资产线>/<条目>-<档位>.<ext>
例：web/public/assets/avatar/avatar-base-01.glb
    web/public/assets/money/bundle-skin-real.ktx2
    web/public/assets/money/bundle-skin-gc.ktx2   ← 逛厂币 B 方案皮肤
```

## 币面可替换架构（7.6 合规 B 方案）

- 钞票几何统一用 Instanced Mesh，材质贴图运行时可切换
- 皮肤注册表：`web/src/engine/skins.ts` —— `{ real: "bundle-skin-real", gc: "bundle-skin-gc" }`
- 商业版切 `gc` 皮肤只需改一个配置项
