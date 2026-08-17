# project-management Specification

## Purpose

多專案的清單管理與切換：加入／移除／切換專案、清單的持久化、路徑驗證與失效語意、每專案徽章的弱一致刷新，以及空清單的引導。

## Requirements

### Requirement: 專案清單持久化
系統 SHALL 將專案清單（各專案路徑）與最後啟用專案持久化於平台慣例的應用程式設定位置；App 重啟後清單 SHALL 完整還原。設定資料損毀或無法解析時，系統 SHALL 視為空清單重建，MUST NOT 因此無法啟動。

#### Scenario: 重啟還原
- **WHEN** 使用者加入兩個專案後重啟 App
- **THEN** 側欄專案清單仍列出該兩個專案

#### Scenario: 設定損毀
- **WHEN** 設定資料被外部改壞（無法解析）
- **THEN** App 正常啟動並呈現空清單引導，不顯示崩潰或無法操作的錯誤

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

### Requirement: 每專案徽章弱一致
清單每項 SHALL 掛徽章顯示該專案未 archive 的 change 數。徽章 SHALL 於 App 啟動時刷新一輪、並於每次切換專案時刷新；目前專案的徽章 SHALL 隨其變動通知即時更新；非目前專案的變動 MAY 延遲至下次刷新時機才反映。無法取得數字的專案（路徑失效、CLI 失敗）MUST NOT 顯示編造的數字。

#### Scenario: 啟動刷新
- **WHEN** App 啟動且清單有三個專案
- **THEN** 各項徽章顯示各自專案當下的未 archive change 數

#### Scenario: 非目前專案延遲反映
- **WHEN** 外部工具 archive 了非目前專案的一個 change
- **THEN** 該專案徽章允許暫不更新，於下次啟動或切換過去時反映新數字

#### Scenario: 取數失敗不編數字
- **WHEN** 清單中某專案路徑已失效
- **THEN** 該項不顯示數字徽章

### Requirement: 覆寫與 fallback 為暫時項
啟動時由環境變數覆寫、或由工作目錄 fallback（dogfooding）決定的目標專案若不在持久化清單中，SHALL 以暫時項形式顯示於清單，MUST NOT 自動寫入持久化清單；其後的切換操作 SHALL 照常生效。

#### Scenario: 暫時項顯示
- **WHEN** 以環境變數指定一個不在清單中的專案路徑啟動
- **THEN** 該專案顯示為目前專案，重啟（不帶環境變數）後不出現在清單中

### Requirement: 空清單引導
清單無任何專案時，主區 SHALL 顯示引導加入專案的空狀態，並提供加入入口。

#### Scenario: 首次啟動
- **WHEN** App 首次啟動且無環境變數覆寫、設定中無任何專案、伺服端工作目錄也不是 openspec 專案
- **THEN** 主區顯示引導加入專案的空狀態
