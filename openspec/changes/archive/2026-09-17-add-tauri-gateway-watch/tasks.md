## 1. 外殼通道的薄層包裝

- [x] 1.1 在 `src/api/desktop/shell.ts` 補上監看與取消監看兩個包裝：監看收路徑、遞迴與延遲設定、一個事件接收管道，回傳一個監看編號；取消監看收該編號。沿用檔案中既有的做法——直接呼叫外殼已註冊的檔案通道指令，不另裝繫結套件。驗證：`pnpm typecheck` 通過，且包裝的型別標出事件內容只取得到路徑陣列
- [x] 1.2 確認外殼端零改動即可用：`src-tauri/capabilities/default.json` 已含監看與取消監看兩項權限、`src-tauri/Cargo.toml` 已啟用監看能力。驗證：讀過兩個檔案確認無需新增，並在本張的實作報告中寫明外殼未改動

## 2. 目前專案的變動出口

- [x] 2.1 在 `src/api/desktop/projects.ts` 加一個「目前專案變了」的訂閱出口（訂閱、取消訂閱、送出通知），並於 `addProject`、`removeProject`、`switchProject` 三處改完執行期狀態後各送出一次。驗證：`src/api/desktop/projects.test.ts` 新增測試，斷言三個動作各觸發一次、且未變更目標時不觸發
- [x] 2.2 確認送出的時機在設定持久化之後、回傳結果之前，且持久化失敗不影響送出。驗證：測試覆蓋「設定寫入失敗時仍送出通知」

## 3. 桌面形態的監看模組

- [x] 3.1 新增 `src/api/desktop/watch.ts`：對外提供訂閱（回傳取消訂閱）與「現在有沒有接上」兩個出口。第一個訂閱者到來時才接上監看，最後一個離開時不強制斷開（沿用 web 形態語意）。驗證：`src/api/desktop/watch.test.ts` 以假的外殼通道斷言訂閱與取消訂閱的行為
- [x] 3.2 接上監看時走 `resolveTarget()` 取得解開 symlink 後的目標路徑與檔案存取授權；無目標專案時不接上、記為未接上。驗證：測試斷言監看用的是 `resolveTarget()` 回傳的路徑而非設定裡的原字串，以及無目標專案時不呼叫監看通道（design 決策 4）
- [x] 3.3 先試 `openspec/changes/`，該目錄監看不了就退一層監看 `openspec/`；退一層時以 `paths.ts` 的 `isInside` 判斷事件路徑是否落在 `openspec/changes/` 底下，落在外面的丟棄。兩層都監看不了即記為未接上、不重試。驗證：測試覆蓋三種情形——直接監看成功、退一層並濾掉範圍外事件、兩層皆失敗（design 決策 5）
- [x] 3.4 事件送到後做 400 毫秒的尾端合併再通知訂閱者：合併期間再收到事件就重新計時，底層逐則送上來的一批只產生一則通知。單一訂閱者拋出例外不影響其他訂閱者。驗證：測試以假時鐘斷言「逐則送入 N 則只得一則通知」與「連續送入期間不提前通知」（design 決策 1、2）
- [x] 3.5 訂閱「目前專案變了」：收到後先停掉舊監看再接上新目標，並以一個遞增計數丟棄接上途中已被換掉的那一輪；重接完成 MUST NOT 補發通知。驗證：測試覆蓋「切換後只有新目標的事件觸發通知」與「連續切換兩次時第一輪的結果被丟棄」（design 決策 3、7）
- [x] 3.6 取消訂閱時若監看尚未接上，接上後要立刻收掉，不留下沒有訂閱者的監看。驗證：測試斷言「訂閱後立即取消」的情形下最終呼叫了取消監看通道（design 決策 4 的副作用）

## 4. 接上 gateway 與診斷

- [x] 4.1 `src/api/desktop-gateway.ts` 補上 `subscribeToChanges`，改由 3.1 的模組承接，並更新檔頭說明（過渡期間仍經本地 API server 的只剩原生對話框與開啟所在位置）。驗證：`src/api/desktop-gateway.test.ts` 斷言該方法不再落到 web 形態的實作
- [x] 4.2 `src/api/desktop/diagnostics.ts` 的通知欄位改讀 3.1 的「現在有沒有接上」，不再回未知。驗證：`src/api/desktop/diagnostics.test.ts` 斷言接上時為是、未接上時為否，且不再出現未知

## 5. 刪除過渡同步呼叫

- [x] 5.1 從 `src/api/desktop/projects.ts` 刪除 `syncLocalServer`、三處呼叫與等待上限常數，並移除相關註解中的技術債說明。驗證：`src/api/desktop/` 底下搜尋 `fetch(` 零命中（原判準寫「搜尋 `/api/` 零命中」，但該字串仍會命中註解裡指向 web 端點的說明與 `@tauri-apps/api` 匯入路徑，對正為真正要驗的「不對本地 API server 發請求」），`src/api/desktop/projects.test.ts` 既有測試全過
- [x] 5.2 確認刪除後「移除清單裡最後一個專案」不再有殘留狀態問題。驗證：測試斷言移除最後一個專案後目前專案為無，且不對本地 API server 發出請求（design 決策 8）

## 6. 收掉診斷欄位的未知態

- [x] 6.1 `src/api/types.ts` 的環境診斷型別中，檔案變動通知欄位由三態縮為兩態（是／否）。驗證：`pnpm typecheck` 通過，且型別變更後 web 形態的實作無需改動
- [x] 6.2 `src/components/SettingsModal.vue` 的診斷列移除該項的未知分支，值只剩已接上與未接上兩種呈現。開啟所在位置那四種禁用成因的文案完全不動（那是 T4b 的範圍）。驗證：`pnpm typecheck` 與 `pnpm lint` 通過，且開啟位置按鈕的說明文字逐字未變

## 7. 驗收

- [x] 7.1 `pnpm test`、`pnpm typecheck`、`pnpm lint` 全數通過（由 Tester gate 覆蓋：480 測試全過）
- [x] 7.2 以 `pnpm dev:app` 啟動桌面形態，勾選一個 task，確認左側該 change 卡片的進度數字於短暫延遲後自行更新，不需切頁
- [x] 7.3 桌面形態下以外部編輯器修改某 change 的 tasks 檔案，確認清單自行刷新；再修改專案內 `openspec/` 以外的檔案，確認不觸發刷新（實機驗證：外部取消／回復勾選 6.1，App 詳情面板同步變動；改 README.md 與 src/ 新增刪除檔案時桌面 App 零次重新載入，靜置基準亦為零）
- [x] 7.4 桌面形態下切換到另一個專案，分別修改新舊兩個專案的 `openspec/changes/` 內容，確認只有新專案的變動觸發刷新（實機驗證：切到 ui 後，ui 的變動令桌面 App 重新載入 12 次、specrun-app 的變動令桌面 App 重新載入 0 次；以 CLI 程序的父程序辨識，排除併跑的 Nitro server 雜訊）
- [x] 7.5 桌面形態下開啟 Settings，確認即時刷新一項顯示為明確的已接上，不是佔位符；再把目標專案切成一個沒有 `openspec/` 的暫時項，確認該項顯示為未接上（實機驗證：目標為 ui 時顯示 Connected；目標切為當時無 openspec/ 的 EOC_TV 時顯示 Not connected）
- [x] 7.6 以瀏覽器形態（`pnpm dev`）走一遍同樣的刷新情境，確認 web 形態行為零變化（由操作流程驗證 gate 覆蓋：勾選免切頁更新 16/22→17/22、外部改檔觸發刷新、Settings 顯示 Connected，無 console error）
