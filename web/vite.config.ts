import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const webRoot = path.dirname(fileURLToPath(import.meta.url))
// 仓库根 = web/ 的上一级。旧值 '../..' 从 web/ 再上两级会误算成 E:\（把整盘塞给 fs.allow），
// 2026-10-27 配置审查修正。
const repoRoot = path.resolve(webRoot, '..')

// 各部署目标的 base 前缀（非路径令牌触发，规避 MSYS 路径改写）
const BASE_TOKENS: Record<string, string> = {
  ghpages: '/guangchang/',
  // 魔搭创空间 static：经 <user>-<space>.ms.show 根域名托管（iframe 直连），base 保持 /
  modelscope: '/',
}

// base 令牌 fail-fast：非空但不在映射表内 → 立刻抛错，禁止静默 fallback 到 '/'。
// 背景（T8）：路径形态的 base 值会被 Git Bash(MSYS) 改写成 C:/Program Files/Git/...，
// 若此处默默取 '/'，构建照样"成功"却在线上白屏——把错误暴露在构建期而非线上。
const baseToken = process.env.VITE_BASE_TOKEN
if (baseToken && !Object.prototype.hasOwnProperty.call(BASE_TOKENS, baseToken)) {
  throw new Error(
    `[vite.config] 未知的 VITE_BASE_TOKEN="${baseToken}"；合法值仅：${Object.keys(BASE_TOKENS).join(' / ')}。` +
      `切勿传入路径形态（如 /guangchang/）——Git Bash(MSYS) 会改写为 C:/Program Files/Git/... 导致线上白屏 ` +
      `（docs/lessons.md §3 铁律 4 / T8）。`,
  )
}

export default defineConfig({
  plugins: [react()],
  // GitHub Pages 部署在 /guangchang/ 子路径。
  // 注意：不要用 VITE_BASE=/guangchang/ 这类路径形态的环境变量——
  // Git Bash(MSYS) 会把路径形态的 env 值自动改写成 C:/Program Files/Git/...
  // 导致线上脚本 404 白屏（10.27 事故）。用非路径令牌触发。
  base: baseToken ? BASE_TOKENS[baseToken] : '/',
  // 开发仅放行 vite 根（web/）与仓库根词典目录 /dictionary，最小化 fs 暴露面
  // （旧配置 allow:[repoRoot] 因 repoRoot 误算为 E:\ 而整盘放行）
  server: { fs: { allow: [webRoot, path.resolve(repoRoot, 'dictionary')] } },
  // aholo-viewer 自带 worker（splat-worker.js），依赖预打包会丢失它
  optimizeDeps: { exclude: ['@manycore/aholo-viewer'] },
})
