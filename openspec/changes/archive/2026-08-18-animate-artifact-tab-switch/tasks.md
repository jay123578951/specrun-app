## 1. 抽出共用 tabs 元件

- [x] 1.1 新增 `src/components/ArtifactTabs.vue`：props `items`（artifact 清單）／`current`（當前 tab id）／`identity`（change 名，供 D3 判定）／`idPrefix`（兩個面板的 `id`／`aria-controls` 前綴不同），emit `select`；標記完整搬移現有 tablist（`role="tablist"`、`tab-item first:pl-0`、`aria-selected`、`aria-controls`），不含選中底線
- [x] 1.2 `ArtifactPanel.vue` 改用 `ArtifactTabs`，移除原 tablist 標記與 `:class` 的 `border-accent-bright`，`v-else` 的 `h-12` 佔位維持在面板側不動
- [x] 1.3 `ArchivedPanel.vue` 同 1.2，確認 `archived-tab-` 前綴與 `archived-panel-` 的 `aria-controls` 對應不變
- [x] 1.4 `uno.config.ts` 的 `tab-item` 註解更新：底線責任已移交 indicator，`border-b-2 border-transparent` 留作佔位（design D6）

## 2. Indicator 的量測與滑動

- [x] 2.1 `ArtifactTabs.vue` 內加入絕對定位 bar（高 2px、基準寬 1px、`transform-origin: left`），以 `translate` / `scale` 個別屬性定位（design D1／D2）
- [x] 2.2 實作量測：以 ref 取當前選中 tab 的 `offsetLeft` / `offsetWidth`，寬度為 0 時跳過該次更新（不把 bar 縮成看不見）
- [x] 2.3 掛上三個量測觸發點：`current`／`items` 變動後的 `nextTick`、`document.fonts.ready`、tablist 上的 `ResizeObserver`（design D4）；元件卸載時解除 observer 與在飛的回呼
- [x] 2.4 實作「無過場就位」路徑：`identity` 變動、首次量測、`items` 集合換掉、ResizeObserver 校正皆走此路徑（關 transition → 設位置 → 下一幀掛回）
- [x] 2.5 過場時值：`translate` 與 `scale` 走 180ms `var(--sr-ease-in-out)`；連續點擊靠 transition 自身 retarget，不做佇列
- [x] 2.6 確認 bar 與 header `border-b` 的層疊關係正確（tablist 帶 `-mb-px`）；若需層級，走 `uno.config.ts` 的具名 z 層慣例

## 3. 內容淡入時值分檔

- [x] 3.1 `PanelShell.vue` 的 `scrollKey` 拆為 `identityKey`（change 名）與 `contentKey`（tab 名），watcher 兩者都監看，捲動歸零行為不變
- [x] 3.2 淡入時長依觸發來源分檔：換 change 180ms、換 tab 160ms（design D5），`FADE_SUPPRESS_MS` 的連按閘門邏輯不動
- [x] 3.3 `ArtifactPanel.vue` / `ArchivedPanel.vue` / `SpecPanel.vue` 三處的 `PanelShell` 用法更新為新 props（`SpecPanel` 無 tabs，`contentKey` 給空值即可）

## 4. Reduced motion 與收尾

- [x] 4.1 `src/styles/interactions.css` 加上 indicator 的 reduced motion 降級：`transition-property` 縮到 `opacity`，位移瞬間歸位（design D7），註解說明機制與既有 `.sr-motion` 同源
- [x] 4.2 `pnpm lint` 與 `pnpm test` 通過

## 5. 對齊責任拆分

- [x] 5.1 `ArtifactTabs.vue` 的 label 包一層 `<span>` 供量測；`place()` 改抓該 span，`translate` 為 `offsetLeft − 3.5`、`scale` 為 `offsetWidth + 7`（design D9）
- [x] 5.2 tab class 改回單純的 `tab-item`，移除 `first:px-0`
- [x] 5.3 tablist 加 `-ml-3`，讓首顆 tab 的文字左緣落在面板標題左緣（design D9）
- [x] 5.4 `docs/ui-structure-decisions.md` 的 `tab-item` 條目補一句：tabs 列的對齊由容器負外距承擔，內距不兼差
- [x] 5.5 `pnpm lint` 與 `pnpm test` 通過

## 6. 人工驗收

- [x] 6.1 同一份 change 內連續切 tab：底線讀得出從舊 tab 移動到新 tab（首顆的對齊細節見 6.8）
- [x] 6.2 換 change（點卡片與按 ↑↓）：底線直接就位、不從舊位置滑過去；內容淡入可被感知
- [x] 6.3 首次開啟詳情面板（強制重整、清 http cache 讓字體重載）：底線落在正確寬度，沒有停在 fallback 字體的寬度上
- [x] 6.4 archived 詳情面板：tab 名較長（`specs/<capability-path>`）時底線寬度正確；行為與 change 詳情面板一致
- [x] 6.5 開啟系統的減少動態效果後切 tab：底線瞬間就位、仍清楚指出當前選取，內容淡入保留
- [x] 6.6 快速連點多個 tab：底線自當前位置直接轉向最後一個目標，不排隊、不重播
- [x] 6.7 四顆 tab 的間距處處相同，首顆的點擊面積沒有比其他窄
- [x] 6.8 底線左右各超出文字一段等寬餘裕；首顆底線略微探出標題左緣，文字左緣則精準落在標題線上
