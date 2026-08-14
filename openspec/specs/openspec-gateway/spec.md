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
系統 SHALL 以環境變數指定的路徑作為目標專案；未指定時 SHALL fallback 至 App 自身 repo 路徑。

#### Scenario: 環境變數指定
- **WHEN** 環境變數設為某個 openspec 專案路徑
- **THEN** 清單資料來自該路徑的專案

#### Scenario: 未指定時 fallback
- **WHEN** 環境變數未設定
- **THEN** 清單資料來自 App 自身 repo（dogfooding）

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
