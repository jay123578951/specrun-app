## 1. 兩樣共用基礎

- [x] 1.1 新增純字串的路徑計算模組：接路徑、取上一層、把絕對路徑換算成相對某個根目錄的路徑、判斷一個路徑是否落在某目錄底下。單元測試覆蓋兩種分隔符、目標就是根目錄本身、目標在根目錄之外（回原路徑）、以及前綴相同但不同層的逸出判定（`/a/bc` 不算在 `/a/b` 底下）
- [x] 1.2 `src/api/desktop/shell.ts` 補一個「這個路徑存在嗎」的包裝，維持既有姿態——只收束型別與錯誤形狀，不放商業規則；權限已在清單內，不動 `src-tauri/capabilities/default.json`

## 2. park 的檔案層（桌面形態）

- [x] 2.1 實作 park 可用性判定：列出專案資料夾、找名為 `.git` 的那一項，是資料夾則可 park、是檔案則回 worktree、找不到則回非 git repo。單元測試覆蓋三種情形，並確認判定過程不查詢 `.git` 本身
- [x] 2.2 實作 metadata 的讀取與整檔覆寫：解析沿用既有的逐欄位收斂規則（認不得的紀錄整筆丟掉、讀壞一律降級成空表），寫入走「先寫暫存檔、再改名蓋上去」，暫存檔名用時間戳加亂數。單元測試覆蓋：內容壞掉、欄位缺漏、寫入後讀得回來
- [x] 2.3 實作 parked change 的目錄列舉（只認目錄、排除散落檔案、目錄不存在即空清單不是錯誤）與 change 名的安全檢查（只收單一路徑片段）。單元測試覆蓋目錄不存在、混有檔案、名稱含分隔符

## 3. tasks 勾選寫入

- [x] 3.1 實作 tasks 檔案位置的解析與記錄：問一趟 `status --change <name> --json`、只認 tasks artifact 的既存路徑、恰一筆才記；記錄的識別鍵是「專案路徑＋change 名」。單元測試覆蓋：記錄命中免呼叫、記錄所指檔案已不在時重新解析、多檔與零檔不記錄、**切換專案後對同名 change 解析出的是新專案的路徑**
- [x] 3.2 實作勾選寫入：以 change 為單位排隊、重讀檔案、逐行比對、全有全無、單次寫回；衝突與其他失敗分成可區分的兩類。單元測試覆蓋：單行成功、多行一次寫、任一行不符整批放棄、目標 change 無 tasks 檔案、讀寫失敗

## 4. park 與 unpark

- [x] 4.1 實作 park：先重新取得一次專案授權（不吃已授權的記憶），再依序做「取 artifact 快照 → 搬移目錄 → 寫 metadata」；快照存的是 change 目錄內的相對路徑，快照或搬移任一步失敗即整個放棄，只有 metadata 寫入失敗可以吞。單元測試覆蓋：正常 park、目的地已有同名殘留、來源已不在、快照取不到、metadata 寫不進去仍回成功
- [x] 4.2 實作 unpark：同樣先重新取得授權，搬回 `openspec/changes/`；目的地已有同名 change 時拒絕，不覆蓋也不自動改名；metadata 的移除失敗可以吞。單元測試覆蓋：正常 unpark、撞名拒絕、來源已不在

## 5. parked 清單與詳情

- [x] 5.1 實作 parked 清單：目錄列舉為準，每筆讀 tasks 與 proposal 原文、取目錄建立時刻，metadata 只補 park 時間與快照路徑；孤兒紀錄不列出。造出 probe 交給既有 normalize。單元測試覆蓋：正常清單、metadata 缺項、孤兒紀錄、單筆讀不到不拖垮整份、無目標專案
- [x] 5.2 實作 parked 詳情：tabs 依快照列出，讀每個檔案前先問它存不存在——不存在就略過、存在卻讀不到才帶錯誤；metadata 缺失時退回現場列舉 `*.md`。單元測試覆蓋：快照齊備、**快照中某檔已被刪除時詳情照常開啟**、存在卻讀不到時回報失敗、metadata 缺失走現場列舉、快照路徑逸出 change 目錄時不讀

## 6. archived 清單與詳情

- [x] 6.1 實作 archived 清單：先確認專案有 `openspec/`（沒有是「不是 OpenSpec 專案」，不是讀取失敗），再列舉 archive 目錄、每筆現場讀 tasks 原文。單元測試覆蓋：正常清單、archive 目錄不存在即空清單、專案無 `openspec/`、單筆讀不到 tasks 不影響其餘
- [x] 6.2 實作 archived 詳情：tabs 現場列舉（頂層 `*.md` 加 `specs/**/spec.md`），順序 proposal → design → delta specs → tasks → 其他；列得到卻讀不到即回報失敗（不做存在與否的詢問）。單元測試覆蓋：含多份 delta spec 的排序、change 目錄已不在、名稱含分隔符被擋下

## 7. 接上 gateway 與收尾

- [x] 7.1 `src/api/desktop-gateway.ts` 接上七個方法（`toggleTask`、`parkChange`、`unparkChange`、`listParked`、`getParkedDetail`、`listArchived`、`getArchivedDetail`）；`src/api/gateway.test.ts` 與既有 gateway 測試通過
- [x] 7.2 `src/api/desktop/projects.ts` 的過渡呼叫改寫註解：解除條件仍是「本地 API server 不再需要知道目前專案是哪個」，保留理由由「勾選與 park 仍靠它」改為「檔案變動通知（即時刷新）仍靠它」
- [x] 7.3 確認 web 形態的七條 route 與 `server/utils/` 底下三個模組一字未動，`git diff --stat server/` 為空

## 8. 驗收

- [x] 8.1 `pnpm lint && pnpm test && pnpm typecheck` 全數通過（由 Tester gate 覆蓋：38 檔 464 測試全綠，lint 與 typecheck 皆 exit 0）
- [x] 8.2 以打包形態（`pnpm tauri build` 後開 `.app`，本地 API server 不啟動）實測七條路：勾得動任務且檔案真的被改、change 停得下來也恢復得回來、parked 詳情開得出 artifact、Archived 頁列得出清單且詳情含 delta spec
- [x] 8.3 同一個打包 App 實測「快照檔案被刪掉」：park 一個 change，到檔案總管刪掉它 parked 目錄裡的一份 `.md`，回 App 開它的詳情——面板照常開啟，其餘 artifact 內容正常
- [x] 8.4 同一個打包 App 實測 git worktree 專案：加入一個 `.git` 為檔案的 worktree 專案，確認 park 呈禁用且提示陳述的是 worktree 不支援，不是「這個專案沒有 .git」
- [x] 8.5 同一個打包 App 實測同名 change 不跨專案：兩個都含同名 change 的專案，於 A 勾選一項後切到 B 勾選同一個 change 的某項，確認改到的是 B 的檔案、A 的檔案未被改動
- [x] 8.6 同一個打包 App 確認兩項預期中的過渡行為：勾選成功後左側卡片的進度數字不變（切頁回來才更新）是預期、不是缺陷；仍不可用的三項（原生選資料夾加入專案、開啟檔案所在位置、檔案變動自動刷新）維持現行錯誤訊息、不當機
