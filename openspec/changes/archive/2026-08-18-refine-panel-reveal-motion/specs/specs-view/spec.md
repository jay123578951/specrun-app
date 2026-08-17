## MODIFIED Requirements

### Requirement: spec 詳情 slideover
點擊清單列 SHALL 以 slideover 覆蓋面板開啟該 spec 的原始 Markdown 全文，唯讀渲染規範沿用 artifact-view 的「Markdown 唯讀渲染」；面板 SHALL 無 artifact tabs；面板 header SHALL 含收合鈕與手動 Refresh。面板開啟期間左側露出區的清單列 SHALL 可點擊切換 spec，當前開啟列 SHALL 高亮，再次點擊當前列 SHALL 收合面板。面板的進出場與原地換內容動效 SHALL 沿用 artifact-view 的「詳情滑出面板」與「覆蓋檢視下的清單切換」規範，MUST NOT 自成一套值。

#### Scenario: 開啟詳情
- **WHEN** 使用者點擊某 spec 列
- **THEN** slideover 面板滑入並渲染該 spec 的 Markdown 全文，該列高亮

#### Scenario: 動效與 change 詳情一致
- **WHEN** 使用者開啟、收合面板，或於面板開啟中切換至另一個 spec
- **THEN** 過場的位移與時長與 change 詳情面板一致

#### Scenario: 露出區切換
- **WHEN** 面板開啟中，使用者點擊露出區的另一列
- **THEN** 面板內容原地切換為該 spec，清單不移位

#### Scenario: 再點收合
- **WHEN** 面板開啟中，使用者再次點擊當前開啟的列
- **THEN** 面板收合，回到全寬清單
