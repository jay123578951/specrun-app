import { defineNitroConfig } from 'nitropack/config'

// dev port 3210 由 package.json 的 dev:server script 以 --port 指定（v2 config 無 port 選項）
export default defineNitroConfig({
  compatibilityDate: '2026-08-14',
  srcDir: 'server',
})
