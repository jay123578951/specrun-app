## ADDED Requirements

### Requirement: 側欄結構與入口
側欄 SHALL 呈現四段結構（Logo＋App 名／專案清單／Specs 與 Archived 入口／Settings）；專案清單段 SHALL 為可互動的多專案清單，其行為（列項、切換、加入、移除、徽章）由 project-management capability 規範。Specs 與 Archived 項 SHALL 可互動：點擊將主區切換至對應頁（頁內容分別由 specs-view 與 archived-view capability 規範），且主區為該頁時對應項 SHALL 高亮標示當前頁；主區為 Changes 頁時 nav 段 MUST NOT 有高亮項（以專案清單段的目前專案標記兼任位置指示），nav 段 MUST NOT 另設 Changes 項。Archived 項的文字 SHALL 為「Archived」（MUST NOT 沿用「Archive」）。Settings 項 SHALL 可互動：點擊開啟 Settings 覆蓋層（其行為由 app-settings capability 規範）；Settings 是覆蓋層而非頁，因此 Settings 項 MUST NOT 具備當前頁高亮，開啟 Settings 亦 MUST NOT 改變 nav 段既有的高亮狀態。

#### Scenario: 專案徽章
- **WHEN** 目前專案有 3 個進行中 change
- **THEN** 側欄清單中目前專案項的徽章顯示 3（多專案徽章行為詳見 project-management）

#### Scenario: 切至 Specs 頁
- **WHEN** 使用者在 Changes 頁點擊側欄 Specs 項
- **THEN** 主區切換為 Specs 頁，Specs 項高亮

#### Scenario: 切至 Archived 頁
- **WHEN** 使用者在 Changes 頁點擊側欄 Archived 項
- **THEN** 主區切換為 Archived 頁，Archived 項高亮

#### Scenario: 開啟 Settings
- **WHEN** 使用者點擊側欄 Settings 項
- **THEN** Settings 覆蓋層開啟，主區維持在原本的頁

#### Scenario: Settings 不影響 nav 高亮
- **WHEN** 使用者在 Specs 頁開啟 Settings
- **THEN** Specs 項仍為高亮，Settings 項 MUST NOT 出現當前頁高亮

## REMOVED Requirements

### Requirement: 側欄靜態殼
**Reason**: Settings 項落地為可互動入口後，「靜態殼」的前提與該需求明文的「Settings 項 MUST NOT 具備功能（點擊無反應）」條款、以及「死項點擊」scenario 均已不成立。側欄的其餘規定（四段結構、Specs／Archived 的切頁與高亮、Archived 文字、Changes 頁不高亮 nav）未變，原封移入新需求。

**Migration**: 由本 change 新增的「側欄結構與入口」需求承接。原需求的三個 scenario（專案徽章／切至 Specs 頁／切至 Archived 頁）逐字保留；「死項點擊」由「開啟 Settings」與「Settings 不影響 nav 高亮」兩個 scenario 取代。
