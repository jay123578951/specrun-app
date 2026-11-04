# Proposal

## Why

Roadmap 卡片的時間和組內順序都取自檔案修改時間，所以檔案只要被重寫，內容沒變也會顯示剛更新。`TCERT/ds` 歸檔時對 `openspec/roadmap/*.md` 執行 `sed -i`，46 張卡片的時間全部更新，其中 38 張內容完全沒變；切換分支和合併又再次更新了 commit 改到的 8 張。

這不是規範能擋住的問題：`srun:roadmap` 已要求歸檔時用 `grep -rl` 找出相關卡片，agent 仍可能掃過全部檔案，而切換分支和重新 clone 也會更新檔案修改時間。所以要改的是時間的依據。

## What Changes

- 卡片的更新時間和組內排序，改用內容最後一次提交的作者時間。
- 這些卡片繼續用檔案修改時間：有未提交的修改、還沒被 git 追蹤、被 git 忽略，或沒有提交紀錄。
- 專案沒用 git、或讀取 git 失敗時，整份清單退回檔案修改時間，不顯示錯誤。
- 右側面板的 `Updated` 和卡片顯示同一個時間。
- 使用者看得到的變化：
  - `sed` 掃過、切換分支、重新 clone，都不會讓內容沒變的卡片更新時間。
  - rebase 不會更新卡片時間。
  - 同一個 commit 改到的卡片顯示相同時間，組內依檔名排序。
  - 卡片顯示的是提交時間，不是提交前最後一次編輯的時間。
  - 現有專案打開後，內容沒變的卡片會自動顯示最後一次提交的時間，不需要另外還原。
- 更新時機不變：仍是重新進入頁面或按 Refresh。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `roadmap-view`：新增更新時刻的依據；「規劃檔清單」「清單分組」「清單卡片內容」「讀取範圍」改為依更新時刻，並允許讀取 git 紀錄。

## Impact

- `src/api/normalize-roadmap.ts`：判斷每張卡片用哪個時間、排序。
- `src/api/types.ts`：清單資料多帶 git 輸出；卡片的時間欄位改名。
- `src/api/desktop/roadmap.ts`、`server/api/roadmap.get.ts`：各自讀取 git 紀錄。
- `src/components/RoadmapView.vue`、`src/components/RoadmapPanel.vue`：改讀新的時間欄位，畫面呈現不變。
- 使用者電腦需要有 `git` 才看得到新行為；沒有時退回現有行為。
- 不動：Changes 頁的時間、`srun:roadmap` 規範。
