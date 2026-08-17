## 1. 抽取邏輯抽成共用模組（design D2）

- [x] 1.1 新增 `src/api/why-summary.ts`：把 `extractWhy()` 與其私有輔助（`WHY_HEADING`、`firstSentence`、`stripMarkdown`）從 `src/api/normalize-parked.ts` 整段搬入，行為與註解不變
- [x] 1.2 `src/api/normalize-parked.ts` 改為 import 並續出 `extractWhy`（比照既有 `countTasks` 的 re-export 寫法），確認 `normalize-parked.test.ts` 不需改動即通過
- [x] 1.3 新增 `src/api/why-summary.test.ts`：把 `normalize-parked.test.ts` 中屬於 `extractWhy` 的案例移過來，並補齊 spec 立的 scenario——半形句號不誤切（`design.md`）、段落無句末標點回傳全文、無 `## Why` 段落回空字串、任意層級標題與大小寫不敏感

## 2. 資料層：清單摘錄欄位（design D3、D4）

- [x] 2.1 `src/api/types.ts`：`ChangeSummary` 新增 `summary: string`；`ChangeListProbe` 新增選用 `proposals?: Record<string, string>`（change name → proposal 原文），兩處都加註解說明來源與降級語意
- [x] 2.2 `server/api/changes.get.ts`：CLI 成功後解析 stdout 取得 change names，並行讀取各 `openspec/changes/<name>/proposal.md` 填入 `proposals`；每筆獨立吞錯（讀不到就不入表），單筆失敗不影響其餘項目與整體回傳
- [x] 2.3 同檔加入路徑逸出檢查：目標路徑 `path.resolve` 後須仍落在該 change 目錄內，否則視同讀取失敗（比照 `server/api/parked.get.ts` 的 `readOptional`）
- [x] 2.4 `src/api/normalize.ts`：`normalizeChangeList()` 逐筆以 `extractWhy(probe.proposals?.[name] ?? '')` 填入 `summary`；`proposals` 缺漏或整個欄位不存在時一律為空字串
- [x] 2.5 `src/api/normalize.test.ts` 補測：有 proposal 抽出首句、無該筆 proposal 為空、`proposals` 欄位整體缺失時全筆為空且清單仍 `ok: true`

## 3. 卡片渲染（spec change-list）

- [x] 3.1 `src/components/ChangeCard.vue`：新增摘錄區塊置於標題列與進度條之間，active 與 parked 共用同一段渲染（讀 `change.summary`）；套用兩行 clamp 與 `text-text-3`（tokens 既有的摘錄語意色）
- [x] 3.2 同檔：`summary` 為空字串時整個區塊不渲染（`v-if`），不留佔位、不顯示任何缺件或錯誤提示
- [x] 3.3 `src/components/ChangeCardSkeleton.vue`：加入摘錄行佔位，使 skeleton 高度對齊「有摘錄」的真實卡片（design D5）

## 4. 驗證

- [x] 4.1 `pnpm test` 全綠
- [x] 4.2 `pnpm typecheck` 與 `pnpm lint` 無新增問題
- [x] 4.3 `openspec validate --strict show-why-summary-on-cards` 通過
- [x] 4.4 手動驗收（dogfood 本專案 openspec 目錄）：active 卡片顯示摘錄、parked 卡片顯示摘錄、長摘錄兩行截斷、刻意移除某 change 的 proposal 後該卡無摘錄區塊且無錯誤、首載 skeleton 到真實卡片無其他區塊跳動
