# Tasks

## 1. 組內排序改為依修改時刻

- [x] 1.1 改 `src/api/normalize-roadmap.ts` 的清單排序：組間順序不變；組內依 `mtime` 由新到舊，`mtime` 相同時依檔名字母序，`mtime` 為 `null` 的排在組尾、彼此依檔名字母序。函式名改成符合新行為的名字。驗證：`pnpm vitest run src/api/normalize-roadmap.test.ts` 通過
- [x] 1.2 改寫 `src/api/normalize-roadmap.test.ts`「排序」區塊：原本「組內依檔名字母序」的案例改成各檔給不同 `mtime`，並補三個案例：最近修改的排最前、`mtime` 相同依檔名、`mtime` 為 `null` 排組尾。驗證：同上指令通過，且把排序改回檔名字母序時新案例會失敗
- [x] 1.3 檢查 `src/stores/roadmap.test.ts`、`src/components/RoadmapView.test.ts`、`src/components/RoadmapPanel.test.ts` 有沒有依賴舊的檔名排序（例如 ↑↓ 切換順序、卡片順序的斷言），有就改成符合新排序。驗證：`pnpm vitest run` 全數通過
- [x] 1.4 在 Roadmap 頁實際看一次：同一組內最近修改的卡片在最上面；在編輯器存檔某個規劃檔、App 重新讀到後，那張卡片跳到組內第一個；↑↓ 切換順序跟畫面上的卡片順序一致
