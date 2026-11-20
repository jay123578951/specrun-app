# support-openspec-2-skills

## Why

openspec 2.0 改了流程檔的擺法，Settings 的「Project workflow files」因此判斷錯誤。

- 流程檔開頭不再寫 `generatedBy`，App 讀不到版本號。
- `.claude/skills/openspec-*` 從資料夾變成連結，指向 `.agents/skills/`。App 目前只把資料夾算作流程檔，連結被略過。

結果是：專案用 openspec 2.x 更新過之後，那一列永遠顯示「Not set up」，之後 CLI 出新版也不會提示落後。

## What Changes

- **連結也算流程檔**：`.claude/skills/openspec-*` 是資料夾或連結都算。
- **讀不到版本號時改問 CLI**：有流程檔、但沒有任何一個讀得到 `generatedBy` 時，以目前的執行檔跑 `openspec update <專案路徑> --dry-run --json`。有檔案要變動就是落後，沒有就是已是最新。這個指令只回報，不改檔案。
- **畫面**：這種專案的版本欄顯示 `-`，狀態照常顯示「Behind CLI」或「Up to date」，落後時照常有 Update 按鈕。CLI 答不出來時（例如 1.15 以前不認得 `--dry-run`）該列不顯示狀態。
- **讀得到版本號的專案完全照舊**：仍然比版本號，不多呼叫 CLI。
- **行為改變**：有流程檔但都沒有 `generatedBy` 的專案，以前顯示「Not set up」，現在改由 CLI 回答。完全沒有流程檔的專案仍顯示「Not set up」。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `openspec-gateway`：「專案流程檔版本讀取通道」加入連結的認定，未設定只指沒有任何流程檔；新增「流程檔沒有版本號時向 CLI 詢問」。
- `app-settings`：新增「沒有版本號的流程檔的呈現」。

## Impact

- 共用：`src/api/workflow-files.ts` 新增解析 `update --dry-run --json` 的函式，`buildWorkflowEntry` 接受 CLI 問來的結果。
- 後端（Nitro）：`server/utils/workflow-files.ts`。
- 桌面（Tauri）：`src/api/desktop/workflow-files.ts`。外殼的授權範圍不變：只需要列出 `.claude/skills` 底下的名稱，不必讀連結另一頭的 `.agents/skills`。
- 前端元件與 store 不變。
- 相依：`--dry-run` 需要 openspec 1.15.0 以上。更舊的 CLI 搭配沒有版本號的流程檔時，該列不顯示狀態。
- 已知限制：把流程檔裝成全機共用的專案，專案資料夾裡沒有任何流程檔，App 分不出它和沒設定的專案，兩者都顯示「Not set up」。
