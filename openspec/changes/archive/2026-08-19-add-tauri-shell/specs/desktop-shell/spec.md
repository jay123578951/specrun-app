## Purpose

App 的桌面外殼形態：桌面視窗的啟動與開發通路、外殼提供給前端的平台通道（外部指令執行、檔案存取授權）及其安全邊界。只管形態與通道，不含任何規格語意——引擎仍完全外包 openspec CLI。

## ADDED Requirements

### Requirement: 桌面視窗形態啟動

App SHALL 可以桌面視窗形態啟動並載入完整既有 UI，開發通路下功能 SHALL 等同 web 形態——資料路徑不變（經既有本地 API），既有各 capability 的行為不因執行形態改變。

#### Scenario: 開發通路啟動

- **WHEN** 開發者以桌面開發指令啟動 App
- **THEN** 桌面視窗開啟並顯示 Changes 主頁，清單、詳情 slideover、tasks 勾選、park 拖曳、頁切換與 Settings 均可正常操作

### Requirement: 外部指令執行通道

外殼 SHALL 提供前端可呼叫的外部指令執行通道，接受動態的程式路徑、參數與工作目錄，回傳 exit status、stdout 與 stderr。程式路徑不存在或不可執行時 SHALL 回傳可辨識的錯誤結果，MUST NOT 使 App 崩潰。

#### Scenario: 以設定的 CLI 路徑對指定專案執行

- **WHEN** 前端以使用者設定的 openspec 執行檔路徑、cwd 指向某已加入專案，呼叫執行通道跑 `list --json`
- **THEN** 回傳該專案目錄下執行的結果（root path 為該專案路徑）

#### Scenario: 程式路徑不存在

- **WHEN** 前端以不存在的程式路徑呼叫執行通道
- **THEN** 得到錯誤結果（含原因），App 與視窗維持正常運作

### Requirement: 專案路徑的檔案存取授權

外殼 SHALL 提供前端可呼叫的目錄授權通道：授權後該目錄（遞迴）SHALL 可由前端讀寫。授權一個專案路徑時 MUST 同時使其 `.git` 子目錄（遞迴）可存取——遞迴授權不涵蓋 dotfile 目錄，而 park 機制依賴 `.git/specrun-app/` 的讀寫。

#### Scenario: 授權後可讀寫專案檔案

- **WHEN** 前端對某專案路徑呼叫授權通道，隨後讀寫該專案內的一般檔案
- **THEN** 讀寫成功

#### Scenario: 授權涵蓋 .git 子目錄

- **WHEN** 前端對某專案路徑呼叫授權通道，隨後在該專案 `.git/specrun-app/` 下建目錄與寫檔
- **THEN** 操作成功，無需前端另行對 `.git` 發起授權

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
