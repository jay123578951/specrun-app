## 1. 外殼：相依、指令與權限

- [x] 1.1 `src-tauri/Cargo.toml` 新增 Tauri 官方對話框外掛相依（版本線與既有的檔案外掛一致），並在 `src-tauri/src/lib.rs` 的 builder 註冊它。驗證：`cargo check` 通過（`pnpm exec tauri dev` 建置通過、桌面視窗開得起來併入人工驗收 4.2／4.6，開發形態不另跑）
- [x] 1.2 `src-tauri/src/lib.rs` 新增 async 指令 `pick_folder`：以外掛的 **Rust API** 建構 dialog（`FileDialogBuilder`），`parent()` 指定 main 視窗，標題沿用 `Select a project folder`，不設起始目錄；以一次性通道等待回呼，回傳 `Result<Option<String>, String>`。指令加進 `invoke_handler`。驗證：`cargo test` 既有測試全過、`cargo check` 通過（`pnpm exec tauri dev` 建置通過併入人工驗收 4.2／4.6）（design D1、D2、D5、D6）
- [x] 1.3 確認 `src-tauri/capabilities/default.json` **不**新增任何對話框相關權限——前端呼叫的是 1.2 的自有指令，不是外掛自己的 JS 指令。驗證：該檔案在本張零改動，且 4.2 的實機驗證能開得出 dialog（若誤接成外掛的 JS 指令，會因缺少權限而失敗，這一步即是它的反向驗證）（design D1）

## 2. 薄層包裝與桌面形態的實作

- [x] 2.1 `src/api/desktop/shell.ts` 新增 `pickFolder` 包裝：呼叫 1.2 的指令，回傳「選到的路徑或空值」，錯誤照該檔既有姿態收束成可辨識的失敗形狀，不放任何商業規則。沿用檔案中既有做法，不安裝 JS 繫結套件。驗證：`pnpm typecheck` 通過（design D5）
- [x] 2.2 新增 `src/api/desktop/folder-picker.ts`：把薄層的三種結果映射成既有的 `PickFolderOutcome`——有路徑為 `picked`、空值為 `canceled`、失敗為 `failed`。桌面形態不產生 `unsupported` 與 `busy`，且 MUST NOT 自行維護「已有 dialog 開著」的狀態。驗證：`src/api/desktop/folder-picker.test.ts` 以假的外殼通道斷言三種映射各自成立，並斷言連續兩次呼叫都會實際呼叫外殼、不被任何內部旗標擋下（design D3、D4）
- [x] 2.3 確認 `src/api/types.ts` 的 `PickFolderOutcome` 五個狀態原樣不動——`unsupported` 與 `busy` 由 web 形態繼續使用。驗證：該檔案在本張零改動，`pnpm typecheck` 通過（design D4）

## 3. 接上 gateway

- [x] 3.1 `src/api/desktop-gateway.ts` 補上 `pickFolder`，改由 2.2 的模組承接，並更新檔頭說明——自持範圍納入加入專案的資料夾選擇，過渡期間仍經本地 API server 的只剩開啟檔案所在位置。`...webGateway` 這一行保留。驗證：`src/api/desktop-gateway.test.ts` 斷言 `pickFolder` 不再落到 web 形態的實作，且 `revealPath` 仍落在它身上（design D7）
- [x] 3.2 確認 `src/api/web-gateway.ts`、`server/` 底下所有檔案、`src/api/desktop/projects.ts` 的加入流程、`src/api/types.ts`、`src-tauri/capabilities/default.json` 皆零改動。驗證：`git diff main --stat` 確認改動檔案清單不含這些路徑。（原本此項還包含 `src/stores/projects.ts` 的 `startAdd` 與所有畫面元件；3.3 經使用者裁決後必須改動它們，零改動的範圍已對正縮小到上列項目，改動範圍僅限 3.3 所述）
- [x] 3.3 WARNING 修復（review 意見，方案 a）：從使用者點擊入口到 dialog 實際呈現之間有一段跨行程延遲，這段期間主視窗照常收點擊，`startAdd` 的四個入口卻沒有任何東西擋住第二次觸發。`src/stores/projects.ts` 的 `startAdd` 在等待 `gateway.pickFolder()` 期間對外呈現一個「選擇進行中」的狀態（`picking`），只驅動按鈕能不能點，不改變 `startAdd` 自身的控制流、不提早 return、不回 `busy`——與 `busy`（`mutate()` 專用）是兩回事。`ProjectSwitcher.vue`、`ChangeList.vue`、`SpecsView.vue`、`ArchivedView.vue` 四個「加入專案」入口統一綁上它；`ProjectSwitcher.vue` 那顆同時仍綁 `busy`。`ChangeList.vue`／`SpecsView.vue`／`ArchivedView.vue` 三個空狀態的 `btn` 原本未綁定任何不可點狀態，一併補上（`.btn` shortcut 本已內建 `disabled:opacity-55`／`disabled:cursor-not-allowed`，缺的只是 `:disabled` 綁定）。同步更新 `specs/desktop-shell/spec.md`（原生資料夾選擇視窗附屬於主視窗）與 `design.md` D3，把入口自身的「選擇進行中」狀態與規格禁止的「系統維護已有 dialog 開著」全域狀態分清楚。驗證：`src/stores/projects.test.ts` 新增兩則測試，斷言 `picking` 僅在 `gateway.pickFolder()` 等待期間為真，且重疊呼叫 `startAdd` 兩次都各自真的呼叫 `gateway.pickFolder()`（不被 `picking` 擋下）；`pnpm typecheck`、`pnpm lint` 通過（spec：原生資料夾選擇視窗附屬於主視窗；design D3）

## 4. 驗收

- [x] 4.1 `pnpm test`、`pnpm typecheck`、`pnpm lint` 全數通過（由 gate 覆蓋：Tester 與收尾批實測 40 檔 486 測全過、typecheck 與 lint 乾淨、`cargo test` 17 過）
- [x] 4.2 以桌面形態啟動，點「加入專案」：確認 dialog 自主視窗滑下（macOS 為 sheet）、開啟期間側欄與主區點不動、且畫面上不會出現第二個 dialog；選定一個含 `openspec/` 的資料夾後該專案加入清單並成為目前專案，主區顯示其 change 清單（spec：原生資料夾選擇視窗附屬於主視窗、以 dialog 加入）
- [x] 4.3 同一個 dialog 按取消：確認清單與目前專案不變、不跳任何 toast、主視窗恢復可操作（spec：dialog 中取消、dialog 結束後主視窗恢復）
- [x] 4.4 選定一個**不含** `openspec/` 的資料夾：確認跳出驗證失敗的 toast、清單不變；隨後在該視窗的開發者工具中嘗試讀取該資料夾內任一檔案的內容，確認被拒。這一步是 design D1 的核心驗證——若改用外掛的 JS 指令，這個讀取會成功（spec：選到非專案資料夾不換來其內容的讀取權）
- [x] 4.5 選定一個已在清單中的專案：確認不重複加入、以 toast 提示已存在並切換過去（spec：重複加入）
- [x] 4.6 **打包後驗證**：以 `pnpm exec tauri build` 產出 `.app`，在本地 API server **未執行**的情況下啟動它，從空清單以加入專案入口加入一個專案並確認主區列出其 change 清單。這是本張的存在理由，必須以打包形態驗證，開發形態不算數（spec：不經本地 API server 也加得了專案）
- [x] 4.7 確認兩項已知的過渡狀態仍如預期，**不視為缺陷**：Settings 的「開啟所在位置」仍為禁用並說明原因；artifact 內容裡的外部連結點下去仍無反應（兩者屬 T4b 後半的範圍）
- [x] 4.8 快速連點兩下「加入專案」入口（側欄或任一頁的空狀態按鈕）：確認第一下點擊後按鈕立即呈現為不可點，不會冒出第二個資料夾選擇 dialog；選定或取消後按鈕恢復可點（spec：原生資料夾選擇視窗附屬於主視窗，T3.3）
