## MODIFIED Requirements

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
