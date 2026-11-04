# Design

## Context

動機見 `proposal.md`，行為見 `specs/roadmap-view/spec.md`。

現況的資料流分兩層，這次沿用：

```
桌面版 desktop/roadmap.ts ---+
                             +--> RoadmapListProbe --> normalize-roadmap.ts --> 卡片、面板
網頁版 server/api/roadmap.get.ts --+
```

兩邊只負責讀取資料，解析、分組、排序都在共用的 `normalize-roadmap.ts`。兩邊也都已有執行外部程式的能力：桌面版是 `spawnBin`（Rust 端的 `spawn_bin` 沒有限定程式），網頁版是 `execFile`。

## Goals / Non-Goals

**Goals:**

- 兩個版本對同一個專案算出相同的時間。
- 判斷規則只寫一份，而且不用啟動 git 就能測試。
- 讀取 git 不寫入使用者的 repo。

**Non-Goals:**

- 不改 Changes 頁的時間。
- 不監看 `.git`。提交之後仍要重新進入頁面或按 Refresh 才更新。
- 不在畫面上標示某張卡片用的是哪一種時間。

## Decisions

### D1. 時間的依據：提交時間，有未提交修改時用檔案修改時間

使用者在討論中選定。只加強規範擋不住切換分支和重新 clone。App 自己記住每張卡片內容的做法，要多一份長期保存的紀錄，而且重新 clone 後全部會被當成新卡片。

使用者已接受的代價：同一個 commit 的卡片時間相同，組內依檔名排序；顯示的時間是提交時間，可能晚於實際編輯時間。

### D2. 用作者時間，不用提交時間

使用者選定。這次要解決的是內容沒變卻更新時間，rebase 正是這種情況。代價是 amend 改了內容後，時間仍是 commit 最初建立的時間。實測 `TCERT/ui` 改到 roadmap 的 182 個 commit 有 14 個兩者不同，最大差距約 2 天；`TCERT/ds` 的 24 個都相同。

### D3. 讀取用三條 git 指令，都在 `openspec/roadmap/` 目錄內執行

```
git log --no-show-signature --root --format=@%at --name-only -z --relative -- .
git --no-optional-locks -c diff.autoRefreshIndex=false diff --numstat --no-renames -z --relative HEAD -- .
git ls-files -z -- .
```

- **在 roadmap 目錄內執行加 `--relative`：** 輸出的路徑相對於這個目錄，頂層卡片就是 `a.md`，子目錄的同名檔是 `sub/a.md`，不會混淆。專案在 repo 子目錄或 worktree 時也不需要另外處理，所以不用 `resolveGitDir`，它會把 worktree 回報成不可用。
- **`-z`：** 中文檔名不會被 git 轉成跳脫字元。
- **`-c diff.autoRefreshIndex=false`：** `git diff` 預設會把重新比對過的結果寫回 `.git/index`，`--no-optional-locks` 擋不住這件事（實測用 `sed` 重寫檔案後執行，索引檔的修改時間和 sha 都變了）。關掉之後索引檔不變。`--no-optional-locks` 仍保留，避免 git 取得選用的鎖。
- **`--numstat --no-renames`，不用 `--name-only`：** 關掉自動更新索引後，`--name-only` 會把「重寫但內容沒變」的檔案也列成有修改，因為它只看檔案的時間戳記。`--numstat` 要比對內容，內容沒變的檔案不會列出。每筆是 `新增數<tab>刪除數<tab>路徑`，以 `\0` 結尾；二進位檔的兩個數字是 `-`；路徑可能含 tab，只切前兩個 tab。`--no-renames` 讓改名列成新舊兩筆，不用另外解析改名格式。
- **`--no-show-signature`、`--root`：** 兩個都是讓輸出不受使用者設定影響。`log.showSignature=true` 時，`git log` 會在輸出裡插入簽章訊息，被當成檔名或讓格式不合。`log.showRoot=false` 時，第一個 commit 不列檔名，只在第一個 commit 改過的卡片會退回檔案修改時間。
- **`ls-files`：** 曾被提交、之後被 `git rm --cached` 或被 `.gitignore` 忽略的檔案，仍然出現在 `git log`，但 `diff HEAD` 不會列出，所以單靠前兩條會把移除那天的時間當成更新時刻。`ls-files` 列出目前被追蹤的檔案，不在其中的卡片一律用檔案修改時間。
- **`diff HEAD`，不用 `status`：** 它同時涵蓋已暫存和未暫存的修改，也支援 `--relative`；`status --porcelain` 的路徑固定相對於 repo 根目錄，還要多一步換算。
- **不加 `--follow`：** 改檔名的 commit 算一次更新。`--follow` 也只能追一個檔案。

已用暫存 repo 實測：作者時間正確、改檔名顯示新檔名、中文檔名正確、`sub/` 不混淆、加上 `-c diff.autoRefreshIndex=false` 與 `--numstat` 後，`sed` 重寫但內容沒變的檔案不列入 `diff`，`.git/index` 的修改時間和 sha 都不變；未暫存、已暫存與中文檔名的修改都正確列出。

`git log` 依新到舊輸出，所以每個檔名第一次出現的那筆就是它最後一次提交。`--format` 和 `-z` 併用時，第一個檔名前面會多一個換行，解析時要去掉。

### D4. 判斷規則放在 `normalize-roadmap.ts`，兩邊只帶原始輸出

`RoadmapListProbe` 新增選填欄位：

```ts
interface RoadmapListProbe {
  git?: { log: string, changed: string, tracked: string }
}
```

三條指令都成功才帶這個欄位，任一失敗就整個不帶，所以不會有部分卡片用提交時間的情況。`normalizeRoadmapList` 解析這三段文字，得出每張卡片的時間：不在 `tracked` 之內或在 `changed` 之內的卡片用檔案修改時間，其餘用 `log` 裡的作者時間。任一段格式不合，整份退回檔案修改時間。

這和現有分層一致，也讓判斷規則不用執行 git 就能測試。另一個做法是兩邊各自解析後傳時間，但解析就要寫兩份。

### D5. 卡片的 `mtime` 欄位改名為 `updatedAt`

`RoadmapSummary.mtime` 之後可能是提交時間，留著舊名會誤導讀程式碼的人。`RoadmapFileProbe.mtime` 仍是檔案修改時間，不改。`RoadmapPanel.vue` 和 `RoadmapView.vue` 讀同一個欄位，所以面板和卡片自然一致。

### D6. 失敗時不顯示錯誤

比照 `buildRefs` 的做法：次要資料讀不到，不影響整份清單。git 指令的非零結束、逾時、輸出超過上限、程式不存在，一律視為讀取失敗。

### D7. 執行 `git` 時不借 login shell；macOS 桌面版先確認有開發工具

沒裝 Xcode 開發工具的 Mac，執行 `/usr/bin/git` 可能跳出系統的安裝提示（依 macOS 的已知行為，本機有裝，無法實測）。Roadmap 頁每次載入都會執行 git，所以要擋掉。

- 桌面版在 macOS 上第一次讀取前，執行一次 `/usr/bin/xcode-select -p`。它結束碼非 0 時，這次 App 執行期間都不再呼叫 git。結果留在記憶體，不存檔。
- 程式名直接用 `git`，走 App 既有的 `PATH`。不借 login shell，因為它每次要多花時間，而 GUI App 的 `PATH` 已含 `/usr/bin`。只裝在其他路徑的 git 找不到時，會退回檔案修改時間。
- 不靠先找 `.git` 來判斷：桌面版的檔案權限只開放專案目錄，專案在 repo 子目錄時讀不到上層，就判斷不了。
- 網頁版只在開發時使用，不加這道檢查。

### 刻意留給 Coder 的留白

- git 指令的逾時和輸出上限：比照現有 CLI 呼叫的設定，實作時決定。

## Risks / Trade-offs

- [只有 merge commit 改到卡片內容時，`git log --name-only` 不列出 merge commit 的檔案] → 卡片會顯示較早那個 commit 的時間。只有解衝突時改了內容才會遇到，影響小，不處理。
- [有未提交修改的卡片再被 `sed` 掃過] → 時間仍會更新，因為它本來就用檔案修改時間。可接受。
- [被 git 判定為二進位的 `.md`（例如含 NUL 字元），`--numstat` 對內容沒變的重寫仍會列出 `-\t-\t路徑`] → 這張卡片會用檔案修改時間，`sed` 重寫後顯示剛更新。實測確認，極少見，不處理。
- [Roadmap 頁每次載入多執行三個程式] → `TCERT/ds` 實測約 0.01 秒。git 卡住時，這次載入最多多等到逾時，之後退回檔案修改時間。
- [`xcode-select` 判斷不準] → 最壞情況是有 git 卻退回檔案修改時間，或仍跳一次安裝提示，兩者都不影響清單內容。

## Migration Plan

不需要搬移資料。新版讀到的就是新時間，退回上一版就恢復檔案修改時間。
