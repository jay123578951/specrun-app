# Spec Delta

## MODIFIED Requirements

### Requirement: 檔案變動通知

系統 SHALL 提供變動通知的訂閱通道：目標專案 `openspec/changes/` 底下、`openspec/roadmap/` 底下與 `openspec/roadmap.off` 的新增、修改、刪除，SHALL 於短暫延遲後通知所有訂閱者。通知 SHALL 為粗粒度——MUST NOT 帶個別 change 或檔案的細節，訂閱者收到後自行重取資料；短時間內的連環變動 SHALL 合併為一則通知；上述範圍以外的檔案變動 MUST NOT 觸發通知。切換目標專案後，通知來源 SHALL 跟隨改為新目標專案，原專案的變動 MUST NOT 再觸發通知。

連環變動合併為一則的保證 SHALL 由本通道自己負責，MUST NOT 假定底層的檔案監看機制已經合併過——部分形態的監看機制即使設了延遲，仍是把一批變動逐則送上來。

監看的目標路徑 SHALL 為解開 symlink 後的實際位置。變動事件回報的是實際位置，監看路徑與它不一致時，「這則變動落不落在通知範圍內」的判斷會把每一則都當成範圍外。

#### Scenario: 單檔修改觸發通知

- **WHEN** 外部工具修改 `openspec/changes/<name>/tasks.md`
- **THEN** 訂閱者於短暫延遲後收到一則「有變動」通知，通知不含 change 名稱或檔案路徑

#### Scenario: 連環寫入合併

- **WHEN** 外部工具在短時間內連續寫入多個檔案（如 git 操作或 AI agent 批次改檔）
- **THEN** 訂閱者僅收到一則合併後的通知，而非每檔一則

#### Scenario: 底層逐則送上來仍只得一則

- **WHEN** 底層監看機制把一批變動逐則送上通道
- **THEN** 訂閱者仍只收到一則通知，而非每則一次

#### Scenario: 規劃檔修改觸發通知

- **WHEN** 外部工具修改 `openspec/roadmap/` 底下的某個規劃檔
- **THEN** 訂閱者於短暫延遲後收到一則「有變動」通知，通知不含檔案路徑，也不標示變動來自 roadmap

#### Scenario: 規劃檔新增與刪除觸發通知

- **WHEN** 外部工具在 `openspec/roadmap/` 底下新增一個規劃檔，或刪除既有的規劃檔
- **THEN** 訂閱者於短暫延遲後收到一則「有變動」通知

#### Scenario: roadmap 目錄原本不存在

- **WHEN** 訂閱時目標專案還沒有 `openspec/roadmap/`，之後該目錄被建立並寫入第一個規劃檔
- **THEN** 訂閱者收到通知，MUST NOT 需要重新訂閱或重開 App

#### Scenario: 停用標記出現或消失觸發通知

- **WHEN** 外部工具建立或刪除 `openspec/roadmap.off`
- **THEN** 訂閱者於短暫延遲後收到一則「有變動」通知

#### Scenario: 範圍外變動不通知

- **WHEN** 目標專案通知範圍以外的檔案（如 `src/` 下的程式碼、`openspec/specs/` 底下的 spec、`openspec/config.yaml`）被修改
- **THEN** 不發出任何通知

#### Scenario: 經 symlink 加入的專案照常通知

- **WHEN** 目標專案的路徑經過 symlink，外部工具修改該專案 `openspec/changes/` 底下的檔案
- **THEN** 訂閱者照常收到通知，MUST NOT 因路徑寫法不同而把變動判為範圍外

#### Scenario: 切換後通知跟隨

- **WHEN** 使用者從專案 A 切換至專案 B 後，外部工具分別修改 A 與 B 通知範圍內的檔案
- **THEN** 只有 B 的變動觸發通知

#### Scenario: 目標未實際改變時不重接

- **WHEN** 使用者加入一個已經是目前目標的專案、切換到目前這個專案，或移除的不是目前目標的專案
- **THEN** 通知來源不重接，既有的通知照常送達

#### Scenario: 設定寫入失敗仍跟隨新目標

- **WHEN** 使用者切換目標專案，而應用程式設定的寫入失敗
- **THEN** 通知來源仍跟隨改為新目標專案

#### Scenario: 切換前已在合併等待中的變動仍送出一則

- **WHEN** 目標專案的變動已進入合併等待、尚未送出通知，此時使用者切換到另一個專案
- **THEN** 該則通知照常送出；通知不帶內容，訂閱者收到後重取的是新目標專案的資料

#### Scenario: changes 目錄本身出現不單獨觸發通知

- **WHEN** 通知由執行形態自持、在同一個行程內傳遞，目標專案原本沒有 `openspec/changes/`，該目錄被建立但底下還沒有任何檔案
- **THEN** 不發出通知；直到該目錄底下出現第一個檔案才通知

#### Scenario: 訂閱後隨即取消不留下監看

- **WHEN** 訂閱者在監看尚未接上之前就取消訂閱
- **THEN** 監看接上後立即收掉，MUST NOT 留下沒有訂閱者的監看；其後新的訂閱者仍能接上並收到通知

