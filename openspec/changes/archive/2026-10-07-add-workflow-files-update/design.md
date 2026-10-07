# Design

## Context

動機見 proposal.md 的 Why，行為契約見 `specs/app-settings`、`specs/openspec-gateway`、`specs/desktop-shell`。

開發期實測（openspec 1.14.1，在專案副本上執行，未動真實專案）：

```
第一次  Updating 1 tool(s): claude (1.13.1 -> 1.14.1)
        Updated: Claude Code (v1.14.1)          exit 0，改 10 個檔案，約 1.2 秒
第二次  All 1 tool(s) up to date (v1.14.1)      exit 0，不改任何檔案
```

- `update` 在沒有終端機時不會停下來問，App 可直接背景執行；重複執行不會出事。
- `update` 沒有 `--json`，只有文字輸出與結束代碼。
- CLI 沒有回報流程檔版本的指令（`doctor --json`、`context --json` 都沒有）。CLI 內部的 `getToolVersionStatus` 沒有開放成指令。CLI 自己判斷 skill 檔是否最新時只看 `generatedBy:` 這一行（`dist/core/update.js:396` 的註解）。
- 遇到舊格式檔案時，非互動且沒有 `--force` 的 `update` 會跳過清理，印出 `⚠ Run with --force to auto-cleanup legacy files, or run interactively.`。

既有程式的相關現況：

- 桌面形態的專案授權（`src-tauri/src/lib.rs:119` 的 `allow_path`）遞迴放行專案目錄，但遞迴放行不涵蓋 `.` 開頭的目錄，所以另外補放行了 `.git`。`.claude/` 目前讀不到。
- 其他專案的徽章（`src/api/desktop/projects.ts` 的 `countAll`）走 CLI，不讀檔，所以目前只有「目前專案」有被放行讀檔。
- App 專案清單的實際分布：1.2.0、1.8.0、1.13.1 兩個、1.14.1、未設定。

## Goals / Non-Goals

**Goals:**

- 版本解析、取最舊、與 CLI 比較、更新結果解析都放在 `src/api/` 的共用純模組，網頁與桌面兩邊只做讀檔與執行。
- 讀檔範圍只到 `.claude/skills/openspec-*/SKILL.md` 的開頭一行，不讀其他內容。

**Non-Goals:**

- 不顯示 git 分支與未提交改動：App 不碰 git（roadmap-view 時已決定不引入）。
- 不支援 Claude Code 以外的 AI 工具。
- 不替未設定的專案執行 `openspec init`。
- 不處理 CLI 本身的升級（屬於 `adopt-openspec-1-14`）。

## Decisions

### D1. 版本一覽放在 Settings，目前專案在上、其他專案收起

使用者在 explore 中選定放在 Settings（另一個選項是側欄每個專案旁直接標示）。理由：可以和上方的 CLI 版本對照；openspec 約每週出一版，側欄常駐記號在 CLI 升級那一週會讓所有專案同時亮起，很快會被當成雜訊。

驗收時發現全部列出會讓 Settings 隨專案數變長，改為最上方只顯示目前專案，其餘收在預設收起的「Other projects (N) · M behind」，每次開啟都重新收起。曾評估「只顯示目前專案」並否決：CLI 升級那一週要逐一切換專案才能更新，也失去一眼對照全部專案的能力。

### D2. 只有逐一的 Update 按鈕，不做全部更新

使用者在 explore 中選定。實際狀況是 3 個專案在功能分支、5 個有未提交改動。一次全部更新會讓這些專案同時多出與手上工作無關的改動；逐一按可以跳過正在做的專案。日後要加全部更新不難。

### D3. 版本從 `generatedBy` 讀，多檔不一時取最舊

CLI 不提供查詢指令。App 讀 archived、park、roadmap 時已有「CLI 不提供就直接讀檔、不涉規格內容」的做法，且 CLI 自己判斷時也只看這一行。只要有一個 skill 檔舊，該專案就需要更新，所以取最舊。

### D4. 只看 Claude Code

使用者的專案都只用 Claude Code。openspec 支援 50 多種工具、檔案位置各不同，全部支援會多出用不到的程式。

### D5. 不加 `--force`

`--force` 會整個刪除舊格式檔案，App 在背景執行時使用者看不到這個過程。不加時 CLI 只跳過並印警告，App 把警告就地顯示。

### D6. 比 CLI 新的專案不放按鈕

`update` 遇到版本不同就會重寫，用舊 CLI 按下去等於把流程檔降版。

### D7. 桌面授權只多放行 `.claude/skills`

比照 `allow_path` 對 `.git` 的既有補放行。只放行 `.claude/skills`，不放行整個 `.claude/`，因為 `.claude/` 底下還有 `settings.json` 等與此功能無關的個人設定。讀取其他專案前，要先對該專案呼叫既有的授權流程（`ensureAccess`）；這些都是使用者自己加入清單的專案。

### D8. 更新通道只接受專案清單內的路徑

更新會在該路徑寫檔，只允許清單內的專案，避免通道被拿來對任意路徑執行。

### D9. 狀態就地呈現，不出 toast；不顯示 git 資訊

依 app-settings「驗證結果就地呈現」的既有慣例。

### D10. 開啟 Settings 時讀取

與 `adopt-openspec-1-14` 的新版檢查同一個時機。更新完成後只重讀該專案。

### D11. 畫面文字一律英文

既有 spec 的慣例。

### 刻意留給 Coder 的留白（非遺漏）

- **怎麼從 CLI 文字輸出挑出警告**：顯示整段輸出，或只挑 `⚠` 開頭的行，皆可。畫面上的差別很小。

## Risks / Trade-offs

- [openspec 日後改了 `generatedBy` 的位置或格式] → 讀不到時回報未設定，不會顯示錯的版本號；單元測試釘住目前格式。
- [CLI 日後改了 `update` 的文字輸出] → 成功與否只看結束代碼，文字只拿來顯示，改了也不會判錯。
- [桌面授權範圍擴大到其他專案] → 只限使用者自己加入清單的專案，且 `.claude` 只開放 `skills`。
- [使用者在 Claude Code 正在使用某專案時按了更新] → 流程檔被改寫，下一次讀取 skill 時才生效，不會中斷進行中的 session。

## Migration Plan

無資料遷移。回滾只需還原本 change 的程式碼；已被更新的專案流程檔留在新版，不受影響。
