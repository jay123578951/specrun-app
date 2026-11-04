# Spec Delta

## ADDED Requirements

### Requirement: 更新時刻的依據
每個規劃檔的更新時刻 SHALL 是最後一次改到該檔的 commit 的作者時間。檔案有未提交的修改（已暫存或未暫存）、還沒被 git 追蹤、被 git 忽略，或沒有提交紀錄時，更新時刻 SHALL 改用檔案修改時刻。卡片的更新時間、組內排序與詳情 header 的更新時刻 SHALL 使用同一個值。

未提交的修改 SHALL 以內容比對判斷：內容與最後一次提交相同的檔案，即使被重寫過，也 MUST NOT 算作有未提交的修改。改檔名的 commit SHALL 視為改到新檔名的檔案，MUST NOT 往前追溯舊檔名的紀錄。

專案位於 repo 的子目錄或 git worktree 時，SHALL 同樣依上述規則。

#### Scenario: 重寫檔案但內容沒變
- **WHEN** 某工具重寫了所有規劃檔，只有 `a.md` 內容改變且尚未提交，`b.md` 的內容與最後一次提交相同
- **THEN** `a.md` 顯示檔案修改時刻，`b.md` 仍顯示最後一次提交的作者時間

#### Scenario: 切換分支
- **WHEN** 切換分支後 `a.md` 的檔案修改時刻變成現在，且沒有未提交的修改
- **THEN** `a.md` 顯示目前分支上最後改到它的 commit 的作者時間

#### Scenario: rebase 後時間不變
- **WHEN** 改到 `a.md` 的 commit 被 rebase，作者時間不變、提交時間變成現在
- **THEN** `a.md` 的更新時刻不變

#### Scenario: 編輯中還沒提交
- **WHEN** `a.md` 存檔後還沒提交
- **THEN** `a.md` 顯示檔案修改時刻

#### Scenario: 提交之後
- **WHEN** `a.md` 提交後，使用者重新進入 Roadmap 頁或按 Refresh
- **THEN** `a.md` 顯示該 commit 的作者時間

#### Scenario: 新增還沒追蹤的檔案
- **WHEN** `new.md` 還沒被 git 追蹤
- **THEN** `new.md` 顯示檔案修改時刻

#### Scenario: 被 git 忽略的檔案
- **WHEN** `openspec/roadmap/` 被 `.gitignore` 忽略，且其中的檔案沒有提交紀錄
- **THEN** 這些卡片都顯示檔案修改時刻

#### Scenario: 曾提交後移除追蹤或被忽略
- **WHEN** `a.md` 曾被提交，之後被 `git rm --cached` 移除追蹤或被 `.gitignore` 忽略，移除的 commit 仍列出 `a.md`
- **THEN** `a.md` 顯示檔案修改時刻，不是移除那次 commit 的作者時間

#### Scenario: 改檔名
- **WHEN** 某 commit 把 `old.md` 改名為 `new.md`，之後沒有再改動
- **THEN** `new.md` 顯示該 commit 的作者時間

#### Scenario: 子目錄的同名檔不影響頂層卡片
- **WHEN** `openspec/roadmap/sub/a.md` 有較新的提交，`openspec/roadmap/a.md` 沒有
- **THEN** 卡片 `a.md` 顯示頂層 `a.md` 自己的提交時間

#### Scenario: 專案在 repo 的子目錄
- **WHEN** 目標專案是某個 repo 的子目錄，`openspec/roadmap/` 下的檔案有提交紀錄
- **THEN** 卡片顯示各自最後一次提交的作者時間

#### Scenario: 面板與卡片一致
- **WHEN** 卡片顯示 `a.md` 的提交時間，使用者開啟 `a.md` 的詳情
- **THEN** 詳情 header 的 `Updated` 顯示同一個時刻

#### Scenario: 只改檔案權限
- **WHEN** `a.md` 內容與最後一次提交相同，只有檔案權限改變且尚未提交
- **THEN** `a.md` 算作有未提交的修改，顯示檔案修改時刻

#### Scenario: 有未提交修改但取不到檔案修改時刻
- **WHEN** `a.md` 有未提交的修改，且檔案修改時刻讀取失敗
- **THEN** `a.md` 不顯示更新時間，MUST NOT 改用提交時間

#### Scenario: 內容讀取失敗但有提交紀錄
- **WHEN** `a.md` 的內容讀取失敗，但它有提交紀錄且沒有未提交的修改
- **THEN** `a.md` 顯示最後一次提交的作者時間

### Requirement: git 紀錄不可用時退回檔案修改時刻
專案沒有使用 git、電腦沒有可用的 git，或讀取 git 紀錄失敗（含逾時）時，整份清單的更新時刻 SHALL 全部使用檔案修改時刻。此時 UI MUST NOT 顯示錯誤或提示，規劃檔清單的其他內容 SHALL 照常呈現。

#### Scenario: 專案沒有使用 git
- **WHEN** 目標專案不在任何 git repo 內
- **THEN** 所有卡片顯示檔案修改時刻，頁面不出現錯誤

#### Scenario: 讀取失敗不混用
- **WHEN** 讀取提交時間成功，但判斷未提交修改的那一步失敗
- **THEN** 所有卡片都顯示檔案修改時刻，MUST NOT 有部分卡片顯示提交時間

#### Scenario: 電腦沒有 git
- **WHEN** 電腦上沒有可用的 git
- **THEN** 清單照常列出，所有卡片顯示檔案修改時刻，App MUST NOT 因此跳出系統的安裝提示

#### Scenario: repo 還沒有任何 commit
- **WHEN** 目標專案的 repo 還沒有任何 commit
- **THEN** 所有卡片顯示檔案修改時刻，頁面不出現錯誤

#### Scenario: 提交紀錄沒有改到規劃檔
- **WHEN** repo 有 commit，但沒有任何 commit 改到 `openspec/roadmap/`
- **THEN** 所有卡片顯示檔案修改時刻

#### Scenario: git 輸出無法解析
- **WHEN** git 指令成功，但輸出格式無法解析
- **THEN** 所有卡片都顯示檔案修改時刻，MUST NOT 有部分卡片顯示提交時間

#### Scenario: git 執行過久或輸出過大
- **WHEN** 任一條 git 指令超過 5 秒，或輸出超過 16MB
- **THEN** 視為讀取失敗，所有卡片顯示檔案修改時刻

#### Scenario: macOS 開發工具檢查沒有成功
- **WHEN** macOS 桌面版檢查開發工具時結束碼非 0、執行失敗或超過 5 秒
- **THEN** 這次 App 執行期間都不呼叫 git，所有卡片顯示檔案修改時刻，重新開啟 App 才再檢查

## MODIFIED Requirements

### Requirement: 規劃檔清單
主區切至 Roadmap 頁時 SHALL 列出目標專案 `openspec/roadmap/` 目錄頂層的所有 `*.md` 檔，每檔一張卡片。子目錄、非 `.md` 檔與以 `.` 開頭的檔案 MUST NOT 列入。資料 SHALL 來自檔案層直讀（目錄列舉、檔案內容與檔案修改時刻）與 git 紀錄（見「更新時刻的依據」），MUST NOT 依賴 openspec CLI；CLI 不可用時 Roadmap 頁 SHALL 照常運作，且 MUST NOT 顯示 CLI 不可用的提示。

每檔的**標題**與**狀態字**取自檔案中第一個以 `# ` 開頭的行：
- 該行去掉 `# ` 後，若含連續兩個以上的空白，最後一段連續空白之後的文字為狀態字，之前的文字為標題；
- 不含這種空白時，整段為標題、狀態字為空；
- 檔案沒有這一行時，標題為檔名去掉 `.md`、狀態字視為不存在。

UI 文案 SHALL 一律使用英文；規劃檔內容本身照原文呈現。

#### Scenario: 列出規劃檔
- **WHEN** `openspec/roadmap/` 下有 18 個 `.md` 檔與一個 `notes.txt`
- **THEN** Roadmap 頁列出 18 張卡片，`notes.txt` 不出現

#### Scenario: 標題與狀態字
- **WHEN** 某檔第一個 `# ` 行為 `# 培訓機構管理        1/4`
- **THEN** 該卡標題為「培訓機構管理」，狀態字為 `1/4`

#### Scenario: CLI 不可用不影響
- **WHEN** openspec CLI 無法執行，使用者切到 Roadmap 頁
- **THEN** 清單照常列出，頁面不出現 CLI 不可用的提示

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

組內 SHALL 依更新時刻（見「更新時刻的依據」）由新到舊排列；更新時刻相同時依檔名字母序。取不到更新時刻的檔 SHALL 排在該組所有取得到更新時刻的檔之後，彼此依檔名字母序。更新時刻為 0 SHALL 視為取得到更新時刻，依值排序；更新時刻不是有限數字（如 NaN、Infinity）SHALL 視為取不到更新時刻。UI MUST NOT 提供排序或分組切換。

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
- **WHEN** 同一組的 `b.md` 與 `a.md` 更新時刻完全相同
- **THEN** 該組內 `a.md` 排在 `b.md` 之前

#### Scenario: 取不到修改時刻的檔排在組尾
- **WHEN** Other 組有 `00-執行順序.md`（取不到更新時刻）與 `z.md`（一年前修改）
- **THEN** 該組內 `z.md` 排在 `00-執行順序.md` 之前

#### Scenario: 修改時刻為 0 仍算取得到
- **WHEN** 同一組有 `a.md`（更新時刻為 0）、`b.md`（一年前修改）與 `c.md`（取不到更新時刻）
- **THEN** 該組內依序為 `b.md`、`a.md`、`c.md`

#### Scenario: 修改時刻不是有限數字時當作取不到
- **WHEN** 同一組有 `a.md`（更新時刻為 NaN）與 `b.md`（一年前修改）
- **THEN** 該組內 `b.md` 排在 `a.md` 之前

#### Scenario: 存檔後跳到組內第一個
- **WHEN** In progress 組原本 `a.md` 在 `b.md` 之前，使用者在編輯器修改並存檔 `b.md`，App 重新讀到清單
- **THEN** 該組內 `b.md` 排在第一個

#### Scenario: 同一個 commit 改到的卡片依檔名
- **WHEN** 同一組的 `b.md` 與 `a.md` 都沒有未提交的修改，最後一次提交是同一個 commit
- **THEN** 兩張卡片顯示相同時間，該組內 `a.md` 排在 `b.md` 之前

### Requirement: 清單卡片內容
每張卡片 SHALL 顯示：
- **標題**：標題中的行內 code 以行內 code 樣式呈現。
- **更新時間**：該檔的更新時刻（見「更新時刻的依據」），以與 change 卡片相同的相對時間格式呈現；滑鼠停留時提供完整時刻。

依組別另外顯示：
- **In progress**：進度條與 `N/M`；副行 `Next: <範圍>`。範圍取自 `## 拆分與進度` 段表格中「狀態」欄含 `⬅` 那一列的「範圍」欄，照原文呈現，不去除行內 code 標記。
- **Blocked**：`Blocked` 標記；副行 `Needs: <前置>`。前置取自開頭段 `- **前置**：` 行的內容，去除行內 code 與粗體標記後呈現，超出寬度截斷。
- **子項**（開頭段有 `- **屬於**：` 行，且其中第一個 `*.md` 引用對得到清單中的規劃檔）：`part of <該規劃檔標題>` 標籤。

以上任一資訊取不到時，該部分 MUST NOT 呈現，MUST NOT 以佔位文字代替。

#### Scenario: 進行中項目
- **WHEN** 某檔狀態字為 `1/4`，拆分表中「停用機構的下游影響」那列的狀態欄為 `⬅ 接下來`
- **THEN** 卡片顯示 1/4 的進度條，副行為 `Next: 停用機構的下游影響`

#### Scenario: 卡著的項目
- **WHEN** 某檔狀態字為 `卡著`，開頭段含 `- **前置**：業主確認重新輔導的實際運作流程（見下）`
- **THEN** 卡片顯示 Blocked 標記，副行為 `Needs: 業主確認重新輔導的實際運作流程（見下）`

#### Scenario: 缺件不佔位
- **WHEN** 某檔狀態字為 `卡著` 但沒有 `前置` 行
- **THEN** 卡片顯示 Blocked 標記，不顯示 Needs 副行

#### Scenario: 取不到修改時刻
- **WHEN** 某規劃檔沒有提交時間可用，檔案修改時刻也讀取失敗
- **THEN** 該卡片不顯示更新時間，其餘資訊照常呈現

#### Scenario: Next 範圍含行內 code
- **WHEN** 進行中項目的 `⬅` 列範圍欄原文為 `` 串接 `badge-api` ``
- **THEN** 副行照原文顯示為 `` Next: 串接 `badge-api` ``，反引號保留

### Requirement: 讀取範圍
Roadmap 頁 SHALL 只讀取以下內容：
- 目標專案 `openspec/roadmap/` 頂層 `.md` 檔的內容與修改時刻；
- `openspec/roadmap.off` 是否存在；
- `openspec/roadmap/` 底下檔案的提交時間，哪些檔案有未提交的修改，以及哪些檔案被 git 追蹤。

讀取 git 紀錄 MUST NOT 寫入 repo 的任何內容，包含 git 的索引檔。

為了解析引用連結，SHALL 只列舉以下目錄的名稱，MUST NOT 讀取其中任何檔案的內容：
- `openspec/specs/`；
- `openspec/changes/`；
- `openspec/changes/archive/`；
- App 自身存放的 parked change（只取名稱）。

讀取通道 MUST NOT 接受呼叫端給定的檔名或路徑。每次讀取的範圍固定為上述內容，由系統自行列舉。

上列任一目錄列舉失敗時，該類名稱 SHALL 視同空清單：對應的引用不成連結，MUST NOT 讓規劃檔清單跟著失敗。

#### Scenario: 不依呼叫端路徑讀檔
- **WHEN** Roadmap 頁載入或刷新
- **THEN** 系統只讀 `openspec/roadmap/` 頂層列舉到的 `.md` 檔，不存在「指定檔名讀取」的通道

#### Scenario: 名稱清單不含內容
- **WHEN** 系統為解析引用列舉 `openspec/specs/`
- **THEN** 回應只含各 spec 的名稱，不含任何 spec 的內容

#### Scenario: 名稱目錄列舉失敗
- **WHEN** `openspec/changes/archive/` 列舉失敗
- **THEN** Roadmap 清單照常呈現，封存 change 的引用維持一般行內 code、不成連結

#### Scenario: 讀取 git 紀錄不寫入 repo
- **WHEN** Roadmap 頁載入或刷新
- **THEN** repo 的 commit、暫存內容與 git 索引檔都維持原狀
