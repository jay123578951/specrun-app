# Tasks

## 1. 共用判斷規則

- [x] 1.1 `src/api/types.ts`：`RoadmapListProbe` 新增選填的 `git?: { log: string, changed: string, tracked: string }`；`RoadmapSummary.mtime` 改名為 `updatedAt`，一併更新 `RoadmapView.vue`、`RoadmapPanel.vue` 與相關測試。驗證：`pnpm typecheck` 通過，畫面呈現的程式邏輯不變。
- [x] 1.2 `src/api/normalize-roadmap.ts`：解析 `git.log`、`git.changed`（`--numstat` 格式）與 `git.tracked`，算出每張卡片的更新時刻（design D3、D4）。驗證：`normalize-roadmap.test.ts` 新增案例，涵蓋作者時間、取最新一筆、第一個檔名前的換行、中文檔名、`sub/a.md` 不影響 `a.md`、有未提交修改、未追蹤（`tracked` 裡沒有）、曾提交後移除追蹤或被忽略（`log` 有、`tracked` 沒有）、`changed` 格式不合、沒有 `git` 欄位全部用檔案修改時刻、輸出格式不合時用檔案修改時刻。
- [x] 1.3 排序改用 `updatedAt`；同一個 commit 的卡片依檔名排序。驗證：`normalize-roadmap.test.ts` 新增同時間依檔名的案例，既有的排序案例全部通過。

## 2. 網頁版讀取 git

- [x] 2.1 新增 `server/utils/roadmap-git.ts`，用 `execFile` 在 roadmap 目錄執行 design D3 的三條指令，任一失敗就不回傳結果；`server/api/roadmap.get.ts` 把結果放進 probe，roadmap 目錄不存在或沒有卡片時不執行。驗證：`server/utils/roadmap-git.test.ts` 用暫存目錄建立真的 git repo，涵蓋一般 repo、repo 子目錄、worktree、非 git 目錄，並確認 `.git/index` 的修改時間沒變；把結果交給 `normalizeRoadmapList`，確認解析得出預期時間。

## 3. 桌面版讀取 git

- [x] 3.1 `src/api/desktop/roadmap.ts`：用 `spawnBin` 在 roadmap 目錄執行同樣的三條指令，任一失敗（spawn 失敗、非零結束、逾時、輸出被截斷）就不帶 `git` 欄位；roadmap 目錄不存在或沒有卡片時不執行。驗證：`desktop/roadmap.test.ts` 新增各失敗情形的案例，以及成功時 probe 帶到 `normalizeRoadmapList` 的結果。
- [x] 3.2 macOS 上第一次呼叫 git 前，先執行一次 `/usr/bin/xcode-select -p`；失敗時這次 App 執行期間都不呼叫 git，結果只留在記憶體（design D7）。驗證：`desktop/roadmap.test.ts` 確認失敗時不呼叫 git、連續載入只檢查一次、非 macOS 不檢查。

## 4. 實機確認

- [x] 4.1 依專案 `CLAUDE.md` 的順序開啟開發伺服器，切到 `TCERT/ds` 的 Roadmap 頁。驗證：內容沒變的卡片顯示各自最後一次提交的時間，不是全部相同；右側面板的 `Updated` 和卡片一致；在暫存 repo 用 `sed -i` 重寫檔案後按 Refresh，時間不變；修改一張並存檔後按 Refresh，那張排到組內第一個。（由 gate 覆蓋：操作流程驗證）
- [x] 4.2 整體檢查。驗證：`pnpm test`、`pnpm typecheck`、`pnpm lint` 全部通過。（由 gate 覆蓋：全部測試，typecheck 與 lint 由主對話實跑）
