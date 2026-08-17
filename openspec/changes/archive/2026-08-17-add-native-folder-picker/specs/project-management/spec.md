## MODIFIED Requirements

### Requirement: 加入專案
系統 SHALL 以作業系統原生資料夾選擇 dialog 作為加入專案的唯一入口（能力由伺服端依其執行平台判定並回報，前端 MUST NOT 寫死），且 MUST NOT 提供手打或貼上路徑的替代輸入。使用者選定資料夾後 SHALL 驗證該路徑為既存資料夾且含 `openspec/` 目錄，驗證失敗 SHALL 以 toast 明確提示且不加入清單；加入成功 SHALL 立即切換至該專案，並進入該專案的 Changes 主頁（主區若在 Specs 等其他頁則回到 Changes 頁）。以 canonical 路徑比對已存在於清單的專案時，系統 MUST NOT 重複加入，SHALL 以 toast 提示已存在並直接切換過去。

使用者取消選擇 SHALL 不產生任何變化與提示。執行環境不具備原生選資料夾能力（如伺服端平台不支援）或 dialog 開啟失敗時，SHALL 以 toast 說明無法開啟選擇器，清單不變。

各處的加入入口（側欄與各頁空狀態）SHALL 走同一套流程，行為一致。

#### Scenario: 以 dialog 加入
- **WHEN** 使用者點擊加入專案入口並在 dialog 中選定一個含 `openspec/` 目錄的資料夾
- **THEN** 該專案出現在清單中並成為目前專案，主區顯示其 change 清單

#### Scenario: dialog 中取消
- **WHEN** 使用者點擊加入專案入口開啟 dialog 後取消選擇
- **THEN** 清單與目前專案不變，介面不顯示任何錯誤與任何輸入欄位

#### Scenario: dialog 選到無效資料夾
- **WHEN** 使用者在 dialog 中選定一個不含 `openspec/` 目錄的資料夾
- **THEN** 以 toast 顯示明確的驗證失敗提示，清單不變

#### Scenario: 重複加入
- **WHEN** 使用者選定的資料夾（canonical 化後）已在清單中
- **THEN** 不新增項目，以 toast 提示已存在並切換至該專案

#### Scenario: 不具能力或開啟失敗
- **WHEN** 執行環境不具備原生選資料夾能力，或回報具備能力但 dialog 實際開啟失敗
- **THEN** 以 toast 說明無法開啟選擇器，清單不變，介面不出現任何路徑輸入欄位

#### Scenario: 空狀態的加入入口
- **WHEN** 清單為空、使用者點擊主區空狀態的加入專案按鈕
- **THEN** 開啟同一個原生 dialog，後續行為與側欄入口完全相同

#### Scenario: 在 Specs 頁加入專案
- **WHEN** 主區在 Specs 頁，使用者加入並切換至另一個專案
- **THEN** 主區顯示新專案的 Changes 主頁，不停留在 Specs 頁顯示前一個專案的 spec 清單
