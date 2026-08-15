## MODIFIED Requirements

### Requirement: change 卡片內容
主區 SHALL 以卡片列出每個進行中 change，每張卡片 SHALL 含：change 名稱、任務進度條與 n/m 數字、相對時間（active 卡片為最後修改；parked 卡片為 park 時點，如「parked 3w ago」）。UI 文案 SHALL 一律使用英文。

#### Scenario: 進行中 change 的卡片
- **WHEN** 某 change 有 2/4 個任務完成
- **THEN** 卡片顯示 change 名稱、約半滿的進度條、「2/4」與相對時間

#### Scenario: 無任務的 change
- **WHEN** 某 change 的 totalTasks 為 0（status `no-tasks`）
- **THEN** 卡片顯示空進度軌與「No tasks」文字，不顯示 n/m 數字

#### Scenario: 已完成的 change
- **WHEN** 某 change 全部任務完成（status `complete`）
- **THEN** 卡片以可辨識的完成狀態呈現（進度條滿且採完成語意色）

#### Scenario: parked 卡片的時間欄位
- **WHEN** 某 change 於三週前被 park
- **THEN** 該卡片時間欄位顯示 park 相對時間（如「parked 3w ago」），而非檔案最後修改時間

### Requirement: 群組與排序
清單 SHALL 分為「Active」與「Parked」兩群組同頁呈現，各群組標題含數量；Active 卡片順序 SHALL 為資料來源回傳的順序（lastModified 新→舊），前端不重排；Parked 卡片 SHALL 依 park 時間新→舊排序。無 parked change 時 Parked 群組 SHALL 整段隱藏（不顯示空群組標題）。

#### Scenario: 群組標題數量
- **WHEN** 有 3 個進行中 change 與 2 個 parked change
- **THEN** 群組標題分別顯示「Active (3)」與「Parked (2)」

#### Scenario: 無 parked 時隱藏群組
- **WHEN** 專案沒有任何 parked change
- **THEN** 主區僅顯示 Active 群組，無 Parked 標題或空區塊

## REMOVED Requirements

### Requirement: 卡片點擊開啟詳情
**Reason**: hover 行為自「僅視覺回饋、禁止動作按鈕」反轉為浮現 Park/Restore 動作按鈕，requirement 整體重寫。
**Migration**: 由本 change 新增的「卡片點擊與 hover 動作」requirement 取代。

## ADDED Requirements

### Requirement: 卡片點擊與 hover 動作
卡片 SHALL 可點擊，點擊後開啟該 change 的詳情檢視（收合變形，行為見 `artifact-view`；parked 卡片開啟唯讀詳情，行為見 `park-mechanism`）。hover 時卡片 SHALL 呈現視覺抬升並浮現動作按鈕：active 卡片為 Park、parked 卡片為 Restore；複製名稱與刪除動作仍為後續里程碑範圍，MUST NOT 出現。動作按鈕點擊 MUST NOT 觸發卡片的開啟詳情行為。

#### Scenario: 點擊卡片
- **WHEN** 使用者點擊某張卡片
- **THEN** 主區變形為該 change 的詳情檢視

#### Scenario: hover 浮現動作
- **WHEN** 使用者 hover active 卡片
- **THEN** 卡片視覺抬升並浮現 Park 動作按鈕，無複製或刪除按鈕

#### Scenario: 動作點擊不開詳情
- **WHEN** 使用者點擊卡片上的 Park／Restore 按鈕
- **THEN** 執行對應操作，詳情檢視不開啟
