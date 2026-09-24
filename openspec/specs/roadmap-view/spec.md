# roadmap-view Specification

## Purpose

Roadmap 頁：以分組清單呈現目標專案 `openspec/roadmap/` 下的開發項追蹤檔（格式依 srun:roadmap），並以唯讀 slideover 閱讀單一規劃檔；閱讀時重排開頭段與拆分表、把引用轉成可跳轉的連結，涵蓋載入、空、錯誤狀態與鍵盤行為。

## Requirements

### Requirement: 規劃檔清單
主區切至 Roadmap 頁時 SHALL 列出目標專案 `openspec/roadmap/` 目錄頂層的所有 `*.md` 檔，每檔一張卡片。子目錄、非 `.md` 檔與以 `.` 開頭的檔案 MUST NOT 列入。資料 SHALL 來自檔案層直讀（目錄列舉、檔案內容與檔案修改時刻），MUST NOT 依賴 openspec CLI；CLI 不可用時 Roadmap 頁 SHALL 照常運作，且 MUST NOT 顯示 CLI 不可用的提示。

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

組內 SHALL 依檔名字母序排列。UI MUST NOT 提供排序或分組切換。

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

### Requirement: 清單卡片內容
每張卡片 SHALL 顯示：
- **標題**：標題中的行內 code 以行內 code 樣式呈現。
- **更新時間**：該檔的最後修改時刻，以與 change 卡片相同的相對時間格式呈現；滑鼠停留時提供完整時刻。

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
- **WHEN** 某規劃檔的修改時刻讀取失敗
- **THEN** 該卡片不顯示更新時間，其餘資訊照常呈現

#### Scenario: Next 範圍含行內 code
- **WHEN** 進行中項目的 `⬅` 列範圍欄原文為 `` 串接 `badge-api` ``
- **THEN** 副行照原文顯示為 `` Next: 串接 `badge-api` ``，反引號保留

### Requirement: 卡片的複製標題
卡片 SHALL 提供複製標題的控制，其呈現與互動 SHALL 與 change 卡片的複製名稱控制一致：
- 靜置時隱藏，hover 或鍵盤聚焦時浮現；
- 點擊 MUST NOT 同時打開詳情；
- 複製成功後短暫呈現完成狀態。

複製內容 SHALL 為標題的純文字，行內 code 的反引號 MUST 去除。

#### Scenario: 複製標題
- **WHEN** 使用者在標題為 ``色彩透明度寫法失效（`/N`）`` 的卡片上點擊複製控制
- **THEN** 剪貼簿內容為 `色彩透明度寫法失效（/N）`，詳情面板不開啟

### Requirement: 詳情 slideover（唯讀）
點擊卡片 SHALL 以 slideover 覆蓋面板開啟該規劃檔。面板規則：
- 內容 SHALL 為去除第一個 `# ` 標題行後的全文，以 Markdown 唯讀渲染；渲染與外部連結的規範沿用 artifact-view 的「Markdown 唯讀渲染」與「連結行為」。
- 面板 MUST NOT 有 tabs，MUST NOT 顯示檔案路徑。
- 面板開啟期間，左側露出區的卡片 SHALL 可點擊切換，當前開啟卡 SHALL 高亮，再次點擊當前卡 SHALL 收合面板。
- 面板的進出場與原地換內容的動效 SHALL 沿用 artifact-view 的「詳情滑出面板」與「覆蓋檢視下的清單切換」，MUST NOT 自成一套值。
- 面板 MUST NOT 提供任何編輯檔案的能力。

#### Scenario: 開啟詳情
- **WHEN** 使用者點擊某規劃檔卡片
- **THEN** slideover 滑入，header 顯示該檔標題，內容區不重複顯示標題行

#### Scenario: 露出區切換
- **WHEN** 面板開啟中，使用者點擊露出區的另一張卡片
- **THEN** 面板內容原地切換為該規劃檔，清單不移位

### Requirement: 詳情 header
面板 header SHALL 顯示標題，並依組別在標題旁顯示狀態：
- In progress：進度條與 `N/M`；
- Blocked：`Blocked` 標記；
- Other：`Other` 標記；
- Available：不顯示狀態。

收合控制所在的那一列 SHALL 依序呈現以下三項，排法與 change 詳情面板的建立時刻欄位與動作控制同構：
- **更新時刻**：文案為 `Updated ` 接不含年份的月日與 24 小時制時分（如 `Updated 09-21 14:52`）。滑鼠停留時提供含年份的完整時刻。它 MUST NOT 呈現為可互動元素。取不到時整欄 MUST NOT 呈現、MUST NOT 留佔位。
- **複製標題控制**：複製內容同「卡片的複製標題」。
- **刷新控制**：重新讀取清單並更新面板內容；清單上該項的卡片同步更新。

面板 MUST NOT 顯示建立時刻：規劃檔存檔方式會重寫檔案，檔案的建立時刻不代表開發項的建立。

#### Scenario: header 動作區
- **WHEN** 使用者開啟最後修改於 2026-09-21 14:52 的規劃檔
- **THEN** header 控制列顯示 `Updated 09-21 14:52`、複製控制與刷新控制，不顯示 `Created`

#### Scenario: 刷新後檔案已刪除
- **WHEN** 面板開啟中，該檔已被刪除，使用者點擊面板的刷新控制
- **THEN** 面板關閉，清單重新載入且不再含該檔

### Requirement: 開頭段重排
第一個 `## ` 段落標題之前的內容稱為開頭段，面板 SHALL 將它拆成兩塊，呈現於內容區最前面：
- **關係欄**：開頭段中形如 `- **欄名**：內容` 的行（冒號可為全形或半形），欄名為 1 到 6 個非空白字元。這些行 SHALL 收進一個有框的區塊，每行一列、左為欄名、右為內容，依原檔順序排列；內容中的引用連結規則照常適用。沒有這類行時 MUST NOT 出現該區塊。
- **導言**：開頭段其餘的內容 SHALL 呈現在關係欄區塊之上，字色比正文低一階。

欄名 MUST NOT 限定為固定清單。

#### Scenario: 關係欄收框
- **WHEN** 開頭段含 `- **規格**：…`、`- **相關**：…` 兩行與一段說明文字
- **THEN** 內容區最上方是說明文字，其下是含「規格」「相關」兩列的框

#### Scenario: 非規定欄名
- **WHEN** 開頭段含 `- **順序與現況**：\`00-執行順序.md\``
- **THEN** 該行出現在關係欄框中，欄名為「順序與現況」

#### Scenario: 沒有關係欄
- **WHEN** 開頭段只有說明文字
- **THEN** 內容區最上方只有導言，不出現空框

### Requirement: 拆分與進度提前與狀態圖示
內文含 `## 拆分與進度` 段落時，該段 SHALL 呈現在開頭段之後、其他段落之前；其餘段落 SHALL 依原檔順序。

該段內表頭為「狀態」的欄位，下列值 SHALL 以圖示呈現，並於滑鼠停留時提供英文說明：

| 原文 | 呈現 | 說明文字 | 該列文字 |
|------|------|---------|---------|
| `✅` | 淡底圓點的勾，完成色 | `Done` | 降一階 |
| `⬅ 接下來` | 實心 accent 底圓點的箭頭，全表最醒目 | `Next up` | 加重 |
| `卡著` | 淡底圓點的鎖，parked 色 | `Blocked` | 不變 |

其餘值 SHALL 照原文呈現。該欄 MUST NOT 折行。

以上處理 MUST NOT 套用到 `## 拆分與進度` 段以外的表格。

#### Scenario: 段落提前
- **WHEN** 原檔段落順序為 開始的條件 → 拆分與進度 → 動工前必知
- **THEN** 面板呈現順序為 開頭段 → 拆分與進度 → 開始的條件 → 動工前必知

#### Scenario: 狀態圖示
- **WHEN** 拆分表三列的狀態欄分別為 `⬅ 接下來`、`✅`、`卡著`
- **THEN** 三列分別呈現箭頭、勾、鎖圖示；箭頭列文字加重，勾列文字降階

#### Scenario: 不認得的狀態
- **WHEN** 拆分表某列狀態欄為 `暫緩`
- **THEN** 該格照原文顯示「暫緩」

#### Scenario: 其他表格不受影響
- **WHEN** 規劃檔另有一段表頭含「狀態」欄的表格，不在 `## 拆分與進度` 段內
- **THEN** 該表格照原文呈現，不換圖示

### Requirement: 引用連結
面板內容中的行內 code，對得到實際存在的目標時 SHALL 呈現為可點連結；對不到時 SHALL 維持一般行內 code 樣式，MUST NOT 可互動。code block 內的文字 MUST NOT 轉為連結。

依以下規則比對，採第一條成立者：
1. 形如 `名稱.md`、不含 `/`，且 `openspec/roadmap/` 下存在該檔 → 規劃檔。
2. 含 `archive/YYYY-MM-DD-名稱`（前面有無 `changes/` 等路徑皆可），且該目錄存在於封存目錄 → 封存 change。
3. 整段為 `YYYY-MM-DD-名稱`，且該目錄存在於封存目錄 → 封存 change。
4. 含 `specs/<id>/spec.md`，且目標專案存在該 spec → spec。
5. 整段為小寫英數與連字號組成、至少含一個連字號的名稱，依序比對：
   1. 目標專案的 spec → spec；
   2. Changes 頁上的 change（含 parked）→ change；
   3. 封存目錄中去掉日期前綴後同名的封存 change → 封存 change。

連結目標是別頁時（spec、change、封存 change），連結 SHALL 附上目標頁名的提示（如 `Specs ↗`）；目標是規劃檔時不附提示。

#### Scenario: 撞名時規格優先
- **WHEN** 內容含 `resilient-community-lifecycle`，目標專案同時有同名 spec 與名為 `2026-08-10-resilient-community-lifecycle` 的封存 change
- **THEN** 該引用連到 Specs 頁的 `resilient-community-lifecycle`

#### Scenario: 短的封存路徑
- **WHEN** 內容含 `archive/2026-09-02-badge-issuance-roster/`，且該封存 change 存在
- **THEN** 該引用為連到 Archived 頁的連結

#### Scenario: 對不到的名稱不成連結
- **WHEN** 內容含 `no-restricted-imports`，目標專案沒有同名的 spec、change 或封存 change
- **THEN** 該文字以一般行內 code 呈現，點擊無反應

#### Scenario: 不存在的規劃檔
- **WHEN** 內容含 `已刪除的項目.md`，roadmap 目錄下沒有該檔
- **THEN** 該文字以一般行內 code 呈現，點擊無反應

### Requirement: 引用連結的跳轉
點擊規劃檔連結 SHALL 在面板內原地切換為該規劃檔，清單上對應的卡片 SHALL 高亮並帶進視野。

點擊別頁連結 SHALL 依以下順序跳轉：
1. 主區切換至目標頁（Specs、Changes 或 Archived），Roadmap 的面板隨切頁關閉；
2. 目標頁照其自身規則載入清單；
3. 載入後打開目標項的詳情，該項在清單上高亮並帶進視野。

目標頁載入後找不到該項時（例如期間被封存或刪除），SHALL 停在該頁的清單，並以非阻斷提示告知找不到，提示文案為 `Could not find "<名稱>". It may have been moved or removed.`。

目標頁清單讀取失敗時，SHALL 放棄開啟該項，只呈現該頁自身的錯誤狀態，MUST NOT 另出找不到的提示。

目標頁尚未載入完成、使用者就切到其他頁（或切換專案）時，SHALL 放棄開啟該項且不提示；之後再進入該頁 MUST NOT 自動打開它。

跳轉 MUST NOT 提供返回 Roadmap 的捷徑；回到 Roadmap 頁 SHALL 照「切頁即關與重新載入」為關閉面板的清單。

#### Scenario: 規劃檔互跳
- **WHEN** 面板開啟中，使用者點擊內容中的 `防災士名冊契約化.md`
- **THEN** 面板內容換成「防災士名冊契約化」，清單上該卡高亮

#### Scenario: 跳到封存 change
- **WHEN** 使用者點擊 `2026-09-22-dpo-role-switcher-unification`
- **THEN** 主區切至 Archived 頁，並打開該封存 change 的詳情

#### Scenario: 目標已不存在
- **WHEN** 使用者點擊一個 change 連結，而該 change 在 Changes 頁重新載入後已不在清單上
- **THEN** 主區停在 Changes 頁清單、不開面板，並出現找不到該 change 的非阻斷提示

#### Scenario: 目標頁讀取失敗
- **WHEN** 使用者點擊一個 spec 連結，Specs 頁清單讀取失敗
- **THEN** 主區停在 Specs 頁並顯示其讀取錯誤狀態，不開面板，不出現找不到的提示

#### Scenario: 跳轉途中離開目標頁
- **WHEN** 使用者點擊一個 spec 連結，Specs 頁尚未載入完成就切到 Changes 頁，之後再從下拉進入 Specs 頁
- **THEN** Specs 頁不自動打開該 spec，也不出現找不到的提示

### Requirement: 鍵盤行為
面板開啟期間 SHALL 支援：
- ↑↓ 鍵依清單呈現順序（跨組連續）切換相鄰規劃檔；
- Esc 收合面板。

行為語意與 change 詳情的覆蓋檢視一致；面板未開啟時鍵盤 MUST NOT 搶任何行為。

#### Scenario: 跨組切換
- **WHEN** 面板開著 In progress 組的最後一項，使用者按 ↓
- **THEN** 面板切換至 Available 組的第一項

#### Scenario: Esc 收合
- **WHEN** 面板開啟中，使用者按 Esc
- **THEN** 面板收合

### Requirement: 切頁即關與重新載入
自 Roadmap 頁切至其他頁（或切換專案）時 SHALL 關閉開啟中的面板，且不保留開啟狀態。

每次進入 Roadmap 頁 SHALL 重新載入清單；頁首 SHALL 提供手動刷新。

系統 MUST NOT 為 Roadmap 頁擴充檔案變動監看。

#### Scenario: 切頁關閉
- **WHEN** Roadmap 頁面板開啟中，使用者切至 Specs 頁再切回 Roadmap 頁
- **THEN** 回到 Roadmap 頁時為全寬清單，清單資料重新載入

#### Scenario: 背景變動不自動更新
- **WHEN** 使用者停在 Roadmap 頁，外部工具修改了某規劃檔的狀態字
- **THEN** 清單維持原樣，直到使用者手動刷新或重新進頁

### Requirement: 空與錯誤狀態
Roadmap 頁 SHALL 依下列情境分層呈現，MUST NOT 靜默留白：
- **專案停用 roadmap**：目標專案沒有 `openspec/roadmap/` 目錄，但有 `openspec/roadmap.off`。SHALL 顯示「此專案選擇不使用 roadmap」的說明。
- **沒有 roadmap**：沒有 `openspec/roadmap/` 目錄也沒有 `roadmap.off`，或目錄下沒有任何 `.md` 檔。SHALL 顯示「尚無 roadmap」的說明，並指出規劃檔的存放位置。
- **目錄與停用標記同時存在**：以目錄為準，照常列出。
- **無目標專案、非 openspec 專案**：語意與 Specs 頁的分層一致。
- **讀取失敗**：顯示錯誤狀態，可手動重試。
- **單一規劃檔內容讀取失敗**：MUST NOT 拖垮清單。該檔 SHALL 以檔名為標題列入 Other 組，其餘卡片正常。
- **首次載入尚未取得資料**：SHALL 顯示載入佔位，MUST NOT 顯示空狀態文案。

#### Scenario: 專案停用 roadmap
- **WHEN** 目標專案有 `openspec/roadmap.off`、沒有 `openspec/roadmap/`
- **THEN** Roadmap 頁顯示此專案選擇不使用 roadmap 的說明，不顯示錯誤

#### Scenario: 尚無 roadmap
- **WHEN** 目標專案沒有 `openspec/roadmap/` 也沒有 `roadmap.off`
- **THEN** Roadmap 頁顯示尚無 roadmap 的說明與 `openspec/roadmap/` 位置

#### Scenario: 單檔讀取失敗
- **WHEN** 清單中某個規劃檔讀取失敗
- **THEN** 該檔以檔名出現在 Other 組，其他卡片正常分組

### Requirement: 讀取範圍
Roadmap 頁 SHALL 只讀取以下內容：
- 目標專案 `openspec/roadmap/` 頂層 `.md` 檔的內容與修改時刻；
- `openspec/roadmap.off` 是否存在。

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
