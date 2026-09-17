## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: 桌面視窗形態啟動

App SHALL 可以桌面視窗形態啟動並載入完整既有 UI。既有各 capability 的行為 SHALL 不因執行形態改變——改變的只有資料取得的路徑，不是使用者看到的結果。

桌面形態的設定讀寫、CLI 執行檔解析，以及 change 與 spec 的讀取（清單與詳情）SHALL 由外殼自持，MUST NOT 經由本地 API server。尚未移轉的資料路徑在過渡期間 MAY 仍經本地 API server；移轉完成前，桌面開發通路 SHALL 併跑它。

#### Scenario: 開發通路啟動

- **WHEN** 開發者以桌面開發指令啟動 App
- **THEN** 桌面視窗開啟並顯示 Changes 主頁，清單、詳情 slideover、tasks 勾選、park 拖曳、頁切換與 Settings 均可正常操作

#### Scenario: 不經本地 API server 也讀得出專案與 CLI 狀態

- **WHEN** 以打包後的桌面 App 啟動，本地 API server 未執行
- **THEN** 側欄列出已加入的專案且可切換，Settings 呈現 CLI 解析結果

#### Scenario: 不經本地 API server 也讀得出 change 與 spec

- **WHEN** 以打包後的桌面 App 啟動，本地 API server 未執行
- **THEN** 主區列出目標專案的 change 清單（含 Why 摘錄、進度與建立時刻），詳情 slideover 開得出各 artifact 內容，Specs 頁列得出 capability 清單並開得出 spec 全文

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
