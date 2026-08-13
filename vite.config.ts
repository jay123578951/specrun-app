import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    vue(),
    UnoCSS(),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3210',
    },
  },
})
