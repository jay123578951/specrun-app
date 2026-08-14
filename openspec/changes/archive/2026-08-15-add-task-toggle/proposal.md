## Why

驗收 tasks 進度目前只能回編輯器改 `tasks.md`——App 看得到勾選狀態卻不能動它，最高頻的小操作反而斷在工具切換上。C4 引入 App 的第一個（也是目前唯一的）寫入功能：在 tasks tab 直接勾選 checkbox。

## What Changes

- tasks artifact 的 tab 內，task list checkbox 由唯讀轉為可互動：點擊即翻轉 `[ ]`↔`[x]` 並寫回檔案。
- 僅 `tasks` artifact 開放勾選；其他 artifact（含 custom schema 的任何 artifact）維持唯讀——custom schema 為驗收測試資料，不為其擴大寫入面。
- gateway 介面新增寫入方法（App 唯一寫入通道），web 形態走 Nitro POST route；寫入為 UI 層檔案操作，不經 openspec CLI，進度數字仍由引擎重算。
- 併發安全：寫入前重讀檔案、比對目標行原文，只翻該行的勾選字元、其餘 byte 不動；該行已變則放棄寫入並回報衝突。
- UI 採樂觀更新：點擊立即變化，寫入失敗才彈回並以 toast 提示；in-flight 期間鎖定該顆 checkbox 防連點。
- 寫入後的畫面刷新沿用 C3 live-refresh 既有機制（watcher → 重取 → 無差異不重繪），不新增刷新路徑。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `artifact-view`: 「Markdown 唯讀渲染」requirement 原文明定 checkbox MUST NOT 可互動（勾選為 C4 範圍）——本 change 兌現該保留範圍：tasks tab 的 checkbox 轉為可互動，新增樂觀更新、in-flight 鎖定、失敗彈回與衝突提示的行為要求；其餘 artifact 維持唯讀。
- `openspec-gateway`: 新增「task 勾選寫入」requirement——寫入通道的介面、路徑白名單（沿用 `artifactPaths`、不信任 client 路徑）、行比對併發策略與衝突回報分類。

## Impact

- `src/markdown/render.ts`：task list 渲染改為可互動模式，並自 token `map` 注入來源行號屬性。
- `src/components/MarkdownView.vue` / `ArtifactPanel.vue`：checkbox 點擊的事件委派、樂觀翻與 pending 鎖定。
- `src/stores/detail.ts`：勾選動作的狀態流（樂觀更新、失敗彈回、toast）。
- `src/api/`：`OpenSpecGateway` 介面新增寫入方法，`web-gateway` 實作、types 擴充（M4 Tauri 版屆時換 fs 實作，介面不變）。
- `server/`：新增 POST route 與翻行寫檔邏輯（重讀、比對、翻字元、寫回）。
- 既有唯讀語意變更僅限 tasks tab；清單進度數字、live-refresh、快取語意皆沿用既有機制，無 schema 或相依套件變動。
