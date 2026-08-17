# project-management Delta

## MODIFIED Requirements

### Requirement: 加入專案
系統 SHALL 提供以本機資料夾路徑加入專案的入口。加入時 SHALL 驗證該路徑為既存資料夾且含 `openspec/` 目錄，驗證失敗 SHALL 明確提示且不加入清單；加入成功 SHALL 立即切換至該專案，並進入該專案的 Changes 主頁（主區若在 Specs 等其他頁則回到 Changes 頁）。以 canonical 路徑比對已存在於清單的專案時，系統 MUST NOT 重複加入，SHALL 提示已存在並直接切換過去。

#### Scenario: 加入有效專案
- **WHEN** 使用者輸入一個含 `openspec/` 目錄的資料夾路徑並確認加入
- **THEN** 該專案出現在清單中並成為目前專案，主區顯示其 change 清單

#### Scenario: 路徑無效
- **WHEN** 使用者輸入不存在的路徑或不含 `openspec/` 的資料夾
- **THEN** 顯示明確的驗證失敗提示，清單不變

#### Scenario: 重複加入
- **WHEN** 使用者輸入的路徑（canonical 化後）已在清單中
- **THEN** 不新增項目，提示已存在並切換至該專案

#### Scenario: 在 Specs 頁加入專案
- **WHEN** 主區在 Specs 頁，使用者加入並切換至另一個專案
- **THEN** 主區顯示新專案的 Changes 主頁，不停留在 Specs 頁顯示前一個專案的 spec 清單

### Requirement: 移除專案
清單項 SHALL 提供移除操作，移除前 SHALL 經確認，確認文案 SHALL 講明只將專案移出清單、不動磁碟上的任何檔案。移除目前專案時，系統 SHALL 切換至清單第一個專案，並進入該專案的 Changes 主頁（主區若在 Specs 等其他頁則回到 Changes 頁）；清單因此變空時 SHALL 進入空清單引導。

#### Scenario: 移除非目前專案
- **WHEN** 使用者對非目前專案觸發移除並確認
- **THEN** 該項自清單消失，目前專案與主區內容不變，磁碟檔案不受影響

#### Scenario: 移除目前專案
- **WHEN** 使用者移除目前專案且清單尚有其他專案
- **THEN** 系統切換至清單第一個專案並載入其資料

#### Scenario: 移除至清單全空
- **WHEN** 使用者移除清單中最後一個專案
- **THEN** 主區顯示空清單引導（引導加入專案）

#### Scenario: 在 Specs 頁移除目前專案
- **WHEN** 主區在 Specs 頁，使用者移除目前專案且清單尚有其他專案
- **THEN** 主區顯示接手專案的 Changes 主頁，不停留在 Specs 頁

### Requirement: 切換專案
點擊側欄專案清單中的專案項 SHALL 一律進入該專案的 Changes 主頁：點擊非目前專案 SHALL 切換過去，主區 SHALL 顯示新專案的 change 清單（已開啟的詳情視圖關閉、若在 Specs 等其他頁則回到 Changes 頁），資料 SHALL 全部來自新專案，切換後最後啟用專案的持久化紀錄 SHALL 更新；點擊目前專案時，若主區不在 Changes 頁 SHALL 回到 Changes 頁（已開啟的詳情視圖關閉），已在 Changes 頁則 SHALL 無任何反應。切換至路徑已失效的專案時，SHALL 以既有的「路徑不存在」錯誤語意呈現；系統 MUST NOT 以背景輪詢方式預先偵測清單中各專案的失效。

#### Scenario: 切換成功
- **WHEN** 使用者在詳情視圖開啟時點擊另一個專案
- **THEN** 詳情關閉、主區顯示新專案的 change 清單，側欄目前專案標示移至新專案

#### Scenario: 從 Specs 頁點目前專案回主頁
- **WHEN** 主區在 Specs 頁，使用者點擊側欄的目前專案
- **THEN** 主區回到 Changes 頁，專案不變

#### Scenario: 從 Specs 頁切換到另一個專案
- **WHEN** 主區在 Specs 頁，使用者點擊另一個專案
- **THEN** 主區顯示新專案的 Changes 主頁（不停留在 Specs 頁）

#### Scenario: 已在主頁點目前專案
- **WHEN** 主區在 Changes 頁，使用者點擊目前專案
- **THEN** 無任何反應（不重載、無錯誤）

#### Scenario: 切換到已失效的專案
- **WHEN** 清單中某專案的資料夾已被移走，使用者點擊它
- **THEN** 切換發生且主區以「路徑不存在」錯誤呈現，其他專案不受影響
