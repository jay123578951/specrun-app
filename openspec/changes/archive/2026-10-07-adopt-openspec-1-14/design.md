# Design

## Context

動機見 proposal.md 的 Why。行為契約見 `specs/archived-view`、`specs/app-settings`、`specs/openspec-gateway`。

兩種執行形態各有一份 IO，解析集中在共用純模組：

- **網頁**：Nitro route 造 probe（`server/api/archived.get.ts`）。
- **桌面**：Tauri 外殼造 probe（`src/api/desktop/archived.ts`；CLI 呼叫走 `src/api/desktop/reads.ts` 的 `cliProbe` 同一種形狀）。
- **共用**：`src/api/normalize-archived.ts` 負責日期前綴拆解、排序、錯誤分類；`src/api/normalize.ts` 負責 CLI 清單的錯誤分類（三類）。

開發期實測（openspec 1.14.1，本專案 38 筆 archived）：

| 情況 | `openspec list --archived --json` 的結果 |
|---|---|
| 一般 | `{ changes: [{ name, completedTasks, totalTasks, lastModified, status, archived }], root }`，`name` 為完整目錄名 |
| 進度 | 38 筆的完成數／總數與 App 現行自行解析的結果完全相同 |
| 目錄名無日期前綴 | 照常列出 |
| tasks.md 讀不到（權限 000） | 該筆照列，`totalTasks: 0`、`status: "no-tasks"`，exit 0 |
| archive 目錄不存在 | `changes: []`，exit 0 |
| 非 openspec 專案 | `root: null` 加 `no_openspec_root` 診斷，exit 1（與 `list --json` 同形） |
| openspec 1.13.2 | stderr `error: unknown option '--archived'`，exit 1 |
| 耗時 | 約 0.8 秒（與 Changes 頁的 `list --json` 同一量級） |

`openspec version --check --json`（1.14 起才有）回傳：

```json
{
  "schemaVersion": 1,
  "version": "1.14.1",
  "install": { "location": "...", "packageManager": "pnpm", "scope": "global" },
  "update": { "status": "current", "latest": "1.14.1", "command": null, "canSelfUpgrade": false }
}
```

`update.status` 的值來自 CLI 原始碼 `dist/core/version-check.d.ts`：`available | current | disabled | offline`。`command` 只在 CLI 判斷得出安裝方式時才有值。耗時約 0.7 秒。

## Goals / Non-Goals

**Goals:**

- archived 清單與 change 清單走同一套 CLI 錯誤分類，只多一類「版本過舊」。
- 版本門檻的判斷只有一處，Archived 頁與 Settings 用同一個答案。

**Non-Goals:**

- 不改 archived 詳情：`status`／`show` 仍不認得已歸檔的 change，詳情照舊直讀檔案。
- 不改 Roadmap：引用解析只需要名稱，繼續直接列 archive 目錄（`server/utils/archive-store.ts` 的 `listArchivedDirs` 保留）。
- 不改 Parked：它仍自己數 tasks.md，`src/api/task-progress.ts` 保留。
- 不同步 openspec 流程檔（`openspec update`）：那是工具維護，另外處理。
- 不做 App 代跑升級，不在 Settings 外提示新版。

## Decisions

### D1. CLI 太舊時顯示「需要升級」，不退回直接讀檔

使用者在 explore 中選定。退回直接讀檔等於新舊兩套讀法都要維護，失去改用 CLI 的理由。影響範圍只有 Archived 頁，且只有 openspec 低於 1.14 的人會遇到。

### D2. 新版提示只在 Settings 裡，開啟 Settings 時才檢查

使用者在 explore 中選定。openspec 約每週出一版，Settings 外的常駐提示很快會被當成雜訊；真正必須升級的情況由 Archived 頁自己說明。也省掉齒輪按鈕的小點與其消失規則。

### D3. 名稱、日期、排序仍從目錄名拆，不用 CLI 的 `lastModified`

CLI 的 `name` 就是完整目錄名，`splitDatePrefix` 照舊適用。`lastModified` 是檔案最後修改時刻，任何後補修改都會讓它跳到最近，不能當歸檔日。CLI 的排序依 `lastModified`，與 spec 規定的「歸檔日新→舊」不同，所以排序照舊由 `normalize-archived` 做。

### D4. 版本過舊是獨立的第四類錯誤

不併入「CLI 不可用」：那一類的說明是「找不到執行檔」，對已經裝好但版本舊的人是錯誤指引。也不併入「呼叫或解析失敗」：那一類附 Try again，重試必定再失敗。第四類在畫面上的呈現比照 `src/components/ChangeList.vue:118` 的 CLI 不可用提示：說明加 Open settings 按鈕，不放重試。依據：該處已是「要使用者換 CLI 才解得開」的既有做法。

### D5. CLI 不可用時 Archived 頁比照 Changes／Specs 頁

以前 Archived 不需要 CLI，CLI 不可用時照樣能看。改用 CLI 後沿用既有的「CLI 不可用」呈現，不另設文案。

### D6. 換 CLI 後 Archived 重載

`stores/settings.ts` 的 `reloadAfterCliChange` 目前刻意跳過 archived（註解寫「CLI 零參與」）。改用 CLI 後此理由不成立，加入 archived 重載，舊版換新版後「需要升級」立即消失。

### D7. 更新檢查只顯示 CLI 給的指令，不代跑

全域安裝在背景執行，失敗了使用者也看不到過程；CLI 本身對 pnpm 等安裝回 `canSelfUpgrade: false`。複製鈕沿用 `src/components/CopyNameButton.vue`（`name` 傳指令字串，`label` 改為指令的說明）。

### D8. 無法檢查合併四種來源

`offline`、`disabled`、逾時、執行失敗或輸出看不懂，對使用者都是「現在沒有答案」，處置也相同（晚點再開一次 Settings），因此在畫面上合併為一種。

### D9. 檢查中與結果就地呈現

依 app-settings「驗證結果就地呈現」的既有慣例：狀態寫在 openspec CLI 區塊內，不出 toast。檢查是非同步的，Settings 其他操作不等它。

### D10. 兩種執行形態都做，解析共用

更新檢查的 JSON 解析放在 `src/api/` 的共用純模組，網頁與桌面各自只負責 spawn。比照既有 normalize 分工。

### D11. 畫面文字一律英文

archived-view 規格明定 UI 文案用英文。explore 中的中文描述只表達意思。

### 刻意留給 Coder 的留白（非遺漏）

- **怎麼判斷 CLI 低於 1.14**：可比較 `--version` 取得的版本號，或辨認 CLI 回的 `unknown option '--archived'`／`unknown command 'version'`。兩種做法在畫面上結果相同。唯一要求見 Goals：Archived 頁與 Settings 的判斷不得分岔。

## Risks / Trade-offs

- [Archived 頁載入變慢約 0.8 秒] → 與 Changes 頁同一量級，既有 skeleton 已涵蓋載入期。
- [CLI 日後改 `list --archived` 的 JSON 形狀] → 解析集中在 `normalize-archived.ts`，非預期形狀歸「呼叫或解析失敗」，不會靜默顯示錯的資料。
- [CLI 太舊的辨識依賴錯誤字串或版本號格式] → 單元測試釘住 1.13.2 實際輸出；辨識失敗時退成「呼叫或解析失敗」，仍有錯誤說明，不會留白。
- [`version --check` 每次開 Settings 都連網] → 只在開 Settings 時發生，次數低；離線歸「無法檢查」，不影響其他操作。

## Migration Plan

無資料遷移。openspec 低於 1.14 的使用者升級後 Archived 頁恢復；回滾只需還原本 change 的程式碼。
