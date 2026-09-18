## MODIFIED Requirements

### Requirement: 桌面視窗形態啟動

App SHALL 可以桌面視窗形態啟動並載入完整既有 UI。既有各 capability 的行為 SHALL 不因執行形態改變——改變的只有資料取得的路徑，不是使用者看到的結果。

桌面形態的設定讀寫、CLI 執行檔解析、change 與 spec 的讀取（清單與詳情）、檔案操作面（tasks 勾選寫入、park／unpark、parked 與 archived 的清單與詳情）、檔案變動通知、加入專案的原生資料夾選擇、開啟檔案所在位置，以及把外部網址交給系統開啟 SHALL 由外殼自持，MUST NOT 經由本地 API server。

桌面形態的資料取得路徑 SHALL 全數由外殼自持，MUST NOT 有任何一條仍經本地 API server。桌面開發通路仍併跑本地 API server，但它此時只服務在瀏覽器中執行的那一份；桌面形態 MUST NOT 依賴它是否在跑。

桌面形態 MUST NOT 為了讓本地 API server 跟上目前目標專案而回頭呼叫它——需要知道目標專案的路徑已全數由這個形態自持，而打包形態下那一趟呼叫必定失敗。

桌面形態把路徑交給作業系統開啟時，SHALL 僅在它實際需要開啟的範圍內取得授權，MUST NOT 為了取得開啟能力而擴大既有的檔案可讀範圍。

檔案操作面以 change 名定位目錄時，SHALL 先確認該名稱為單一路徑片段，含路徑分隔符或上層參照者 SHALL 被拒絕且不觸及檔案系統。讀取某個 change 的檔案時，實際讀取的路徑 SHALL 限於該 change 目錄之內；逸出者 SHALL 被拒絕，且拒絕的理由 SHALL 陳述為「不讀取此 change 目錄以外的檔案」，MUST NOT 呈現為該檔案不存在或讀取失敗——後兩者會讓使用者誤以為自己的檔案出了問題。

#### Scenario: 開發通路啟動

- **WHEN** 開發者以桌面開發指令啟動 App
- **THEN** 桌面視窗開啟並顯示 Changes 主頁，清單、詳情 slideover、tasks 勾選、park 拖曳、頁切換與 Settings 均可正常操作

#### Scenario: 不經本地 API server 也讀得出專案與 CLI 狀態

- **WHEN** 以打包後的桌面 App 啟動，本地 API server 未執行
- **THEN** 側欄列出已加入的專案且可切換，Settings 呈現 CLI 解析結果

#### Scenario: 不經本地 API server 也加得了專案

- **WHEN** 以打包後的桌面 App 啟動，本地 API server 未執行，專案清單為空，使用者點擊空狀態的加入專案按鈕並選定一個含 `openspec/` 目錄的資料夾
- **THEN** 原生資料夾選擇 dialog 正常開啟，該專案加入清單並成為目前專案，主區顯示其 change 清單

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

#### Scenario: 不經本地 API server 也開得了檔案所在位置

- **WHEN** 以打包後的桌面 App 啟動，本地 API server 未執行，使用者開啟 Settings 並按下設定檔位置的開啟動作
- **THEN** 該動作可按（不呈現為禁用），按下後該檔所在的資料夾於系統的檔案管理器中開啟並選取該檔

#### Scenario: 不經本地 API server 也開得進目前專案

- **WHEN** 以打包後的桌面 App 啟動，本地 API server 未執行，使用者開啟 Settings 並按下目前專案的開啟動作
- **THEN** 該動作可按（不呈現為禁用），按下後該專案資料夾本身於系統的檔案管理器中開啟，使用者看到的是專案的內容，MUST NOT 呈現為它的上一層資料夾

#### Scenario: 開啟動作收到的路徑指向一個應用程式

- **WHEN** 以打包後的桌面 App 啟動，本地 API server 未執行，開啟動作收到的路徑指向一個應用程式（macOS 上副檔名為 `.app` 的那種）
- **THEN** 該應用程式所在的資料夾於系統的檔案管理器中開啟並在其中選取它，該應用程式 MUST NOT 被啟動——它在檔案系統上是資料夾，但開啟它等於把它跑起來

#### Scenario: 不經本地 API server 也點得動外部連結

- **WHEN** 以打包後的桌面 App 啟動，本地 API server 未執行，使用者在某 artifact 內容中點擊一個 https 連結
- **THEN** 該網址於系統的預設瀏覽器開啟，App 視窗維持在原本的檢視狀態

#### Scenario: 開啟路徑不擴大檔案可讀範圍

- **WHEN** 桌面形態取得把路徑交給作業系統開啟的能力之後，檢視它被授予的檔案存取範圍
- **THEN** 該範圍與取得此能力之前相同，MUST NOT 因此多出任何原本讀不到的路徑

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
