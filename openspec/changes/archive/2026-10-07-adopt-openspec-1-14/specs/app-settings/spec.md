# Spec Delta

## REMOVED Requirements

### Requirement: 套用後的資料重載範圍

**Reason**: 這條要求 archived 資料在換 CLI 後 MUST NOT 重載（情境「archived 不受影響」），理由是 archived 不經 CLI。archived 清單改由 CLI 取得後，這個行為要反過來，舊情境無法保留。

**Migration**: 由新增的「套用 CLI 後的資料重載範圍」取代：重載範圍加入 archived，其餘行為不變。

## ADDED Requirements

### Requirement: 套用 CLI 後的資料重載範圍

CLI 執行檔變更並套用成功後，系統 SHALL 重載受該執行檔影響的資料：change 清單、目前所在頁的引擎資料、各專案徽章，以及 archived 資料——archived 清單同樣來自 CLI，舊版換成新版後版本過舊的錯誤須隨之消失。檔案變動通知 MUST NOT 因此重掛——它監看檔案系統、與 CLI 無關。重載期間 Settings SHALL 維持開啟，MUST NOT 因套用成功而自動關閉。

#### Scenario: 套用後清單更新

- **WHEN** 先前 CLI 不可用導致清單為空，使用者於 Settings 指定有效路徑並套用成功
- **THEN** change 清單重新載入並呈現資料，Settings 仍為開啟狀態且顯示成功態

#### Scenario: archived 隨之重載

- **WHEN** Archived 頁因 openspec 1.13.2 顯示版本過舊，使用者於 Settings 套用一個 1.14 以上的執行檔
- **THEN** archived 資料重新載入，Archived 頁改為呈現清單，不再顯示版本過舊

### Requirement: 開啟 Settings 時檢查 openspec 新版

每次開啟 Settings，且目前有可用的 openspec 執行檔時，系統 SHALL 以該執行檔檢查有沒有新版（見 openspec-gateway「CLI 更新檢查通道」）。套用新的執行檔成功後 SHALL 針對新執行檔重新檢查。檢查期間 SHALL 在 openspec CLI 區塊就地顯示檢查中，MUST NOT 擋住 Settings 其他操作。系統 MUST NOT 在 Settings 以外的位置提示有新版。

#### Scenario: 開啟即檢查

- **WHEN** 使用者開啟 Settings，目前生效的 openspec 為 1.14.1
- **THEN** openspec CLI 區塊先顯示檢查中，取得結果後換成檢查結果

#### Scenario: CLI 不可用時不檢查

- **WHEN** 使用者開啟 Settings，目前沒有可用的 openspec 執行檔
- **THEN** 系統不進行更新檢查，區塊只呈現既有的失敗狀態

#### Scenario: 換執行檔後重新檢查

- **WHEN** 使用者在 Settings 開啟期間套用另一個執行檔且成功
- **THEN** 系統以新執行檔重新檢查，顯示的結果屬於新執行檔

#### Scenario: 切回自動偵測後重新檢查

- **WHEN** 使用者在 Settings 開啟期間切回自動偵測，或按重新偵測，且找到可用的執行檔
- **THEN** 系統以偵測到的執行檔重新檢查

#### Scenario: 套用失敗時保留原結果

- **WHEN** 使用者在 Settings 開啟期間套用另一個執行檔但失敗
- **THEN** 系統不重新檢查，區塊保留原本生效執行檔的檢查結果

#### Scenario: Settings 外不提示

- **WHEN** 檢查結果為有新版，使用者關閉 Settings
- **THEN** 側欄與其他頁面不出現任何新版提示

### Requirement: 更新檢查結果的呈現

檢查結果 SHALL 就地呈現在 openspec CLI 區塊，MUST NOT 以自動消失的 toast 呈現，並 SHALL 區分四種：有新版、已是最新版、無法檢查、版本低於 1.14。有新版 SHALL 顯示新版號；CLI 提供升級指令時 SHALL 一併顯示該指令與複製鈕，未提供時只顯示新版號。系統 MUST NOT 代使用者執行升級指令。

#### Scenario: 有新版且附指令

- **WHEN** 檢查回報有新版 1.15.0，並提供升級指令
- **THEN** 區塊顯示新版號 1.15.0、該升級指令與複製鈕，App 不執行該指令

#### Scenario: 有新版但無指令

- **WHEN** 檢查回報有新版 1.15.0，但沒有提供升級指令
- **THEN** 區塊只顯示新版號 1.15.0，不顯示指令與複製鈕

#### Scenario: 已是最新版

- **WHEN** 檢查回報目前版本已是最新
- **THEN** 區塊顯示已是最新版

#### Scenario: 無法檢查

- **WHEN** 檢查因離線、registry 被停用、逾時或輸出無法解析而沒有結果
- **THEN** 區塊顯示目前無法檢查更新，Settings 其他功能照常

#### Scenario: 版本低於 1.14

- **WHEN** 目前生效的 openspec 為 1.13.2
- **THEN** 區塊說明 Archived 頁與檢查更新需要 openspec 1.14 以上，不顯示升級指令

#### Scenario: 手動路徑尚未驗證

- **WHEN** 使用者在手動模式輸入新路徑但還沒驗證套用
- **THEN** 區塊仍顯示目前生效執行檔的檢查結果，不因尚未驗證的路徑而隱藏
