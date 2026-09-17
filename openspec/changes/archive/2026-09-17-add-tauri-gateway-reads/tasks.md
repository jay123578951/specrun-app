## 1. 外殼補兩樣通道

- [x] 1.1 `src-tauri/src/lib.rs` 新增路徑正規化指令（解開 symlink 取得實際位置），路徑不存在時回可辨識的錯誤；以 Rust 單元測試覆蓋三種情形（symlink 目錄、一般目錄、不存在的路徑），`cargo test` 通過
- [x] 1.2 `src-tauri/capabilities/default.json` 補查詢檔案基本資訊的權限（`fs:allow-stat`），`pnpm dev:app` 啟得起來
- [x] 1.3 `src/api/desktop/shell.ts` 補兩個包裝：呼叫正規化指令、查詢檔案基本資訊（取建立時刻）。維持既有姿態——只收束型別與錯誤形狀，不放商業規則

## 2. 目標專案的解析收斂成一處

- [x] 2.1 `src/api/desktop/projects.ts` 新增「解析目標專案」：canonical 化 → 確認已授權（未授權則授權，已授權的路徑記著不重複呼叫）→ 驗證是既存資料夾，回傳可用的目標路徑，或回傳目標不可用的 probe 骨架（`target-missing`，細節帶失敗原因）。單元測試覆蓋：無目標專案、資料夾不存在、授權被拒、授權只發一次
- [x] 2.2 `addProject` 寫入設定前一併 canonical 化，與瀏覽器那一側對齊；單元測試驗證 symlink 路徑存進去的是實際位置
- [x] 2.3 `syncLocalServer` 的 TODO 註解改寫：解除條件由「下一張 change」改為「本地 API server 不再需要知道目前專案是哪個」，並寫明不在本張刪除的理由（勾選與 park 仍靠它對齊目標專案）

## 3. 指令執行結果換成完整形狀

- [x] 3.1 `src/api/desktop/cli.ts` 的 `runCli` 改為回傳「跑完了（結束代碼、stdout、stderr）」或「沒跑成（已分類的失敗）」；四種沒跑成的情形在這一層分類完——外殼拒絕與解析不出執行檔歸「CLI 不可用」，逾時與輸出截斷歸「呼叫或解析失敗」。單元測試覆蓋四種
- [x] 3.2 側欄徽章的呼叫端自行收斂為原本的判斷，既有徽章測試不改仍通過

## 4. 四條讀取路

- [x] 4.1 新增 `src/api/desktop/reads.ts`，實作 change 清單：跑 `list --json`、並行讀各 change 的 `proposal.md` 與目錄建立時刻、造出 probe 交給既有 normalize。路徑逸出 change 目錄時視同讀不到。單元測試覆蓋：正常清單、單筆讀不到不拖垮整份、目標不可用
- [x] 4.2 實作 change 詳情：跑 `status --change <name> --json`、依引擎回傳的 artifact 路徑讀齊檔案、造 probe。只讀引擎列出的路徑，讀不到的那筆帶錯誤訊息。單元測試覆蓋：多 artifact 齊備、其中一份讀不到、change 不存在
- [x] 4.3 實作 spec 清單與 spec 全文：各跑一次 CLI，原樣轉送輸出造 probe。單元測試覆蓋：正常、spec 不存在
- [x] 4.4 `src/api/desktop-gateway.ts` 接上四個方法；`src/api/gateway.test.ts` 與既有 gateway 測試通過

## 5. 驗收

- [x] 5.1 `pnpm lint && pnpm test && pnpm typecheck` 全數通過（由 gate 覆蓋：356 案全綠、lint 與 typecheck 乾淨，另 `cargo test --lib` 17 passed）
- [x] 5.2 以打包形態（`pnpm tauri build` 後開 `.app`，本地 API server 不啟動）實測：側欄列得出專案且可切換，主區列得出 change 清單（含 Why 摘錄、進度、今昨時間），詳情開得出各 artifact，Specs 頁列得出清單並開得出全文
- [x] 5.3 同一個打包 App 實測 symlink 專案：設定中放一筆經過 symlink 的專案路徑，切過去後主區正常列出 changes，不出現「不是 OpenSpec 專案」
- [x] 5.4 同一個打包 App 確認預期中仍不可用的四項維持現行錯誤訊息、不當機：Archived 頁、任務勾選、加入專案、開啟所在位置
