# Tasks

## 1. 解析層（兩形態共用）

- [x] 1.1 在 `src/api/types.ts` 定義 roadmap 的 probe 與結果型別（檔案清單、目錄與 `roadmap.off` 是否存在、引用名稱清單、失敗分類），並在 Gateway 介面加 `listRoadmap()`；`pnpm typecheck` 通過
- [x] 1.2 在 `src/api/normalize-roadmap.ts` 實作以下解析：標題行（標題與狀態字）、四組分類、組內檔名排序、Next 範圍、Needs 前置、屬於的父項；在 `normalize-roadmap.test.ts` 以 TCERT 形狀的 fixture 驗證，fixture 須涵蓋：
  - 總覽檔歸 Other；
  - `0/M` 歸 Available、`N/M` 且 N=M 歸 Other；
  - 無段落標題歸 Other；
  - 標題含行內 code；
  - 單檔讀取失敗以檔名列入 Other；
  - 取不到 Next／Needs 時為空。
- [x] 1.3 在同一模組實作顯示切段，輸出導言、關係欄列、拆分與進度段、其餘段落四塊；以測試驗證以下行為：
  - 冒號全形與半形都認得；
  - 欄名超過 6 字不算關係欄；
  - 非規定欄名（如「順序與現況」）照收；
  - 其餘段落維持原順序；
  - 沒有開頭段或沒有拆分段時對應區塊為空。
- [x] 1.4 在同一模組實作引用解析函式，照 spec「引用連結」的五條規則與「規格 > change（含 parked）> 封存」順序；以測試驗證以下情形：
  - 撞名時連到規格；
  - 短的 `archive/` 路徑；
  - `YYYY-MM-DD-名稱`；
  - `specs/<id>/spec.md`；
  - 不存在的 `.md` 與 kebab 名不成連結。

## 2. 讀取層（web 與桌面各一份）

- [x] 2.1 新增 `server/api/roadmap.get.ts`，讀取範圍如下；web gateway 接上 `listRoadmap()`，`web-gateway.test.ts` 補一則回應形狀測試：
  - 只列舉 `openspec/roadmap/` 頂層 `.md`：讀內容與 mtime，排除 dotfile、子目錄、非 md；
  - 判斷 `roadmap.off` 是否存在；
  - 名稱清單：specs、changes（排除 archive）、archive 的子目錄名，parked 名稱沿用 `listParkedNames`；
  - 失敗分類：
    - 目錄不存在是正常狀態，不是錯誤；
    - 單檔讀取失敗只標記該檔；
    - 列舉失敗回 `read-failed`。
- [x] 2.2 新增 `src/api/desktop/roadmap.ts`，語意與 2.1 相同，改用 Tauri fs 的 `readDir`／`readTextFile`／`stat`；desktop gateway 接上，並在 `desktop-gateway.test.ts` 補對應測試。確認既有的專案路徑授權已涵蓋 `openspec/` 與 `.git`，不需新增授權。

## 3. Markdown 渲染擴充

- [x] 3.1 讓 `src/markdown/render.ts` 的 `renderMarkdown` 接受可選的 roadmap 選項，包含引用解析函式與拆分表模式：
  - `code_inline` 對得到時輸出 `.md-ref` button；跨頁的附目標頁提示；
  - code block 不受影響；
  - 拆分表模式把「狀態」欄的三個固定值換成內嵌 SVG 圖示＋title，並替該列加上狀態 class；
  - 不傳選項時輸出與現況逐字相同。
  
  以單元測試驗證上述四點。
- [x] 3.2 讓 `MarkdownView.vue` 的委派 click 命中 `.md-ref` 時 emit `ref` 事件（帶 kind 與 target），既有連結與勾選行為不變；在 `MarkdownView.test.ts` 補一則點擊測試。
- [x] 3.3 在 `src/styles/markdown.css` 補上以下樣式，全部引用 tokens，並對照模擬畫面確認視覺一致：
  - `.md-ref`：可點樣式、hover、focus ring；
  - 目標頁提示；
  - 導言降階字色；
  - 關係欄框；
  - 拆分表狀態圖示（接下來為實心 accent 底，完成與卡著為淡底）；
  - 列狀態字色；
  - 狀態欄不折行。

## 4. 狀態與換頁

- [x] 4.1 `stores/view.ts`：`AppView` 加 `'roadmap'`，並新增 `pendingOpen` 與 `openOn(view, id)`；`openOn` 走既有 `show()`，切頁即關的語意不變。以 store 測試驗證。
- [x] 4.2 新增 `stores/roadmap.ts`，生命週期比照 archived store：
  - `enter`／`reset`／`load` 與序號作廢；
  - `firstLoadPending`；
  - `openFile`；
  - 分組後攤平的順序（供 ↑↓）；
  - `count`；
  - 面板刷新重跑清單，項目消失時關面板；
  - 引用點擊：規劃檔在面板內原地切換，別頁呼叫 `openOn`。
  
  以 store 測試驗證開關、刷新後消失、跨組 ↑↓ 順序。
- [x] 4.3 Specs 與 Archived store 的 `enter()` 載入完成後消化 `pendingOpen`：找到就開啟，找不到就 toast 且不開面板；Changes 頁在切頁當下以 active＋parked 清單消化。三頁各補一則測試（找到／找不到）。

## 5. 畫面

- [x] 5.1 新增 `RoadmapView.vue`（清單頁）：
  - 麵包屑＋Refresh；
  - 四組分組標題與數量；
  - 卡片內容：標題、hover 複製鈕、更新時間、進度條與 N/M、Next／Needs 副行、part of 標籤、Blocked 標記；
  - 狀態：skeleton、無專案、非 openspec 專案、`roadmap.off`、尚無 roadmap、讀取失敗可重試；
  - UI 文案英文；
  - 複製鈕與 change 卡片的 `CopyNameButton` 同構（必要時抽出共用）；
  - 在瀏覽器以 TCERT 專案目視確認與模擬畫面一致。
- [x] 5.2 新增 `RoadmapPanel.vue`（基於 `PanelShell`）：
  - header：標題、狀態（進度條／Blocked／Other）、`Updated MM-DD HH:mm` 加含年份的 title、複製控制、刷新控制，不顯示路徑；
  - 內容依序：導言、關係欄框、拆分與進度（拆分表模式）、其餘段落；
  - 引用點擊接到 store。
- [x] 5.3 `App.vue` 接上 Roadmap 頁與面板槽、`panelOpen`、`move()`、Esc；在麵包屑下拉加入 Roadmap 項，順序為 Changes／Specs／Archived／Roadmap，並顯示 Roadmap 頁的數量。在瀏覽器確認四頁切換、↑↓ 跨組、Esc 收合。

## 6. 整合驗證

- [x] 6.1 以 TCERT 專案走過 spec 各情境：（由操作流程驗證關卡覆蓋；「跳轉後目標消失時 toast」無法以點擊造出，由 store 測試覆蓋）
  - 分組結果為進行中 1、Available 12、卡著 3、Other 1（TCERT 目前 17 檔；設計時為 18 檔、Available 13）；
  - 撞名連到 Specs；
  - 短 archive 路徑連到 Archived；
  - 跳轉後目標消失時 toast；
  - 切頁再回來為關閉面板的清單。
- [x] 6.2 以 specrun-app 自身（有 `roadmap.off`）、一個沒有 roadmap 的專案、CLI 設成無效路徑三種情境，確認空狀態與「CLI 不可用不影響 Roadmap」。
- [x] 6.3 以 `pnpm dev:app` 在桌面視窗逐頁檢視 Roadmap（含詳情與引用跳轉），確認與瀏覽器一致，無破版。
- [x] 6.4 `pnpm lint`、`pnpm typecheck`、`pnpm test` 全數通過。（由 Tester 關卡覆蓋）
