import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// 單元與整合測試在 node 跑（IndexedDB 用 fake-indexeddb）；只有元件測試（*.test.tsx）需要 DOM
export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      { extends: true, test: { name: 'node', environment: 'node', include: ['src/**/*.test.ts'] } },
      { extends: true, test: { name: 'dom', environment: 'happy-dom', include: ['src/**/*.test.tsx'] } },
    ],
  },
})
