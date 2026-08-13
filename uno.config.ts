import { defineConfig, presetWind4 } from 'unocss'

// 刻意不定義 theme/tokens——視覺基礎由後續 design change 專門處理
export default defineConfig({
  presets: [
    presetWind4(),
  ],
})
