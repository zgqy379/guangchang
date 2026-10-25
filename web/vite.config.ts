import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

// 各部署目标的 base 前缀（非路径令牌触发，规避 MSYS 路径改写）
const BASE_TOKENS: Record<string, string> = {
  ghpages: '/guangchang/',
  // 魔搭创空间 static：经 <user>-<space>.ms.show 根域名托管（iframe 直连），base 保持 /
  modelscope: '/',
}

export default defineConfig({
  plugins: [react()],
  // GitHub Pages 部署在 /guangchang/ 子路径。
  // 注意：不要用 VITE_BASE=/guangchang/ 这类路径形态的环境变量——
  // Git Bash(MSYS) 会把路径形态的 env 值自动改写成 C:/Program Files/Git/...
  // 导致线上脚本 404 白屏（10.27 事故）。用非路径令牌触发。
  base: BASE_TOKENS[process.env.VITE_BASE_TOKEN ?? ''] ?? '/',
  // 词典 JSON 在仓库根 /dictionary，开发时放行 fs 访问
  server: { fs: { allow: [repoRoot] } },
  // aholo-viewer 自带 worker（splat-worker.js），依赖预打包会丢失它
  optimizeDeps: { exclude: ['@manycore/aholo-viewer'] },
})
