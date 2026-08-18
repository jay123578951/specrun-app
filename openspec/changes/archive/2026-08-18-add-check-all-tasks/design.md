## Context

現行寫入路徑是一條窄而完整的鏈：`MarkdownView` 的點擊委派 → `detail.toggleTask(line)` 對快取來源字串就地翻行（樂觀更新）→ `POST /api/changes/:name/tasks/toggle` 以 `expectedText` 逐行比對後寫回。整條鏈只認識「一行」這個單位，而 `expectedText` 比對正是它的併發安全來源。

批次勾選要嵌進這條鏈，唯一有爭議的是「一次寫幾行」這件事該落在哪一層。動機見 proposal.md - Why，行為契約見兩份 delta spec。

三個既有不變式限制了做法：

- **樂觀更新的字串必須與伺服端寫出的檔案逐 byte 相同**——這是「無差異不重繪、畫面零閃爍」的前提（既有 design D5 的產物）。
- **DOM 不是狀態源**：目標與判定一律取自來源字串。
- **per-change 序列化**：同一份 tasks 的「重讀 → 比對 → 寫回」不交錯。

## Goals / Non-Goals

**Goals:**
- 批次寫入為單次檔案寫入，且與單顆點擊共用同一條通道與同一份翻行邏輯。
- 前端不新增第二套「哪些行可勾」的判定。
- 批次與單顆點擊並存時，不會互相把對方推進衝突。

**Non-Goals:**
- 不做節（`## N.`）層級的批次入口。若「一次收一節」的痛感真的出現，再作為獨立 change 處理。
- 不擴充 toast 的動作按鈕能力（批次不提供 undo，見 proposal）。
- 不為舊的單行 request shape 保留相容層——前後端同版出貨。

## Decisions

### D1：擴充既有端點吃多行，不新增 `/toggle-all`

request body 從 `{ line, expectedText, checked }` 改為 `{ edits: [{ line, expectedText }], checked }`；單顆點擊即 `edits` 長度為 1。

`checked` 留在頂層而非逐 edit：批次一律 `true`，單顆是當前值的反向，沒有「同一次請求裡有些勾有些取消」的使用情境。逐 edit 帶 `checked` 更通用，但通用性此刻沒有消費者，只會多一組要驗的輸入組合。

替代方案是新開 `/toggle-all`（body 只帶 change 名，由伺服端自己掃未勾行）。否決理由有二：其一，spec 明寫這是「App 的唯一寫入通道」，開第二條就要在兩處各自維護路徑白名單、序列化佇列與衝突語意；其二，由伺服端自己決定要勾哪些行，等於繞過 `expectedText` 這道併發保護——使用者按下按鈕時看到的是 7 個未勾項，伺服端掃到的可能是 8 個。

### D2：`toggleTaskLine` 改為一次收多筆 edit

`src/utils/task-line.ts` 的 `toggleTaskLine(content, line, expectedText, checked)` 改為 `toggleTaskLines(content, edits, checked)`：切一次行、逐 edit 比對與翻字元、全部成立才 `join()` 回傳。任一 edit 的行內容不符即回 `conflict`，不符 task 行語法即回 `not-a-task-line`，兩者都不產出內容。

這一份仍由伺服端與前端樂觀更新共用（server route 反向 import `src/` 的既有方向不變），逐 byte 相同的不變式因此自動延伸到批次。若改成「前端自己迴圈翻 N 次、伺服端另寫一套」，就等於把這個不變式交給兩份程式碼各自維持。

`checked` 在多行下仍是整批共用一個值，與 D1 的 request shape 對齊。

### D3：目標行集合在前端從來源字串算出

批次動作掃當前 tasks 檔案內容，取所有 `isTaskLine(text) && !isCheckedLine(text)` 的行組成 `edits`。判定沿用 `task-line.ts` 既有的兩個函式——這正是「可勾選項的判定一致性」那條 spec 已經鎖定的同一份判準，前端不會多出一套自己的規則，也不需要查 DOM。

### D4：in-flight 期間的互斥規則

`pendingTaskLines` 直接容納整批行號，`MarkdownView` 既有的 `data-pending` 標記邏輯無須改動就涵蓋了批次涉及的每一顆 checkbox。

批次入口的停用條件是「無未勾行 **或** `pendingTaskLines` 非空」。後半段是必要的：樂觀更新會先把翻轉後的內容寫進快取，若此時再發批次，它算出的 `expectedText` 是翻轉後的文字，而伺服端可能還沒寫入前一筆——比對必然不符，整批被判衝突。與其讓兩個合法操作互相絆倒，不如在有任何寫入在飛時就不開放批次。

反方向（批次進行中點擊單顆 checkbox）不需要額外處理：批次只涵蓋未勾行，這些行已在 pending 集合中被鎖住；剩下可點的是已勾行，而批次不會改動它們，其 `expectedText` 在批次前後一致，經佇列序列化後照樣成立。

### D5：入口以 tabs 列的 trailing slot 承載

`ArtifactTabs` 新增一個 `trailing` slot 置於 tablist 尾端（`ml-auto` 靠右）。`ArchivedPanel` 共用同一個元件但不填 slot，唯讀面板因此不需要任何條件判斷就不會長出寫入入口。

放這裡而非 `PanelShell` 的動作槽：動作槽（Copy name／Refresh）是「不論看哪個 tab 都在」的穩定集合，而批次入口只在 tasks tab 有效；塞進去會讓那個 `ml-auto` 右對齊的槽在切 tab 時長短變動，帶著旁邊兩顆一起橫移。tabs 靠左、入口靠右則互不推擠，也不影響 indicator 依 `offsetLeft`／`offsetWidth` 的量測。header 不隨內容捲動，順帶滿足 spec 的「捲到底仍可觸發」。

量體不畫盒子（新增的 `btn-inline` 階）：`btn-sm`（h-9）塞進 `tab-item` 的 h-12 行內，上下只剩 5.25px，一個有邊框的按鈕逼近該列底下的 `border-b` 會顯得侷促。改為 h-8、無邊框、hover 才浮底色——靜態是一行帶圖示的文字，與同列 tab 文字同一條視覺基線；再以 `-mr-2` 抵掉右內距，文字右緣與上方動作槽的 icon-btn 切齊（tabs 用 `-ml-3` 對齊左緣的同一手法）。帶文字而非純圖示不變——一次改寫數十行的操作，光靠圖示猜不出後果。

### D6：衝突為全有全無，由伺服端在寫入前決斷

伺服端讀檔後先跑完所有比對，全部通過才寫檔；任一行不符即整批放棄。與既有的 per-change 佇列組合後，「重讀 → 全比對 → 單次寫回」整段不與其他寫入交錯。

「跳過不符的行、寫其餘」被否決：它讓使用者看到的結果與按下按鈕時的預期產生無聲落差，而這個落差還得靠額外文案解釋。本機 openspec 目錄被外部同時改寫本就罕見，罕見情境該選最好解釋的行為。

## Risks / Trade-offs

- **[大批次的樂觀更新一次替換整份內容，觸發整片 Markdown 重渲染（含 async highlighter）]** → 與單顆點擊走的是同一條路徑，差別只在變動行數；tasks 檔案的量級（數十行）下重渲染成本與現況同階，不另做增量更新。
- **[前端算出的未勾行集合可能已與磁碟不同步（背景剛被外部改寫）]** → 這正是 `expectedText` 逐行比對要接的情形，結果是整批衝突並彈回，spec 已定義該路徑。
- **[in-flight 期間停用批次入口，快速操作時按鈕會短暫不可用]** → 單顆寫入的往返在本機是毫秒級；用短暫的停用換掉一整類必然失敗的衝突，划算。
- **[`TaskToggleInput` 改 shape 會讓既有單元測試與型別同時失效]** → 這是同版出貨的內部介面，一次改完；`task-line.test.ts` 與 `task-consistency.test.ts` 隨之更新，且新增多行案例（含批次衝突整批放棄）鎖住新語意。
