import { defineConfig } from 'vitest/config'

// 目前只測純函式（shared normalize、server utils）；元件測試進來再談環境與 setup
// scripts/ 底下是建置期工具（如 build-app-icon.ts），不在 src/server 之列，故另外列入
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'server/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
})
