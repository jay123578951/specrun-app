# add-archived-view

## Why

側欄的 Archive 至今是死項，archived change 在 App 內完全不可見——回顧「之前做過什麼、當時怎麼設計」得回到編輯器翻目錄。C9 是缺頁收尾的最後一頁（Settings 併入 M3），補齊後 App 的頁面骨架到齊，C10 視覺精修才有完整對象。

## What Changes

- 側欄 `Archive` 死項改名為 `Archived` 並升級為換頁入口（與 Specs 同一套高亮／換頁行為）。
- 新增 Archived 頁：當前專案的 archived change 清單，卡片顯示名稱（去日期前綴）、archived 日期（目錄名前綴解析）、tasks 進度（現場解析，未全完成為異常訊號、全完成淡化）。
- 點卡片開啟右側 slideover 詳情：整份唯讀，tabs 為現場列舉的頂層 `*.md` ＋ `specs/` 下的 delta spec。
- 資料源為檔案層直讀 `openspec/changes/archive/`（openspec CLI 不認識 archived change，`list`／`status`／`show` 實測均回錯誤；比照 park 機制的檔案層直讀先例）。
- 順帶：slideover 外殼於第三處使用者到齊後抽共用（rule of three，SpecPanel 既有註解預告）——純重構，不改可見行為。

## Capabilities

### New Capabilities

- `archived-view`: Archived 頁——archived change 清單（排序、卡片資訊、空／錯誤狀態）與唯讀 slideover 詳情（tabs 列舉、刷新策略）。

### Modified Capabilities

- `change-list`: 側欄 nav 段的 Archive 死項改為 Archived 換頁入口——項目命名、可互動、高亮當前頁；死項規範縮限至 Settings。

## Impact

- 前端：`AppSidebar.vue`（命名＋入口）、`stores/view.ts`（`AppView` 聯集加 `'archived'`）、新 ArchivedView／清單卡片、詳情面板走唯讀渲染路徑；slideover 外殼抽共用觸及 `ArtifactPanel.vue`／`SpecPanel.vue`／`App.vue`。
- 後端（Nitro）：新增 archived 清單與詳情 API（目錄列舉＋現場解析），countTasks 等解析邏輯與 `normalize-parked.ts` 共用。
- openspec CLI：不參與，零依賴變動。
