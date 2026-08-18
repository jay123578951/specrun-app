## MODIFIED Requirements

### Requirement: change 卡片內容
主區 SHALL 以卡片列出每個進行中 change，每張卡片 SHALL 含：change 名稱、任務進度條與 n/m 數字、相對時間（active 卡片為最後修改；parked 卡片為 park 時點，如「parked 3w ago」）、以及該 change 的 Why 摘錄。UI 文案 SHALL 一律使用英文。

Why 摘錄 SHALL 取自該 change proposal 的 `## Why` 第一段（取得規則見 `openspec-gateway`），並 SHALL 最多顯示兩行、超出部分以省略號截斷。截斷位置 SHALL 由呈現層依實際可用寬度決定，MUST NOT 保證落在句界或詞界——摘錄因此可能結束於不完整的語句，此 SHALL 為可接受行為：卡片摘錄供清單層快速掃視，完整內容於詳情檢視取得。省略號 SHALL 僅於內容確實溢出時出現，摘錄未達兩行時 MUST NOT 顯示省略號、也 MUST NOT 補滿第二行。摘錄 MUST NOT 經 LLM 或任何生成式加工。active 與 parked 卡片 SHALL 以相同方式呈現摘錄。

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
- **WHEN** 某 active change 的 proposal 含 `## Why` 段落，其第一段可抽出
- **THEN** 該卡片在進度條之外另顯示該段落，最多兩行

#### Scenario: 長摘錄截斷
- **WHEN** 某 change 的 Why 第一段長度超過卡片兩行可容納的字數
- **THEN** 摘錄顯示至第二行結尾並以省略號截斷，卡片高度不因該摘錄增長

#### Scenario: 截斷不保證落在句界
- **WHEN** 卡片兩行的容量剛好落在某個詞或某句的中間
- **THEN** 摘錄即在該處截斷並接省略號，MUST NOT 為求語句完整而提前退到前一個句界

#### Scenario: 摘錄未滿兩行
- **WHEN** 某 change 的 Why 第一段在可用寬度下不足兩行
- **THEN** 摘錄完整顯示且不含省略號，卡片不為未使用的第二行保留高度

#### Scenario: 視窗寬度改變時的截斷
- **WHEN** 同一張卡片先後處於較寬與較窄的可用寬度
- **THEN** 兩種寬度下各自依兩行容量截斷，同一摘錄呈現的字數不同 SHALL 為可接受行為

#### Scenario: parked 卡片同樣顯示摘錄
- **WHEN** 某 parked change 的 proposal 含可抽出的 `## Why` 第一段
- **THEN** 該卡片以與 active 卡片相同的方式顯示摘錄

#### Scenario: 無摘錄可顯示
- **WHEN** 某 change 沒有 proposal 檔案，或其 proposal 無 `## Why` 段落
- **THEN** 該卡片不顯示摘錄區塊、不顯示佔位空白、不顯示任何錯誤或缺件提示
