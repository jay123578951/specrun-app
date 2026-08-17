# specs-view Delta

## Purpose

Specs 頁：以清單呈現目標專案的所有 capability spec，並以 slideover 詳情渲染單一 spec 全文，涵蓋載入、空、錯誤狀態與鍵盤行為。

## ADDED Requirements

### Requirement: Specs 清單
主區切至 Specs 頁時 SHALL 以純列表列出目標專案的所有 capability spec，每列 SHALL 含 spec 名稱與 requirement 數；資料 SHALL 來自單次引擎清單呼叫，排序沿用引擎輸出，UI 不自行加工或排序。UI 文案 SHALL 一律使用英文。

#### Scenario: 列表顯示
- **WHEN** 目標專案有 5 個 capability spec
- **THEN** Specs 頁列出 5 列，各列顯示名稱與 requirement 數，順序與引擎輸出一致

#### Scenario: 載入中
- **WHEN** Specs 頁首次載入尚未取得資料
- **THEN** 顯示載入佔位（skeleton），不顯示空狀態文案

### Requirement: spec 詳情 slideover
點擊清單列 SHALL 以 slideover 覆蓋面板開啟該 spec 的原始 Markdown 全文，唯讀渲染規範沿用 artifact-view 的「Markdown 唯讀渲染」；面板 SHALL 無 artifact tabs；面板 header SHALL 含收合鈕與手動 Refresh。面板開啟期間左側露出區的清單列 SHALL 可點擊切換 spec，當前開啟列 SHALL 高亮，再次點擊當前列 SHALL 收合面板。

#### Scenario: 開啟詳情
- **WHEN** 使用者點擊某 spec 列
- **THEN** slideover 面板滑入並渲染該 spec 的 Markdown 全文，該列高亮

#### Scenario: 露出區切換
- **WHEN** 面板開啟中，使用者點擊露出區的另一列
- **THEN** 面板內容原地切換為該 spec，清單不移位

#### Scenario: 再點收合
- **WHEN** 面板開啟中，使用者再次點擊當前開啟的列
- **THEN** 面板收合，回到全寬清單

### Requirement: 鍵盤行為
面板開啟期間 SHALL 支援 ↑↓ 鍵切換相鄰 spec 與 Esc 收合面板，行為語意與 change 詳情的覆蓋檢視一致；面板未開啟時鍵盤 MUST NOT 搶任何行為。

#### Scenario: 方向鍵切換
- **WHEN** 面板開啟中，使用者按 ↓
- **THEN** 面板切換至清單中的下一個 spec，該列高亮並帶進視野

#### Scenario: Esc 收合
- **WHEN** 面板開啟中，使用者按 Esc
- **THEN** 面板收合

### Requirement: 切頁即關與重新載入
自 Specs 頁切至其他頁（或切換專案）時 SHALL 關閉開啟中的詳情面板且不保留開啟狀態；每次進入 Specs 頁 SHALL 重新載入清單資料，系統 MUST NOT 為 Specs 頁擴充檔案變動監看。

#### Scenario: 切頁關閉
- **WHEN** Specs 頁面板開啟中，使用者切至 Changes 頁再切回 Specs 頁
- **THEN** 回到 Specs 頁時為全寬清單（面板未開啟），清單資料重新載入

### Requirement: 空與錯誤狀態
目標專案無任何 spec 時 SHALL 顯示空狀態文案；載入失敗時 SHALL 依 gateway 錯誤分類分層呈現，語意與 change 清單的錯誤呈現一致（CLI 不可用為常駐提示、其餘為頁內錯誤狀態），MUST NOT 靜默留白。

#### Scenario: 空狀態
- **WHEN** 目標專案的 specs 目錄不存在或無任何 spec
- **THEN** Specs 頁顯示空狀態文案

#### Scenario: 載入失敗
- **WHEN** 引擎清單呼叫失敗
- **THEN** Specs 頁顯示對應錯誤狀態與訊息，可手動重試
