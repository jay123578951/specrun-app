import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

// 預設環境是 node：多數測試測的是純函式（shared normalize、server utils），不需要 DOM。
// 元件測試改在各自檔案頂端加 `// @vitest-environment jsdom` 這個 magic comment 單獨切換，
// 不整批改成 jsdom——那會拖慢所有不碰 DOM 的測試。
// vue() 只為了讓 vitest 看得懂 .vue 檔的 SFC 語法；UnoCSS 是建置期產生原子 CSS，
// 元件測試斷言的是行為與屬性，不必也在這裡跑一份。
// scripts/ 底下是建置期工具（如 build-app-icon.ts），不在 src/server 之列，故另外列入
export default defineConfig({
  plugins: [vue()],
  test: {
    include: ['src/**/*.test.ts', 'server/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
})
