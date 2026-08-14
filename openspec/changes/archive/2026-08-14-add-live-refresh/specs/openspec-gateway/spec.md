## ADDED Requirements

### Requirement: 檔案變動通知
系統 SHALL 提供變動通知的訂閱通道：目標專案 `openspec/changes/` 底下任何檔案或目錄的新增、修改、刪除，SHALL 於短暫延遲後通知所有訂閱者。通知 SHALL 為粗粒度——MUST NOT 帶個別 change 或檔案的細節，訂閱者收到後自行重取資料；短時間內的連環變動 SHALL 合併為一則通知；`openspec/changes/` 以外的檔案變動 MUST NOT 觸發通知。

#### Scenario: 單檔修改觸發通知
- **WHEN** 外部工具修改 `openspec/changes/<name>/tasks.md`
- **THEN** 訂閱者於短暫延遲後收到一則「有變動」通知，通知不含 change 名稱或檔案路徑

#### Scenario: 連環寫入合併
- **WHEN** 外部工具在短時間內連續寫入多個檔案（如 git 操作或 AI agent 批次改檔）
- **THEN** 訂閱者僅收到一則合併後的通知，而非每檔一則

#### Scenario: 範圍外變動不通知
- **WHEN** 目標專案 `openspec/changes/` 以外的檔案（如 `src/` 下的程式碼）被修改
- **THEN** 不發出任何通知

### Requirement: 通知通道之韌性
通知通道斷線時 SHALL 自動重連，且 MUST NOT 顯示任何錯誤提示。通知能力不可用（如監看目錄不存在、監看啟動失敗）時，清單與詳情的既有功能 SHALL 照常運作，僅失去自動刷新——手動 refresh 仍為可用的後備。

#### Scenario: 斷線自動重連
- **WHEN** 通知通道因連線中斷而失效後又可恢復
- **THEN** 通道自動重新建立，期間與之後皆無錯誤提示，恢復後通知照常送達

#### Scenario: 通知不可用不影響既有功能
- **WHEN** 通知通道無法建立
- **THEN** 清單載入、詳情檢視與手動 refresh 全部照常運作
