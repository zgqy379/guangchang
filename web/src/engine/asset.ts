// 资产 URL 工具：拼接 vite base（GitHub Pages 部署在 /guangchang/ 子路径，
// 硬编码 /assets/... 会 404 并让 useGLTF.preload 在模块初始化时抛错——10.27 白屏事故根因之二）
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

export const assetUrl = (path: string) => `${BASE}${path}`
