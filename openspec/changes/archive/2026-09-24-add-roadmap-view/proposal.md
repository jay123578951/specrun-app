# add-roadmap-view

## Why

採用 srun:roadmap 的專案會在 `openspec/roadmap/` 累積大量開發規劃：切分、順序、卡在哪、動工前必知、否決過的做法。這些資訊在 App 內完全看不到，要決定「下一步做什麼」或查某一項的筆記，都得回編輯器翻檔。TCERT 實測 18 個規劃檔、414 行，已經到了需要專門檢視的量。

## What Changes

- 新增第四頁 **Roadmap**，加進麵包屑的頁切換下拉（Changes／Specs／Archived／Roadmap）。
- 清單依規劃檔標題行的狀態分四組：In progress／Available／Blocked／Other。判斷規則照 srun:roadmap 的格式；分不進三組的一律歸 Other，不會把總覽檔、過期檔誤列為可挑的開發項。
- 清單卡片：標題、hover 浮出的複製標題鈕、更新時間；進行中的項目顯示進度與下一段，卡著的項目顯示前置，子項顯示所屬大項。
- 點卡片開右側 slideover，唯讀顯示全文，但會重排顯示方式，檔案內容不變：
  - 開頭段拆成導言與關係欄小框；
  - 「拆分與進度」提到最前；
  - 拆分表的狀態欄換成圖示。
- 全文裡的行內 code 引用，對得到實物的才變成可點連結：
  - 規劃檔：在面板內原地切換；
  - spec／進行中 change／封存 change：跳到對應頁並打開該項。
  - Changes、Specs、Archived 三頁因此各多一個「從外部指定打開某一項」的入口。
- 面板右上角放更新時刻、複製標題、刷新，排法和 change 面板同構。
- 空狀態分三種：專案有 `roadmap.off`、沒有 roadmap、讀取失敗。
- 資料來源是檔案層直讀，只列目錄、只讀 Markdown，不經 openspec CLI；web 與桌面兩種執行形態各有一份。
- 不監看檔案變動：進頁載入一次，另有手動 Refresh，比照 Specs／Archived 頁。

## Capabilities

### New Capabilities

- `roadmap-view`：Roadmap 頁，涵蓋三件事：
  - 規劃檔清單：分組規則、卡片資訊、空與錯誤狀態；
  - 唯讀 slideover 詳情：開頭段重排、拆分表提前與狀態圖示、header 動作區；
  - 引用連結的解析與跨頁跳轉。

### Modified Capabilities

- `page-navigation`：麵包屑與頁切換下拉從三頁擴為四頁；Roadmap 頁的項目數量隨麵包屑呈現。
- `change-list`：側欄結構需求裡列舉的頁入口加入 Roadmap（側欄仍不設頁入口）。
- `desktop-shell`：桌面 webview 逐頁無退化的檢視範圍加入 Roadmap 頁。

## Impact

- 前端：
  - `stores/view.ts`：`AppView` 加 `'roadmap'`；
  - 新增 Roadmap 清單頁、面板、store；
  - `App.vue`：面板槽與鍵盤分派加一支；
  - 麵包屑下拉；
  - Changes／Specs／Archived 三個 store 各加一個「進頁並打開指定項」的入口；
  - Markdown 渲染：面板內的引用連結與拆分表狀態圖示。
- 後端（Nitro）：新增 roadmap 清單與內容 API（列目錄＋讀檔＋stat），以及引用解析用的名稱清單（specs／changes／archive 目錄列舉）。
- 桌面（Tauri）：`src/api/desktop/` 新增同語意的讀取實作。既有的專案路徑授權已涵蓋 `openspec/`，不需新增授權。
- openspec CLI：不參與，零依賴變動。
- 參考資料：TCERT 專案的 `openspec/roadmap/`（18 檔）；格式依據 specrun 的 srun:roadmap skill。
