## MODIFIED Requirements

### Requirement: 清單分組
清單 SHALL 依下列規則分成四組，依序呈現為 In progress、Available、Blocked、Other；每組 SHALL 顯示組名與該組項目數，沒有項目的組 MUST NOT 呈現。

- **Blocked**：狀態字為 `卡著`。
- **In progress**：狀態字為 `N/M`（N、M 為整數），且 0 < N < M。
- **Available**：符合下列任一：
  - 狀態字為 `0/M`（含 `0/0`）；
  - 狀態字為空，且內文含 `## 開始的條件`、`## 拆分與進度`、`## 動工前必知`、`## 已否決的做法` 四個段落標題中的至少一個。段落標題以開頭相符判斷，標題後接其他文字（如 `## 開始的條件（補充）`）也算；fenced code block 內的行不算。
- **Other**：不符合以上三組的一律歸此組，包括：
  - 沒有 `# ` 標題行；
  - 狀態字不是上述三種形式；
  - 狀態字為空但內文不含任何一個上述段落標題；
  - 狀態字為 `N/M` 且 N 等於 M；
  - 狀態字為 `N/M` 且 N 大於 M。

組內 SHALL 依檔案最後修改時刻由新到舊排列；修改時刻相同時依檔名字母序。取不到修改時刻的檔 SHALL 排在該組所有取得到修改時刻的檔之後，彼此依檔名字母序。修改時刻為 0 SHALL 視為取得到修改時刻，依值排序；修改時刻不是有限數字（如 NaN、Infinity）SHALL 視為取不到修改時刻。UI MUST NOT 提供排序或分組切換。

#### Scenario: 總覽檔歸入 Other
- **WHEN** `00-執行順序.md` 的標題行無狀態字，內文只有「交接主線」「卡著（前置未解除）」等自訂段落標題
- **THEN** 該檔出現在 Other 組，不出現在 Available 組

#### Scenario: 一般單段項歸入 Available
- **WHEN** 某檔標題行無狀態字，內文含 `## 動工前必知`
- **THEN** 該檔出現在 Available 組

#### Scenario: 全數完成未刪檔
- **WHEN** 某檔狀態字為 `4/4`
- **THEN** 該檔出現在 Other 組

#### Scenario: 無此組項目
- **WHEN** 目標專案沒有任何狀態字為 `卡著` 的檔
- **THEN** 清單不呈現 Blocked 組標題

#### Scenario: 進度字的邊界值
- **WHEN** 某檔狀態字為 `0/0`，另一檔狀態字為 `5/3`
- **THEN** `0/0` 的檔出現在 Available 組，`5/3` 的檔出現在 Other 組

#### Scenario: 段落標題後接補充文字
- **WHEN** 某檔標題行無狀態字，內文唯一的規定段落標題寫成 `## 開始的條件（補充）`
- **THEN** 該檔出現在 Available 組

#### Scenario: 組內最近修改的排最前
- **WHEN** Available 組有 `a.md`（三天前修改）與 `b.md`（五分鐘前修改）
- **THEN** 該組內 `b.md` 排在 `a.md` 之前

#### Scenario: 修改時刻相同時依檔名
- **WHEN** 同一組的 `b.md` 與 `a.md` 修改時刻完全相同
- **THEN** 該組內 `a.md` 排在 `b.md` 之前

#### Scenario: 取不到修改時刻的檔排在組尾
- **WHEN** Other 組有 `00-執行順序.md`（取不到修改時刻）與 `z.md`（一年前修改）
- **THEN** 該組內 `z.md` 排在 `00-執行順序.md` 之前

#### Scenario: 修改時刻為 0 仍算取得到
- **WHEN** 同一組有 `a.md`（修改時刻為 0）、`b.md`（一年前修改）與 `c.md`（取不到修改時刻）
- **THEN** 該組內依序為 `b.md`、`a.md`、`c.md`

#### Scenario: 修改時刻不是有限數字時當作取不到
- **WHEN** 同一組有 `a.md`（修改時刻為 NaN）與 `b.md`（一年前修改）
- **THEN** 該組內 `b.md` 排在 `a.md` 之前

#### Scenario: 存檔後跳到組內第一個
- **WHEN** In progress 組原本 `a.md` 在 `b.md` 之前，使用者在編輯器修改並存檔 `b.md`，App 重新讀到清單
- **THEN** 該組內 `b.md` 排在第一個
