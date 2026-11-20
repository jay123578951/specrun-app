# Tasks

## 1. 共用解析層

- [x] 1.1 `src/api/workflow-files.ts` 新增 `parseUpdatePreview`：`changes` 非空為落後、空為已是最新；結束代碼非 0、不是 JSON、沒有 `changes` 回 null。以 2.1.1 實測輸出寫單元測試
- [x] 1.2 `buildWorkflowEntry` 接受 CLI 問來的結果：讀得到版本號照舊比版本；有流程檔但都沒有版本號時採用 CLI 的結果；CLI 不可用或答不出來時狀態為 null；沒有流程檔為未設定
- [x] 1.3 新增 `needsUpdatePreview`，供兩種形態判斷要不要問 CLI
- [x] 1.4 移除讀取本專案自身 `SKILL.md` 的測試（本專案更新到 2.x 後該檔不再有版本號），改為驗證 2.x 格式讀不到版本號

## 2. 讀取通道（網頁與桌面各一份）

- [x] 2.1 `server/utils/workflow-files.ts`：連結也算流程檔；需要時跑 `update <路徑> --dry-run --json`，例外不逸出。測試用真的連結與暫存資料夾
- [x] 2.2 `src/api/desktop/workflow-files.ts`：同上，測試用假外殼回報 `isSymlink`

## 3. 驗證

- [x] 3.1 `pnpm test`、`pnpm typecheck`、`pnpm lint` 通過
- [ ] 3.2 人工驗收：在桌面 App 的 Settings 確認一個已用 2.x 更新過的專案顯示 `-` 與「Up to date」，未更新的專案顯示版本號與「Behind CLI」
