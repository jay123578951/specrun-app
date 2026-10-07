# Tasks

## 1. 共用解析層

- [x] 1.1 在 `src/api/types.ts` 定義流程檔版本與更新結果的型別（每專案：路徑、版本或未設定／不存在、與 CLI 比較後的五種狀態；更新結果：成功與否、警告文字、錯誤訊息），並在 Gateway 介面加「讀取各專案流程檔版本」與「更新單一專案流程檔」兩個方法；`pnpm typecheck` 通過
- [x] 1.2 新增共用純模組，實作：從 SKILL.md 開頭取出 `generatedBy`、多檔取最舊、與 CLI 版本比較得出落後／已是最新／比 CLI 新、CLI 不可用時不比較；以單元測試驗證以下情形：
  - 6 檔一致；5 檔 1.14.1 加 1 檔 1.8.0 取 1.8.0；
  - 沒有任何 `generatedBy` 為未設定；
  - 1.2.0 比 1.14.1 舊（數字比較，不是字串比較）；
  - 專案 1.14.1、CLI 1.13.2 為比 CLI 新；
  - CLI 不可用時不產出比較結果。
- [x] 1.3 在同一模組實作更新結果解析：結束代碼 0 為成功、從輸出挑出警告（做法見 design 留白）、逾時／截斷／非 0 為失敗並附錯誤訊息；以單元測試釘住實測的兩段輸出（`Updated: Claude Code (v1.14.1)` 與 `All 1 tool(s) up to date`）以及 `⚠ Run with --force ...` 警告

## 2. 桌面授權

- [x] 2.1 `src-tauri/src/lib.rs` 的 `allow_path` 在 `.git` 之後，對存在的 `.claude/skills` 補一次遞迴放行，並更新其文件註解；在既有的 Rust 測試（`lib.rs` 的 scope 測試）新增兩則：放行後 `.claude/skills/x/SKILL.md` 可讀、`.claude/settings.json` 不可讀；`cargo test` 通過

## 3. 讀取與更新通道（網頁與桌面各一份）

- [x] 3.1 新增網頁形態的流程檔版本 API：依 App 專案清單逐一列出 `.claude/skills/openspec-*/SKILL.md` 並讀開頭，交給 1.2 的解析；單一專案失敗不影響其他。web gateway 接上並在 `web-gateway.test.ts` 補回應形狀測試，以 `curl` 對本機確認 6 個專案的版本與實際一致
- [x] 3.2 新增網頁形態的更新 API：只接受專案清單內的路徑，以目前生效執行檔跑 `update <路徑>`（不加 `--force`），結果交給 1.3 的解析；web gateway 接上並補測試，含「清單外路徑被拒、不呼叫 CLI」
- [x] 3.3 在 `src/api/desktop/` 新增同語意的讀取：讀其他專案前先走既有的 `ensureAccess` 授權流程；以假外殼在測試中驗證版本解析、資料夾不存在、單一專案失敗不拖垮其他
- [x] 3.4 在 `src/api/desktop/` 新增同語意的更新：走既有的執行通道並設逾時上限、只接受清單內路徑、例外不逸出；以假外殼在測試中驗證成功、警告、失敗、清單外路徑四種情形

## 4. Settings 畫面

- [x] 4.1 `stores/settings.ts` 加流程檔一覽的狀態：開啟 Settings 時讀取、每列各自的更新中／結果、更新完成後只重讀該專案、同一列更新中不可重複觸發；`stores/settings.test.ts` 逐條驗證
- [x] 4.2 `SettingsModal.vue` 新增「Project workflow files」區，放在 openspec CLI 區塊之後：每列顯示專案名、版本、狀態；落後列有 Update 按鈕；更新中、成功、警告、失敗就地顯示；沒有全部更新按鈕、沒有 git 資訊；文案英文。`SettingsModal.test.ts` 驗證五種列狀態與更新的三種結果，並套用 ui-interaction-states 檢查 Update 按鈕的各狀態

## 5. 整合確認

- [x] 5.1 `pnpm lint`、`pnpm typecheck`、`pnpm test` 全數通過（由 gate 覆蓋：全部測試，vitest 866／866、cargo 33／33）
- [x] 5.2 用 `pnpm dev`（先依 CLAUDE.md 確認 5173 沒人在聽）開 Settings，確認 6 個專案的版本與狀態和實際相符；只對 specrun-app 本身按 Update，確認那一列轉為已是最新，且 `git status` 只多出 `.claude/` 底下的改動（人工驗收通過）
- [x] 5.3 `pnpm dev:app` 在桌面視窗重看一次 Settings 的這一區，確認版本讀得到（驗證 `.claude/skills` 授權生效），且不對其他專案按 Update（人工驗收通過）

## 6. 驗收修正：目前專案在上、其他專案收起

- [x] 6.1 `stores/settings.ts` 區分目前專案那一列與其餘專案（目前專案不在清單或沒有目前專案時，其餘＝清單全部）；「Other projects」展開狀態每次開啟 Settings 重設為收起；算出其餘專案中的落後數量。`stores/settings.test.ts` 逐條驗證
- [x] 6.2 `SettingsModal.vue`：目前專案那一列置頂；其下「Other projects (N) · M behind」可展開／收起；目前專案不在清單或沒有目前專案時，最上方改為一句英文說明。`SettingsModal.test.ts` 驗證預設收起、展開後列出各列、重開後收起、不在清單、更新成功後落後數同步，並套用 ui-interaction-states 檢查展開按鈕的各狀態
- [x] 6.3 `pnpm lint`、`pnpm typecheck`、`pnpm test` 全數通過

## Workflow follow-up

- 實作前先完成 `adopt-openspec-1-14`，兩者都會改到 `SettingsModal.vue` 與 `stores/settings.ts`。
