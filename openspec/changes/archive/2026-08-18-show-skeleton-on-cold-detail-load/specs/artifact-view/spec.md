## MODIFIED Requirements

### Requirement: 載入與新鮮度
每次進入詳情或切換 change，系統 SHALL 重新取得該 change 的詳情資料，MUST NOT 以快取取代重取。有快取的 change SHALL 立即顯示上次取得的內容、不等待請求完成；重取完成後內容有差異 SHALL 靜默更新並保留捲動位置，無差異 MUST NOT 重繪。詳情快取 SHALL 跨 session 持久化，持久層不可用時 SHALL 靜默降級為記憶體快取。清單載入完成後，系統 SHALL 依序背景預載各 active change 的詳情；使用者點開尚未預載的 change 時，該項 SHALL 優先取得。此預載屬掛載時載入一次的延伸；除此、進入／切換、手動刷新與變動通知觸發的自動重載（見「變動時自動重載當前詳情」）外，詳情 MUST NOT 自動重新載入。無快取可顯示時（罕見的墊底路徑），內容面板 SHALL 顯示 skeleton，其形態 SHALL 與手動刷新的 skeleton 同源（見「詳情手動刷新」），MUST NOT 以純文字提示替代，MUST NOT 顯示前一個 change 的內容。

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
- **THEN** 內容面板顯示 skeleton（該項插隊優先取得），不顯示純文字載入提示，也不顯示前一 change 的內容

#### Scenario: 墊底路徑的 skeleton 與手動刷新同形
- **WHEN** 使用者先經歷一次墊底路徑載入，再於同一面板按下 refresh
- **THEN** 兩次讀取中呈現的 skeleton 形態一致

#### Scenario: 外部改動後重新點開
- **WHEN** 外部工具修改了某 artifact 檔案後，使用者重新點開該 change
- **THEN** 內容面板先顯示上次內容，重取完成後靜默更新為修改後的最新內容

### Requirement: 詳情手動刷新
使用者觸發詳情的手動 refresh 控制時，內容面板 SHALL 清空並顯示 skeleton（數行等寬的文字行，末行較短），完成後渲染最新內容。skeleton 的行寬與行距 SHALL 對齊實際內容的閱讀欄與行高，其色階 SHALL 與所在面板背景形成可辨識的對比。刷新是「我要等新資料」的明示，內容必然被替換，SHALL 以 skeleton 回饋讀取中狀態，MUST NOT 以純文字提示替代。有快取可顯示的導航動作（開卡片／切換）不受此規範涵蓋——那條路徑立即顯示既有內容、無任何讀取回饋（見「載入與新鮮度」）。

#### Scenario: 手動刷新顯示 skeleton
- **WHEN** 使用者於詳情檢視按下 refresh 控制
- **THEN** 內容面板清空並顯示 skeleton，資料回傳後渲染最新內容
