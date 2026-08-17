## 1. Gateway 資料層

- [x] 1.1 `src/api/types.ts` 新增 specs 清單與 spec 內容的型別（SpecSummary、結果聯合型別，錯誤沿用 GatewayError）
- [x] 1.2 `server/api/specs.get.ts`：spawn `openspec list --specs --json`，沿用 openspec-cli util 與錯誤分類
- [x] 1.3 `server/api/specs/[id].get.ts`：spawn `openspec show <id> --type spec`，stdout 原樣轉交；spec 不存在回錯誤不回空內容
- [x] 1.4 `src/api/` normalize 與 web-gateway 方法（含單元測試，比照 normalize.test.ts 慣例）

## 2. 換頁機制與側欄

- [x] 2.1 新增 `stores/view.ts`（currentView＋切換 action，切換時關閉詳情面板）
- [x] 2.2 `AppSidebar.vue`：Specs 項活化（點擊切頁、當前頁高亮；Archive／Settings 維持死項）
- [x] 2.3 `ProjectSwitcher.vue`：點專案項一律進入該專案 Changes 主頁（目前專案：非主頁回主頁、已在主頁無作用）
- [x] 2.4 `App.vue`：主區依 view state 切換 ChangeList／Specs 頁

## 3. Specs 頁清單

- [x] 3.1 新增 `stores/specs.ts`（清單載入、進頁重載、開啟中 spec 狀態）
- [x] 3.2 Specs 清單元件：純列表列（mono 名稱＋requirement 數）、skeleton 載入佔位、空狀態、錯誤狀態（沿用 StateNotice 分層語意）

## 4. Spec 詳情 slideover

- [x] 4.1 新增 `SpecPanel.vue`：無 tabs 的 Markdown 全文渲染，header 收合鈕＋Refresh，定位與進出場動畫值對齊 ArtifactPanel
- [x] 4.2 露出區互動：列點擊切換、當前列高亮、再點當前列收合
- [x] 4.3 鍵盤：Specs 頁面板開啟期間 ↑↓ 切換（帶進視野）與 Esc 收合；面板未開啟不搶鍵
- [x] 4.4 切頁即關：離開 Specs 頁（含切換專案）關閉面板、進頁重載清單

## 5. 驗收

- [x] 5.1 `pnpm test` 與 `pnpm lint` 通過
- [x] 5.2 對照 specs-view／change-list／project-management delta 逐條人工驗收（含空專案、CLI 錯誤情境）
