## 1. Server：park 儲存層與操作

- [x] 1.1 新增 `.git/specrun-app/` utils：git 目錄檢測（`.git` 必須是目錄，否則回報 `not-git-repo`／`git-worktree`）、parked 目錄列舉、`parked.json` 讀寫（目錄為準、孤兒 metadata 忽略）
- [x] 1.2 新增 `POST /api/changes/[name]/park`：快照 `openspec status` artifactPaths → rename 搬移 → 寫 metadata（依 design D3 順序與失敗語意；殘留撞名拒絕）
- [x] 1.3 新增 `POST /api/parked/[name]/unpark`：目標撞名檢查 → rename 搬回 → 移除 metadata key
- [x] 1.4 新增 `GET /api/parked`：回傳 `parkAvailable`／`reason` 與 parked 清單（現場解析 tasks 計數與 proposal 首句摘錄，解析歸 `src/api/` 純函式）
- [x] 1.5 新增 `GET /api/parked/[name]`：依快照路徑打包 parked 詳情 bundle（讀檔範圍限定快照；metadata 缺失 fallback 現場列舉 `*.md`）

## 2. Gateway 與 normalize

- [x] 2.1 gateway interface 增 `listParked`／`parkChange`／`unparkChange`／`getParkedDetail` 四方法與 web-gateway 實作
- [x] 2.2 parked 清單與詳情的 normalize 純函式＋單元測試（含 metadata 缺項 fallback、孤兒忽略的案例）

## 3. Store 與清單 UI

- [x] 3.1 `changes` store 擴充 parked 狀態：與 active 同步載入、切專案 invalidate 一併清空、park/unpark 成功後主動 reload 兩群組
- [x] 3.2 `ChangeList.vue` 雙群組呈現：Parked 群組標題與數量、park 時間新→舊排序、無 parked 整段隱藏
- [x] 3.3 `ChangeCard.vue` parked 變體（時間欄位顯示 parked 相對時間）與 hover 動作按鈕：active 卡 Park／parked 卡 Restore，點擊不觸發開詳情；`parkAvailable` 為 false 時 park 按鈕禁用＋tooltip
- [x] 3.4 park/unpark 操作接線：成功後群組搬移即時反映（基本 enter/leave 動畫依 ui-motion）、失敗 toast

## 4. Parked 詳情唯讀

- [x] 4.1 `detail` store 資料路徑分流：parked change 走 `getParkedDetail`，tabs 依快照 artifacts 列出
- [x] 4.2 詳情唯讀變體：tasks checkbox 禁用（含視覺與行為），其餘 tabs 照常渲染

## 5. 驗收

- [x] 5.1 Vitest：儲存層 utils（git 檢測、撞名／殘留、metadata fallback）與 normalize 測試全綠
- [x] 5.2 真實流程走查：park → git status 乾淨 → `openspec list` 不見 → parked 詳情唯讀 → unpark 還原；非 git 目錄專案 park 禁用
