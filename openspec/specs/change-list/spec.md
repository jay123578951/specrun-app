# change-list Specification

## Purpose

App 的主畫面：以卡片清單呈現目標專案的進行中 change 與任務進度，涵蓋載入、刷新、錯誤與空狀態行為，以及側欄外殼。

## Requirements

### Requirement: change 卡片內容
主區 SHALL 以卡片列出每個進行中 change，每張卡片 SHALL 含：change 名稱、任務進度條與 n/m 數字、相對時間（最後修改）。UI 文案 SHALL 一律使用英文。

#### Scenario: 進行中 change 的卡片
- **WHEN** 某 change 有 2/4 個任務完成
- **THEN** 卡片顯示 change 名稱、約半滿的進度條、「2/4」與相對時間

#### Scenario: 無任務的 change
- **WHEN** 某 change 的 totalTasks 為 0（status `no-tasks`）
- **THEN** 卡片顯示空進度軌與「No tasks」文字，不顯示 n/m 數字

#### Scenario: 已完成的 change
- **WHEN** 某 change 全部任務完成（status `complete`）
- **THEN** 卡片以可辨識的完成狀態呈現（進度條滿且採完成語意色）

### Requirement: 群組與排序
清單 SHALL 置於「Active」群組下，群組標題含數量；卡片順序 SHALL 為資料來源回傳的順序（lastModified 新→舊），前端不重排。

#### Scenario: 群組標題數量
- **WHEN** 有 3 個進行中 change
- **THEN** 群組標題顯示「Active (3)」

### Requirement: 卡片點擊開啟詳情
卡片 SHALL 可點擊，點擊後開啟該 change 的詳情檢視（收合變形，行為見 `artifact-view`）；卡片 MUST NOT 提供 hover 動作（Park／複製／刪除為後續里程碑範圍），hover SHALL 僅有視覺抬升回饋。

#### Scenario: 點擊卡片
- **WHEN** 使用者點擊某張卡片
- **THEN** 主區變形為該 change 的詳情檢視

#### Scenario: hover 僅視覺回饋
- **WHEN** 使用者 hover 卡片
- **THEN** 卡片僅呈現視覺抬升，不浮現任何動作按鈕

### Requirement: 首次載入顯示 skeleton
清單資料首次載入期間，主區 SHALL 顯示與真實卡片同尺寸的 skeleton 卡片（2–3 張），資料到達後替換為真實卡片且無版面跳動。

#### Scenario: 載入空窗
- **WHEN** 清單資料尚未回傳（CLI spawn 進行中）
- **THEN** 主區顯示 skeleton 卡片而非空白或 spinner

### Requirement: 手動刷新
主區 SHALL 提供手動 refresh 控制；刷新期間 SHALL 保留既有清單內容、僅於控制項上顯示進行中狀態，MUST NOT 清空清單或改回 skeleton。除掛載時載入一次、手動刷新與變動通知觸發的自動重載（見「變動時自動重載」）外，系統 MUST NOT 自動重新載入。

#### Scenario: 刷新期間保留舊資料
- **WHEN** 使用者觸發 refresh 且新資料尚未回傳
- **THEN** 畫面持續顯示原有卡片，refresh 控制項呈現進行中狀態

### Requirement: 變動時自動重載
收到 gateway 變動通知後，清單 SHALL 自動重新載入。重載期間與完成後 SHALL 保留既有卡片內容——MUST NOT 清空清單、顯示 skeleton 或造成版面跳動，資料有差異時原地更新。自動重載失敗 SHALL 完全靜默：MUST NOT 顯示 toast、banner 或錯誤畫面，既有卡片保留，由下一次通知或手動 refresh 自然重試。

#### Scenario: 外部新增 change
- **WHEN** 外部工具於 `openspec/changes/` 建立新的 change
- **THEN** 清單於短暫延遲後自動出現該卡片，畫面其餘部分不變

#### Scenario: 外部更新任務進度
- **WHEN** 外部工具勾選某 change 的 tasks.md 項目
- **THEN** 該卡片的進度條與 n/m 數字於短暫延遲後自動更新

#### Scenario: 自動重載失敗靜默
- **WHEN** 通知觸發的清單重載因 spawn 或解析失敗
- **THEN** 無任何錯誤提示出現，既有卡片維持顯示

### Requirement: 錯誤呈現分層
錯誤呈現 SHALL 對應 gateway 的三類錯誤：CLI 不可用 → 主區常駐 banner；目標路徑不是 openspec 專案 → 主區明確提示（與「沒有 change」的空狀態可區分）；呼叫或解析失敗 → 自動消失的 toast（保留既有清單內容）。呼叫或解析失敗發生在首次載入、沒有既有清單可保留時，主區 SHALL 於卡片區另外顯示可重試的提示；四種提示（CLI 不可用／非 openspec 專案／載入失敗／無 change 空狀態）的文案 SHALL 互相可區分。本需求的失敗提示適用於掛載首次載入與手動刷新；變動通知觸發的自動重載失敗 SHALL 依「變動時自動重載」完全靜默。

#### Scenario: CLI 不可用
- **WHEN** gateway 回報 CLI 不可用
- **THEN** 主區顯示常駐 banner 說明問題

#### Scenario: 路徑不是 openspec 專案
- **WHEN** gateway 回報目標路徑不是 openspec 專案
- **THEN** 主區顯示明確提示，且其文案與「專案內無 change」的空狀態不同

#### Scenario: 暫時性失敗
- **WHEN** 已有清單顯示中且一次手動 refresh 因 spawn 或解析失敗
- **THEN** 顯示自動消失的 toast，既有卡片不消失

#### Scenario: 首次載入即失敗
- **WHEN** 首次載入因 spawn 或解析失敗，畫面沒有任何既有清單可保留
- **THEN** 卡片區顯示可重試的提示（文案與空狀態、非 openspec 專案提示均不同），toast 仍照暫時性失敗規則出現

### Requirement: 空狀態
目標專案為有效 openspec 專案但無進行中 change 時，主區 SHALL 顯示空狀態文案。

#### Scenario: 無進行中 change
- **WHEN** 清單回傳 0 筆且無錯誤
- **THEN** 主區顯示空狀態文案（英文），不顯示 skeleton 或錯誤

### Requirement: 側欄靜態殼
側欄 SHALL 呈現四段結構（Logo＋App 名／專案清單／Specs 與 Archive 入口／Settings）；專案清單段 SHALL 為可互動的多專案清單，其行為（列項、切換、加入、移除、徽章）由 project-management capability 規範；Specs／Archive／Settings 各項 MUST NOT 具備功能（點擊無反應），且 MUST NOT 以灰化樣式呈現。

#### Scenario: 專案徽章
- **WHEN** 目前專案有 3 個進行中 change
- **THEN** 側欄清單中目前專案項的徽章顯示 3（多專案徽章行為詳見 project-management）

#### Scenario: 死項點擊
- **WHEN** 使用者點擊 Specs／Archive／Settings
- **THEN** 無任何反應（無導航、無錯誤）
