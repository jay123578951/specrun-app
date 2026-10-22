# Tasks

## 0. 開工前

- [x] 0.1 確認 `git status` 乾淨：上一筆側欄排版修改（`ProjectSwitcher.vue` 的 Add project 置底、Show N more、門檻 12）已經 commit。驗證：`git status --short` 沒有列出 `src/components/ProjectSwitcher.vue`

## 1. gateway 介面與桌面版

- [x] 1.1 在 `src/api/types.ts` 的 `OpenSpecGateway` 加上 `reorderProjects: (paths: string[]) => Promise<ProjectActionResult>`，註解寫明：傳入不含暫時項的完整順序，必須和目前清單是同一組路徑。驗證：`pnpm typecheck` 只在還沒實作的 gateway 報缺少成員
- [x] 1.2 在 `src/api/desktop/projects.ts` 實作 `reorderProjects`，接到 `src/api/desktop-gateway.ts`。做法照 design 決定 1、2：路徑組不同就回 `{ ok: false }`，不改設定；組相同就換掉 `projects` 再寫檔；寫檔失敗就還原順序並回 `{ ok: false }`。成功時回不帶徽章的清單。驗證：在 `src/api/desktop/projects.test.ts` 補三個案例並通過：換順序後清單照新順序、路徑組不同被拒且設定不變、寫檔失敗回 `ok: false` 且順序還原。另外更新 `src/api/desktop-gateway.test.ts` 的 mock 清單

## 2. 開發用 API

- [x] 2.1 在 `server/utils/project-state.ts` 加上 `reorderProjects(paths)`。規則和 1.2 相同，寫檔失敗不能被 `persist` 吞掉。驗證：在 `server/utils/project-state.test.ts` 補 1.2 那三個案例並通過
- [x] 2.2 新增 `server/api/project/reorder.post.ts`（body `{ paths: string[] }`），body 格式不對時回 400。在 `src/api/web-gateway.ts` 加上 `reorderProjects`，失敗訊息寫 `Could not save the project order.`。驗證：`pnpm typecheck` 通過；用 `curl -X POST localhost:3210/api/project/reorder` 送一份反過來的順序，再 `GET /api/projects`，順序跟著變

## 3. store

- [x] 3.1 在 `src/stores/projects.ts` 加上 `reorder(paths)`，照 design 決定 3：畫面先換順序、存檔排隊只送最新的一份、成功時記下存成功的順序、失敗時照存成功的順序重排並 `notify`。`mutate()` 開始前先等排序存完。驗證：在 `src/stores/projects.test.ts` 補四個案例並通過：成功後順序維持、失敗時彈回並發出 toast、連續兩次排序只在第一次存完後再送最後一份、排序存檔途中呼叫 `switchTo` 會等存完才開始

## 4. 側欄互動

- [x] 4.1 在 `ProjectSwitcher.vue` 加上 `canReorder`：`busy` 為 false，而且清單沒收合，或已經按了 Show N more。暫時項不能移動，其他項目的可移動範圍從暫時項下方開始。驗證：在 4.2、4.3 的元件測試裡涵蓋收合、`busy` 和暫時項三種情況
- [x] 4.2 鍵盤排序（design 決定 5）：專案按鈕收到 Alt+↑／↓ 時移動一格，邊界不動作，移動後 focus 留在原專案；可排序的專案在提示文字加上按鍵說明。驗證：新增 `src/components/ProjectSwitcher.test.ts`，案例有 Alt+↓ 後 `reorder` 收到的順序、頂端按 Alt+↑ 不呼叫、`canReorder` 為 false 時不呼叫、移動後 `document.activeElement` 仍是同一個專案
- [x] 4.3 滑鼠拖曳（design 決定 4）：5px 門檻、pointer capture、按在 ✕ 上不起拖、拖曳中藏起 ✕、其他列讓位（減少動態時不加 transition）、放開後交給 `reorder` 並吞掉 click、pointercancel 時取消。驗證：在 `ProjectSwitcher.test.ts` 補四個案例並通過：移動不到 5px 放開會切換專案、拖過門檻放開後 `reorder` 收到新順序且沒有切換、按在 ✕ 上拖動不起拖、pointercancel 後不呼叫 `reorder`

## 5. 整合檢查

- [x] 5.1 起 `pnpm dev`，在瀏覽器實際操作：把最後一個專案拖到最上面、用 Alt+↑／↓ 移動、重載頁面後順序還在。沒拖動就放開仍會切換專案。拖曳時 ✕ 不出現，其他列會讓位。驗證：以上都照規格發生，`pnpm vitest run` 全數通過，`pnpm lint` 沒有錯誤（由 gate 覆蓋：瀏覽器操作由操作流程驗證、vitest 與 lint 由全部測試；收合、暫時項、存檔失敗三種情境留人工驗）
