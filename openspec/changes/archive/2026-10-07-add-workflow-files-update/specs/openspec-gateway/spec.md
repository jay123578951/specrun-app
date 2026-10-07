# Spec Delta

## ADDED Requirements

### Requirement: 專案流程檔版本讀取通道

系統 SHALL 提供讀取各專案流程檔版本的通道。版本 SHALL 取自該專案 `.claude/skills/openspec-*/SKILL.md` 開頭的 `generatedBy` 值；多個檔案版本不一時 SHALL 取最舊者。系統 MUST NOT 讀取這些檔案的其他內容，也 MUST NOT 讀取其他 AI 工具的流程檔。查不到任何 `generatedBy` 時 SHALL 回報未設定；資料夾不存在時 SHALL 回報不存在。單一專案讀取失敗 MUST NOT 影響其他專案的結果。網頁與桌面兩種執行形態 SHALL 各自提供，結果語意相同。

#### Scenario: 版本一致

- **WHEN** 某專案 6 個 openspec skill 檔的 `generatedBy` 都是 1.13.1
- **THEN** 通道回報該專案為 1.13.1

#### Scenario: 版本不一

- **WHEN** 某專案 5 個 skill 檔為 1.14.1、1 個為 1.8.0
- **THEN** 通道回報該專案為 1.8.0

#### Scenario: 未設定

- **WHEN** 某專案沒有 `.claude/skills/openspec-*` 目錄，或其中檔案都沒有 `generatedBy`
- **THEN** 通道回報該專案為未設定

#### Scenario: 單一專案失敗不拖垮其他

- **WHEN** 6 個專案中有 1 個資料夾不存在
- **THEN** 該專案回報不存在，其餘 5 個照常回報版本

#### Scenario: 只讀到檔案開頭的設定段

- **WHEN** skill 檔開頭以 `---` 包住的設定段之後，內文又出現 `generatedBy`
- **THEN** 通道只採用開頭設定段裡的值；讀到設定段結束就停止讀取，單一檔案最多讀 8 KB

#### Scenario: 版本號含非數字段

- **WHEN** 某專案的 `generatedBy` 含非數字段（例如 `1.14.0-beta`）
- **THEN** 非數字段視為 0 參與比較，該版本與 `1.14.0` 視為相同

#### Scenario: 桌面形態授權失敗

- **WHEN** 桌面形態讀取某專案前，對該專案的授權失敗
- **THEN** 該專案回報不存在，其他專案照常

#### Scenario: 暫時加入的專案不列出

- **WHEN** 網頁形態目前開啟的專案是由環境變數或啟動位置帶入、未存進專案清單
- **THEN** 通道不列出該專案，也不接受對它更新

### Requirement: 專案流程檔更新通道

系統 SHALL 提供以目前生效的執行檔對單一專案執行 `update <專案路徑>` 的通道，MUST NOT 附加 `--force`。通道 SHALL 回傳是否成功與 CLI 的文字輸出；成功但輸出含警告時 SHALL 一併回傳警告文字。逾時、執行失敗與非 0 結束代碼 SHALL 回報為失敗並附 CLI 的錯誤訊息。失敗 SHALL 以回傳值表達，MUST NOT 讓例外逸出。通道 SHALL 只接受 App 專案清單中的專案路徑。

#### Scenario: 更新成功

- **WHEN** 對一個流程檔為 1.13.1 的專案呼叫更新，CLI 為 1.14.1
- **THEN** 通道回報成功，該專案的流程檔改為 1.14.1

#### Scenario: 不附加 --force

- **WHEN** 對一個含舊格式檔案的專案呼叫更新
- **THEN** CLI 以不加 `--force` 的方式執行，舊格式檔案保留，通道回報成功並附上 CLI 的警告文字

#### Scenario: 非清單內的路徑

- **WHEN** 以不在 App 專案清單中的路徑呼叫更新
- **THEN** 通道拒絕執行並回報失敗，不呼叫 CLI

#### Scenario: CLI 執行失敗

- **WHEN** 更新時 CLI 結束代碼非 0
- **THEN** 通道回報失敗並附 CLI 的錯誤訊息，不拋出例外

#### Scenario: 警告文字的取法

- **WHEN** 更新成功，CLI 輸出中有以 `⚠` 開頭的行
- **THEN** 通道只回傳這些行作為警告文字，其他輸出不列入

#### Scenario: 輸出被截斷

- **WHEN** CLI 結束代碼為 0，但輸出超過上限被截斷
- **THEN** 通道回報失敗，訊息為 `Update output was truncated.`

#### Scenario: 逾時上限

- **WHEN** 更新執行超過 15 秒仍未結束
- **THEN** 通道停止等待並回報失敗

#### Scenario: 路徑寫法不同

- **WHEN** 以清單內專案路徑的另一種寫法呼叫更新（例如結尾多一個 `/`）
- **THEN** 網頁形態將路徑整理後視為同一專案並更新該專案；桌面形態要求與清單上的路徑完全相同，否則拒絕。兩者都只會對清單內的專案執行更新
