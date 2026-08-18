## MODIFIED Requirements

### Requirement: task 勾選寫入通道
gateway SHALL 提供翻轉 task 勾選狀態的寫入方法——App 的唯一寫入通道。單次寫入請求 SHALL 可指定一個或多個目標行，全部目標行 SHALL 落在同一份 tasks 檔案；單顆 checkbox 的點擊即為只帶一個目標行的情形，MUST NOT 另闢第二條寫入通道。多個目標行的寫入 SHALL 以單次讀取、單次寫回完成，MUST NOT 逐行分次寫檔。寫入 SHALL 為檔案層操作，MUST NOT 經 openspec CLI 改寫內容；進度數字仍由引擎於後續讀取時重算，系統 MUST NOT 自行推導。寫入目標 SHALL 由伺服端以 CLI 回傳的 tasks artifact `artifactPaths` 解析，MUST NOT 信任呼叫端提供的檔案路徑；tasks artifact 以外的檔案 MUST NOT 可經此通道寫入。

#### Scenario: 勾選寫入成功
- **WHEN** 呼叫端對某 change 的 tasks 檔案某行發出勾選請求，且該行內容與呼叫端所見一致
- **THEN** 該行的勾選標記翻轉並寫回檔案，回應成功

#### Scenario: 多行一次寫入
- **WHEN** 呼叫端於單次請求中指定同一份 tasks 檔案的 N（N > 1）個目標行，且每一行的內容都與呼叫端所見一致
- **THEN** N 行的勾選標記在一次檔案寫入中全部翻轉，回應成功，且該檔案 MUST NOT 被寫入超過一次

#### Scenario: 路徑由伺服端解析
- **WHEN** 呼叫端發出勾選請求（僅含 change 名稱、目標行號與各行原文）
- **THEN** 伺服端自行解析 tasks artifact 的檔案路徑後寫入，呼叫端無從指定任意路徑

#### Scenario: 非 tasks 檔案拒絕寫入
- **WHEN** 勾選請求的目標 change 其 tasks artifact 無既存檔案
- **THEN** 寫入被拒絕並回報錯誤，不寫入任何其他檔案

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
