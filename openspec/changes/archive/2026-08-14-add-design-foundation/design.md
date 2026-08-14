# Design: add-design-foundation

## Context

見 proposal.md - Why。所有視覺決策（色板 v2、字體選型、字級表、間距／圓角／elevation／icon）已於 UI 設計討論收斂，**數值的權威來源是 `docs/ui-structure-decisions.md`**（風格層決策＋實作決策段落），本文件不重抄數值表，只記「怎麼落地」的技術決策。打樣參照 `docs/style-preview.html`。

約束：UnoCSS 已裝但零設定（C0 刻意留白）；未來要套 Tauri（WKWebView、離線執行）；日後可能加亮色主題。

## Goals / Non-Goals

**Goals**
- C1 起任何元件都能只用語意 token 完成樣式，不需要（也不允許）hardcode 色值／字級
- 字體離線可用，中文分片按需載入
- token 命名與 `docs/ui-structure-decisions.md` 的表一一對應，兩邊可互相查對

**Non-Goals**
- 亮色主題的實際定義（但架構要留門，見 D1）
- 動效 token（時長／曲線由 ui-motion skill 的表管，元件實作時引用，不在此重複建 token）
- 互動八態樣式（ui-interaction-states skill 管，隨元件實作）

## Decisions

### D1. Token 載體：CSS variables 定義、UnoCSS theme 引用

`src/styles/tokens.css` 於 `:root` 定義全部 token（色彩 12 個＋字體家族 4 個＋浮層陰影 1 個），`uno.config.ts` 的 theme 以 `var(--…)` 引用，元件寫語意 utility（`bg-surface`、`text-text-2`、`border-line`…）。

- 為什麼不直接把色值寫進 uno theme：日後亮色主題只要換 `:root` 一層（或加 `[data-theme]` scope），元件零改動；DevTools 檢查元素時看得到語意名，除錯體驗好。
- **變數一律加 `--sr-` 前綴**（`--sr-bg`、`--sr-font-ui`、`--sr-shadow-overlay`）：presetWind4 會依 theme 自動產生 `--colors-*`／`--font-*`／`--text-*`／`--radius-*`，同名會寫成 `--font-ui: var(--font-ui)` 這種循環參照。前綴同時讓「我們的 token」與「preset 產生的」在 DevTools 一眼分得開。
- 為什麼不用 antfu-design 的完整 class-based 體系自建一套：方向一致（語意化、不 hardcode），但規模縮到本 App 夠用即可，避免為單一 App 維護一套 design system 框架。

### D2. 字體管線：字體套件自架、main.ts 顯式引入字重

依賴 `@fontsource/manrope`（400/500/600/700）、`@fontsource/ibm-plex-mono`（400/500）、`@ibm/plex-sans-tc`（Regular/Medium/SemiBold）、`@fontsource/lora`（500/600），於 `src/main.ts` 逐字重 import；Vite 打包成本地資產。

- 為什麼不用 Google Fonts CDN：Tauri 離線需求＋啟動不吃網路延遲。
- **TC 為什麼不走 fontsource**：`@fontsource/ibm-plex-sans-tc` 不存在——Google Fonts 沒有這個家族（Plex 只有 JP/KR/Thai/Arabic 等），fontsource 只鏡像 Google Fonts。改用 IBM 官方的 `@ibm/plex-sans-tc`，它同樣附 `fonts/split/woff2/hinted/` 分片（每字重 206 片＋unicode-range CSS），惰性載入機制不變。
- 為什麼不自跑 subset 工具：上述套件已含現成 unicode-range 分片，瀏覽器按需載入，效果等同 subset 而零維護。
- 代價記錄：IBM 的分片按碼位切、非按字頻，一段中文會命中約 50 片（~1.1MB）。因為是本地資產、無網路往返，接受。
- font-family token：`--sr-font-ui`（Manrope）、`--sr-font-mono`（IBM Plex Mono）、`--sr-font-tc`（IBM Plex Sans TC，fallback `PingFang TC`）、`--sr-font-serif`（Lora，僅 wordmark）。Manrope 不含中文字形，UI 內若出現中文自然 fallback 到 TC 鏈——`--sr-font-ui` 的 fallback 鏈尾接 TC 與系統字。

### D3. 字級：UnoCSS theme `text` 十階、行高綁定

十階字級表（見 docs 表）落成 uno theme `text` 具名階（presetWind4 的 fontSize 對應 key 叫 `text`，字體家族叫 `font`）：`ui-base`／`ui-sm`／`ui-xs`／`mono-base`／`mono-sm`／`read-base`／`read-h1`／`read-h2`／`read-h3`／`read-code`，`ui-base` 與 `read-base` 綁預設行高（1.6／1.85），其餘階承接父層行高。

- 為什麼用具名階不用 uno 預設數字階（text-sm/text-base）：階數紀律——預設階是開放集合，具名階是封閉集合，元件想用第十一階時必須先來改這裡，蔓延會被 review 看見。
- theme 是深合併，光是寫進 `theme.text` 只會「多出」具名階、預設階仍在。用 `configResolved` 把 `theme.text` 與 `theme.radius` 整組換掉，封閉集合才真的封閉（`text-xl`、`rounded-sm` 產不出來）。

### D4. 間距與圓角：沿用 uno 4px 預設階＋自訂 radius

間距直接用 UnoCSS 預設 4px 基準階（`p-4` = 16px），不自訂——我們的 4–48 階本來就是它的子集，規範寫在用法（寬鬆取大一階）不寫在設定。圓角自訂 theme `radius`：`DEFAULT` 5px、`lg` 8px，並停用其餘預設階。

- pill 不進 theme：presetWind4 的 `rounded-full` 硬編為 `calc(infinity * 1px)`，比對 `full` 這個 key 之前就回傳了，寫 `full: 999px` 是讀不到的死設定。pill 一律用 `rounded-full`（WKWebView 支援 `calc(infinity * …)`）。

### D5. Elevation：色階分層，單一浮層陰影

層次＝surface 色階＋1px border，全域禁 box-shadow；唯一例外 `--sr-shadow-overlay`（dropdown、toast 用的弱陰影）。寫進 tokens.css 註解與本文件，C1 起 review 據此把關。

### D6. Icon：preset-icons ＋ Lucide

`uno.config.ts` 啟用 `presetIcons`，依賴 `@iconify-json/lucide`，用法 `i-lucide-*`。純 CSS icon、隨用隨打包，無 runtime 請求。

- 為什麼 Lucide：線條圓潤度與 Manrope 氣質相配、devtool 圈主流、覆蓋齊全（park/restore/settings/external-link 等本 App 需要的都有）。

### D7. 驗證頁：App.vue 改為 token 取樣頁

hello 頁改成渲染：色票一排、四字體樣本各一行（含中文段落驗 TC 分片）、字級階梯、icon 數枚——用且僅用語意 utility。目的是人工驗收「管線通、值正確」，不是正式 UI（C1 會整頁換掉）。

## Risks / Trade-offs

- [TC 字體打包體積（全分片數 MB）] → 分片為多個 woff2、瀏覽器按 unicode-range 惰性載入，實際只抓用到的片；驗證頁的中文段落即是驗此機制（實測 666 個 @font-face 只下載 54 個）
- [chip 半透明底用 `color-mix()`，WKWebView 需 Safari 16.2+] → 本 App 是個人工具、目標機為新版 macOS，接受；若 M4 打包時遇舊系統，改預先算好的 rgba token，僅動 tokens.css
- [Manrope 無中文字形，中英混排時 fallback 字重不完全一致] → fallback 鏈固定為 Plex Sans TC，字重 400/500/600 對齊，視覺差可接受

## Migration Plan

無（純新增；App.vue 原 hello 內容被取樣頁取代，health 檢查保留於頁內）。

## Open Questions

無——設定頁開啟形態等結構問題屬 C1 之後的 change，與本 change 無涉。
