## Why

卡片目前只有 change 名稱，名稱寫得不夠白時，使用者無法在清單層判斷這個 change 在做什麼，得逐張點開詳情才知道——清單失去「一排掃過去掌握全部狀態」的作用。

`docs/ui-structure-decisions.md` 的卡片規格早已定案「Why 摘錄：proposal `## Why` 首句、純機械抽取、CSS 兩行 clamp」，parked 那一半也已實作（`ParkedSummary.summary` 與 `extractWhy()`），但兩件事都還沒接到畫面上。這是補既有規格的實作缺口，不是新設計。

## What Changes

- change 卡片新增 Why 摘錄一行區塊，兩行 clamp，置於標題列與進度條之間。
- Active 卡片新增摘錄資料：清單資料取得時一併讀取各 change 的 `proposal.md`，抽出 `## Why` 首句。抽取沿用既有 `extractWhy()`，不新增解析邏輯。
- Parked 卡片接上既有的 `summary` 欄位（資料層已完成，僅缺渲染）。
- 摘錄抽不到（無 proposal、無 `## Why` 段、讀取失敗）時卡片不顯示該區塊，也不保留佔位——卡片高度隨內容變化。
- 摘錄取得 MUST NOT 為個別 change 追加 CLI 呼叫，一律走檔案層直讀，比照 `park-mechanism` 與 `archived-view` 既有的「目錄為準、現場解析、降級不報錯」先例。

非目標（明確不在此範圍）：卡片拖拉、狀態切換、群組恆常顯示（另一個 change）；摘錄的 LLM 加工（`docs/ui-structure-decisions.md` 已否決）；Archived 卡片的摘錄。

## Capabilities

### New Capabilities

無。

### Modified Capabilities

- `change-list`: 「change 卡片內容」需求新增 Why 摘錄元素，並規範摘錄缺失時的呈現（不顯示、不佔位）。
- `openspec-gateway`: 清單資料新增 Why 摘錄欄位；同時界定其讀檔範圍——既有「讀檔範圍限定於引擎回傳路徑」需求明文禁止依任意路徑讀檔，該需求的意圖是約束 artifact 全文外流（詳情通道），需明確區分出「清單摘錄」這條以固定慣例路徑讀取、且只外流一句摘錄的窄通道，避免規格自相矛盾。

## Impact

- `src/api/types.ts`：`ChangeSummary` 新增 `summary` 欄位；`ChangeListProbe` 需帶入各 change 的 proposal 原文。
- `server/api/changes.get.ts`：CLI 呼叫後追加一輪檔案層讀取（每 change 一個 `proposal.md`，並行）。仍為單次 CLI 呼叫。
- `src/api/normalize.ts`：清單正規化時填入摘錄，複用 `normalize-parked.ts` 續出的 `extractWhy()`。
- `src/components/ChangeCard.vue`：新增摘錄區塊，active 與 parked 共用同一段渲染。
- `src/components/ChangeCardSkeleton.vue`：卡片高度改變，skeleton 需同步（「首次載入顯示 skeleton」要求無版面跳動）。
- 效能：清單載入從 1 次 spawn ＋ 0 次讀檔變為 1 次 spawn ＋ N 次並行小檔讀取（單專案 N ≈ 5），相較 spawn 成本可忽略。
- 不影響：詳情通道、park／unpark、watcher、專案切換。
