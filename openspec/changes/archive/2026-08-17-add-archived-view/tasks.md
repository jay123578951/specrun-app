# add-archived-view Tasks

## 1. 共用邏輯抽取（先鋪路，不改行為）

- [x] 1.1 自 `normalize-parked.ts` 抽出 countTasks 等任務解析共用邏輯至共用 util，parked 路徑改為引用，既有測試不變仍過
- [x] 1.2 抽 `PanelShell` 共用外殼（定位／底色／左緣線、header 收合鈕＋動作槽、捲動容器與換內容捲動歸零），`ArtifactPanel`／`SpecPanel` 改填 slot，行為不變（design D5）

## 2. 後端（Nitro routes ＋ normalize）

- [x] 2.1 `src/api/types.ts` 增補 archived 清單／詳情型別；`GET /api/archived`：目錄列舉＋逐目錄解析日期前綴與 tasks 進度，單筆失敗降級不拖垮清單（design D2）
- [x] 2.2 `GET /api/archived/[name]`：現場列舉 tabs（頂層 `*.md` ＋ `specs/**/spec.md`，順序依 design D4）＋逐檔讀取，路徑守衛比照 parked
- [x] 2.3 `src/api/normalize-archived.ts`：清單排序（日期新→舊、同日名稱序、無日期墊底）、名稱去前綴、進度與錯誤分類純函式＋單元測試

## 3. 前端（頁面與狀態）

- [x] 3.1 `stores/view.ts` 的 `AppView` 加 `'archived'`；`stores/archived.ts` 比照 specs store 的 enter／reset 生命週期，無寫入路徑（design D6／D7）
- [x] 3.2 `AppSidebar.vue`：Archive 死項改為 Archived 換頁入口（命名、高亮、aria-current），死項規範縮限 Settings
- [x] 3.3 `ArchivedView.vue`：卡片清單（名稱／日期／進度醒目規則）、skeleton、四層空／錯誤狀態、Refresh（spec archived-view）
- [x] 3.4 `ArchivedPanel.vue`：以 `PanelShell` 組唯讀詳情（tabs、Markdown 唯讀渲染、tasks 不可勾），App.vue 接線（露出區切換、`PANEL_MOTION`、↑↓／Esc）

## 4. 驗收

- [x] 4.1 `pnpm test` 全過；本專案 10 筆 archive 資料 dogfood：清單排序與日期正確、未完成進度醒目、詳情 tabs 含 delta spec、鍵盤與切頁即關行為、既有 Changes／Specs 頁 slideover 無回歸
