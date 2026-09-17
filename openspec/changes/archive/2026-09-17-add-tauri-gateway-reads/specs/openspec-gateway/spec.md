## MODIFIED Requirements

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
