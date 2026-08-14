## ADDED Requirements

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
