# Spec Delta

## ADDED Requirements

### Requirement: 時間欄位隨時間更新
App 開著且資料沒有變動時，active 與 parked 卡片的時間欄位 SHALL 仍隨時間更新：從時間流逝到欄位反映新寫法，延遲 SHALL 不超過一分鐘。視窗從看不見變回看得見時，時間欄位 SHALL 立即依當下時刻重算，MUST NOT 等到下一次例行更新。時間欄位的格式規則（見「change 卡片內容」）、時間來源與清單排序 MUST NOT 因本需求而改變。

#### Scenario: 開著不動跨過午夜
- **WHEN** 某 active 卡片於今日 18:38 顯示「18:38」，App 一直開著、該 change 無任何變動，時間來到隔日 00:01
- **THEN** 一分鐘內該欄位改為相對寫法（如「5h ago」），MUST NOT 繼續顯示「18:38」

#### Scenario: parked 卡片天數自己往上跳
- **WHEN** 某 parked 卡片顯示「parked 11d ago」，App 一直開著、未按 Refresh，經過的時間滿 12 天
- **THEN** 一分鐘內該欄位改為「parked 12d ago」

#### Scenario: 跨日後的分鐘數持續更新
- **WHEN** 某卡片時刻為前一日 23:58，當下為 00:01，欄位顯示「3m ago」，App 開著不動
- **THEN** 每過一分鐘，欄位的分鐘數隨之增加

#### Scenario: 視窗切回來立即重算
- **WHEN** App 視窗被隱藏或電腦睡眠期間跨過午夜，使用者之後讓視窗重新可見
- **THEN** 視窗可見的當下，時間欄位即依當下時刻顯示，不等待下一次例行更新
