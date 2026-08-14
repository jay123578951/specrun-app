## Why

App 目前只能看單一專案（啟動時由 env 或 cwd 定死），但實際使用情境是多個 repo 各有自己的 openspec 目錄，得重啟才能換專案。C5 讓專案清單與切換進 UI——路徑管理從這個 change 才真正開始做。

## What Changes

- 側欄「Projects」區從單一靜態項變成可互動的多專案清單：全展開直接點擊切換、每項掛「未 archive change 數」徽章、hover ✕ 移除（確認後只移出清單不動磁碟）、底部「＋ Add project」。
- 新增專案管理的持久化：`~/Library/Application Support/`（平台慣例位置）下一個 JSON 設定檔，存 `projects[]` 與 `lastActivePath`。
- server 持有「目前專案」執行期狀態：新增切換 API，切換時 file watcher teardown 再 re-mount 到新專案。
- 目標路徑解析優先序改為 env（dev override）> 設定檔 `lastActivePath` > `cwd()` fallback。
- gateway 介面新增 `pickFolder()` 縫：web 過渡期以貼路徑輸入框實作，Tauri 後換原生 dialog。
- 加入專案時驗證「是資料夾且含 `openspec/`」；之後失效走 lazy——切過去才以既有 `target-missing` probe 語意顯示。
- 徽章弱一致：啟動時並行刷一輪、切換時再刷；非 current 專案的變動不即時反映（watcher 只盯 current）。

## Capabilities

### New Capabilities

- `project-management`: 專案清單的加入／移除／切換與持久化、路徑驗證與失效語意、每專案徽章的弱一致刷新、空清單引導。

### Modified Capabilities

- `change-list`: 「側欄靜態殼」requirement 中的專案清單段——原規格明定「只含目標專案一項、除徽章外不具功能」，C5 起該段讓位給 `project-management` 的多專案清單（Specs／Archive／Settings 死項不變）。
- `openspec-gateway`: 「目標專案路徑解析」requirement——優先序加入設定檔層，且目標路徑從啟動時定死變為 server 執行期可換狀態；「檔案變動通知」requirement 增補切換情境——watcher 跟隨 current 專案換掛。

## Impact

- server：`server/utils/openspec-cli.ts`（`resolveTargetPath` 從 pure 函式變讀取執行期狀態）、`server/utils/change-watcher.ts`（掛一次不重掛 → 可 teardown / re-mount）、新增 project 相關 route（清單／加入／移除／切換）、新增設定檔讀寫模組。
- 前端：`AppSidebar.vue`（Projects 區重做）、新增 projects store、`stores/changes.ts` 與 `stores/detail.ts`（切換時重置）、`src/api/gateway.ts` 介面擴充（`pickFolder()` 等）與 web-gateway 實作。
- 不動：openspec CLI 呼叫語意、change 卡片與詳情、tasks 勾選。
