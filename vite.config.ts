import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    vue(),
    UnoCSS(),
  ],
  server: {
    // Tauri devUrl 寫死 127.0.0.1:5173：host 不綁死會只聽 ::1，
    // WKWebView 對 localhost 走 IPv4 會連不上（白屏）；port 漂移會斷 dev:app
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:3210',
    },
  },
})
