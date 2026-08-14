## Why

目前清單與詳情只在掛載時載入一次＋手動 refresh（C1／C2 刻意的範圍切割）。實際使用場景是旁邊跑著 Claude Code 或 git 操作、`openspec/changes/` 持續變動——使用者得不斷手按 refresh 才能看到最新狀態。C3 補上 file watcher 推播，讓畫面自動跟上檔案系統，完成 M1 Viewer「即時」的最後一塊。

## What Changes

- Nitro 端新增 file watcher：監看目標專案 `openspec/changes/**`，變動經 debounce 後發出粗粒度「有變動」通知（不帶細節 payload）。
- 新增 SSE 通知通道（Nitro `createEventStream`），前端以 EventSource 訂閱；訂閱能力納入 `OpenSpecGateway` 介面（M4 Tauri 換 fs plugin watch 實作，呼叫端零改動）。
- 收到通知後前端自動重載：change 清單＋當前開啟的詳情。既有的「刷新期間保留舊資料」「內容無差異不重繪」語意直接沿用，畫面不閃爍。
- 自動觸發的重載失敗一律靜默（不 toast、不 staleWarning）；手動 refresh 的失敗提示行為不變。
- 正在檢視的 change 被 archive／刪除時，詳情自動關閉、回到清單（取代目前的錯誤提示路徑）。
- watcher 事件不重跑 prefetch；未開啟 change 的快取過期交給既有暖路徑點開時重取。

## Capabilities

### New Capabilities

（無——通知通道屬 gateway 資料通道職責，自動重載行為屬各畫面既有 capability。）

### Modified Capabilities

- `openspec-gateway`: 新增「檔案變動通知」需求——watch 範圍、粗粒度事件、debounce、訂閱介面與斷線重連語意。
- `change-list`: 「手動刷新」需求中「MUST NOT 自動重新載入（watcher 為 C3 範圍）」的限制解除，新增 watcher 觸發自動重載與背景失敗靜默的需求。
- `artifact-view`: 「載入與新鮮度」同上解除限制；新增當前詳情隨通知重載、以及 change 消失時自動關閉回清單的需求。

## Impact

- **server**：新增 watcher 單例與 SSE route（如 `GET /api/watch`）；`server/utils/openspec-cli.ts` 的 target 路徑解析共用。
- **src/api**：`OpenSpecGateway` 介面新增訂閱方法；`web-gateway` 實作 EventSource 訂閱。
- **src/stores**：`changes.ts` 與 `detail.ts` 各加自動重載入口（靜默失敗變體）；`detail.ts` 加「change 已消失 → close」路徑。
- **依賴**：傾向 Node 原生 `fs.watch`（recursive），零新依賴；由實作階段定奪（design 留白）。
- **不影響**：CLI 呼叫策略、normalize、渲染層、既有手動 refresh 行為。
