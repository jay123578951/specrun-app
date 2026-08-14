## REMOVED Requirements

### Requirement: 卡片為純展示
**Reason**: C2 起卡片成為詳情檢視的入口，「純展示」約束不再成立；點擊行為由新要求「卡片點擊開啟詳情」定義。
**Migration**: 點擊行為見本 delta 的 ADDED 要求；詳情檢視本體見 `artifact-view` capability。hover 動作（Park／複製／刪除）仍未開放，維持不做。

## ADDED Requirements

### Requirement: 卡片點擊開啟詳情
卡片 SHALL 可點擊，點擊後開啟該 change 的詳情檢視（收合變形，行為見 `artifact-view`）；卡片 MUST NOT 提供 hover 動作（Park／複製／刪除為後續里程碑範圍），hover SHALL 僅有視覺抬升回饋。

#### Scenario: 點擊卡片
- **WHEN** 使用者點擊某張卡片
- **THEN** 主區變形為該 change 的詳情檢視

#### Scenario: hover 僅視覺回饋
- **WHEN** 使用者 hover 卡片
- **THEN** 卡片僅呈現視覺抬升，不浮現任何動作按鈕
