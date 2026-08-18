## 1. 麵包屑元件

- [x] 1.1 新增頁首元件，承擔整個 header 行：左側麵包屑（專案名純標籤＋當前頁下拉觸發項＋可選的數量），右側以 slot 收 Refresh 控制項
- [x] 1.2 專案段取 `projects.currentProject` 的 `name`、`title` 掛完整路徑、走 `font-mono`；無目標專案時整個元件不渲染
- [x] 1.3 當前頁名由 `view.currentView` 推導顯示字（Changes／Specs／Archived）
- [x] 1.4 數量以 prop 傳入且可省略：Specs／Archived 傳各自 store 的 count，Changes 不傳

## 2. 頁切換下拉

- [x] 2.1 實作 menu button：觸發項為當前頁名，展開列出全部三頁並標示當前項
- [x] 2.2 選定非當前頁呼叫 `view.show()`；選定當前頁只關閉下拉、不重新載入
- [x] 2.3 點擊下拉外部關閉；關閉與選定後 focus 交回觸發項
- [x] 2.4 鍵盤：Esc 關閉、↑↓ 在三項間移動、Enter 選定；focus ring 走 `kbd-focus`
- [x] 2.5 開合動效沿用 `interactions.css` 既有 overlay 配方（175ms／250ms、`--sr-ease-out`、scale 0.96→1），不新增曲線或時值
- [x] 2.6 若需要新的 shortcut，加進 `uno.config.ts`；字級只能取既有五階，MUST NOT 新增字級

## 3. 三頁掛載

- [x] 3.1 `SpecsView.vue`：以新元件取代現有 header，Refresh 進 slot，移除原本的 `Specs (n)` 頁標
- [x] 3.2 `ArchivedView.vue`：同上
- [x] 3.3 `ChangeList.vue`：以新元件取代現有 header；原本的 `Active (n)` 下移為 Active 群組的標題，與既有的 Parked 群組標題對稱
- [x] 3.4 確認三頁的無專案分支仍走既有的 `noProject` 早退，空狀態引導不變

## 4. 側欄與鍵盤

- [x] 4.1 `AppSidebar.vue`：移除 Specs／Archived 的 nav 段，改為三段結構；更新該檔說明四段結構的註解
- [x] 4.2 `App.vue`：在既有 `keydown` listener 的 `settings.isOpen` 早退旁加上下拉開啟時的讓位，形狀與之一致

## 5. 文件同步

- [x] 5.1 `docs/ui-structure-decisions.md`：側欄段落由四段改為三段，移除 Specs／Archive 入口的描述，補上麵包屑承擔頁切換
- [x] 5.2 同檔的「已否決項」表：註明「專案下拉選單」的否決範圍僅限專案切換，不涵蓋本案的頁下拉

## 6. 驗證

- [x] 6.1 `pnpm lint` 與 `pnpm typecheck` 通過
- [x] 6.2 `pnpm test` 通過（本案不改資料層，既有測試應無須調整；有失敗須查明是否為預期外的行為變更）
- [x] 6.3 人工走查三頁切換、詳情面板開啟時自露出的下拉切頁、無專案空狀態、鍵盤（Esc／↑↓／Enter）與 focus 回歸
