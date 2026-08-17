# archived-view Specification

## Purpose

Archived 頁：以清單呈現目標專案的 archived change（名稱、歸檔日期、任務進度），並以唯讀 slideover 詳情回顧單一 archived change 的各 artifact 與 delta spec，涵蓋載入、空、錯誤狀態與鍵盤行為。

## Requirements

### Requirement: Archived 清單
主區切至 Archived 頁時 SHALL 列出目標專案 `openspec/changes/archive/` 下的所有 archived change；資料 SHALL 來自檔案層直讀（目錄列舉＋現場解析），MUST NOT 依賴 openspec CLI（CLI 不認識 archived change）。每張卡片 SHALL 顯示：change 名稱（目錄名去除 `YYYY-MM-DD-` 日期前綴）、archived 日期（由該前綴解析；解析不到則不顯示日期，MUST NOT 顯示佔位文字）、tasks 進度（現場解析 `tasks.md` 的勾選數／總數；無 tasks.md 或無任務行則不顯示進度）。全完成的進度 SHALL 淡化呈現，未全完成的進度 SHALL 醒目呈現（歸檔時未完成是值得一眼看到的異常訊號）。UI 文案 SHALL 一律使用英文。

#### Scenario: 列表顯示
- **WHEN** archive 目錄下有 10 個 archived change 目錄
- **THEN** Archived 頁列出 10 張卡片，各卡顯示去前綴名稱、日期與任務進度

#### Scenario: 未完成即醒目
- **WHEN** 某 archived change 的 tasks.md 為 7/9 完成
- **THEN** 該卡進度以醒目樣式呈現，與全完成卡片有可辨識的視覺差異

#### Scenario: 目錄名無日期前綴
- **WHEN** 某 archived change 目錄名不含 `YYYY-MM-DD-` 前綴
- **THEN** 卡片顯示完整目錄名為名稱、不顯示日期，清單仍正常呈現

#### Scenario: 載入中
- **WHEN** Archived 頁首次載入尚未取得資料
- **THEN** 顯示載入佔位（skeleton），不顯示空狀態文案

### Requirement: 清單排序
清單 SHALL 依 archived 日期新→舊排序；同日期依名稱字母序；無法解析日期者排在最後（依名稱字母序）。UI MUST NOT 提供排序切換。

#### Scenario: 混合排序
- **WHEN** 清單含兩筆同日、一筆較舊、一筆無日期前綴的 archived change
- **THEN** 順序為：同日兩筆（名稱字母序）→ 較舊一筆 → 無日期一筆

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

### Requirement: 鍵盤行為
面板開啟期間 SHALL 支援 ↑↓ 鍵切換相鄰 archived change 與 Esc 收合面板，行為語意與 change 詳情的覆蓋檢視一致；面板未開啟時鍵盤 MUST NOT 搶任何行為。

#### Scenario: 方向鍵切換
- **WHEN** 面板開啟中，使用者按 ↓
- **THEN** 面板切換至清單中的下一個 archived change，該卡高亮並帶進視野

#### Scenario: Esc 收合
- **WHEN** 面板開啟中，使用者按 Esc
- **THEN** 面板收合

### Requirement: 切頁即關與重新載入
自 Archived 頁切至其他頁（或切換專案）時 SHALL 關閉開啟中的詳情面板且不保留開啟狀態；每次進入 Archived 頁 SHALL 重新載入清單資料，系統 MUST NOT 為 Archived 頁擴充檔案變動監看。

#### Scenario: 切頁關閉
- **WHEN** Archived 頁面板開啟中，使用者切至 Changes 頁再切回 Archived 頁
- **THEN** 回到 Archived 頁時為全寬清單（面板未開啟），清單資料重新載入

### Requirement: 空與錯誤狀態
目標專案無 archive 目錄或其下無任何 archived change 時 SHALL 顯示空狀態文案；無目標專案、非 openspec 專案、讀取失敗各情境 SHALL 分層呈現，語意與 Specs 頁的分層一致，MUST NOT 靜默留白。讀取失敗 SHALL 可手動重試。

#### Scenario: 空狀態
- **WHEN** 目標專案的 `openspec/changes/archive/` 不存在或為空
- **THEN** Archived 頁顯示空狀態文案，不顯示錯誤

#### Scenario: 讀取失敗
- **WHEN** 清單讀取因檔案系統錯誤未完成
- **THEN** Archived 頁顯示錯誤狀態與訊息，可手動重試

#### Scenario: 單一 change 讀取失敗不拖垮清單
- **WHEN** 清單中某個 archived change 的 tasks.md 讀取失敗
- **THEN** 該卡仍顯示名稱與日期（不顯示進度），其他卡片正常
