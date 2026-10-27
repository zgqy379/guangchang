// 资产 URL 工具：拼接 vite base（GitHub Pages 部署在 /guangchang/ 子路径，
// 硬编码 /assets/... 会 404 并让 useGLTF.preload 在模块初始化时抛错——10.27 白屏事故根因之二）
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

/**
 * 拼接资源 URL。
 * 契约（10.27 白屏事故防线）：path 必须是以 '/' 开头的站内绝对路径，
 * 且不含 '..' 越界段——否则会拼出 404 地址并让 useGLTF 在模块初始化时抛错。
 */
export const assetUrl = (path: string): string => {
  if (!path.startsWith('/')) {
    throw new Error(`assetUrl: 路径必须以 "/" 开头（收到 "${path}"）`)
  }
  if (path.includes('..')) {
    throw new Error(`assetUrl: 路径不得包含 ".." 越界段（收到 "${path}"）`)
  }
  return `${BASE}${path}`
}
