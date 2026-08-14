# Proposal: add-design-foundation

## Why

C0 骨架已就緒但零視覺決策；C1 起所有 UI change 都需要統一的視覺基礎（design tokens、字體、icon、間距），否則各 change 只能各自 hardcode 樣式，C7 精修時全面返工。UI 設計討論已完成收斂（結構、色彩、字體、字級、實作決策全記於 `docs/ui-structure-decisions.md`），本 change 把這些決策落成可用的程式基礎。

## What Changes

- **Design tokens**：色板 v2（12 個色彩 token）以 CSS variables 定義於 `:root`，UnoCSS theme 引用 `var()`，元件用語意化 utility（不得 hardcode 色值）
- **字體管線**：自架打包 Manrope（UI）／IBM Plex Mono（slug、代碼）／IBM Plex Sans TC（繁中內容）／Lora（wordmark 專用），TC 用現成 unicode-range 分片；不依賴 CDN（Tauri 離線需求）。前三者走 `@fontsource`，TC 走官方 `@ibm/plex-sans-tc`（fontsource 沒有這個家族）
- **字級 token**：十階字級表（UI 三階＋mono 兩階＋閱讀五階），階數鎖死
- **間距／圓角**：4px 基準間距階（4–48）；圓角三階 `rounded` 5px／`rounded-lg` 8px／`rounded-full`（pill）
- **Elevation 規範**：不用 box-shadow，靠 surface 色階＋1px 邊框分層；浮層保留一種弱陰影
- **Icon 系統**：UnoCSS preset-icons ＋ Lucide
- **驗證頁**：現有 hello 頁改用 tokens 渲染（字體、色彩、字級各取樣），證明管線通；非正式 UI
- **不包含**：任何業務 UI 元件（C1 起）、亮色主題（暗色優先，日後再加）、動效實作（依 ui-motion skill 隨元件實作）、C7 視覺精修

## Capabilities

### New Capabilities

（無——本 change 為視覺基礎工程，不引入規格層行為，`.openspec.yaml` 宣告 `skip_specs: true`；設計決策的權威來源是 `docs/ui-structure-decisions.md` 與本 change 的 design.md）

### Modified Capabilities

（無）

## Impact

- 新增依賴：`@fontsource/manrope`、`@fontsource/ibm-plex-mono`、`@ibm/plex-sans-tc`、`@fontsource/lora`、`@iconify-json/lucide`
- `uno.config.ts`：theme 接 CSS variables、preset-icons 啟用；語意 utility 直接由 theme 的語意色名產生（`bg-surface`、`border-line`…），不需另建 shortcuts
- 新增 `src/styles/`（tokens.css：色彩＋字體家族＋浮層陰影 variables）
- `src/main.ts`：引入字體與 tokens.css
- `src/App.vue`：hello 頁改用 tokens 取樣渲染
