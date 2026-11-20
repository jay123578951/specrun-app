# Spec Delta

## MODIFIED Requirements

### Requirement: 專案流程檔版本讀取通道

系統 SHALL 提供讀取各專案流程檔版本的通道。版本 SHALL 取自該專案 `.claude/skills/openspec-*/SKILL.md` 開頭的 `generatedBy` 值；多個檔案版本不一時 SHALL 取最舊者。`.claude/skills/openspec-*` 是資料夾或連結都 SHALL 算作流程檔。系統 MUST NOT 讀取這些檔案的其他內容，也 MUST NOT 讀取其他 AI 工具的流程檔。沒有任何流程檔時 SHALL 回報未設定；有流程檔但都查不到 `generatedBy` 時依「流程檔沒有版本號時向 CLI 詢問」處理。資料夾不存在時 SHALL 回報不存在。單一專案讀取失敗 MUST NOT 影響其他專案的結果。網頁與桌面兩種執行形態 SHALL 各自提供，結果語意相同。

#### Scenario: 版本一致

- **WHEN** 某專案 6 個 openspec skill 檔的 `generatedBy` 都是 1.13.1
- **THEN** 通道回報該專案為 1.13.1

#### Scenario: 版本不一

- **WHEN** 某專案 5 個 skill 檔為 1.14.1、1 個為 1.8.0
- **THEN** 通道回報該專案為 1.8.0

#### Scenario: 未設定

- **WHEN** 某專案沒有任何 `.claude/skills/openspec-*` 項目
- **THEN** 通道回報該專案為未設定，不呼叫 CLI

#### Scenario: 流程檔是連結

- **WHEN** 某專案的 `.claude/skills/openspec-propose` 是指向 `.agents/skills/openspec-propose` 的連結
- **THEN** 通道把它算作流程檔，不回報未設定

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

## ADDED Requirements

### Requirement: 流程檔沒有版本號時向 CLI 詢問

專案有流程檔、但都查不到 `generatedBy` 時（openspec 2.0 起的流程檔不寫版本），系統 SHALL 以目前生效的執行檔對該專案執行 `update <專案路徑> --dry-run --json`：回報有檔案要變動時為落後，沒有時為已是最新，版本為無。這個呼叫 MUST NOT 改動專案檔案。執行檔不可用、或這個呼叫沒有給出可解析的結果時，系統 SHALL 回報無比較結果，MUST NOT 讓例外逸出。讀得到任何一個 `generatedBy` 的專案 MUST NOT 執行這個呼叫。

#### Scenario: 落後

- **WHEN** 某專案的流程檔都沒有 `generatedBy`，CLI 為 2.1.1，`update <專案路徑> --dry-run --json` 回報的 `changes` 有 3 筆
- **THEN** 通道回報該專案為落後、版本為無

#### Scenario: 已是最新

- **WHEN** 某專案的流程檔都沒有 `generatedBy`，`update <專案路徑> --dry-run --json` 回報的 `changes` 是空的
- **THEN** 通道回報該專案為已是最新、版本為無

#### Scenario: 讀得到版本號就不問 CLI

- **WHEN** 某專案的流程檔讀得到 `generatedBy` 1.14.1，CLI 為 2.1.1
- **THEN** 通道回報 1.14.1、落後，不執行 `update --dry-run`

#### Scenario: CLI 答不出來

- **WHEN** 某專案的流程檔都沒有 `generatedBy`，而 `update --dry-run --json` 結束代碼非 0（例如 CLI 1.14.1 不認得 `--dry-run`）、輸出無法解析、或執行失敗
- **THEN** 通道回報該專案無比較結果、版本為無，其他專案照常

#### Scenario: CLI 不可用

- **WHEN** 某專案的流程檔都沒有 `generatedBy`，目前沒有可用的執行檔
- **THEN** 通道回報該專案無比較結果，不嘗試執行
