## 1. 伺服端寫入通道

- [x] 1.1 建立翻行核心模組（server/utils）：保留行尾符的切行、`expectedText` 全等比對、task 行 regex 判定與勾選字元置換、byte 保真拼回；含衝突／非 task 行的錯誤回傳
- [x] 1.2 翻行核心單元測試：`-`/`*`/`+`／有序清單／縮排子項／大寫 `X`／CRLF／檔尾無換行／目標行已變（衝突）／其他行已變（照常寫入）
- [x] 1.3 建立 `POST /api/changes/:name/tasks/toggle` route：重跑 `openspec status` 解析 tasks artifact 路徑（單檔檢查）、per-change 序列化寫入、三分結果回應（成功／409 衝突／失敗）
- [x] 1.4 前後端判定一致性測試：固定 tasks 樣本同時餵 markdown-it-task-lists 渲染與伺服端 regex，兩邊認定的可勾行集合一致

## 2. gateway 介面與型別

- [x] 2.1 `OpenSpecGateway` 新增 `toggleTask` 方法與 `ToggleResult` 三分型別（types.ts），web-gateway 實作呼叫新 route

## 3. 渲染層互動化

- [x] 3.1 `render.ts` 支援 interactive 模式：tasks 單檔時啟用 checkbox、自 token `map` 注入 `data-line`；其他情形維持既有唯讀管線
- [x] 3.2 `MarkdownView` / `ArtifactPanel` 事件委派：接住 checkbox 點擊、讀 `data-line`、轉發勾選動作；僅 tasks tab 掛委派
- [x] 3.3 checkbox 互動視覺狀態：hover／focus-visible／pending（in-flight 鎖定中）以既有 tokens 實作

## 4. store 樂觀更新

- [x] 4.1 detail store 勾選動作：對快取來源字串就地翻行 → 觸發重渲染 → 呼叫 gateway；in-flight 行號集合鎖定同顆連點
- [x] 4.2 失敗處理：字串彈回原值＋toast（衝突與一般失敗文案可區分，英文）；成功路徑靜默、交由變動通知吸收

## 5. 驗證

- [x] 5.1 在本 change 自己的 tasks tab 實測（dogfooding）：勾選即時翻轉、卡片進度數字隨引擎重算更新、無閃爍
- [x] 5.2 衝突實測：畫面開著時外部改寫目標行再點擊，確認彈回＋衝突 toast＋內容隨通知更新
- [x] 5.3 邊界確認：非 tasks tab checkbox 不可點、custom schema change（`check-custom-schema-tabs`）全 tab 唯讀、in-flight 連點無第二次請求
