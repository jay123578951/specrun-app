# Spec Delta

## MODIFIED Requirements

### Requirement: 錯誤分類
系統 SHALL 將取得清單的失敗情形分為四類並以可區分的型別對外回報：(1) CLI 不可用（找不到執行檔）；(2) 目標路徑不是 openspec 專案；(3) 呼叫或解析失敗（spawn 錯誤、非預期輸出、JSON 解析失敗）；(4) CLI 版本過舊（執行檔可以執行，但版本低於該讀取路所需的最低版本）。

執行通道回報的逾時與輸出截斷 SHALL 歸入第三類。此二者在部分執行形態下是帶旗標的正常回傳而非例外，系統 MUST NOT 因其形式上成功而略過分類，也 MUST NOT 以被截斷的輸出解析出結果。CLI 程序被外部終止（既無結束代碼，亦非逾時或截斷）SHALL 同樣歸入第三類。

五條讀取路——change 清單、change 詳情、spec 清單、spec 全文、archived 清單——SHALL 套用同一套分類，同一種失敗在任何一條路上 SHALL 得到同一類結果；目標路徑不可用（不存在、不是資料夾、授權失敗）在五條路上 SHALL 皆歸第二類。第四類目前只會出現在 archived 清單這條路，其最低版本為 1.14.0。

所有讀取路的失敗 SHALL 以回傳值表達，MUST NOT 讓例外逸出至呼叫端——通道本身出事（執行檔解析鏈失敗、外殼呼叫拋出）時 SHALL 收成第三類回報。逸出的例外會使畫面停在載入中或靜默留空，使用者因而看不到任何錯誤說明。

#### Scenario: CLI 不可用
- **WHEN** openspec 執行檔不存在或無法啟動
- **THEN** 系統回報「CLI 不可用」類錯誤

#### Scenario: 呼叫或解析失敗
- **WHEN** CLI 程序異常結束且輸出不是可解析的診斷 JSON，或 stdout 無法解析
- **THEN** 系統回報「呼叫或解析失敗」類錯誤

#### Scenario: 指令未於上限內結束
- **WHEN** CLI 呼叫超過執行通道的逾時上限而被終止
- **THEN** 系統回報「呼叫或解析失敗」類錯誤並指出未於上限內結束，MUST NOT 呈現為空清單

#### Scenario: 指令輸出被截斷
- **WHEN** CLI 的輸出超過執行通道的上限而被截斷
- **THEN** 系統回報「呼叫或解析失敗」類錯誤，MUST NOT 解析被截斷的輸出

#### Scenario: 程序被外部終止
- **WHEN** CLI 程序被外部終止，既未回報結束代碼，也未觸及逾時或輸出上限
- **THEN** 系統回報「呼叫或解析失敗」類錯誤，MUST NOT 呈現為空清單

#### Scenario: 通道本身出事不讓例外逸出
- **WHEN** 取得清單、詳情、spec 清單、spec 全文或 archived 清單時，執行通道本身拋出例外（如執行檔解析鏈失敗）
- **THEN** 該次請求回報「呼叫或解析失敗」類錯誤，畫面顯示錯誤說明，MUST NOT 停在載入中或靜默留空

#### Scenario: spec 全文的目標不可用歸第二類
- **WHEN** 目標路徑不可用（未選專案、資料夾不存在或授權失敗）時開啟一份 spec 全文
- **THEN** 系統回報「目標路徑不是 openspec 專案」類錯誤，與 change 清單、change 詳情、spec 清單、archived 清單四條路得到同一類結果

#### Scenario: archived 清單遇到舊版 CLI
- **WHEN** 目前生效的 openspec 為 1.13.2，取得 archived 清單
- **THEN** 系統回報「CLI 版本過舊」類錯誤，MUST NOT 歸入「呼叫或解析失敗」

#### Scenario: 非零結束但不是舊版的拒絕訊息
- **WHEN** CLI 以非零結束，但錯誤輸出不是舊版 CLI 拒絕新選項或新指令的訊息
- **THEN** 系統回報「呼叫或解析失敗」類錯誤，MUST NOT 歸入「CLI 版本過舊」

#### Scenario: archived 清單有一筆形狀不符
- **WHEN** archived 清單的 JSON 中有任一筆缺少目錄名、完成數或總數，或型別不對
- **THEN** 整份清單回報「呼叫或解析失敗」類錯誤，MUST NOT 略過該筆後顯示其餘筆數

#### Scenario: archived 清單的目標不是 openspec 專案
- **WHEN** 目標資料夾存在但不是 openspec 專案，取得 archived 清單
- **THEN** 系統依 CLI 回報的找不到 openspec 根目錄診斷，回報「目標路徑不是 openspec 專案」類錯誤

## ADDED Requirements

### Requirement: archived 清單以單次 CLI 呼叫取得
系統 SHALL 以單次引擎 archived 清單呼叫（`--json`）取得目標專案的 archived change，每筆含目錄名、完成數與總數。系統 MUST NOT 自行列舉 archive 目錄或解析 `tasks.md` 補充清單或進度。失敗情形 SHALL 沿用「錯誤分類」。archived 詳情與 Roadmap 的引用解析不在此限，仍直接讀取檔案。

#### Scenario: 取得清單
- **WHEN** 目標專案的 archive 目錄下有 38 個 archived change
- **THEN** 單次 CLI 呼叫回傳 38 筆，各含目錄名、完成數與總數

#### Scenario: 尚未歸檔過
- **WHEN** 目標專案沒有 archive 目錄
- **THEN** 系統回傳空清單，不回報錯誤

#### Scenario: 兩種執行形態一致
- **WHEN** 同一個專案分別以網頁形態與桌面形態取得 archived 清單
- **THEN** 兩者回傳相同的筆數與進度

### Requirement: CLI 更新檢查通道
系統 SHALL 提供以目前生效執行檔檢查 openspec 新版的通道，回傳四種結果之一：有新版（含新版號，CLI 提供時含升級指令）、已是最新版、無法檢查、版本低於 1.14。離線、registry 被停用、逾時、執行失敗與輸出無法解析 SHALL 一律歸為無法檢查。通道失敗 SHALL 以回傳值表達，MUST NOT 讓例外逸出。網頁與桌面兩種執行形態 SHALL 各自提供，結果語意相同。

#### Scenario: 有新版
- **WHEN** 目前生效的 openspec 為 1.14.1，registry 上最新為 1.15.0
- **THEN** 通道回傳有新版、新版號 1.15.0，以及 CLI 提供的升級指令（若有）

#### Scenario: 離線
- **WHEN** 檢查時連不上 registry
- **THEN** 通道回傳無法檢查，不拋出例外

#### Scenario: 舊版 CLI
- **WHEN** 目前生效的 openspec 為 1.13.2
- **THEN** 通道回傳版本低於 1.14，不回傳升級指令

#### Scenario: 回報有新版卻沒有新版號
- **WHEN** CLI 回報有新版，但沒有提供新版號
- **THEN** 通道回傳無法檢查，MUST NOT 顯示空白或猜測的版號

#### Scenario: 與目前選中的專案無關
- **WHEN** 尚未選擇任何專案，或選中的專案不是 openspec 專案
- **THEN** 通道照常以目前生效執行檔檢查，結果不受專案影響

#### Scenario: 網頁形態的後端回應失敗
- **WHEN** 網頁形態下，更新檢查的後端連不上或回應失敗狀態
- **THEN** 通道回傳無法檢查，不拋出例外
