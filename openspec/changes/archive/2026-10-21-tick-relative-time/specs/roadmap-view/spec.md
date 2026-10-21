# Spec Delta

## ADDED Requirements

### Requirement: 更新時間隨時間更新
App 開著且規劃檔沒有變動時，清單卡片的更新時間 SHALL 比照 change 卡片時間欄位隨時間更新（見 `change-list`「時間欄位隨時間更新」）：延遲 SHALL 不超過一分鐘，視窗從看不見變回看得見時 SHALL 立即重算。滑鼠停留時提供的完整時刻不受影響。

#### Scenario: 開著不動跨過午夜
- **WHEN** 某規劃檔於今日 18:38 修改，卡片顯示「18:38」，App 停在 Roadmap 頁不動，時間來到隔日
- **THEN** 一分鐘內該卡片更新時間改為相對寫法，MUST NOT 繼續顯示「18:38」

#### Scenario: 視窗切回來立即重算
- **WHEN** App 視窗隱藏期間經過數天，使用者之後讓視窗重新可見
- **THEN** 視窗可見的當下，更新時間即依當下時刻顯示
