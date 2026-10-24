import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 不支援單頁應用的路由：直接打開 /iching/gua/3 會找不到檔案。
// 把 index.html 複製成 404.html，Pages 遇到不存在的路徑就會載入它，再交給前端路由。
function spaFallback(): Plugin {
  let outDir = 'dist'
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    configResolved(config) { outDir = resolve(config.root, config.build.outDir) },
    closeBundle() { copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html')) },
  }
}

export default defineConfig(({ command, isPreview }) => ({
  // 正式版部署在 https://openclaw-metis.github.io/iching/；本機開發維持根路徑，vite preview 比照正式版
  base: command === 'build' || isPreview ? '/iching/' : '/',
  plugins: [react(), spaFallback()],
  server: { port: 5181 },
}))
