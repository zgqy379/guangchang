# 第三方工具与素材授权清单（Third-Party Notices）

逛厂 GuǎngChǎng · Aholo 全球 3D AI 黑客松参赛作品。
本文件对应赛事《参赛作品提交须知》"如实说明主要工具及用途，并遵守相应的许可协议"要求。

## 群核 Aholo（核心创作引擎）

| 能力 | 用途 | 授权 |
|--|--|--|
| Aholo Lux3D（文生 3D / 图生 3D / 绑骨） | 玩家形象、HR 形象 ×10（上线 9）、逛厂币与金币道具 | Aholo 产品服务条款 |
| Aholo SpatialGen / World | 四行业办公室 3DGS 空间（SPZ） | Aholo 产品服务条款 |
| Aholo Viewer（`@manycore/aholo-viewer`） | 办公室漫游渲染层 | MIT |
| Aholo API / MCP | 批量生成、绑骨、资产回传、参数存档 | Aholo 产品服务条款 |
| Aholo Reality | 照片/视频重建实测（定点全景素材失败，未进公开 Demo） | Aholo 产品服务条款 |
| LuxReal | 街区大屏宣传片规划内容源（尚未接入） | Aholo 产品服务条款 |

## 受限 / 未分发素材

| 素材 | 状态 |
|--|--|
| InteriorGS 数据集（HF gated） | 仅本地验证真实扫描对照。**数据、渲染截图均不进公开仓库与公开部署**（`.gitignore` 已封堵 `*interiorgs*`） |
| Pexels 视频 5483080（空办公室定点全景摇镜） | 仅用于 Aholo Reality 重建的失败对照测试；未进入 Demo、未进公开仓库 |
| 用户自拍/办公室照片 | 仅本地用于生成形象；**原图不入库、不上传**；公开 Demo 只使用预生成 3D 形象 |

## 动画与模型

| 素材 | 用途 | 授权 |
|--|--|--|
| Mixamo（Adobe）idle / walk 动画 | 驱动玩家与 HR（同 52 根骨骼），已重定向并嵌入 GLB 随项目使用；不作为独立动画资产再分发 | Adobe Mixamo 许可 |
| Draco GLTF 解码器 | 自托管于 `web/public/draco/`（复制自 three@0.169.0 examples），避免第三方 CDN 单点故障 | Apache-2.0 |

## 开源依赖

React、React DOM、Vite、TypeScript — MIT / Apache-2.0
three.js、@react-three/fiber、@react-three/drei — MIT
@gltf-transform/cli — MIT；style-dictionary — Apache-2.0
Typst（报告排版）— Apache-2.0

完整依赖及版本见 `web/package.json` 与 `web/package-lock.json`。

## 字体

报告 PDF 使用 Microsoft YaHei / Noto Sans SC 排版（PDF 内嵌子集，仅供阅读）。
Web 端使用系统字体栈（PingFang SC / Microsoft YaHei / system-ui），不加载外部字体。

## 内容声明

Demo 中全部公司（不眠星云科技 / 慢山文旅 / 追光新创等）、薪资参数与招聘口号均为**虚构演示样例**；
币面为虚构"逛厂币"，不使用人民币图样；不含真实用户数据与生产环境密钥。
