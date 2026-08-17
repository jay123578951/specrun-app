## 1. Server 端 pick-folder

- [x] 1.1 建立 `server/utils/folder-picker.ts`：osascript 結果映射純函式（exit code＋stdout＋stderr → `PickFolderOutcome`，含 picked／canceled／failed 三型判定）與 darwin 平台判定；spawn 邏輯與 in-flight busy 旗標（design D2、D3）
- [x] 1.2 建立 `server/api/pick-folder.post.ts`：非 darwin 回 `unsupported`，darwin 走 spawn 流程回映射結果
- [x] 1.3 新增映射純函式的單元測試（成功取路徑含去尾換行、User canceled、其他非零 exit）

## 2. 前端介面接線

- [x] 2.1 `src/api/types.ts`：新增 `PickFolderOutcome` 型別；`GatewayApi` 移除 `canPickFolder`、`pickFolder` 改回傳 `Promise<PickFolderOutcome>`（design D1）
- [x] 2.2 `src/api/web-gateway.ts`：`pickFolder()` 實作打 `POST /api/pick-folder`，網路層錯誤映射為 `failed`；移除寫死的 `canPickFolder: false`
- [x] 2.3 `ProjectSwitcher.vue` 的 `startAdd()` 改依 `pickFolder()` 的 status 分流（design D4）

## 3. 驗收回饋：移除手打路徑輸入列

- [x] 3.1 projects store：新增 `startAdd()` 動作收下全部 status 分流與 toast（picked → 加入、失敗 `notify`；canceled／busy → 無事；unsupported／failed → `notify`），並移除 `addFormOpen`（design D4、D5）
- [x] 3.2 `ProjectSwitcher.vue`：移除路徑輸入列 form 與其狀態（`draft`／`addError`／`pathInput`／`onFormFocusOut`／`closeAdd`／`submitAdd`／`submitPath`），「Add project」改呼叫 `projects.startAdd()`
- [x] 3.3 `ChangeList.vue`／`SpecsView.vue`／`ArchivedView.vue` 三處空狀態的加入按鈕改呼叫 `projects.startAdd()`

## 4. 驗證

- [x] 4.1 `pnpm test`、`pnpm typecheck`、`pnpm lint` 全綠
- [x] 4.2 macOS 實機走一遍（spec 各 scenario）：dialog 開啟且在前景、選有效專案即加入切換、取消不留任何痕跡（畫面無輸入框）、選到無 `openspec/` 的資料夾出 toast、重複加入出 toast 並切換、空清單時主區空狀態的加入按鈕同樣開 dialog
