# openspec-gateway Delta

## ADDED Requirements

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
