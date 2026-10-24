import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export default defineConfig({
  plugins: [react()],
  // 词典 JSON 在仓库根 /dictionary，开发时放行 fs 访问
  server: { fs: { allow: [repoRoot] } },
})
