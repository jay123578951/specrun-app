# Spec Delta

## ADDED Requirements

### Requirement: 沒有版本號的流程檔的呈現

「Project workflow files」區中，流程檔沒有版本號的專案（openspec 2.0 起），版本欄 SHALL 顯示 `-`，狀態 SHALL 取自 openspec-gateway「流程檔沒有版本號時向 CLI 詢問」的回報：落後或已是最新。落後時 SHALL 照常有 Update 按鈕。通道回報無比較結果時，該列 SHALL 只顯示專案名稱與 `-`，MUST NOT 呈現狀態與 Update 按鈕。

#### Scenario: 已是最新與落後

- **WHEN** CLI 為 2.1.1，某專案的流程檔沒有版本號，通道回報它已是最新；另一個同樣沒有版本號的專案，通道回報落後
- **THEN** 兩列的版本欄都顯示 `-`；前者標示已是最新、沒有 Update 按鈕，後者標示落後、有 Update 按鈕

#### Scenario: 判斷不出狀態

- **WHEN** 某專案的流程檔沒有版本號，而目前的 CLI 答不出它是否落後
- **THEN** 該列只顯示專案名稱與 `-`，不顯示狀態，也不顯示 Update 按鈕

#### Scenario: 更新後流程檔沒有版本號

- **WHEN** 使用者按下某個 1.14.1 專案的 Update，CLI 為 2.1.1，更新後的流程檔不再寫版本號
- **THEN** 更新完成後該列改為已是最新、版本欄顯示 `-`，按鈕消失
