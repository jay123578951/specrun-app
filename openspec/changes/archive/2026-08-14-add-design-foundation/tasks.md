# Tasks: add-design-foundation

## 1. 依賴與 tokens

- [x] 1.1 安裝依賴：`@fontsource/manrope`、`@fontsource/ibm-plex-mono`、`@ibm/plex-sans-tc`（fontsource 無 TC 字體，改用官方 IBM 套件，同樣附 unicode-range 分片）、`@fontsource/lora`、`@iconify-json/lucide`
- [x] 1.2 建立 `src/styles/tokens.css`：`:root` 定義色彩 12 token（色板 v2，值照 `docs/ui-structure-decisions.md`）、字體家族 4 token（含 fallback 鏈）、`--sr-shadow-overlay`；註明 elevation 規範（禁 box-shadow）
- [x] 1.3 `src/main.ts` 引入 tokens.css 與各字體字重（Manrope 400/500/600/700、Plex Mono 400/500、Plex Sans TC 400/500/600、Lora 500/600）

## 2. UnoCSS 設定

- [x] 2.1 `uno.config.ts` theme：colors 以 `var(--…)` 接語意名（bg/surface/surface-hover/line/text/text-2/text-3/accent/accent-bright/parked/done/error）
- [x] 2.2 theme `text` 十階具名字級（ui-base/ui-sm/ui-xs/mono-base/mono-sm/read-base/read-h1/read-h2/read-h3/read-code），ui-base 與 read-base 綁行高 1.6/1.85；theme `font` 接四個 token
- [x] 2.3 theme `radius`：DEFAULT 5px／lg 8px（pill 走 preset 內建的 `rounded-full`，該值 preset 硬編為 `calc(infinity * 1px)`、不讀 theme）
- [x] 2.4 啟用 presetIcons（Lucide），確認 `i-lucide-*` 可用

## 3. 驗證頁與收尾

- [x] 3.1 `src/App.vue` 改為 token 取樣頁：色票一排、四字體樣本（含中文段落驗 TC 分片惰性載入）、字級階梯、icon 數枚；全部使用語意 utility，保留 health 顯示
- [x] 3.2 `pnpm dev` 人工驗收：字體正確渲染（DevTools Network 確認 TC 只載用到的分片）、色值與打樣一致、icon 顯示、lint 通過
