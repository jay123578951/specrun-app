# openspec-gateway Specification

## Purpose

App 取得規格資料的唯一通道：以 spawn openspec CLI（`--json`）為介面，定義呼叫策略、輸出正規化與錯誤分類，不重新實作任何規格語意。

## Requirements

### Requirement: 清單資料以單次 CLI 呼叫取得
系統取得 change 清單時 SHALL 只執行一次 `openspec list --json`，且 MUST NOT 對個別 change 追加額外的 CLI 呼叫（如逐一 `status`）。

為取得各項目的 Why 摘錄而讀取檔案 SHALL 不構成額外的 CLI 呼叫：摘錄一律以檔案層直讀取得，MUST NOT 藉 `openspec status --change` 或任何逐一 change 的 CLI 呼叫解析 proposal 路徑。各 change 的 proposal 讀取 SHALL 並行發出，MUST NOT 逐一序列等待；任何單筆讀取失敗 MUST NOT 阻斷其餘項目或整份清單的回傳。

#### Scenario: 多個 change 仍單次呼叫
- **WHEN** 目標專案有 N（N > 1）個進行中 change 且清單資料被請求
- **THEN** 系統只執行一次 CLI 程序即回傳全部 N 筆資料

#### Scenario: 摘錄不追加 CLI 呼叫
- **WHEN** 目標專案有 N（N > 1）個進行中 change 且清單資料（含 Why 摘錄）被請求
- **THEN** 系統仍只執行一次 CLI 程序，摘錄所需的 proposal 內容全數以檔案讀取取得

#### Scenario: 單筆讀取失敗不拖垮清單
- **WHEN** 某一個 change 的 proposal 因權限問題讀取失敗
- **THEN** 該筆摘錄為空，其餘項目摘錄正常，清單整體不回報錯誤

### Requirement: 清單項目的 Why 段落摘錄
清單資料的每一筆 SHALL 帶一個 Why 摘錄欄位。摘錄 SHALL 為該 change proposal 中 `## Why`（任意層級標題，不分大小寫）之後第一段的**全文**，去除行內 Markdown 記號後的純文字；段落的邊界 SHALL 由空行或下一個標題判定，段落內的換行 SHALL 以單一空白接合為一行。系統 MUST NOT 對該段落再做句末判定或任何長度截斷——截斷位置與截斷指示 SHALL 全數交由呈現層決定。摘錄 SHALL NOT 設字元上限：段落邊界本身即為長度的天然界限。摘錄 MUST NOT 經 LLM 或任何生成式加工。

下列情形 SHALL 一律回傳空摘錄，且 MUST NOT 使該筆項目或整份清單回報錯誤：proposal 檔案不存在、讀取失敗、無 `## Why` 段落、該段落為空。active 與 parked 兩側的摘錄 SHALL 適用同一套抽取與降級規則。

#### Scenario: 抽出第一段全文
- **WHEN** 某 change 的 proposal `## Why` 段落為「卡片目前只有 change 名稱，使用者無法在清單層判斷用途。補上摘錄後，清單層即可判斷。」
- **THEN** 該筆項目的摘錄為該段落全文，含第二句在內，不在任何句號處截斷

#### Scenario: 只取第一段
- **WHEN** 某 change 的 `## Why` 之後有兩個以空行分隔的段落
- **THEN** 摘錄僅含第一段，第二段不進入摘錄

#### Scenario: 段落跨行接合
- **WHEN** 某 change 的 `## Why` 第一段在原始檔中佔連續多行
- **THEN** 摘錄將各行以單一空白接合為一行文字，不保留換行

#### Scenario: 句號後緊接非空白不再是特例
- **WHEN** 某 change 的 Why 第一段含「細節見 design.md 的第二節。後續說明。」
- **THEN** 摘錄包含該段全文，`design.md` 與其後的句子皆完整保留

#### Scenario: 英文縮寫不再提早結束
- **WHEN** 某 change 的 Why 第一段為「See e.g. the second section. Rest of the paragraph.」
- **THEN** 摘錄為該段全文，MUST NOT 在 `e.g.` 處結束

#### Scenario: 無 proposal 檔案
- **WHEN** 某 change 目錄下沒有 proposal 檔案
- **THEN** 該筆項目的摘錄為空字串，清單其餘項目照常回傳且整體不回報錯誤

#### Scenario: 無 Why 段落
- **WHEN** 某 change 的 proposal 存在但不含任何 `## Why` 標題
- **THEN** 該筆項目的摘錄為空字串，不回報錯誤

### Requirement: 清單項目的建立時刻
清單資料的每一筆 SHALL 帶一個建立時刻欄位，其值 SHALL 為該 change 目錄於檔案系統上的建立時間。該欄位 SHALL 以檔案層直讀取得，MUST NOT 藉 `openspec status --change` 或任何逐一 change 的 CLI 呼叫取得——比照 Why 摘錄，檔案層讀取不構成額外的 CLI 呼叫。各筆的讀取 SHALL 並行發出，MUST NOT 逐一序列等待。

active 與 parked 兩側 SHALL 適用同一套取得與降級規則。park 與 unpark 為整目錄搬移，MUST NOT 改寫該 change 的建立時刻——同一個 change 在 park 前後回報的建立時刻 SHALL 相同。系統 MUST NOT 為此欄位於 park metadata 另存任何欄位。

下列情形 SHALL 一律回傳空值，且 MUST NOT 使該筆項目或整份清單回報錯誤：目錄不存在、讀取失敗、檔案系統未提供建立時間、以及該筆的 change 名稱解析出的目錄落在 changes 目錄之外。最後一項 SHALL 與其他取不到的情形同等對待，MUST NOT 另行回報為錯誤或安全事件——名稱來自 CLI 輸出，防線的目的是不讀取範圍外的路徑，而非診斷來源。

#### Scenario: 每一筆都帶建立時刻
- **WHEN** 目標專案有 N（N > 1）個進行中 change 且清單資料被請求
- **THEN** 回傳的每一筆均帶該 change 目錄的建立時刻

#### Scenario: 取得建立時刻不追加 CLI 呼叫
- **WHEN** 目標專案有 N（N > 1）個進行中 change 且清單資料（含建立時刻）被請求
- **THEN** 系統仍只執行一次 CLI 程序，建立時刻全數以檔案層讀取取得

#### Scenario: parked 一側同樣帶建立時刻
- **WHEN** parked 清單資料被請求
- **THEN** 每一筆均帶該 change 的建立時刻，取得規則與 active 一側相同

#### Scenario: park 不改寫建立時刻
- **WHEN** 某 change 於建立後被 park，其後 parked 清單資料被請求
- **THEN** 該筆回報的建立時刻與 park 之前相同，MUST NOT 變成 park 當下的時刻

#### Scenario: 名稱解析出的目錄落在範圍外
- **WHEN** 某一筆的 change 名稱解析出的目錄不落在 changes 目錄底下
- **THEN** 該筆建立時刻為空，與讀取失敗同等對待，清單其餘項目正常且不回報錯誤

#### Scenario: 單筆取不到不拖垮清單
- **WHEN** 某一個 change 的目錄建立時間因權限或檔案系統限制無法取得
- **THEN** 該筆建立時刻為空，其餘項目正常，清單整體不回報錯誤

### Requirement: 進度與排序沿用引擎輸出
系統 SHALL 直接使用 CLI 回傳的 `completedTasks`／`totalTasks`／`status` 與回傳順序，MUST NOT 自行解析 tasks 檔案計算進度，也 MUST NOT 重新排序。

#### Scenario: 進度數字與引擎一致
- **WHEN** CLI 回傳某 change 為 `completedTasks: 2, totalTasks: 4`
- **THEN** 系統對外呈現的進度即為 2/4，不因 App 自行讀檔而產生不同數字

#### Scenario: 順序與引擎一致
- **WHEN** CLI 以預設排序（lastModified 新→舊）回傳多筆 change
- **THEN** 系統對外提供的清單順序與 CLI 回傳順序一致

### Requirement: 目標專案路徑解析

系統 SHALL 依下列優先序決定啟動時的目標專案：環境變數（dev override）＞持久化設定的最後啟用專案＞App 伺服端工作目錄（僅於其為 openspec 專案時成立，dogfooding）；三者皆不成立時啟動於無目標專案狀態（空清單引導）。

環境變數與工作目錄兩段 SHALL 僅於當前執行形態具備該通道時成立。桌面外殼沒有行程環境變數可問，GUI 啟動也沒有有意義的工作目錄，該形態的優先序因此只剩「最後啟用專案 ＞ 無目標專案」兩段。

啟動後的目標專案 SHALL 為當前執行形態持有、可於執行期切換的狀態；切換後所有資料請求 SHALL 來自新的目標專案，MUST NOT 要求個別請求自行指定專案。

目標專案路徑 SHALL 於使用前 canonical 化——路徑中的 symlink 解開為實際位置。該能力 SHALL 由當前執行形態提供，兩種形態對同一個專案 SHALL 得出同一個路徑；設定中以 symlink 路徑記錄的專案，MUST NOT 因執行形態不同而得出不同的目標。

在具備檔案存取授權通道的執行形態下，系統 SHALL 於開始使用某目標專案前取得該專案路徑的檔案存取授權——包含啟動時自設定載入的專案與執行期切換過去的專案，MUST NOT 僅於加入專案時取得。授權失敗時 SHALL 比照目標路徑不可用回報，MUST NOT 讓後續的讀取各自以讀不到檔案的形式呈現。

目標路徑無法 canonical 化，或 canonical 化後指向的不是資料夾（如設定中記錄的是一個檔案）時，SHALL 與「該資料夾不存在」同等對待——使用者的處置相同：換一個專案或重新加入。加入專案時路徑無法 canonical 化者 SHALL 同樣視為不是既存資料夾而拒絕加入，MUST NOT 以未解析的路徑寫進設定。

#### Scenario: 環境變數指定

- **WHEN** 在具備環境變數通道的執行形態下，環境變數設為某個 openspec 專案路徑
- **THEN** 啟動時清單資料來自該路徑的專案，即使設定中有最後啟用專案

#### Scenario: 設定檔指定

- **WHEN** 環境變數未設定或該形態無此通道，且持久化設定存有最後啟用專案
- **THEN** 啟動時清單資料來自該專案

#### Scenario: 未指定時 fallback

- **WHEN** 在具備工作目錄通道的執行形態下，環境變數未設定、設定中無最後啟用專案，且工作目錄為 openspec 專案
- **THEN** 清單資料來自該工作目錄（dogfooding）

#### Scenario: 桌面形態只認最後啟用專案

- **WHEN** 以桌面形態啟動，設定中無最後啟用專案
- **THEN** 啟動於無目標專案狀態，MUST NOT 改以環境變數或工作目錄推定

#### Scenario: 執行期切換

- **WHEN** 使用者切換至另一個專案後重新取得清單
- **THEN** 資料來自切換後的專案，請求本身未附帶專案路徑

#### Scenario: 兩形態對 symlink 專案得出同一個目標

- **WHEN** 設定中某專案的路徑經過 symlink，使用者分別以兩種執行形態開啟該專案
- **THEN** 兩者的目標專案路徑相同（皆為解開 symlink 後的實際位置），清單內容一致

#### Scenario: 啟動時載入的專案取得授權

- **WHEN** 在具備授權通道的執行形態下啟動，目標專案取自設定中的最後啟用專案
- **THEN** 該專案的檔案讀取（Why 摘錄、建立時刻、artifact 內容）成功，MUST NOT 因未經加入流程而被拒

#### Scenario: 授權失敗

- **WHEN** 在具備授權通道的執行形態下，目標專案路徑的授權無法取得（資料夾已不存在或權限不足）
- **THEN** 系統回報「目標路徑不是 openspec 專案」類錯誤並附授權失敗的原因，MUST NOT 呈現為一份摘錄與時刻全空的清單

#### Scenario: 目標路徑指向的不是資料夾

- **WHEN** 設定中記錄的目標專案路徑存在，但指向的是一個檔案而非資料夾
- **THEN** 系統回報「目標路徑不是 openspec 專案」類錯誤，與該資料夾不存在時得到同一種結果

#### Scenario: 加入專案時路徑無法解析

- **WHEN** 使用者加入專案時給出的路徑無法 canonical 化
- **THEN** 系統拒絕加入並告知該路徑不是既存資料夾，設定中 MUST NOT 留下該筆

### Requirement: 錯誤分類
系統 SHALL 將取得清單的失敗情形分為三類並以可區分的型別對外回報：(1) CLI 不可用（找不到執行檔）；(2) 目標路徑不是 openspec 專案；(3) 呼叫或解析失敗（spawn 錯誤、非預期輸出、JSON 解析失敗）。

執行通道回報的逾時與輸出截斷 SHALL 歸入第三類。此二者在部分執行形態下是帶旗標的正常回傳而非例外，系統 MUST NOT 因其形式上成功而略過分類，也 MUST NOT 以被截斷的輸出解析出結果。CLI 程序被外部終止（既無結束代碼，亦非逾時或截斷）SHALL 同樣歸入第三類。

四條讀取路——change 清單、change 詳情、spec 清單、spec 全文——SHALL 套用同一套分類，同一種失敗在任何一條路上 SHALL 得到同一類結果；目標路徑不可用（不存在、不是資料夾、授權失敗）在四條路上 SHALL 皆歸第二類。

所有讀取路的失敗 SHALL 以回傳值表達，MUST NOT 讓例外逸出至呼叫端——通道本身出事（執行檔解析鏈失敗、外殼呼叫拋出）時 SHALL 收成第三類回報。逸出的例外會使畫面停在載入中或靜默留空，使用者因而看不到任何錯誤說明。

#### Scenario: CLI 不可用
- **WHEN** openspec 執行檔不存在或無法啟動
- **THEN** 系統回報「CLI 不可用」類錯誤

#### Scenario: 呼叫或解析失敗
- **WHEN** CLI 程序異常結束且輸出不是可解析的診斷 JSON，或 stdout 無法解析
- **THEN** 系統回報「呼叫或解析失敗」類錯誤

#### Scenario: 指令未於上限內結束
- **WHEN** CLI 呼叫超過執行通道的逾時上限而被終止
- **THEN** 系統回報「呼叫或解析失敗」類錯誤並指出未於上限內結束，MUST NOT 呈現為空清單

#### Scenario: 指令輸出被截斷
- **WHEN** CLI 的輸出超過執行通道的上限而被截斷
- **THEN** 系統回報「呼叫或解析失敗」類錯誤，MUST NOT 解析被截斷的輸出

#### Scenario: 程序被外部終止
- **WHEN** CLI 程序被外部終止，既未回報結束代碼，也未觸及逾時或輸出上限
- **THEN** 系統回報「呼叫或解析失敗」類錯誤，MUST NOT 呈現為空清單

#### Scenario: 通道本身出事不讓例外逸出
- **WHEN** 取得清單、詳情、spec 清單或 spec 全文時，執行通道本身拋出例外（如執行檔解析鏈失敗）
- **THEN** 該次請求回報「呼叫或解析失敗」類錯誤，畫面顯示錯誤說明，MUST NOT 停在載入中或靜默留空

#### Scenario: spec 全文的目標不可用歸第二類
- **WHEN** 目標路徑不可用（未選專案、資料夾不存在或授權失敗）時開啟一份 spec 全文
- **THEN** 系統回報「目標路徑不是 openspec 專案」類錯誤，與 change 清單、change 詳情、spec 清單三條路得到同一類結果

### Requirement: 非 openspec 專案的判定以 root 路徑比對為準
系統判定「目標路徑不是 openspec 專案」時，SHALL 比對 CLI 回傳的 `root.path` 與目標專案路徑是否一致，且比對的兩邊 SHALL 皆為 canonical 化後的路徑；並 SHALL 處理 CLI exit code 非 0 時的 JSON 診斷 payload；MUST NOT 以 `root.source` 的特定值（如 `implicit`）作為唯一判準。路徑相符但 `root.source` 為 `implicit`（CLI 找不到任何 root、退回 cwd）時 SHALL 同樣判為非 openspec 專案——`root.source` 在此作為路徑比對之外的補強訊號使用。

#### Scenario: root 解析落到別處
- **WHEN** CLI 成功回傳但 `root.path` 與目標專案路徑不一致（如機器設有 global defaultStore、或目標是其他 openspec repo 的子目錄）
- **THEN** 系統回報「目標路徑不是 openspec 專案」類錯誤，而非顯示來自其他 root 的資料

#### Scenario: CLI 找不到 root 而退回 cwd
- **WHEN** 目標路徑無 openspec root 且機器未註冊 store、未設 global defaultStore（CLI 以 exit 0 回傳 `root.source: "implicit"`，且 `root.path` 與目標路徑相符）
- **THEN** 系統回報「目標路徑不是 openspec 專案」類錯誤，而非當成有效專案的空清單

#### Scenario: CLI 以診斷 payload 失敗
- **WHEN** CLI exit code 非 0 且 stdout 為含診斷資訊的 JSON（如機器有註冊 store 但目標路徑無 openspec root）
- **THEN** 系統解析該 payload 並回報「目標路徑不是 openspec 專案」類錯誤，不當作解析失敗

#### Scenario: 目標路徑經過 symlink
- **WHEN** 目標專案是一個有效的 openspec 專案，但設定中記錄的路徑經過 symlink
- **THEN** 系統判定其為有效專案並正常呈現清單，MUST NOT 因兩邊路徑字面不同而誤判為非 openspec 專案

### Requirement: 單一 change 詳情以單次打包取得
系統取得某 change 的詳情時，SHALL 執行一次 `openspec status --change <name> --json` 取得 artifact 清單與檔案路徑，並於同一請求內讀齊全部已存在的 artifact 檔案內容一併回傳；前端切換 tab 時 MUST NOT 追加資料請求。artifact 清單內容與順序 SHALL 沿用 CLI 回傳結果，MUST NOT 寫死 artifact 名稱（custom schema 必須可用）。

#### Scenario: 單次請求含全部內容
- **WHEN** 某 change 有 proposal／design／tasks 三個已存在的 artifact 且詳情被請求
- **THEN** 一次請求即回傳三者的 tabs 資訊與全部檔案內容，切 tab 不再發出請求

#### Scenario: custom schema 的 artifact 集合
- **WHEN** 目標 change 使用非預設 schema、artifact 集合與名稱不同
- **THEN** 回傳的 artifact 清單完整反映 CLI 輸出，無寫死名稱造成的缺漏

### Requirement: 讀檔範圍限定於引擎回傳路徑
系統讀取 artifact 內容時，SHALL 僅讀取 CLI `artifactPaths` 所列的檔案路徑，MUST NOT 提供依任意路徑讀取檔案的能力；詳情回應 MUST NOT 包含 `artifactPaths` 未列出的檔案內容。

清單摘錄為此規則的唯一例外，且其範圍 SHALL 從嚴界定：摘錄讀取的目標 SHALL 僅為目標專案 `openspec/changes/<change-name>/proposal.md` 這一條由慣例決定的固定路徑，其中 `<change-name>` SHALL 取自 CLI 清單輸出、MUST NOT 來自呼叫端輸入；解析後的路徑逸出該 change 目錄時 SHALL 視同讀取失敗。摘錄通道 SHALL 只對外提供 `## Why` 第一段這一個段落，MUST NOT 使 proposal 的其餘段落、全文或任何其他檔案內容進入清單回應。此例外 MUST NOT 擴及詳情通道——詳情仍完全受本需求前段約束。

#### Scenario: 白名單外的檔案不外流
- **WHEN** change 目錄內存在 `artifactPaths` 未列出的檔案（如 `.openspec.yaml`）
- **THEN** 詳情回應不含該檔案的內容

#### Scenario: 摘錄不外流全文
- **WHEN** 某 change 的 proposal 有數百行且其 `## Why` 第一段被抽出
- **THEN** 清單回應僅含該段落，不含 proposal 的其餘內容

#### Scenario: 摘錄只讀固定路徑
- **WHEN** 清單摘錄被取得
- **THEN** 系統對每個 change 僅嘗試讀取其 change 目錄下的 `proposal.md`，不讀取該目錄下的其他檔案

#### Scenario: 路徑逸出視同失敗
- **WHEN** 某個 change 名稱經解析後會使目標路徑落在該 change 目錄之外
- **THEN** 系統不讀取該路徑，該筆摘錄為空

### Requirement: 詳情的缺件與錯誤分類
詳情取得的失敗情形 SHALL 沿用既有三類錯誤分類。其中：artifact 無既存檔案 SHALL 標示為缺件而非錯誤；`artifactPaths` 已列出的檔案讀取失敗、以及 change 不存在（CLI 回報 change 層錯誤，如已被 archive）SHALL 歸「呼叫或解析失敗」類，並附 CLI 或系統的診斷訊息。

#### Scenario: 缺件不是錯誤
- **WHEN** 某 change 的 design 尚無檔案（existingOutputPaths 為空）
- **THEN** 詳情正常回傳，design 標示為缺件，整體不回報錯誤

#### Scenario: change 已不存在
- **WHEN** 詳情請求的 change 已被 archive，CLI 回報 change 找不到
- **THEN** 系統回報「呼叫或解析失敗」類錯誤並附 CLI 診斷訊息

### Requirement: 檔案變動通知

系統 SHALL 提供變動通知的訂閱通道：目標專案 `openspec/changes/` 底下任何檔案或目錄的新增、修改、刪除，SHALL 於短暫延遲後通知所有訂閱者。通知 SHALL 為粗粒度——MUST NOT 帶個別 change 或檔案的細節，訂閱者收到後自行重取資料；短時間內的連環變動 SHALL 合併為一則通知；`openspec/changes/` 以外的檔案變動 MUST NOT 觸發通知。切換目標專案後，通知來源 SHALL 跟隨改為新目標專案，原專案的變動 MUST NOT 再觸發通知。

連環變動合併為一則的保證 SHALL 由本通道自己負責，MUST NOT 假定底層的檔案監看機制已經合併過——部分形態的監看機制即使設了延遲，仍是把一批變動逐則送上來。

監看的目標路徑 SHALL 為解開 symlink 後的實際位置。變動事件回報的是實際位置，監看路徑與它不一致時，「這則變動落不落在 `openspec/changes/` 底下」的判斷會把每一則都當成範圍外。

#### Scenario: 單檔修改觸發通知

- **WHEN** 外部工具修改 `openspec/changes/<name>/tasks.md`
- **THEN** 訂閱者於短暫延遲後收到一則「有變動」通知，通知不含 change 名稱或檔案路徑

#### Scenario: 連環寫入合併

- **WHEN** 外部工具在短時間內連續寫入多個檔案（如 git 操作或 AI agent 批次改檔）
- **THEN** 訂閱者僅收到一則合併後的通知，而非每檔一則

#### Scenario: 底層逐則送上來仍只得一則

- **WHEN** 底層監看機制把一批變動逐則送上通道
- **THEN** 訂閱者仍只收到一則通知，而非每則一次

#### Scenario: 範圍外變動不通知

- **WHEN** 目標專案 `openspec/changes/` 以外的檔案（如 `src/` 下的程式碼）被修改
- **THEN** 不發出任何通知

#### Scenario: 經 symlink 加入的專案照常通知

- **WHEN** 目標專案的路徑經過 symlink，外部工具修改該專案 `openspec/changes/` 底下的檔案
- **THEN** 訂閱者照常收到通知，MUST NOT 因路徑寫法不同而把變動判為範圍外

#### Scenario: 切換後通知跟隨

- **WHEN** 使用者從專案 A 切換至專案 B 後，外部工具分別修改 A 與 B 的 `openspec/changes/` 內容
- **THEN** 只有 B 的變動觸發通知

#### Scenario: 目標未實際改變時不重接

- **WHEN** 使用者加入一個已經是目前目標的專案、切換到目前這個專案，或移除的不是目前目標的專案
- **THEN** 通知來源不重接，既有的通知照常送達

#### Scenario: 設定寫入失敗仍跟隨新目標

- **WHEN** 使用者切換目標專案，而應用程式設定的寫入失敗
- **THEN** 通知來源仍跟隨改為新目標專案

#### Scenario: 切換前已在合併等待中的變動仍送出一則

- **WHEN** 目標專案的變動已進入合併等待、尚未送出通知，此時使用者切換到另一個專案
- **THEN** 該則通知照常送出；通知不帶內容，訂閱者收到後重取的是新目標專案的資料

#### Scenario: changes 目錄本身出現不單獨觸發通知

- **WHEN** 通知由執行形態自持、在同一個行程內傳遞，目標專案原本沒有 `openspec/changes/`，該目錄被建立但底下還沒有任何檔案
- **THEN** 不發出通知；直到該目錄底下出現第一個檔案才通知

#### Scenario: 訂閱後隨即取消不留下監看

- **WHEN** 訂閱者在監看尚未接上之前就取消訂閱
- **THEN** 監看接上後立即收掉，MUST NOT 留下沒有訂閱者的監看；其後新的訂閱者仍能接上並收到通知

### Requirement: 通知通道之韌性

通知經由會斷線的傳輸通道傳遞時，該通道斷線後 SHALL 自動重連，且 MUST NOT 顯示任何錯誤提示。重連成功後 SHALL 視同收到一次變動通知（補償重載）——斷線期間發生的變動可能已遺失且不會重播，訂閱者以一次重取補齊；首次建立連線 MUST NOT 觸發補償（掛載載入已涵蓋）。

通知在同一個行程內直接傳遞、沒有可斷的傳輸通道時，系統 MUST NOT 補發任何通知——沒有遺失就沒有要補的東西，多補一次只是多一趟引擎呼叫。

通知能力不可用（如監看目錄不存在、監看啟動失敗）時，清單與詳情的既有功能 SHALL 照常運作，僅失去自動刷新——手動 refresh 仍為可用的後備。

#### Scenario: 斷線自動重連

- **WHEN** 通知經由會斷線的傳輸通道傳遞，該通道因連線中斷而失效後又可恢復
- **THEN** 通道自動重新建立，期間與之後皆無錯誤提示，恢復後通知照常送達

#### Scenario: 重連後補償重載

- **WHEN** 上述通道斷線期間目標專案的 `openspec/changes/` 發生變動，其後通道重連成功
- **THEN** 訂閱者於重連成功時收到一次補償通知並重取資料，畫面不停留在斷線前的舊資料

#### Scenario: 同行程傳遞不補發

- **WHEN** 通知在同一個行程內直接傳遞，訂閱建立後目標專案沒有任何變動
- **THEN** 訂閱者不收到任何通知，MUST NOT 因訂閱建立本身而重取資料

#### Scenario: 通知不可用不影響既有功能

- **WHEN** 通知通道無法建立
- **THEN** 清單載入、詳情檢視與手動 refresh 全部照常運作

### Requirement: task 勾選寫入通道
gateway SHALL 提供翻轉 task 勾選狀態的寫入方法——App 的唯一寫入通道。單次寫入請求 SHALL 可指定一個或多個目標行，全部目標行 SHALL 落在同一份 tasks 檔案；單顆 checkbox 的點擊即為只帶一個目標行的情形，MUST NOT 另闢第二條寫入通道。多個目標行的寫入 SHALL 以單次讀取、單次寫回完成，MUST NOT 逐行分次寫檔。寫入 SHALL 為檔案層操作，MUST NOT 經 openspec CLI 改寫內容；進度數字仍由引擎於後續讀取時重算，系統 MUST NOT 自行推導。寫入目標 SHALL 由當前執行形態以 CLI 回傳的 tasks artifact `artifactPaths` 解析，MUST NOT 信任呼叫端提供的檔案路徑；tasks artifact 以外的檔案 MUST NOT 可經此通道寫入。

不含任何目標行的寫入請求 SHALL 被拒絕並回報失敗，MUST NOT 讀取或寫入任何檔案——沒有目標行的寫入沒有可觀察的意義，照常執行只會把原樣內容再寫回一次。

解析結果若被重用以省去重複的 CLI 呼叫，該重用 SHALL 以目標專案與 change 名**共同**識別，MUST NOT 僅以 change 名識別——不同專案可有同名 change，只以 change 名識別會把寫入導向另一個專案的檔案。切換目標專案後對同名 change 的寫入 SHALL 落在切換後的專案。

重用前 SHALL 確認目標專案仍可達，且 SHALL 確認先前解析所指的檔案仍然存在；任一項不成立即 SHALL 重新解析，MUST NOT 沿用過期的結果寫入。確認檔案是否存在的通道自己失敗時 SHALL 視同檔案已不在而重新解析——重新問一趟引擎的代價遠低於寫錯檔案。

#### Scenario: 勾選寫入成功
- **WHEN** 呼叫端對某 change 的 tasks 檔案某行發出勾選請求，且該行內容與呼叫端所見一致
- **THEN** 該行的勾選標記翻轉並寫回檔案，回應成功

#### Scenario: 多行一次寫入
- **WHEN** 呼叫端於單次請求中指定同一份 tasks 檔案的 N（N > 1）個目標行，且每一行的內容都與呼叫端所見一致
- **THEN** N 行的勾選標記在一次檔案寫入中全部翻轉，回應成功，且該檔案 MUST NOT 被寫入超過一次

#### Scenario: 路徑由伺服端解析
- **WHEN** 呼叫端發出勾選請求（僅含 change 名稱、目標行號與各行原文）
- **THEN** 當前執行形態自行解析 tasks artifact 的檔案路徑後寫入，呼叫端無從指定任意路徑

#### Scenario: 非 tasks 檔案拒絕寫入
- **WHEN** 勾選請求的目標 change 其 tasks artifact 無既存檔案
- **THEN** 寫入被拒絕並回報錯誤，不寫入任何其他檔案

#### Scenario: 同名 change 不跨專案串線
- **WHEN** 使用者先於專案 A 對某 change 勾選成功，接著切換到同樣含有同名 change 的專案 B，對該 change 發出勾選請求
- **THEN** 寫入落在專案 B 的該 change tasks 檔案，專案 A 的檔案 MUST NOT 被改動

#### Scenario: 沒有目標行的請求
- **WHEN** 寫入請求不含任何目標行
- **THEN** 請求被拒絕並回報失敗，MUST NOT 讀取或寫入任何檔案

#### Scenario: 重用前目標專案已不可達
- **WHEN** 先前已解析過某 change 的 tasks 檔案位置，其後目標專案資料夾不可達（外接碟未掛載、路徑被改名），使用者對該 change 發出勾選請求
- **THEN** 回報「取不到目標專案」的失敗，MUST NOT 沿用先前解析的路徑寫入

#### Scenario: 重用所指的檔案已不在
- **WHEN** 先前解析所指的 tasks 檔案已不存在（或該確認本身無法完成），使用者對該 change 發出勾選請求
- **THEN** 重新向引擎解析一次檔案位置後再寫入

### Requirement: 勾選寫入的併發安全
寫入前系統 SHALL 重新讀取目標檔案，並逐一比對每個目標行的當前內容與呼叫端提供的該行原文：全部一致 SHALL 僅翻轉這些行的勾選標記（`[ ]`↔`[x]`），這些行的其餘內容與檔案其他部分 MUST NOT 變動（含換行格式）；任一目標行不一致 SHALL 放棄整次寫入並回報衝突——多行請求 SHALL 為全有全無，MUST NOT 部分寫入或跳過不符的行。衝突 SHALL 為可區分的回報類別，與其他寫入失敗（IO 錯誤、路徑解析失敗）不同。

#### Scenario: 目標行已變則放棄
- **WHEN** 呼叫端所見的行內容與寫入前重讀的該行不一致（外部工具已改寫）
- **THEN** 檔案不被寫入，回報衝突類別，呼叫端可據以提示並重取

#### Scenario: 批次中單行不符則整批放棄
- **WHEN** 單次請求指定 N（N > 1）個目標行，其中僅一行的當前內容與呼叫端所見不一致
- **THEN** 檔案完全不被寫入，其餘 N−1 行亦 MUST NOT 被翻轉，回報衝突類別

#### Scenario: 其他行變動不阻擋
- **WHEN** 檔案其他行已被外部修改，但所有目標行的內容與呼叫端所見一致
- **THEN** 寫入照常進行，僅翻轉目標行的勾選標記，其他行維持外部修改後的內容

#### Scenario: 僅翻轉勾選標記
- **WHEN** 目標行為含縮排或大寫勾選標記（如 `  - [X]`）的 task 項目且寫入成立
- **THEN** 寫回後該行僅勾選標記改變，縮排、文字與檔案其餘 byte（含換行格式）完全不變

### Requirement: 可勾選項的判定一致性
伺服端認定「可翻轉的 task 行」的判定 SHALL 與前端渲染為可互動 checkbox 的判定一致——前端可點的項目，伺服端 SHALL 認得並可翻轉（在行內容一致的前提下）；MUST NOT 出現畫面可點、伺服端不認的項目。

#### Scenario: 縮排子項可翻轉
- **WHEN** tasks 檔案含縮排的子 task 項目且使用者於畫面點擊它
- **THEN** 伺服端認定該行為可翻轉的 task 行，寫入照常進行

### Requirement: specs 清單以單次 CLI 呼叫取得
系統 SHALL 以單次引擎清單呼叫（`--json`）取得目標專案的 capability spec 清單，每筆含 spec 識別名與 requirement 數；排序 SHALL 沿用引擎輸出，系統 MUST NOT 自行排序或補充引擎未提供的欄位。失敗情形 SHALL 沿用既有的三類錯誤分類。

#### Scenario: 取得清單
- **WHEN** 目標專案有多個 capability spec
- **THEN** 單次 CLI 呼叫回傳全部 spec 的識別名與 requirement 數，順序與引擎輸出一致

#### Scenario: 呼叫失敗
- **WHEN** CLI 程序異常結束或輸出無法解析
- **THEN** 系統依既有錯誤分類回報「呼叫或解析失敗」類錯誤

### Requirement: spec 內容以原始 Markdown 取得
系統 SHALL 以單次 CLI 呼叫取得單一 spec 的原始 Markdown 全文，內容原樣轉交、MUST NOT 解析或改寫；指定的 spec 不存在或呼叫失敗時 SHALL 依既有錯誤分類回報，MUST NOT 回傳空內容偽裝成功。

#### Scenario: 取得內容
- **WHEN** 呼叫端要求某個存在的 spec
- **THEN** 回傳該 spec 的 Markdown 全文原文

#### Scenario: spec 不存在
- **WHEN** 呼叫端要求的 spec 識別名不存在
- **THEN** 系統回報錯誤（依既有分類），不回傳空內容

### Requirement: CLI 執行檔解析

系統 SHALL 依下列優先序決定 spawn 的 openspec 執行檔：使用者持久化的明示覆寫 ＞ 自動偵測結果。自動偵測 SHALL 依序嘗試：(1) 直接以命令名執行，藉此吃到行程本身的 PATH；(2) 借使用者 login shell 的環境解析命令位置，並取得絕對路徑。第二階段 SHALL 設有逾時上限，逾時視同該階段未命中；執行環境不具備 login shell 能力時 SHALL 跳過該階段。兩階段皆未命中且無明示覆寫時，系統 SHALL 回報 CLI 不可用（沿用既有錯誤分類），MUST NOT 靜默失敗。

解析結果 SHALL 由當前執行形態自行持有、可於執行期更換的狀態；更換後所有資料請求 SHALL 使用新的執行檔，MUST NOT 要求個別請求自行指定執行檔。桌面形態的解析 MUST NOT 依賴本地 API server——該形態下它不存在。系統 MUST NOT 維護一份寫死的常見安裝位置清單作為偵測手段。

第一階段以命令名命中時，系統 SHALL 另行查出該命令名對應的絕對路徑並以絕對路徑呈現，使 Settings 顯示的是檔案位置而不是命令名。該查詢 SHALL 設有逾時上限，查不出來時 SHALL 退回顯示命令名，MUST NOT 因此讓整個解析失敗。

#### Scenario: 行程 PATH 即可命中

- **WHEN** openspec 位於行程本身的 PATH 上
- **THEN** 系統以該執行檔運作，不進入 login shell 階段

#### Scenario: 行程 PATH 未命中而 login shell 命中

- **WHEN** 行程 PATH 上沒有 openspec，但使用者 login shell 的環境找得到（如 GUI 啟動不繼承 shell PATH 的情形）
- **THEN** 系統取得其絕對路徑並以該執行檔運作

#### Scenario: 明示覆寫優先於偵測

- **WHEN** 使用者已持久化一個明示覆寫路徑，且行程 PATH 上另有一個 openspec
- **THEN** 系統使用明示覆寫的執行檔

#### Scenario: 全數未命中

- **WHEN** 無明示覆寫，且兩個偵測階段皆未命中
- **THEN** 系統回報「CLI 不可用」類錯誤

#### Scenario: login shell 逾時

- **WHEN** login shell 解析未於逾時上限內完成
- **THEN** 該階段視同未命中，系統不因此無限期等待

#### Scenario: 執行期更換

- **WHEN** 使用者於執行期套用新的執行檔路徑後重新取得清單
- **THEN** 資料來自以新執行檔進行的呼叫，請求本身未附帶執行檔路徑

#### Scenario: 第一階段命中時顯示絕對路徑

- **WHEN** openspec 位於行程本身的 PATH 上，系統以命令名命中
- **THEN** Settings 顯示該執行檔的絕對路徑，不是命令名

#### Scenario: 絕對路徑查不出來

- **WHEN** 第一階段命中，但還原絕對路徑的查詢失敗或逾時
- **THEN** 系統仍以該執行檔運作，Settings 退回顯示命令名

#### Scenario: 桌面形態自行完成解析

- **WHEN** App 以桌面形態啟動，本地 API server 未執行
- **THEN** 系統仍完成解析並在 Settings 呈現結果（成功時含絕對路徑，失敗時含可據以排除問題的訊息）

### Requirement: CLI 執行檔的驗證通道

系統 SHALL 提供驗證指定執行檔的通道：以 `--version` 執行該路徑，成功時回傳其版本字串，失敗時回傳可據以排除問題的診斷訊息。驗證 MUST NOT 因驗證失敗而改變目前生效的解析結果。

#### Scenario: 驗證成功回版本

- **WHEN** 以有效的 openspec 執行檔路徑請求驗證
- **THEN** 系統回傳成功與該執行檔的版本字串

#### Scenario: 驗證失敗附訊息

- **WHEN** 以不存在或不可執行的路徑請求驗證
- **THEN** 系統回傳失敗與診斷訊息，且目前生效的執行檔不變

### Requirement: 環境診斷通道

系統 SHALL 提供取得環境診斷的通道，涵蓋：應用程式設定檔的絕對路徑、目前目標專案路徑（無目標時明確表達為無）、檔案變動通知是否已接上、App 版本，以及「開啟檔案所在位置」在此執行環境是否可用。系統 SHALL 提供開啟指定檔案所在位置的通道，其可用性判定 SHALL 由當前執行形態負責，前端 MUST NOT 自行判斷平台。

診斷中的某一項在當前執行形態尚無對應通道可問時，系統 SHALL 明確表達為未知，MUST NOT 以其他執行形態的答案或預設值充數——「未知」與「否」在畫面上必須分得出來。

檔案變動通知一項 SHALL 在任何執行形態都回報明確的是或否，MUST NOT 回報未知——每個形態都問得到自己的監看有沒有建立起來。該項的語意 SHALL 為「監看有沒有接上」，MUST NOT 為「監看此刻是否仍有效」：監看建立之後失效的訊號並非每個形態都取得到，以「此刻是否仍有效」為語意會讓取不到訊號的形態在監看已死時仍回報為是，那是一句講不準的話。

#### Scenario: 取得診斷

- **WHEN** 請求環境診斷
- **THEN** 回傳設定檔路徑、目前專案路徑、通知是否已接上、App 版本與開啟位置能力

#### Scenario: 通知未運作

- **WHEN** 檔案變動監看建立失敗（無目標專案、監看目錄不存在或監看啟動失敗）
- **THEN** 診斷回報通知未接上，其餘欄位照常回傳

#### Scenario: 目標路徑解析或授權失敗同樣回報未接上

- **WHEN** 目標專案的實際路徑無法解析、取不到檔案存取授權，或該路徑已不是既存資料夾
- **THEN** 診斷回報通知未接上，與無目標專案同一種答案；系統不自動重試，直到目標專案再次改變

#### Scenario: 接上之後失效仍回報已接上

- **WHEN** 檔案變動監看成功建立後，目標專案資料夾被搬走或刪除，而當前執行形態取不到監看失效的訊號
- **THEN** 診斷仍回報通知已接上，MUST NOT 因此改回未知——主區此時已明確呈現該專案讀不到

#### Scenario: 能力判定在伺服端

- **WHEN** 執行環境不支援開啟檔案所在位置
- **THEN** 診斷回傳該能力為不可用，前端據此呈現而不自行判斷平台

#### Scenario: 該形態尚無通道可問

- **WHEN** 在桌面形態請求環境診斷，而開啟所在位置的通道尚未於該形態具備
- **THEN** 該項回報為未知並在畫面上以未知呈現，設定檔路徑、目前專案路徑、通知是否已接上與 App 版本照常回傳

