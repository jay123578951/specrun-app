# change-list Delta

## MODIFIED Requirements

### Requirement: 卡片點擊與 hover 動作

卡片 SHALL 可點擊，點擊後開啟該 change 的詳情檢視（右側滑出覆蓋面板，行為見 `artifact-view`；parked 卡片開啟唯讀詳情，行為見 `park-mechanism`）。面板開啟期間再次點擊當前開啟的卡片 SHALL 收合面板。hover 時卡片 SHALL 呈現視覺抬升並浮現動作按鈕：active 卡片為 Park、parked 卡片為 Restore；複製名稱與刪除動作仍為後續里程碑範圍，MUST NOT 出現。動作按鈕點擊 MUST NOT 觸發卡片的開啟或收合行為。

#### Scenario: 點擊卡片

- **WHEN** 使用者點擊某張卡片
- **THEN** 該 change 的詳情面板自右側滑入，清單維持原位

#### Scenario: 再次點擊當前卡片收合

- **WHEN** 面板開啟於 change A，使用者再次點擊 A 的卡片
- **THEN** 面板收合，畫面回到完整清單

#### Scenario: hover 浮現動作

- **WHEN** 使用者 hover active 卡片
- **THEN** 卡片視覺抬升並浮現 Park 動作按鈕，無複製或刪除按鈕

#### Scenario: 動作點擊不開詳情

- **WHEN** 使用者點擊卡片上的 Park／Restore 按鈕
- **THEN** 執行對應操作，面板不開啟也不收合
