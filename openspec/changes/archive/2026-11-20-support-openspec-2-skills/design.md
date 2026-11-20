# Design

## Context

動機見 proposal.md 的 Why。行為契約見 `specs/openspec-gateway` 與 `specs/app-settings`。

兩種執行形態各有一份讀取，判斷集中在共用純模組 `src/api/workflow-files.ts`：

- **網頁**：`server/utils/workflow-files.ts`。
- **桌面**：`src/api/desktop/workflow-files.ts`。

開發期實測（openspec 2.1.1）：

| 專案狀態 | `openspec update <路徑> --dry-run --json` 的結果 |
|---|---|
| 1.14.1 產生的舊擺法（資料夾＋`/opsx:*` 指令檔） | `changes` 有 25 筆，exit 0，檔案未被改動 |
| 已用 2.1.1 更新過 | `{ "changes": [], "notes": [], "failures": [] }`，exit 0 |
| 有 `openspec/` 但沒有任何流程檔 | 同上：`changes` 是空的，exit 0 |
| 流程檔裝成全機共用 | 同上；專案內也沒有任何標記 |
| 沒有 `openspec/`、或路徑不存在 | `status` 帶 `update_error`，exit 1 |

2.x 的流程檔開頭只有 `metadata.version: "1.0"`，沒有 `generatedBy`。`.claude/skills/openspec-*` 是相對連結，指向 `../../.agents/skills/openspec-*`。

Tauri fs plugin（2.5.1）的 `read_dir` 用不跟隨連結的 `file_type()`，所以連結回報為 `isSymlink: true`、`isDirectory: false`。

## Decisions

### 讀得到版本號就照舊，讀不到才問 CLI

- **選擇**：保留 `generatedBy` 的讀取與比較。只有「有流程檔、但全部讀不到版本號」時才跑 `update --dry-run --json`。
- **理由**：`--dry-run` 分不出「已是最新」和「沒有流程檔」，兩者都回空的 `changes`，所以仍然要靠檔案是否存在來判斷未設定。既然要看檔案，舊擺法的版本號就順便保留，畫面上仍看得到 1.2.0 這類資訊。
- **沒選的做法**：全部改問 CLI、拿掉版本欄。這樣每次開 Settings 每個專案都要多跑一次 CLI，還會失去版本號與「比 CLI 新」的判斷。

### 不擴大桌面外殼的授權範圍

- **選擇**：桌面形態只列 `.claude/skills` 底下的名稱。連結另一頭的 `.agents/skills` 讀不到，讀取失敗視為沒有版本號，接著問 CLI。
- **理由**：2.x 的檔案本來就沒有版本號，讀得到也沒有用。

### CLI 答不出來時不顯示狀態

- **選擇**：結束代碼非 0、輸出無法解析、執行失敗或丟出例外，一律回報無比較結果。
- **理由**：這時不知道落後與否。顯示「Not set up」或「Up to date」都是錯的。

## Risks

- 沒有版本號的專案，每次開 Settings 多一次 CLI 呼叫（實測約 0.5 秒）。各專案平行執行，不擋其他列。
- 全機共用的專案顯示「Not set up」，見 proposal 的已知限制。
