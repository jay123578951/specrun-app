## MODIFIED Requirements

### Requirement: 側欄靜態殼
側欄 SHALL 呈現四段結構（Logo＋App 名／專案清單／Specs 與 Archived 入口／Settings）；專案清單段 SHALL 為可互動的多專案清單，其行為（列項、切換、加入、移除、徽章）由 project-management capability 規範。Specs 與 Archived 項 SHALL 可互動：點擊將主區切換至對應頁（頁內容分別由 specs-view 與 archived-view capability 規範），且主區為該頁時對應項 SHALL 高亮標示當前頁；主區為 Changes 頁時 nav 段 MUST NOT 有高亮項（以專案清單段的目前專案標記兼任位置指示），nav 段 MUST NOT 另設 Changes 項。Archived 項的文字 SHALL 為「Archived」（MUST NOT 沿用「Archive」）。Settings 項 MUST NOT 具備功能（點擊無反應），且 MUST NOT 以灰化樣式呈現。

#### Scenario: 專案徽章
- **WHEN** 目前專案有 3 個進行中 change
- **THEN** 側欄清單中目前專案項的徽章顯示 3（多專案徽章行為詳見 project-management）

#### Scenario: 切至 Specs 頁
- **WHEN** 使用者在 Changes 頁點擊側欄 Specs 項
- **THEN** 主區切換為 Specs 頁，Specs 項高亮

#### Scenario: 切至 Archived 頁
- **WHEN** 使用者在 Changes 頁點擊側欄 Archived 項
- **THEN** 主區切換為 Archived 頁，Archived 項高亮

#### Scenario: 死項點擊
- **WHEN** 使用者點擊 Settings
- **THEN** 無任何反應（無導航、無錯誤）
