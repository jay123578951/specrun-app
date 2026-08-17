## Context

見 proposal.md — Why。需求本身早已定案於 `docs/ui-structure-decisions.md` 的卡片規格表，這份 design 只處理「怎麼把 active 那一半的資料接上」，以及它與既有規格條文的衝突。

三個既存事實決定了approach：

1. **parked 側已完整實作**：`ParkedSummary.summary` 有欄位，`extractWhy()`（`src/api/normalize-parked.ts`）已含中英句末判定、半形句號防誤切、行內 Markdown 去記號，並有測試覆蓋。這次不重寫任何抽取邏輯。
2. **active 側的資料源不含 proposal 內容**：`openspec list --json` 只回 name／進度／status／lastModified。要摘錄就得另外拿到 proposal 原文。
3. **`openspec-gateway` 有兩條規格條文擋在路上**：「清單資料以單次 CLI 呼叫取得」與「讀檔範圍限定於引擎回傳路徑」。後者明文 `MUST NOT 提供依任意路徑讀取檔案的能力`。delta spec 已正面處理，這裡記錄為何選擇「開一條窄例外」而非其他路線。

專案的層次分工是既有紀律：route 只做 IO（spawn／讀檔），所有解析集中在 `src/api/normalize*.ts` 的純函式（design D1／D2 的既有決策，且 M4 Tauri 版要靠這條才能替換 gateway 實作而不動解析邏輯）。

## Goals / Non-Goals

**Goals:**
- active 與 parked 兩側摘錄走同一套抽取與降級規則，「同一份 proposal 在兩處顯示同一句話」不可分岔。
- 清單載入維持單次 CLI spawn，不因摘錄退化成 N+1。
- 為 proposal 讀取劃出從嚴的路徑邊界，讓「讀檔範圍」那條規格的放寬是可審查的窄例外，而非拆掉圍籬。

**Non-Goals:**
- 不支援 custom schema 改名後的 proposal 檔案（見 Risks，接受降級為空摘錄）。
- 不做摘錄快取層（比照 parked／archived 既有決策：量級小，不值得快取的一致性成本）。
- 不改 Archived 卡片（`ArchivedSummary` 不加 summary 欄位）。
- 不動卡片的 hover 動作、點擊、進度條等既有元素。

## Decisions

### D1: proposal 走檔案層直讀固定慣例路徑，不經 `artifactPaths`

**選擇**：route 端對 CLI 回傳的每個 change name，並行讀取 `<targetPath>/openspec/changes/<name>/proposal.md`。

**否決 — 走 `openspec status --change <name> --json` 取 `artifactPaths`**：這是「正確」的路徑來源，能支援 custom schema 改名的 proposal。但代價是每張卡一趟 CLI spawn（實測量級 ~1s），清單載入從 1 次 spawn 變 N+1 次。單專案 N≈5 就是 5 秒以上的首載——直接摧毀「一排掃過去」的使用情境，且違反既有的「清單資料以單次 CLI 呼叫取得」需求。摘錄是輔助資訊，不值得這個價。

**否決 — park 時那樣預存快照**：park 有 metadata JSON 是因為「搬移會破壞路徑」，active change 沒有這個問題，為摘錄另立一份持久化狀態只會引入不一致的來源。

**代價**：綁死 `proposal.md` 這個慣例檔名。這是既有先例的一致選擇——`server/api/parked.get.ts` 的 `FALLBACK_PROPOSAL = 'proposal.md'` 已經在做同一件事，archived 那側也是目錄列舉為準。

### D2: `extractWhy()` 抽成獨立共用模組，比照 `task-progress.ts` 先例

**選擇**：把 `extractWhy()` 與其私有輔助（`firstSentence`、`stripMarkdown`、`WHY_HEADING`）從 `normalize-parked.ts` 搬到新的 `src/api/why-summary.ts`，`normalize-parked.ts` 續出（re-export）它以維持既有呼叫端與測試不變。

**理由**：這正是 `countTasks` 走過的路——它原本在 `normalize-parked.ts`，第二個消費者（archived）出現時搬進 `src/api/task-progress.ts` 並由原處 re-export，註解寫著「續出是為了呼叫端不必知道它搬了家」。現在 `extractWhy` 有了第二個消費者（active 清單），照同一個 pattern 走，才不會出現「active 的摘錄邏輯 import 自 normalize-parked」這種讀起來莫名的依賴方向。

**否決 — 直接從 `normalize.ts` import `normalize-parked.ts`**：能跑，但依賴方向錯了，且 `normalize.ts`（CLI 輸出轉換）與 `normalize-parked.ts`（檔案現場解析）本來是兩個平行的資料源，互相 import 會讓分工失焦。

### D3: 讀檔在 route、抽句在 normalize，維持既有層次分工

**選擇**：`ChangeListProbe` 新增 `proposals?: Record<string, string>`（change name → proposal 原文；讀不到的 name 不出現在表中）。`server/api/changes.get.ts` 負責讀檔並填入；`normalizeChangeList()` 負責對每筆呼叫 `extractWhy()` 填 `ChangeSummary.summary`。

**理由**：與 `ParkedListProbe.entries[].proposal` 完全同構——parked 那側就是 route 給原文、normalize 抽句。維持這個分工是 M4 的前提：Tauri 版換掉 route（改走 fs plugin）時，抽取邏輯零改動。

**替代方案 — route 直接抽好句子回傳**：省一個欄位，但把解析搬進 IO 層，違反既有紀律，且 Tauri 版要重寫一份抽取。否決。

### D4: 讀檔的路徑邊界從嚴

**選擇**：目標路徑以 `path.resolve` 組出後，驗證它仍落在該 change 目錄內（比照 `parked.get.ts:readOptional` 現成的逸出檢查）；逸出即視同讀取失敗、摘錄為空。change name 一律取自 CLI 輸出，不接受任何呼叫端輸入。

**理由**：CLI 輸出理論上可信，但 change name 來自使用者的目錄名，這道檢查成本近零而且既有程式碼已有同款先例。這也是 delta spec 敢把「讀檔範圍」放寬成窄例外的依據——例外的邊界必須是機械可驗證的，不是靠約定。

### D5: skeleton 高度對齊「有摘錄」的卡片

**選擇**：`ChangeCardSkeleton` 加兩行摘錄佔位，高度對齊摘錄佔滿兩行的真實卡片。

**理由**：摘錄的有無與行數讓真實卡片不等高（proposal.md 的決定），skeleton 不可能同時對齊每一種高度。多數 change 都有 proposal 且首句寫得夠長，對齊 clamp 上限那一種讓常見情況零跳動；摘錄較短或缺席的卡片替換時會縮一點，縮減量以摘錄區塊自身的高度為上限，其下的進度條隨之上移。

**否決 — 卡片保留空摘錄佔位以求等高**：畫面上會出現一塊沒有內容的留白，讀起來像壞掉；且會讓每張卡都變高，壓縮一屏能掃到的卡片數。

## Risks / Trade-offs

- **custom schema 把 proposal 改名 → 摘錄全空**（如 schema 定義 `why.md`）→ 降級為空摘錄，不報錯、不影響其他欄位。本專案自身與 dogfood 對象都用預設 spec-driven schema；真的遇到再開 change 走 `artifactPaths`（屆時可考慮背景補齊而非阻擋首載）。
- **卡片不等高會讓 `TransitionGroup` 的重排（`move-class`）位移距離不一致** → 現有 FLIP 動畫本身能處理任意高度差，無需改動；但後續的拖拉 change 會依賴「量測被拖走卡片的實際高度」來畫原位凹槽，這裡先確認高度非固定，是那個 change 的已知輸入。
- **N 次並行讀檔的失敗放大** → 每筆獨立 try／catch、`Promise.all` 前先各自吞掉錯誤，任何單筆失敗只讓該筆摘錄為空。清單整體不因摘錄而失敗（delta spec 已立為 scenario）。
- **摘錄品質天花板＝proposal 第一句的寫作品質** → 這是 `docs/ui-structure-decisions.md` 已接受的取捨（「反向形成寫作紀律」），不在本 change 重新評估。
- **摘錄與進度數字的一致性視窗不同** → 進度來自 CLI 快照，摘錄來自 CLI 回應之後的讀檔，兩者間隔內若 proposal 被改，摘錄會比進度新。間隔為毫秒級、且 watcher 會觸發重載，不做額外同步。
