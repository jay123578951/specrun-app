## ADDED Requirements

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
