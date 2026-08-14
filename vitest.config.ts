import { defineConfig } from 'vitest/config'

// 目前只測 shared 純函式（normalize）；元件測試進來再談環境與 setup
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
})
