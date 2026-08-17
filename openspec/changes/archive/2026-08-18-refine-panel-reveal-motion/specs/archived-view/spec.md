## MODIFIED Requirements

### Requirement: 詳情 slideover（唯讀）
點擊卡片 SHALL 以 slideover 覆蓋面板開啟該 archived change 的詳情；tabs 集合 SHALL 為現場列舉：change 目錄頂層的 `*.md` 檔＋`specs/` 下的各 delta spec（tab 名為 `specs/<capability-path>`）；tabs 順序 SHALL 為 proposal → design → 各 delta spec（字母序）→ tasks → 其他 `*.md`（字母序），僅列實際存在的檔案。內容 SHALL 整份唯讀，Markdown 渲染規範沿用 artifact-view 的「Markdown 唯讀渲染」，tasks 的 checkbox MUST NOT 可勾選。面板 header SHALL 含收合鈕與手動 Refresh。面板開啟期間左側露出區的卡片 SHALL 可點擊切換，當前開啟卡 SHALL 高亮，再次點擊當前卡 SHALL 收合面板。面板的進出場與原地換內容動效 SHALL 沿用 artifact-view 的「詳情滑出面板」與「覆蓋檢視下的清單切換」規範，MUST NOT 自成一套值。

#### Scenario: 開啟詳情
- **WHEN** 使用者點擊某 archived change 卡片
- **THEN** slideover 面板滑入，tabs 依規定順序列出該 change 實際存在的 artifact 與 delta spec，預設顯示第一個 tab

#### Scenario: 動效與 change 詳情一致
- **WHEN** 使用者開啟、收合面板，或於面板開啟中切換至另一個 archived change
- **THEN** 過場的位移與時長與 change 詳情面板一致

#### Scenario: delta spec tab
- **WHEN** 該 archived change 的 `specs/` 下有 `change-list/spec.md`
- **THEN** tabs 含 `specs/change-list`，點擊後唯讀渲染該 delta 全文

#### Scenario: tasks 唯讀
- **WHEN** 使用者在詳情的 tasks tab 點擊任一 checkbox
- **THEN** 勾選狀態不變，無任何寫入

#### Scenario: 露出區切換
- **WHEN** 面板開啟中，使用者點擊露出區的另一張卡片
- **THEN** 面板內容原地切換為該 change，清單不移位
