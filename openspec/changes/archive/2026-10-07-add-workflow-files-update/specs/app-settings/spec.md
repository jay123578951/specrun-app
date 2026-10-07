# Spec Delta

## ADDED Requirements

### Requirement: 各專案流程檔版本一覽

Settings SHALL 有一區「Project workflow files」，每次開啟 Settings 時讀取 App 專案清單中每個專案的流程檔版本，並 SHALL 與目前生效的 openspec 執行檔版本比較。此區 SHALL 在最上方單獨呈現目前專案那一列；其餘專案 SHALL 收在一行「Other projects」之下，該行顯示其餘專案的數量與其中落後的數量，預設收起，使用者點開才列出各列；每次開啟 Settings 時 SHALL 重新收起。目前專案不在專案清單中、或沒有目前專案時，最上方 SHALL 以一句說明取代該列，「Other projects」列出清單中的全部專案。每列 SHALL 呈現五種狀態之一：落後、已是最新、比 CLI 新、未設定、資料夾不存在。目前沒有可用的執行檔時，此區 SHALL 只列專案與版本，MUST NOT 呈現比較結果與 Update 按鈕。此區 MUST NOT 呈現 git 分支或未提交改動等資訊。UI 文案 SHALL 一律使用英文。

#### Scenario: 列出各專案版本

- **WHEN** 專案清單有 6 個專案，CLI 為 1.14.1，各專案流程檔為 1.13.1、1.13.1、1.2.0、1.8.0、1.14.1 與未設定，目前專案為其中流程檔 1.13.1 的 specrun-app
- **THEN** 最上方為 specrun-app 一列、標示落後；其下一行「Other projects (5) · 3 behind」預設收起；點開後列出 5 列：3 列落後、1 列已是最新、1 列未設定

#### Scenario: 每次開啟預設收起

- **WHEN** 使用者點開「Other projects」後關閉 Settings，再次開啟
- **THEN** 「Other projects」為收起狀態

#### Scenario: 目前專案不在清單

- **WHEN** 沒有目前專案，或目前專案是暫時加入、不在專案清單中
- **THEN** 最上方以一句說明取代目前專案那一列，「Other projects」列出清單中的全部專案

#### Scenario: Other projects 的落後數只算其餘專案

- **WHEN** 目前專案與其餘專案中都有落後的
- **THEN** 「Other projects」那一行的落後數只計算其餘專案，不含目前專案；說明句為 `The current project isn't in your project list.`

#### Scenario: 沒有其餘專案

- **WHEN** 專案清單中只有目前專案一個
- **THEN** 不顯示「Other projects」那一行

#### Scenario: 比 CLI 新

- **WHEN** 某專案流程檔為 1.14.1，目前生效的 CLI 為 1.13.2
- **THEN** 該列標示比 CLI 新，不顯示 Update 按鈕

#### Scenario: 資料夾不存在

- **WHEN** 專案清單中某專案的資料夾已被移走
- **THEN** 該列標示找不到資料夾，不顯示 Update 按鈕，其他列照常

#### Scenario: CLI 不可用

- **WHEN** 開啟 Settings 時沒有可用的 openspec 執行檔
- **THEN** 此區列出各專案與其流程檔版本，不顯示落後與否，也不顯示任何 Update 按鈕

#### Scenario: 換了 CLI 後重讀

- **WHEN** 使用者在 Settings 的 openspec CLI 區改用其他執行檔或切回自動偵測
- **THEN** 此區重新讀取並以新的 CLI 版本比較

#### Scenario: 讀取中、讀取失敗與沒有專案

- **WHEN** 此區尚未讀完、整份讀取失敗，或專案清單沒有任何專案
- **THEN** 此區分別就地顯示讀取中、`Can't read project workflow files: …` 加原因、`No projects added yet.`

#### Scenario: 專案名稱

- **WHEN** 此區列出一個專案
- **THEN** 專案名稱取路徑最後一段，滑鼠停在名稱上可看到完整路徑；沒有版本時版本欄顯示 `-`

### Requirement: 逐一更新專案流程檔

落後的專案列 SHALL 有 Update 按鈕，觸發後系統 SHALL 以目前生效的執行檔對該專案更新流程檔（見 openspec-gateway「專案流程檔更新通道」）。此區 MUST NOT 提供一次更新多個專案的操作。更新進行中該列 SHALL 就地顯示進行中且按鈕不可重複觸發，其他列 SHALL 照常可操作。結果 SHALL 就地呈現於該列，MUST NOT 以自動消失的 toast 呈現。

#### Scenario: 更新成功

- **WHEN** 使用者按下某個 1.13.1 專案的 Update，CLI 為 1.14.1
- **THEN** 更新完成後該列改為已是最新、顯示 1.14.1，按鈕消失

#### Scenario: 更新附帶警告

- **WHEN** 更新成功，但 CLI 回報跳過了舊格式檔案的清理
- **THEN** 該列顯示更新後的版本，並就地顯示 CLI 給的警告文字

#### Scenario: 更新失敗

- **WHEN** 更新因 CLI 結束代碼非 0、逾時或執行失敗而沒有完成
- **THEN** 該列顯示失敗與 CLI 的錯誤訊息，Update 按鈕保留可再按

#### Scenario: 不提供全部更新

- **WHEN** 此區共有 4 列落後，使用者點開「Other projects」
- **THEN** 畫面上只有 4 個各自的 Update 按鈕，沒有一次更新多列的操作

#### Scenario: 落後數隨更新同步

- **WHEN** 「Other projects」中某一列更新成功
- **THEN** 該行顯示的落後數量減 1

#### Scenario: 更新中其他列可操作

- **WHEN** 某列更新進行中，使用者按下另一列的 Update
- **THEN** 兩列各自更新，各自顯示結果

#### Scenario: 更新成功但讀不到新版本

- **WHEN** 更新成功，但隨後重讀版本失敗
- **THEN** 該列維持原本的版本與狀態，並就地顯示 `Updated, but the new version could not be read.`

#### Scenario: 重新開啟 Settings

- **WHEN** 使用者關閉再開啟 Settings
- **THEN** 各列上一次的警告與失敗訊息清除；仍在更新中的列保留進行中狀態
