## Why

同一輪討論裡連開兩個 change，卡片上的時間會一起塌成 `just now`，看不出哪一個先開——而當兩者有「A 做完才能做 B」的開發順序時，清單層就答不出該從哪一張下手。時間顯示只到單一單位是主因；Parked 卡片更根本，它顯示的是「你按下停放的那一刻」，一次拖兩張過去只差幾秒，本身就不帶先後資訊。

## What Changes

- 卡片時間格式改為「今天的顯示時刻、昨天以前維持相對」：同一個日曆日內顯示 `18:38`（24 小時制時分），更早的維持現有單一單位相對寫法（`2d ago`、`1mo ago`）。分界跟日曆日走，不用 24 小時滾動窗——裸時刻不帶日期，只有「一定是今天」才無歧義。
- 詳情面板 header 新增該 change 的建立時刻 `Created 09-15 16:38`（不寫年份，滑鼠停留給完整值）。位置在工具列那一列、複製名稱鈕左邊；呈現上必須讀得出「這是說明文字」而非可點的按鈕。
- 清單資料每一筆補上 change 建立時刻，來源為 change 目錄的檔案系統建立時間（birthtime），以檔案層直讀取得，不追加任何 CLI 呼叫。park 是整目錄搬移（rename）而非複製，建立時間完整保留，parked 一側同樣拿得到。
- 排序一律不動：Active 依最後修改新→舊、Parked 依 park 時點新→舊、Archived 依歸檔日期新→舊，三個群組維持同一條規則。

明確不做（避免實作時自行補回）：不做群組內手動拖曳排序；不記錄 change 之間的先後依賴——openspec 沒有這個概念，本專案不自行發明；卡片上不顯示建立時刻；歸檔頁面板不加此欄位。

已知且接受的限制：新格式對 Active 群組有效（同一天開兩個 change 不再都是 `just now`），對 Parked 群組無效（一次拖兩張進去只差幾秒，精確到分鐘仍相同）。Parked 一側的先後改由「逐一點開詳情面板比對 Created」回答，清單層不承擔。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `change-list`：卡片時間欄位的呈現規則——由「一律相對時間」改為「今天顯示時刻、更早顯示相對」，parked 卡片的 `parked ` 前綴與時間來源均不變。
- `artifact-view`：詳情面板 header 新增建立時刻欄位，含其位置、文案、非互動呈現與滑鼠停留的完整值。
- `openspec-gateway`：清單資料每一筆新增建立時刻欄位，並規範其取得方式（檔案層直讀，不追加 CLI 呼叫）與取不到時的降級。

## Impact

- `src/utils/time.ts`：`formatRelativeTime` 加入「今天」分支，Active 與 Parked 卡片共用同一個函式。
- `src/components/ArtifactPanel.vue`：`#actions` 槽新增建立時刻文字，排在 `CopyNameButton` 之前。
- `src/components/PanelShell.vue`：工具列右側動作槽目前僅容納 icon 按鈕，需容納一段非互動文字並拉開與按鈕組的間距。
- `server/api/parked.get.ts`：逐筆讀檔時順帶取得目錄建立時間。
- active 清單一側的 route 與 `src/api/normalize.ts`／`normalize-parked.ts`：型別與轉換補上新欄位。
- `src/components/ArchivedPanel.vue`：頭部與 `ArtifactPanel` 同構，排版若受影響需一併維持一致；但不加建立時刻欄位。
- `src/components/ChangeCard.vue`：不改動。
- `.git/specrun-app/parked.json` 的結構不變，park／unpark 流程不變。
