# openspec-gateway Specification

## Purpose

App 取得規格資料的唯一通道：以 spawn openspec CLI（`--json`）為介面，定義呼叫策略、輸出正規化與錯誤分類，不重新實作任何規格語意。

## Requirements

### Requirement: 清單資料以單次 CLI 呼叫取得
系統取得 change 清單時 SHALL 只執行一次 `openspec list --json`，且 MUST NOT 對個別 change 追加額外的 CLI 呼叫（如逐一 `status`）。

#### Scenario: 多個 change 仍單次呼叫
- **WHEN** 目標專案有 N（N > 1）個進行中 change 且清單資料被請求
- **THEN** 系統只執行一次 CLI 程序即回傳全部 N 筆資料

### Requirement: 進度與排序沿用引擎輸出
系統 SHALL 直接使用 CLI 回傳的 `completedTasks`／`totalTasks`／`status` 與回傳順序，MUST NOT 自行解析 tasks 檔案計算進度，也 MUST NOT 重新排序。

#### Scenario: 進度數字與引擎一致
- **WHEN** CLI 回傳某 change 為 `completedTasks: 2, totalTasks: 4`
- **THEN** 系統對外呈現的進度即為 2/4，不因 App 自行讀檔而產生不同數字

#### Scenario: 順序與引擎一致
- **WHEN** CLI 以預設排序（lastModified 新→舊）回傳多筆 change
- **THEN** 系統對外提供的清單順序與 CLI 回傳順序一致

### Requirement: 目標專案路徑解析
系統 SHALL 依下列優先序決定啟動時的目標專案：環境變數（dev override）＞持久化設定的最後啟用專案＞App 伺服端工作目錄（僅於其為 openspec 專案時成立，dogfooding）；三者皆不成立時啟動於無目標專案狀態（空清單引導）。啟動後的目標專案 SHALL 為伺服端持有、可於執行期切換的狀態；切換後所有資料請求 SHALL 來自新的目標專案，MUST NOT 要求個別請求自行指定專案。

#### Scenario: 環境變數指定
- **WHEN** 環境變數設為某個 openspec 專案路徑
- **THEN** 啟動時清單資料來自該路徑的專案，即使設定中有最後啟用專案

#### Scenario: 設定檔指定
- **WHEN** 環境變數未設定且持久化設定存有最後啟用專案
- **THEN** 啟動時清單資料來自該專案

#### Scenario: 未指定時 fallback
- **WHEN** 環境變數未設定、設定中無最後啟用專案，且伺服端工作目錄為 openspec 專案
- **THEN** 清單資料來自該工作目錄（dogfooding）

#### Scenario: 執行期切換
- **WHEN** 使用者切換至另一個專案後重新取得清單
- **THEN** 資料來自切換後的專案，請求本身未附帶專案路徑

### Requirement: 錯誤分類
系統 SHALL 將取得清單的失敗情形分為三類並以可區分的型別對外回報：(1) CLI 不可用（找不到執行檔）；(2) 目標路徑不是 openspec 專案；(3) 呼叫或解析失敗（spawn 錯誤、非預期輸出、JSON 解析失敗）。

#### Scenario: CLI 不可用
- **WHEN** openspec 執行檔不存在或無法啟動
- **THEN** 系統回報「CLI 不可用」類錯誤

#### Scenario: 呼叫或解析失敗
- **WHEN** CLI 程序異常結束且輸出不是可解析的診斷 JSON，或 stdout 無法解析
- **THEN** 系統回報「呼叫或解析失敗」類錯誤

### Requirement: 非 openspec 專案的判定以 root 路徑比對為準
系統判定「目標路徑不是 openspec 專案」時，SHALL 比對 CLI 回傳的 `root.path`（canonical 化後）與目標專案路徑是否一致，並 SHALL 處理 CLI exit code 非 0 時的 JSON 診斷 payload；MUST NOT 以 `root.source` 的特定值（如 `implicit`）作為唯一判準。路徑相符但 `root.source` 為 `implicit`（CLI 找不到任何 root、退回 cwd）時 SHALL 同樣判為非 openspec 專案——`root.source` 在此作為路徑比對之外的補強訊號使用。

#### Scenario: root 解析落到別處
- **WHEN** CLI 成功回傳但 `root.path` 與目標專案路徑不一致（如機器設有 global defaultStore、或目標是其他 openspec repo 的子目錄）
- **THEN** 系統回報「目標路徑不是 openspec 專案」類錯誤，而非顯示來自其他 root 的資料

#### Scenario: CLI 找不到 root 而退回 cwd
- **WHEN** 目標路徑無 openspec root 且機器未註冊 store、未設 global defaultStore（CLI 以 exit 0 回傳 `root.source: "implicit"`，且 `root.path` 與目標路徑相符）
- **THEN** 系統回報「目標路徑不是 openspec 專案」類錯誤，而非當成有效專案的空清單

#### Scenario: CLI 以診斷 payload 失敗
- **WHEN** CLI exit code 非 0 且 stdout 為含診斷資訊的 JSON（如機器有註冊 store 但目標路徑無 openspec root）
- **THEN** 系統解析該 payload 並回報「目標路徑不是 openspec 專案」類錯誤，不當作解析失敗

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

#### Scenario: 白名單外的檔案不外流
- **WHEN** change 目錄內存在 `artifactPaths` 未列出的檔案（如 `.openspec.yaml`）
- **THEN** 詳情回應不含該檔案的內容

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

#### Scenario: 單檔修改觸發通知
- **WHEN** 外部工具修改 `openspec/changes/<name>/tasks.md`
- **THEN** 訂閱者於短暫延遲後收到一則「有變動」通知，通知不含 change 名稱或檔案路徑

#### Scenario: 連環寫入合併
- **WHEN** 外部工具在短時間內連續寫入多個檔案（如 git 操作或 AI agent 批次改檔）
- **THEN** 訂閱者僅收到一則合併後的通知，而非每檔一則

#### Scenario: 範圍外變動不通知
- **WHEN** 目標專案 `openspec/changes/` 以外的檔案（如 `src/` 下的程式碼）被修改
- **THEN** 不發出任何通知

#### Scenario: 切換後通知跟隨
- **WHEN** 使用者從專案 A 切換至專案 B 後，外部工具分別修改 A 與 B 的 `openspec/changes/` 內容
- **THEN** 只有 B 的變動觸發通知

### Requirement: 通知通道之韌性
通知通道斷線時 SHALL 自動重連，且 MUST NOT 顯示任何錯誤提示。重連成功後 SHALL 視同收到一次變動通知（補償重載）——斷線期間發生的變動可能已遺失且不會重播，訂閱者以一次重取補齊；首次建立連線 MUST NOT 觸發補償（掛載載入已涵蓋）。通知能力不可用（如監看目錄不存在、監看啟動失敗）時，清單與詳情的既有功能 SHALL 照常運作，僅失去自動刷新——手動 refresh 仍為可用的後備。

#### Scenario: 斷線自動重連
- **WHEN** 通知通道因連線中斷而失效後又可恢復
- **THEN** 通道自動重新建立，期間與之後皆無錯誤提示，恢復後通知照常送達

#### Scenario: 重連後補償重載
- **WHEN** 通知通道斷線期間目標專案的 `openspec/changes/` 發生變動，其後通道重連成功
- **THEN** 訂閱者於重連成功時收到一次補償通知並重取資料，畫面不停留在斷線前的舊資料

#### Scenario: 通知不可用不影響既有功能
- **WHEN** 通知通道無法建立
- **THEN** 清單載入、詳情檢視與手動 refresh 全部照常運作

### Requirement: task 勾選寫入通道
gateway SHALL 提供翻轉單一 task 勾選狀態的寫入方法——App 的唯一寫入通道。寫入 SHALL 為檔案層操作，MUST NOT 經 openspec CLI 改寫內容；進度數字仍由引擎於後續讀取時重算，系統 MUST NOT 自行推導。寫入目標 SHALL 由伺服端以 CLI 回傳的 tasks artifact `artifactPaths` 解析，MUST NOT 信任呼叫端提供的檔案路徑；tasks artifact 以外的檔案 MUST NOT 可經此通道寫入。

#### Scenario: 勾選寫入成功
- **WHEN** 呼叫端對某 change 的 tasks 檔案某行發出勾選請求，且該行內容與呼叫端所見一致
- **THEN** 該行的勾選標記翻轉並寫回檔案，回應成功

#### Scenario: 路徑由伺服端解析
- **WHEN** 呼叫端發出勾選請求（僅含 change 名稱、行號與該行原文）
- **THEN** 伺服端自行解析 tasks artifact 的檔案路徑後寫入，呼叫端無從指定任意路徑

#### Scenario: 非 tasks 檔案拒絕寫入
- **WHEN** 勾選請求的目標 change 其 tasks artifact 無既存檔案
- **THEN** 寫入被拒絕並回報錯誤，不寫入任何其他檔案

### Requirement: 勾選寫入的併發安全
寫入前系統 SHALL 重新讀取目標檔案，並比對目標行的當前內容與呼叫端提供的該行原文：一致 SHALL 僅翻轉該行的勾選標記（`[ ]`↔`[x]`），該行其餘內容與檔案其他部分 MUST NOT 變動（含換行格式）；不一致 SHALL 放棄寫入並回報衝突。衝突 SHALL 為可區分的回報類別，與其他寫入失敗（IO 錯誤、路徑解析失敗）不同。

#### Scenario: 目標行已變則放棄
- **WHEN** 呼叫端所見的行內容與寫入前重讀的該行不一致（外部工具已改寫）
- **THEN** 檔案不被寫入，回報衝突類別，呼叫端可據以提示並重取

#### Scenario: 其他行變動不阻擋
- **WHEN** 檔案其他行已被外部修改，但目標行內容與呼叫端所見一致
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
