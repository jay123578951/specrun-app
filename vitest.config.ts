import { defineConfig } from 'vitest/config'

// 目前只測純函式（shared normalize、server utils）；元件測試進來再談環境與 setup
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
})
