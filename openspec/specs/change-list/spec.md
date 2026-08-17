# change-list Specification

## Purpose

App 的主畫面：以卡片清單呈現目標專案的進行中 change 與任務進度，涵蓋載入、刷新、錯誤與空狀態行為，以及側欄外殼。

## Requirements

### Requirement: change 卡片內容
主區 SHALL 以卡片列出每個進行中 change，每張卡片 SHALL 含：change 名稱、任務進度條與 n/m 數字、相對時間（active 卡片為最後修改；parked 卡片為 park 時點，如「parked 3w ago」）、以及該 change 的 Why 摘錄。UI 文案 SHALL 一律使用英文。

Why 摘錄 SHALL 取自該 change proposal 的 `## Why` 段落首句（取得規則見 `openspec-gateway`），並 SHALL 最多顯示兩行、超出部分以省略號截斷。摘錄 MUST NOT 經 LLM 或任何生成式加工。active 與 parked 卡片 SHALL 以相同方式呈現摘錄。

摘錄為空（無 proposal、無 `## Why` 段落或讀取失敗）時，卡片 MUST NOT 顯示摘錄區塊，也 MUST NOT 為其保留空白佔位——此時卡片高度較有摘錄的卡片為低，清單中卡片高度不一致 SHALL 為可接受行為。摘錄為空 MUST NOT 呈現為錯誤或缺件提示。

#### Scenario: 進行中 change 的卡片
- **WHEN** 某 change 有 2/4 個任務完成
- **THEN** 卡片顯示 change 名稱、約半滿的進度條、「2/4」與相對時間

#### Scenario: 無任務的 change
- **WHEN** 某 change 的 totalTasks 為 0（status `no-tasks`）
- **THEN** 卡片顯示空進度軌與「No tasks」文字，不顯示 n/m 數字

#### Scenario: 已完成的 change
- **WHEN** 某 change 全部任務完成（status `complete`）
- **THEN** 卡片以可辨識的完成狀態呈現（進度條滿且採完成語意色）

#### Scenario: parked 卡片的時間欄位
- **WHEN** 某 change 於三週前被 park
- **THEN** 該卡片時間欄位顯示 park 相對時間（如「parked 3w ago」），而非檔案最後修改時間

#### Scenario: 顯示 Why 摘錄
- **WHEN** 某 active change 的 proposal 含 `## Why` 段落，其首句可抽出
- **THEN** 該卡片在進度條之外另顯示該首句，最多兩行

#### Scenario: 長摘錄截斷
- **WHEN** 某 change 的 Why 首句長度超過卡片兩行可容納的字數
- **THEN** 摘錄顯示至第二行結尾並以省略號截斷，卡片高度不因該摘錄增長

#### Scenario: parked 卡片同樣顯示摘錄
- **WHEN** 某 parked change 的 proposal 含可抽出的 `## Why` 首句
- **THEN** 該卡片以與 active 卡片相同的方式顯示摘錄

#### Scenario: 無摘錄可顯示
- **WHEN** 某 change 沒有 proposal 檔案，或其 proposal 無 `## Why` 段落
- **THEN** 該卡片不顯示摘錄區塊、不顯示佔位空白、不顯示任何錯誤或缺件提示

### Requirement: 群組與排序
清單 SHALL 分為「Active」與「Parked」兩群組同頁呈現，各群組標題含數量；Active 卡片順序 SHALL 為資料來源回傳的順序（lastModified 新→舊），前端不重排；Parked 卡片 SHALL 依 park 時間新→舊排序。無 parked change 時 Parked 群組 SHALL 整段隱藏（不顯示空群組標題）。

#### Scenario: 群組標題數量
- **WHEN** 有 3 個進行中 change 與 2 個 parked change
- **THEN** 群組標題分別顯示「Active (3)」與「Parked (2)」

#### Scenario: 無 parked 時隱藏群組
- **WHEN** 專案沒有任何 parked change
- **THEN** 主區僅顯示 Active 群組，無 Parked 標題或空區塊

### Requirement: 卡片點擊與 hover 動作
卡片 SHALL 可點擊，點擊後開啟該 change 的詳情檢視（右側滑出覆蓋面板，行為見 `artifact-view`；parked 卡片開啟唯讀詳情，行為見 `park-mechanism`）。面板開啟期間再次點擊當前開啟的卡片 SHALL 收合面板。hover 時卡片 SHALL 呈現視覺抬升並浮現動作按鈕：active 卡片為 Park、parked 卡片為 Restore；複製名稱與刪除動作仍為後續里程碑範圍，MUST NOT 出現。動作按鈕點擊 MUST NOT 觸發卡片的開啟或收合行為。

#### Scenario: 點擊卡片
- **WHEN** 使用者點擊某張卡片
- **THEN** 該 change 的詳情面板自右側滑入，清單維持原位

#### Scenario: 再次點擊當前卡片收合
- **WHEN** 面板開啟於 change A，使用者再次點擊 A 的卡片
- **THEN** 面板收合，畫面回到完整清單

#### Scenario: hover 浮現動作
- **WHEN** 使用者 hover active 卡片
- **THEN** 卡片視覺抬升並浮現 Park 動作按鈕，無複製或刪除按鈕

#### Scenario: 動作點擊不開詳情
- **WHEN** 使用者點擊卡片上的 Park／Restore 按鈕
- **THEN** 執行對應操作，面板不開啟也不收合

### Requirement: 首次載入顯示 skeleton
清單資料首次載入期間，主區 SHALL 顯示 skeleton 卡片（2–3 張），其尺寸 SHALL 對應摘錄佔滿兩行的真實卡片高度。資料到達後 SHALL 替換為真實卡片；由於摘錄的有無與行數會使真實卡片高度不一（見「change 卡片內容」），替換時的版面變化 SHALL 全數源自摘錄區塊自身的高度差——卡片內各區塊 MUST NOT 改變自身尺寸，摘錄區塊之下的區塊 MAY 因該高度差整體位移，且位移量 MUST NOT 超過該高度差。

#### Scenario: 載入空窗
- **WHEN** 清單資料尚未回傳（CLI spawn 進行中）
- **THEN** 主區顯示 skeleton 卡片而非空白或 spinner

#### Scenario: skeleton 含摘錄行
- **WHEN** skeleton 卡片顯示中
- **THEN** 其高度包含兩行摘錄區塊，與摘錄佔滿兩行的真實卡片一致

#### Scenario: 摘錄不足兩行時的替換
- **WHEN** 某 change 的摘錄只佔一行，skeleton 替換為該真實卡片
- **THEN** 摘錄區塊之下的區塊整體上移一行的高度，卡片內無任何區塊改變自身尺寸、也無超出該高度差的額外位移

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
