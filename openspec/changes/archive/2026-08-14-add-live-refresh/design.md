## Context

- C1／C2 已為 watcher 預留完整落點：`changes.ts` 的 `load()` 刷新期間保留舊資料；`detail.ts` 的暖路徑有 `isSameDetail` 防重繪與靜默換新；`App.vue` 掛載時載入一次。C3 本質是「補一條推播通道、接上既有 `load()`」，前端幾乎不需新邏輯。
- 既有分層約束（C1 design D1）：web 形態下 Nitro route 只做原始轉送，解析在 shared normalize；M4 換 Tauri 殼只動 gateway 實作。C3 的訂閱通道必須收進同一個抽象。
- 決策已於對話中收斂（srun:decisions），本文件記錄結論與依據；行為契約見三份 delta spec。

## Goals / Non-Goals

**Goals:**

- `openspec/changes/**` 變動 → debounce → 粗粒度通知 → 前端自動重載清單＋當前詳情的完整鏈路。
- 訂閱能力納入 `OpenSpecGateway` 介面，維持「M4 換 Tauri 殼只動 gateway 實作」。

**Non-Goals:**

- `openspec init` 偵測（非 openspec 專案變成有效專案的自動發現）。
- 細粒度事件（辨識哪個 change 變動）；通知帶 payload。
- watcher 觸發重跑 prefetch（未開啟 change 的快取過期交給暖路徑）。
- 多專案監看（C5 之後再議）。

## Decisions

### D1：粗粒度事件——watcher 只喊「有變動」

通知不帶任何細節，前端收到後重載清單＋當前開啟的詳情。棄案「細粒度事件（帶 change 名與變動類型）」：需要處理新增／刪除／rename／archive 的路徑對應與邊角，而 CLI 呼叫成本低（一次 `list` ＋至多一次 `status`）、debounce 已擋掉高頻觸發——薄殼哲學下細粒度的複雜度買不到對應的價值。

### D2：SSE 傳輸，訂閱收進 gateway 介面

web 形態：Nitro 端 `GET /api/watch` 以 `createEventStream` 推播，前端 EventSource 訂閱（原生自帶斷線重連，對應 spec「韌性」需求的靜默重連）。`OpenSpecGateway` 介面新增 `subscribe(callback): unsubscribe` 形態的方法——呼叫端只認 callback，不知道底層是 SSE 還是 Tauri fs plugin 事件，M4 替換範圍維持在 gateway 實作一個檔案。棄案「WebSocket」：雙向能力用不到，SSE 更省。棄案「前端輪詢」：無新後端能力但「即時」體感差、且常態性空轉 CLI。

### D3：debounce 在 server 端做，300–500ms trailing

合併連環寫入（git 操作、AI agent 批次改檔）於通知源頭處理，所有訂閱者受益；前端不再疊一層 debounce。精確值屬刻意留白（見下）。

### D4：watcher 為 server 單例，事件廣播給所有 SSE 訂閱者

watcher 生命週期與訂閱者管理（首個訂閱者到來才啟動、或 server 啟動即掛）屬實作細節，Coder 就地決定；約束只有一條：多個訂閱者（多分頁）共用同一個 watcher，不得每連線各開一個。

### D5：自動觸發與手動觸發的失敗呈現分流

store 層區分觸發來源：手動 refresh／掛載首載沿用既有提示（toast／staleWarning／blockingError）；通知觸發的重載完全靜默（spec 已明定）。「change 消失」與「暫時失敗」以清單重載結果區分——不在清單＝archived（自動關閉詳情）、仍在清單但詳情取失敗＝暫態（靜默留舊內容）。

### D6：archive 自動關閉沿用既有返回路徑

偵測到當前 change 不在重載後的清單 → 走既有 `close()` ＋ `listScrollTop` 還原，與 Esc 返回同一條路徑，不另做過場或提示。

### 自查已定（srun:decisions 記錄）

- SSE 斷線不顯示指示：web 形態下 Nitro server 掛掉＝整個 app 不可用，斷線提示無意義；M4 Tauri 無 SSE；EventSource 原生重連。
- 靜默換新不加「已更新」視覺提示：沿用 C2 design D4 的 stale-while-revalidate 語意。

### 刻意留白（Coder 就地決定，非遺漏）

- watcher 底層：Node 原生 `fs.watch`（recursive）vs chokidar——不改變可見行為；傾向原生（macOS 為主要目標、零依賴符合薄殼），實測不可靠再上 chokidar。
- `openspec/changes/` 目錄不存在時的掛載策略（watch 上層 `openspec/` 或延後掛載）。
- debounce 精確值：300–500ms 區間內自定。
- SSE route 命名與事件格式（無 payload，形式自定）。

## Risks / Trade-offs

- [macOS fs.watch recursive 的事件可靠度（漏報／重複）] → 粗粒度＋debounce 天然容錯：重複事件被合併、單次漏報由下一次任何變動補上；手動 refresh 永遠在。
- [撈到寫到一半的檔案] → 下一個 fs 事件會再觸發重載；`isSameDetail` 擋住中間態造成的重繪閃爍；CLI 解析失敗則靜默、下次通知重試。
- [Nitro dev 模式 route 熱重載可能重建 watcher 單例] → 僅影響開發體驗；EventSource 自動重連會重新訂閱，最壞情況掉一次通知，手動 refresh 可補。
- [高頻變動期間 CLI 呼叫連發] → debounce 已限流；每輪至多 `list` ＋一次 `status`，實測單趟 ~1s，可接受。
