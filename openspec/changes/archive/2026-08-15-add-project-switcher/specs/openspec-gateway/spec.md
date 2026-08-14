## MODIFIED Requirements

### Requirement: 目標專案路徑解析
系統 SHALL 依下列優先序決定啟動時的目標專案：環境變數（dev override）＞持久化設定的最後啟用專案＞App 伺服端工作目錄（僅於其為 openspec 專案時成立，dogfooding）；三者皆不成立時啟動於無目標專案狀態（空清單引導）。啟動後的目標專案 SHALL 為伺服端持有、可於執行期切換的狀態；切換後所有資料請求 SHALL 來自新的目標專案，MUST NOT 要求個別請求自行指定專案。

#### Scenario: 環境變數指定
- **WHEN** 環境變數設為某個 openspec 專案路徑
- **THEN** 啟動時清單資料來自該路徑的專案，即使設定中有最後啟用專案

#### Scenario: 設定檔指定
- **WHEN** 環境變數未設定且持久化設定存有最後啟用專案
- **THEN** 啟動時清單資料來自該專案

#### Scenario: 未指定時 fallback
- **WHEN** 環境變數未設定、設定中無最後啟用專案，且伺服端工作目錄為 openspec 專案
- **THEN** 清單資料來自該工作目錄（dogfooding）

#### Scenario: 執行期切換
- **WHEN** 使用者切換至另一個專案後重新取得清單
- **THEN** 資料來自切換後的專案，請求本身未附帶專案路徑

### Requirement: 檔案變動通知
系統 SHALL 提供變動通知的訂閱通道：目標專案 `openspec/changes/` 底下任何檔案或目錄的新增、修改、刪除，SHALL 於短暫延遲後通知所有訂閱者。通知 SHALL 為粗粒度——MUST NOT 帶個別 change 或檔案的細節，訂閱者收到後自行重取資料；短時間內的連環變動 SHALL 合併為一則通知；`openspec/changes/` 以外的檔案變動 MUST NOT 觸發通知。切換目標專案後，通知來源 SHALL 跟隨改為新目標專案，原專案的變動 MUST NOT 再觸發通知。

#### Scenario: 單檔修改觸發通知
- **WHEN** 外部工具修改 `openspec/changes/<name>/tasks.md`
- **THEN** 訂閱者於短暫延遲後收到一則「有變動」通知，通知不含 change 名稱或檔案路徑

#### Scenario: 連環寫入合併
- **WHEN** 外部工具在短時間內連續寫入多個檔案（如 git 操作或 AI agent 批次改檔）
- **THEN** 訂閱者僅收到一則合併後的通知，而非每檔一則

#### Scenario: 範圍外變動不通知
- **WHEN** 目標專案 `openspec/changes/` 以外的檔案（如 `src/` 下的程式碼）被修改
- **THEN** 不發出任何通知

#### Scenario: 切換後通知跟隨
- **WHEN** 使用者從專案 A 切換至專案 B 後，外部工具分別修改 A 與 B 的 `openspec/changes/` 內容
- **THEN** 只有 B 的變動觸發通知
