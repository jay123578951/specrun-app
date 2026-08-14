## ADDED Requirements

### Requirement: 變動時自動重載當前詳情
詳情開啟期間收到 gateway 變動通知，系統 SHALL 重新取得當前 change 的詳情。重取結果 SHALL 沿用既有靜默更新語意：內容有差異才換上並保留捲動位置，無差異 MUST NOT 重繪。自動重取失敗 SHALL 完全靜默——MUST NOT 顯示任何提示（含小型非阻斷提示），既有內容保留，由下一次通知或手動 refresh 自然重試。通知 MUST NOT 觸發對未開啟 change 的詳情請求；未開啟 change 的快取過期交由下次點開時的既有重取處理。

#### Scenario: 檢視中內容被外部修改
- **WHEN** 使用者正在閱讀某 artifact，外部工具修改了該檔案
- **THEN** 內容於短暫延遲後靜默更新為最新版本，捲動位置保留

#### Scenario: 無差異不重繪
- **WHEN** 通知觸發詳情重取，但該 change 內容未變（變動發生在其他 change）
- **THEN** 內容面板無任何可見變化，無重繪造成的閃爍

#### Scenario: 自動重取失敗靜默
- **WHEN** 通知觸發的詳情重取因寫檔瞬間的暫態失敗
- **THEN** 無任何提示出現，既有內容維持顯示

#### Scenario: 不對未開啟 change 發出請求
- **WHEN** 詳情開啟於 change A 時收到變動通知
- **THEN** 系統僅重取清單與 A 的詳情，不對其他 change 發出詳情請求

### Requirement: 檢視中 change 消失自動關閉
詳情開啟期間，若清單重載結果顯示當前 change 已不存在（被 archive 或刪除），詳情 SHALL 自動關閉並回到全寬清單，清單捲動位置 SHALL 依既有返回語意還原；MUST NOT 顯示錯誤提示或內容過期警告——這是正常消失，不是錯誤。

#### Scenario: 檢視中被 archive
- **WHEN** 使用者正在檢視某 change，外部執行 `openspec archive` 將其移除
- **THEN** 短暫延遲後詳情自動關閉、畫面回到全寬清單（該卡片已不在），全程無錯誤提示

## MODIFIED Requirements

### Requirement: 載入與新鮮度
每次進入詳情或切換 change，系統 SHALL 重新取得該 change 的詳情資料，MUST NOT 以快取取代重取。有快取的 change SHALL 立即顯示上次取得的內容、不等待請求完成；重取完成後內容有差異 SHALL 靜默更新並保留捲動位置，無差異 MUST NOT 重繪。詳情快取 SHALL 跨 session 持久化，持久層不可用時 SHALL 靜默降級為記憶體快取。清單載入完成後，系統 SHALL 依序背景預載各 active change 的詳情；使用者點開尚未預載的 change 時，該項 SHALL 優先取得。此預載屬掛載時載入一次的延伸；除此、進入／切換、手動刷新與變動通知觸發的自動重載（見「變動時自動重載當前詳情」）外，詳情 MUST NOT 自動重新載入。無快取可顯示時（罕見的墊底路徑），內容面板 SHALL 空著或僅顯示小型載入提示，MUST NOT 顯示 skeleton 動畫，MUST NOT 顯示前一個 change 的內容。

#### Scenario: 切換至有快取的 change
- **WHEN** 使用者自 change A 切換至已有快取的 change B
- **THEN** 內容面板立即顯示 B 上次的內容，背景重取完成後若有差異靜默更新

#### Scenario: 啟動預載後點開
- **WHEN** App 啟動、清單載入完成且預載已抓齊，使用者首次點開某 change
- **THEN** 內容面板立即顯示內容，無任何讀取動畫

#### Scenario: 重開 App 後點開
- **WHEN** 使用者重開 App 後點開上一個 session 看過的 change（背景重取尚未完成）
- **THEN** 內容面板立即顯示上次 session 的內容，重取完成後若有差異靜默更新

#### Scenario: 墊底路徑（無快取可顯示）
- **WHEN** 使用者點開一個全新 change，預載尚未排到且無任何快取
- **THEN** 內容面板空著或顯示小型載入提示（該項插隊優先取得），不顯示 skeleton 動畫，也不顯示前一 change 的內容

#### Scenario: 外部改動後重新點開
- **WHEN** 外部工具修改了某 artifact 檔案後，使用者重新點開該 change
- **THEN** 內容面板先顯示上次內容，重取完成後靜默更新為修改後的最新內容
