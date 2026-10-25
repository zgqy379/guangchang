import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export default defineConfig({
  plugins: [react()],
  // GitHub Pages 部署在 /guangchang/ 子路径（本地 dev 不受影响）
  base: process.env.VITE_BASE || '/',
  // 词典 JSON 在仓库根 /dictionary，开发时放行 fs 访问
  server: { fs: { allow: [repoRoot] } },
  // aholo-viewer 自带 worker（splat-worker.js），依赖预打包会丢失它
  optimizeDeps: { exclude: ['@manycore/aholo-viewer'] },
})
