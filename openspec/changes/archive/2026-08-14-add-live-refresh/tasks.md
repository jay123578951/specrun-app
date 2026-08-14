## 1. Server 端通知通道

- [x] 1.1 建立 watcher 單例：監看目標專案 `openspec/changes/**`（底層 fs.watch vs chokidar、目錄不存在時的掛載策略屬 design 留白，就地決定），變動經 debounce（300–500ms trailing）合併為粗粒度事件；多訂閱者共用同一個 watcher
- [x] 1.2 新增 SSE route（如 `GET /api/watch`）：`createEventStream` 推播「有變動」事件（無 payload）；連線關閉時正確清理訂閱
- [x] 1.3 watcher 啟動失敗（目錄不存在等）不影響既有 route 運作，僅失去通知能力

## 2. Gateway 訂閱介面

- [x] 2.1 `OpenSpecGateway` 介面新增訂閱方法（`subscribe(callback): unsubscribe` 形態），型別註記 M4 Tauri 替換點
- [x] 2.2 web-gateway 實作：EventSource 訂閱 SSE route，依原生重連機制靜默恢復，不對外拋斷線錯誤

## 3. 前端自動重載

- [x] 3.1 `changes.ts` 增加靜默重載入口：沿用 `load()` 保留舊資料語意，但失敗不 toast、不設 blockingError（與手動路徑分流）
- [x] 3.2 `detail.ts` 增加靜默重載入口：詳情開啟時重取當前 change，沿用 `isSameDetail` 靜默換新；失敗不設 staleWarning、不進錯誤畫面；不觸發 prefetch
- [x] 3.3 「change 消失」偵測：清單重載後當前 change 不在其中 → 走既有 `close()` 路徑回全寬清單、`listScrollTop` 還原，無任何提示
- [x] 3.4 App 掛載時建立訂閱：通知到達 → 觸發清單靜默重載＋（詳情開啟時）詳情靜默重載；卸載時取消訂閱

## 4. 驗收與收尾

- [x] 4.1 對三份 delta spec 逐 scenario 人工驗收：外部改 tasks.md 看卡片進度與詳情內容自動更新、連環寫入僅一次刷新、檢視中 archive 自動回清單、範圍外變動無反應、kill server 重啟後自動恢復通知
- [x] 4.2 確認手動 refresh 與掛載首載的失敗提示行為未被分流改動波及（toast／staleWarning／blockingError 照舊）
