## ADDED Requirements

### Requirement: 側欄結構
側欄 SHALL 呈現三段結構（Logo＋App 名／專案清單／Settings）；專案清單段 SHALL 為可互動的多專案清單，其行為（列項、切換、加入、移除、徽章）由 project-management capability 規範。側欄 MUST NOT 設置任何頁入口項（Changes／Specs／Archived）——三頁之間的切換由 page-navigation capability 的麵包屑承擔，因此側欄 MUST NOT 出現任何當前頁高亮；專案清單段的目前專案標記僅表示「目前是哪個專案」，MUST NOT 兼作頁位置指示。Settings 項 SHALL 可互動：點擊開啟 Settings 覆蓋層（其行為由 app-settings capability 規範）；Settings 是覆蓋層而非頁，因此 Settings 項 MUST NOT 具備當前頁高亮，開啟 Settings 亦 MUST NOT 改變主區當前頁。

#### Scenario: 專案徽章
- **WHEN** 目前專案有 3 個進行中 change
- **THEN** 側欄清單中目前專案項的徽章顯示 3（多專案徽章行為詳見 project-management）

#### Scenario: 側欄無頁入口
- **WHEN** 主區在 Specs 頁
- **THEN** 側欄不存在 Specs 或 Archived 項，且側欄無任何項呈現當前頁高亮

#### Scenario: 開啟 Settings
- **WHEN** 使用者點擊側欄 Settings 項
- **THEN** Settings 覆蓋層開啟，主區維持在原本的頁

#### Scenario: Settings 不改變當前頁
- **WHEN** 使用者在 Specs 頁開啟 Settings
- **THEN** 主區仍在 Specs 頁，Settings 項 MUST NOT 出現當前頁高亮

## REMOVED Requirements

### Requirement: 側欄結構與入口
**Reason**: 側欄的頁入口整段移除——Specs 與 Archived 在資料層是目前專案的產物，放在專案清單段之外會讀成跨專案共用的全域入口。頁切換改由 page-navigation capability 的麵包屑承擔，側欄自此只管專案與全域設定，因此原requirement 中「四段結構」「Specs／Archived 入口與其當前頁高亮」「Changes 不另設 nav 項、由專案清單標記兼任位置指示」等條款全部失效。

**Migration**: 由本 capability 的「側欄結構」requirement 取代側欄側的規範（三段結構、無頁入口、Settings 覆蓋層語意原樣保留）；原本經由側欄進入 Specs／Archived 的路徑，改由 page-navigation capability 的「頁切換下拉」requirement 提供。
