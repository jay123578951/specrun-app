# Spec Delta

## MODIFIED Requirements

### Requirement: 側欄結構
側欄 SHALL 呈現三段結構（品牌記號＋App 名／專案清單／Settings）；品牌記號段 SHALL 呈現品牌記號與 wordmark，記號的組成、動態與不可互動性由 brand-mark capability 規範。專案清單段 SHALL 為可互動的多專案清單，其行為（列項、切換、加入、移除、徽章）由 project-management capability 規範。側欄 MUST NOT 設置任何頁入口項（Changes／Specs／Archived／Roadmap）——各頁之間的切換由 page-navigation capability 的麵包屑承擔，因此側欄 MUST NOT 出現任何當前頁高亮；專案清單段的目前專案標記僅表示「目前是哪個專案」，MUST NOT 兼作頁位置指示。Settings 項 SHALL 可互動：點擊開啟 Settings 覆蓋層（其行為由 app-settings capability 規範）；Settings 是覆蓋層而非頁，因此 Settings 項 MUST NOT 具備當前頁高亮，開啟 Settings 亦 MUST NOT 改變主區當前頁。

#### Scenario: 品牌記號段
- **WHEN** 側欄呈現
- **THEN** 最上方一列為品牌記號與 wordmark "specrun"，該列無任何可互動項（記號行為詳見 brand-mark）

#### Scenario: 專案徽章
- **WHEN** 目前專案有 3 個進行中 change
- **THEN** 側欄清單中目前專案項的徽章顯示 3（多專案徽章行為詳見 project-management）

#### Scenario: 側欄無頁入口
- **WHEN** 主區在 Roadmap 頁
- **THEN** 側欄不存在 Specs、Archived 或 Roadmap 項，且側欄無任何項呈現當前頁高亮

#### Scenario: 開啟 Settings
- **WHEN** 使用者點擊側欄 Settings 項
- **THEN** Settings 覆蓋層開啟，主區維持在原本的頁

#### Scenario: Settings 不改變當前頁
- **WHEN** 使用者在 Specs 頁開啟 Settings
- **THEN** 主區仍在 Specs 頁，Settings 項 MUST NOT 出現當前頁高亮
