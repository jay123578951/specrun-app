# desktop-shell Specification

## Purpose

App 的桌面外殼形態：桌面視窗的啟動與開發通路、外殼提供給前端的平台通道（外部指令執行、檔案存取授權）及其安全邊界。只管形態與通道，不含任何規格語意——引擎仍完全外包 openspec CLI。

## Requirements

### Requirement: 桌面視窗形態啟動

App SHALL 可以桌面視窗形態啟動並載入完整既有 UI。既有各 capability 的行為 SHALL 不因執行形態改變——改變的只有資料取得的路徑，不是使用者看到的結果。

桌面形態的設定讀寫、CLI 執行檔解析、change 與 spec 的讀取（清單與詳情）、檔案操作面（tasks 勾選寫入、park／unpark、parked 與 archived 的清單與詳情），以及檔案變動通知 SHALL 由外殼自持，MUST NOT 經由本地 API server。尚未移轉的資料路徑在過渡期間 MAY 仍經本地 API server；移轉完成前，桌面開發通路 SHALL 併跑它。

桌面形態 MUST NOT 為了讓本地 API server 跟上目前目標專案而回頭呼叫它——需要知道目標專案的路徑已全數由這個形態自持，而打包形態下那一趟呼叫必定失敗。

檔案操作面以 change 名定位目錄時，SHALL 先確認該名稱為單一路徑片段，含路徑分隔符或上層參照者 SHALL 被拒絕且不觸及檔案系統。讀取某個 change 的檔案時，實際讀取的路徑 SHALL 限於該 change 目錄之內；逸出者 SHALL 被拒絕，且拒絕的理由 SHALL 陳述為「不讀取此 change 目錄以外的檔案」，MUST NOT 呈現為該檔案不存在或讀取失敗——後兩者會讓使用者誤以為自己的檔案出了問題。

#### Scenario: 開發通路啟動

- **WHEN** 開發者以桌面開發指令啟動 App
- **THEN** 桌面視窗開啟並顯示 Changes 主頁，清單、詳情 slideover、tasks 勾選、park 拖曳、頁切換與 Settings 均可正常操作

#### Scenario: 不經本地 API server 也讀得出專案與 CLI 狀態

- **WHEN** 以打包後的桌面 App 啟動，本地 API server 未執行
- **THEN** 側欄列出已加入的專案且可切換，Settings 呈現 CLI 解析結果

#### Scenario: 不經本地 API server 也讀得出 change 與 spec

- **WHEN** 以打包後的桌面 App 啟動，本地 API server 未執行
- **THEN** 主區列出目標專案的 change 清單（含 Why 摘錄、進度與建立時刻），詳情 slideover 開得出各 artifact 內容，Specs 頁列得出 capability 清單並開得出 spec 全文

#### Scenario: 不經本地 API server 也勾得動任務

- **WHEN** 以打包後的桌面 App 啟動，本地 API server 未執行，使用者於某 change 的 tasks 檢視點擊一個 checkbox
- **THEN** 該行的勾選標記翻轉並寫回專案的 tasks 檔案，畫面上的 checkbox 呈現新狀態

#### Scenario: 不經本地 API server 也 park 得動

- **WHEN** 以打包後的桌面 App 啟動，本地 API server 未執行，使用者對某 active change 觸發 park，隨後對它觸發 unpark
- **THEN** 該 change 先移入 Parked 群組（詳情開得出 artifact），再移回 Active 群組，兩次操作皆不顯示失敗

#### Scenario: 不經本地 API server 也開得出 Archived 頁

- **WHEN** 以打包後的桌面 App 啟動，本地 API server 未執行，使用者切到 Archived 頁並點開一張卡片
- **THEN** 頁面列出已歸檔的 change（含歸檔日期與進度），詳情 slideover 開得出各 artifact 內容（含 delta spec）

#### Scenario: 不經本地 API server 也會自己刷新

- **WHEN** 以打包後的桌面 App 啟動，本地 API server 未執行，外部工具修改目標專案某 change 的 tasks 檔案
- **THEN** 清單於短暫延遲後自行更新該 change 的進度，使用者不需切頁或重開

#### Scenario: 勾選後卡片數字自己更新

- **WHEN** 以打包後的桌面 App 啟動，本地 API server 未執行，使用者勾選詳情中的一個 task
- **THEN** 左側該 change 卡片的進度數字於短暫延遲後跟著更新，使用者不需切頁

#### Scenario: 切換專案後通知跟著換目標

- **WHEN** 以打包後的桌面 App 啟動，本地 API server 未執行，使用者切換目標專案後，外部工具分別修改新舊兩個專案的 `openspec/changes/` 內容
- **THEN** 只有新目標專案的變動觸發刷新，切換過程中不對本地 API server 發出任何請求

#### Scenario: change 名含路徑分隔符

- **WHEN** 檔案操作面收到的 change 名含路徑分隔符或上層參照
- **THEN** 該操作被拒絕並回報失敗，MUST NOT 觸及檔案系統

#### Scenario: 讀取路徑逸出 change 目錄

- **WHEN** 某個 change 的詳情要讀取的路徑落在該 change 目錄之外
- **THEN** 該路徑不被讀取，理由陳述為不讀取此 change 目錄以外的檔案，MUST NOT 呈現為檔案不存在或讀取失敗

### Requirement: 外部指令執行通道

外殼 SHALL 提供前端可呼叫的外部指令執行通道，接受動態的程式路徑、參數與工作目錄，回傳 exit status、stdout 與 stderr。程式路徑不存在或不可執行時 SHALL 回傳可辨識的錯誤結果，MUST NOT 使 App 崩潰。

通道 SHALL 接受呼叫端指定的逾時上限。指令未於上限內結束時，外殼 SHALL 終止該行程並回傳可辨識的逾時結果，MUST NOT 無限期等待、MUST NOT 使 App 失去反應——通道會被用來執行使用者自己的 shell 設定檔，那裡面卡住不能拖垮 App。

通道 SHALL 接受呼叫端指定的輸出位元組上限。輸出達到上限時，外殼 SHALL 停止累積並回傳可辨識的截斷結果，MUST NOT 無上限地把輸出收在記憶體裡。呼叫端 SHALL 將截斷結果視同該次呼叫失敗，MUST NOT 把被截斷的輸出當成完整結果解析。

#### Scenario: 以設定的 CLI 路徑對指定專案執行

- **WHEN** 前端以使用者設定的 openspec 執行檔路徑、cwd 指向某已加入專案，呼叫執行通道跑 `list --json`
- **THEN** 回傳該專案目錄下執行的結果（root path 為該專案路徑）

#### Scenario: 程式路徑不存在

- **WHEN** 前端以不存在的程式路徑呼叫執行通道
- **THEN** 得到錯誤結果（含原因），App 與視窗維持正常運作

#### Scenario: 指令超過逾時上限

- **WHEN** 前端以某逾時上限呼叫執行通道，而該指令不會在上限內結束
- **THEN** 該行程被終止，呼叫端得到逾時結果，且視窗於等待期間與其後皆維持可操作

#### Scenario: 指令輸出超過上限

- **WHEN** 前端以某輸出上限呼叫執行通道，而該指令印出的量超過該上限
- **THEN** 呼叫端得到帶截斷標記的結果並視同該次呼叫失敗，不以被截斷的輸出解析出答案

### Requirement: 路徑正規化通道

外殼 SHALL 提供前端可呼叫的路徑正規化通道：給定一個路徑，回傳解開其中 symlink 後的實際位置。該通道 SHALL 為前端取得 canonical 路徑的唯一手段——webview 沒有檔案系統可問，字串層的正規化解不開 symlink。

路徑不存在或無法解析時 SHALL 回傳可辨識的錯誤結果，MUST NOT 自行編造一個路徑，也 MUST NOT 使 App 崩潰。

#### Scenario: 解開 symlink

- **WHEN** 前端以一個指向某資料夾的 symlink 路徑呼叫正規化通道
- **THEN** 回傳該 symlink 實際指向的資料夾路徑

#### Scenario: 一般路徑原樣回傳

- **WHEN** 前端以一個不含 symlink 的既存資料夾路徑呼叫正規化通道
- **THEN** 回傳的路徑與傳入者指向同一個位置

#### Scenario: 路徑不存在

- **WHEN** 前端以一個不存在的路徑呼叫正規化通道
- **THEN** 得到錯誤結果（含原因），App 與視窗維持正常運作

### Requirement: 專案路徑的檔案存取授權

外殼 SHALL 提供前端可呼叫的目錄授權通道：授權後該目錄（遞迴）SHALL 可由前端讀寫。授權一個專案路徑時 MUST 同時使其 `.git` 子目錄（遞迴）可存取——遞迴授權不涵蓋 dotfile 目錄，而 park 機制依賴 `.git/specrun-app/` 的讀寫。

授權範圍 SHALL 涵蓋查詢檔案與目錄的基本資訊（是否為目錄、建立時刻等），不限於內容的讀寫——清單的建立時刻欄位依賴該查詢。

#### Scenario: 授權後可讀寫專案檔案

- **WHEN** 前端對某專案路徑呼叫授權通道，隨後讀寫該專案內的一般檔案
- **THEN** 讀寫成功

#### Scenario: 授權涵蓋 .git 子目錄

- **WHEN** 前端對某專案路徑呼叫授權通道，隨後在該專案 `.git/specrun-app/` 下建目錄與寫檔
- **THEN** 操作成功，無需前端另行對 `.git` 發起授權

#### Scenario: 授權涵蓋基本資訊查詢

- **WHEN** 前端對某專案路徑呼叫授權通道，隨後查詢該專案某個 change 目錄的建立時刻
- **THEN** 查得該目錄的建立時刻，MUST NOT 因權限而落入讀不到的降級

### Requirement: 檔案存取的靜態邊界

前端檔案存取的靜態授權範圍 MUST 僅含 App 自身資料目錄；任何未經授權通道放行的路徑，前端的讀寫嘗試 SHALL 被拒絕並得到可辨識的錯誤。

#### Scenario: 未授權路徑被拒

- **WHEN** 前端未經授權通道，直接嘗試寫入 App 資料目錄以外的任意路徑
- **THEN** 寫入被拒絕，錯誤訊息指明路徑不在允許範圍

### Requirement: 桌面 webview 呈現無退化

既有各頁與互動（Changes、Specs、Archived、詳情 slideover、Settings、拖曳與動畫）在桌面視窗的 webview（WKWebView）中 SHALL 與瀏覽器呈現一致，無 Chrome-only 樣式導致的破版或互動失效。

#### Scenario: 逐頁檢視

- **WHEN** 在桌面視窗中逐頁走過 Changes（含詳情、勾選、park 拖曳）、Specs、Archived 與 Settings
- **THEN** 版面與互動皆與瀏覽器中一致，無破版、無失效

### Requirement: 兩種執行形態共用同一份設定

同一台機器上，桌面形態與 web 形態 SHALL 讀寫同一份應用程式設定——專案清單、最後啟用的專案、CLI 執行檔的明示覆寫皆然。切換執行形態 MUST NOT 改變使用者看到的清單與設定內容。

同一份設定 MUST NOT 同時由兩個行程持有可寫的執行期狀態。設定的寫入權在任一時刻 SHALL 只屬於一個持有者，避免整檔寫回時互相覆蓋。

「同一時刻只有一個持有者」SHALL 以先後使用為前提——兩種形態同時開著時，系統不保證兩邊的設定不互相覆蓋，後寫的會蓋掉先寫的。開發期間同時開啟兩種形態時，使用者 SHALL 以最後一次寫入為準，不倚賴兩邊各自累積的修改。

設定寫入失敗時，系統 SHALL 讓當下的操作照常完成，MUST NOT 因寫不進去而讓操作失敗或中斷——代價是該次修改不會保留到下次啟動。

#### Scenario: 一形態加入，另一形態看得到

- **WHEN** 使用者以其中一種形態加入一個專案，隨後以另一種形態開啟 App
- **THEN** 側欄列出該專案

#### Scenario: 一形態設定 CLI 路徑，另一形態沿用

- **WHEN** 使用者以其中一種形態指定 openspec 執行檔路徑，隨後以另一種形態開啟 App
- **THEN** Settings 顯示同一個覆寫路徑，且資料請求以該執行檔進行

#### Scenario: 兩形態同時開著

- **WHEN** 使用者同時開著兩種形態，並在兩邊各自修改設定
- **THEN** 設定檔內容為最後一次寫入的那一份，先寫的修改不保證保留

#### Scenario: 設定寫不進去

- **WHEN** 設定檔所在位置不可寫，使用者加入一個專案
- **THEN** 該專案在本次執行期間照常出現在側欄且可切換，下次啟動時不在清單中
