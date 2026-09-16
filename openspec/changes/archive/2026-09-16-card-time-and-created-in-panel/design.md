## Context

見 proposal.md 的 Why。這裡只記動手前需要定下來的技術選擇。

現況的三個限制形成了本次的邊界：

- 卡片時間由 `src/utils/time.ts` 的 `formatRelativeTime` 單一函式產生，Active 與 Parked 共用，`ChangeCard.vue` 只負責決定來源與前綴。格式改在函式裡，卡片元件不必動。
- park 是 `rename`（整目錄搬移）而非複製，已實測確認搬移前後目錄的 `birthtime` 不變。因此建立時刻不需要在 park 當下另存，`.git/specrun-app/parked.json` 的結構可維持不動。
- 詳情面板的 header 由 `PanelShell.vue` 提供骨架，`ArtifactPanel.vue` 以 `#actions` 與 `#header` 兩個槽填內容。`#actions` 目前只放 icon 按鈕，`#header` 那一列的上下留白是刻意算過的（讓標題到按鈕、標題到 tabs 看起來等距），新增元素若落在 `#header` 會推高整個 header 並使該計算失效。

## Goals / Non-Goals

**Goals:**

- 卡片時間在「同一天開的多個 change」之間可分辨，且不改動任何排序規則。
- 詳情面板能回答「這個 change 何時建立」，active 與 parked 一致。
- 不增加任何 CLI 呼叫、不增加持久化資料。

**Non-Goals:**

- 不處理「同一分鐘內建立的兩個 change」——時分精度下它們仍相同，這是接受的限制。
- 不讓 Parked 清單層回答先後（一次拖兩張過去只差幾秒，park 時點本身不帶該資訊）。
- 不做群組內手動排序、不記錄 change 之間的依賴、不改卡片時間的來源。

## Decisions

### D1：建立時刻取自 change 目錄的 `birthtime`，不另存 metadata

`fs.stat` 的 `birthtimeMs` 即該目錄被建立的時刻，且 `rename` 不改寫它——park／unpark 因此天然保值。

替代案「park 當下把時刻寫進 `parked.json`」否決：它只覆蓋 parked 一側，active 一側仍得另尋來源；而且多一份要維護的持久化欄位，與「park metadata 只記 park 時間與 artifact 快照」的既有分工衝突。

替代案「`.openspec.yaml` 的 `created:`」否決：該欄位只到日期，同一天建立的多個 change 無法分辨，正好是本次要解決的情形。

替代案「目錄 `mtime`」否決：目錄 mtime 會因內容增刪而更新，語意是「最後一次有檔案進出」，不是建立。

`birthtimeMs` 為 0 或取值失敗一律視為取不到，回傳 `null`。

### D2：`created` 掛在清單摘要上，面板由 change 名稱回查，不動詳情端點

`ChangeSummary` 與 `ParkedSummary` 各加一個可為 `null` 的建立時刻欄位；詳情面板顯示的 change 必定同時存在於清單中（`artifact-view` 既有的「檢視中 change 消失自動關閉」已保證這個不變式），面板據名稱回查即可。

替代案「詳情端點也回傳建立時刻」否決：同一個值會有兩條取得路徑，兩邊的降級規則得各寫一次，且詳情是逐一打包呼叫，多一次 stat 換不到任何新資訊。

### D3：「今天」以本機日曆日比對判定，`now` 維持可注入

`formatRelativeTime(epochMs, now)` 既有的第二參數保留，新分支先比對兩個時刻的本機年、月、日是否相同：相同則輸出 24 小時制時分，否則走既有的相對分支，現有輸出一字不動。

以日曆日而非「24 小時內」判定，是因為輸出的時刻不帶日期：只有在「必為今日」的前提下 `18:38` 才無歧義。用滾動 24 小時會讓昨晚 23:50 的東西在今日凌晨顯示成 `23:50`，讀起來像今晚。

函式命名維持原樣（同一個函式回答「這個時刻要怎麼寫給人看」），呼叫端不必分流。

### D4：面板欄位填進既有的 `#actions` 槽，不改 PanelShell 骨架

建立時刻作為 `ArtifactPanel.vue` 的 `#actions` 第一個子元素，自然落在 `CopyNameButton` 左側，且沿用該槽既有的右對齊與垂直置中。`PanelShell.vue` 只需放寬「這個槽只裝 icon 按鈕」的假設——非互動文字與按鈕之間的間距要大於按鈕彼此的間距，避免被讀成同一組控制。

替代案「`#header` 標題列右端」否決：長 change 名稱會被截得更短。替代案「標題下另起一行」否決：推高 header 並使既有的留白計算失效。兩者在探索階段都評估過。

`ArchivedPanel.vue` 的 header 與此同構，本次不加該欄位，但排版調整需同步套用以維持一致。

### D5：取不到就整欄不渲染

`null` 時面板不輸出該元素、不留佔位、不顯示任何提示。理由與 Why 摘錄一致：缺件不是錯誤，清單層與詳情層都不該為此出現診斷文字。

## Risks / Trade-offs

- **`birthtime` 的跨平台可靠度** → 非 APFS／HFS+ 的檔案系統上，Node 可能回 0，或回等同 `ctime` 的值（而 `ctime` 會被 `rename` 改寫，park 之後就會顯示成停放時刻）。本專案的外殼目標是 macOS，開發與使用皆在 APFS 上；0 一律降級為取不到。此限制記錄於此，不在本 change 內加偵測。
- **裸時刻在跨午夜後會誤讀** → 卡片顯示 `18:38` 時，若畫面整夜未重新渲染，午夜過後那個字串仍在，會被讀成今天傍晚。既有的相對寫法有同樣的停滯問題（`5m ago` 也不會自己長大），本次不引入計時重繪；卡片的滑鼠停留提示已帶完整絕對值，可作為確認出口。
- **共用函式目前無測試護欄** → `src/utils/time.ts` 尚無測試檔，新分支等於在沒有回歸保護的情況下改動 Active 與 Parked 共用的輸出。本次需新建測試，至少涵蓋：同日輸出時分、跨日回到相對、午夜前後各一次的分界行為，以及既有相對寫法（分、時、日、月、年各階）維持原樣。所有案例以注入的 `now` 驅動，MUST NOT 依賴執行當下的系統時間。
- **面板文字坐在按鈕群組中被誤點** → 靠對比階與間距區隔，並確保不可聚焦、無 hover 回饋；這是規格層的要求（見 `artifact-view` delta），驗收時需實際確認。
- **時分精度下同分鐘建立仍無法分辨** → 已知且接受，不補秒數：秒數對掃描無益，且會讓時間欄位變長、擠壓卡片右側的進度數字。

## Migration Plan

無資料遷移。持久化結構（`.git/specrun-app/parked.json`）不變，park／unpark 流程不變，回退即還原程式碼。
