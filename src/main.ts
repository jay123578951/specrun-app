import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'

import 'virtual:uno.css'

// 字體逐字重引入，Vite 打包成本地資產（Tauri 離線需求，不走 CDN）
import '@fontsource/manrope/400.css'
import '@fontsource/manrope/500.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/700.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/lora/500.css'
import '@fontsource/lora/600.css'
// TC 走官方 IBM 套件的 unicode-range 分片（fontsource 無此字體），瀏覽器按需載入
import '@ibm/plex-sans-tc/fonts/split/woff2/hinted/IBMPlexSansTC-Regular.css'
import '@ibm/plex-sans-tc/fonts/split/woff2/hinted/IBMPlexSansTC-Medium.css'
import '@ibm/plex-sans-tc/fonts/split/woff2/hinted/IBMPlexSansTC-SemiBold.css'

// 放最後：base 樣式要蓋過 preset reset
import './styles/tokens.css'

createApp(App)
  .use(createPinia())
  .mount('#app')
