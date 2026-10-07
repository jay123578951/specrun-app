# Tasks

## 1. 共用解析層

- [x] 1.1 在 `src/api/types.ts` 加入以下型別，並在 Gateway 介面加更新檢查方法；`pnpm typecheck` 通過：
  - `GatewayErrorKind` 加「CLI 版本過舊」；
  - archived 清單 probe 改成 CLI 呼叫的形狀（stdout、exit code、spawn 失敗），與 change 清單 probe 同形；
  - 更新檢查的結果型別：有新版（新版號、可選的升級指令）、已是最新、無法檢查、低於 1.14。
- [x] 1.2 實作「CLI 是否低於 1.14」的判斷，放在一處供 archived 與更新檢查共用（判斷方式見 design「刻意留給 Coder 的留白」）；以單元測試釘住 1.13.2 的實際輸出（`error: unknown option '--archived'`，exit 1）判為過舊、1.14.0 與 1.14.1 判為不過舊
- [x] 1.3 改寫 `src/api/normalize-archived.ts` 的 `normalizeArchivedList`：解析 CLI JSON 的 `changes`，名稱與日期照舊由 `splitDatePrefix` 從 `name` 拆出，進度用 CLI 的完成數與總數，不讀 `lastModified`；錯誤分類沿用 `normalize.ts` 的 CLI 清單分類並加上版本過舊。在 `normalize-archived.test.ts` 驗證：
  - 一般清單的名稱、日期、進度與排序；
  - `lastModified` 晚於目錄日期時，日期與排序仍依目錄名；
  - 無日期前綴、`totalTasks: 0` 不顯示進度；
  - `changes: []` 為空清單；
  - `no_openspec_root` 歸非 openspec 專案、找不到執行檔歸 CLI 不可用、1.13.2 輸出歸版本過舊、亂碼歸呼叫或解析失敗。
- [x] 1.4 新增更新檢查結果的解析函式（共用純模組）：`available` 帶 `latest` 與可選 `command`、`current`、`offline`／`disabled`／非零結束／JSON 解析失敗一律為無法檢查、1.13.x 輸出為低於 1.14；以單元測試逐一驗證

## 2. 讀取與檢查通道（網頁與桌面各一份）

- [x] 2.1 改寫 `server/api/archived.get.ts`：改用 `runCli(['list', '--archived', '--json'])`，不再列目錄與讀 tasks.md；`listArchivedDirs` 保留給 roadmap 與詳情。`web-gateway.test.ts` 補回應形狀測試，並以 `curl localhost:3210/api/archived` 對本專案確認回 38 筆
- [x] 2.2 改寫 `src/api/desktop/archived.ts` 的清單讀取：改走 CLI 呼叫（比照 `reads.ts` 的 `cliProbe`），詳情讀取不動；更新 `src/api/desktop/archived.test.ts`，以假外殼驗證清單走 CLI、詳情仍讀檔，並移除已不適用的逐筆讀 tasks.md 測試
- [x] 2.3 新增網頁形態的更新檢查 API（`server/api/cli/` 底下），以目前生效執行檔跑 `version --check --json`；web gateway 接上並在 `web-gateway.test.ts` 補一則測試
- [x] 2.4 在 `src/api/desktop/cli.ts` 新增桌面形態的更新檢查，desktop gateway 接上；在 `src/api/desktop/cli.test.ts` 以假外殼驗證四種結果與例外不逸出

## 3. Archived 頁

- [x] 3.1 `stores/archived.ts` 區分 CLI 不可用與版本過舊；`ArchivedView.vue` 新增這兩種狀態的呈現：說明文字加 Open settings 按鈕、不放 Try again，樣式比照 `ChangeList.vue:118` 的 CLI 不可用提示，文案英文且版本過舊需寫明 openspec 1.14 以上；`stores/archived.test.ts` 驗證兩種錯誤各自的旗標，並在瀏覽器把 CLI 指到 1.13.2 確認畫面出現版本過舊與 Open settings（瀏覽器確認由操作流程驗證覆蓋）

## 4. Settings

- [x] 4.1 `stores/settings.ts` 的 `reloadAfterCliChange` 加入 archived 重載，並更新該函式上方「archived 不動」的註解；`stores/settings.test.ts` 驗證套用成功後 archived 被重載、watcher 不重掛
- [x] 4.2 `stores/settings.ts` 加更新檢查狀態：開啟 Settings 且有可用執行檔時檢查、套用新執行檔成功後重新檢查、CLI 不可用時不檢查、晚到的舊結果不得覆蓋新結果；`stores/settings.test.ts` 逐條驗證
- [x] 4.3 `SettingsModal.vue` 的 openspec CLI 區塊呈現檢查中與四種結果；有新版且有指令時以 `CopyNameButton` 附複製鈕，沒有指令時只顯示新版號；文案英文、不出 toast。`SettingsModal.test.ts` 驗證五種畫面狀態，並套用 ui-interaction-states 檢查複製鈕的狀態

## 5. 整合確認

- [x] 5.1 `pnpm lint`、`pnpm typecheck`、`pnpm test` 全數通過（由 gate 覆蓋：全部測試）
- [x] 5.2 用 `pnpm dev`（先依 CLAUDE.md 確認 5173 沒人在聽）走一遍：Archived 頁列出 38 筆且進度、日期、順序與改動前相同；開 Settings 看到檢查中轉為已是最新版；把 CLI 指到 1.13.2 後 Archived 顯示版本過舊、Settings 顯示需要 1.14，再換回 1.14.1 後兩處自動恢復（由 gate 覆蓋：操作流程驗證；CLI 舊版改用本機 1.8.0）
- [x] 5.3 `pnpm dev:app` 在桌面視窗重走 5.2 的 Archived 與 Settings 部分，確認桌面形態結果相同
