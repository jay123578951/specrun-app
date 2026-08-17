# change-list Delta

## MODIFIED Requirements

### Requirement: 側欄靜態殼
側欄 SHALL 呈現四段結構（Logo＋App 名／專案清單／Specs 與 Archive 入口／Settings）；專案清單段 SHALL 為可互動的多專案清單，其行為（列項、切換、加入、移除、徽章）由 project-management capability 規範。Specs 項 SHALL 可互動：點擊將主區切換至 Specs 頁（頁內容由 specs-view capability 規範），且主區為 Specs 頁時該項 SHALL 高亮標示當前頁；主區為 Changes 頁時 nav 段 MUST NOT 有高亮項（以專案清單段的目前專案標記兼任位置指示），nav 段 MUST NOT 另設 Changes 項。Archive／Settings 各項 MUST NOT 具備功能（點擊無反應），且 MUST NOT 以灰化樣式呈現。

#### Scenario: 專案徽章
- **WHEN** 目前專案有 3 個進行中 change
- **THEN** 側欄清單中目前專案項的徽章顯示 3（多專案徽章行為詳見 project-management）

#### Scenario: 切至 Specs 頁
- **WHEN** 使用者在 Changes 頁點擊側欄 Specs 項
- **THEN** 主區切換為 Specs 頁，Specs 項高亮

#### Scenario: 死項點擊
- **WHEN** 使用者點擊 Archive／Settings
- **THEN** 無任何反應（無導航、無錯誤）
