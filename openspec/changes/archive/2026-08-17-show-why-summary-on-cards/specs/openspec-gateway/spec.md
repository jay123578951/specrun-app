## ADDED Requirements

### Requirement: 清單項目的 Why 摘錄
清單資料的每一筆 SHALL 帶一個 Why 摘錄欄位。摘錄 SHALL 為該 change proposal 中 `## Why`（任意層級標題，不分大小寫）之後第一段的首句，去除行內 Markdown 記號後的純文字；句末以中英文句號、問號、驚嘆號判定，半形句號 SHALL 僅在其後接空白或字串結尾時才視為句末——句號後緊接非空白字元的寫法（`design.md`、`v1.2`）因此 SHALL NOT 被攔腰截斷；段落中找不到句末時 SHALL 回傳整段文字，長度截斷交由呈現層處理。摘錄 MUST NOT 經 LLM 或任何生成式加工。

後接空白的英文縮寫（`e.g. `、`i.e. `）在字元層與真正的句末無從分辨，SHALL NOT 納入上述保護——此處刻意不引入縮寫詞表，摘錄偶爾在縮寫處提早結束 SHALL 為可接受行為。

下列情形 SHALL 一律回傳空摘錄，且 MUST NOT 使該筆項目或整份清單回報錯誤：proposal 檔案不存在、讀取失敗、無 `## Why` 段落、該段落為空。active 與 parked 兩側的摘錄 SHALL 適用同一套抽取與降級規則。

#### Scenario: 抽出首句
- **WHEN** 某 change 的 proposal `## Why` 段落首句為「卡片目前只有 change 名稱，使用者無法在清單層判斷用途。後續說明。」
- **THEN** 該筆項目的摘錄為「卡片目前只有 change 名稱，使用者無法在清單層判斷用途。」，不含後續句子

#### Scenario: 半形句號不誤切
- **WHEN** 某 change 的 Why 首句含「細節見 design.md 的第二節。」
- **THEN** 摘錄保留完整首句，MUST NOT 在 `design.` 處截斷

#### Scenario: 後接空白的縮寫不受保護
- **WHEN** 某 change 的 Why 首句為「See e.g. the second section. Rest.」
- **THEN** 摘錄為「See e.g.」——縮寫處提早結束是這條判準的已知代價，不回報錯誤

#### Scenario: 段落無句末標點
- **WHEN** 某 change 的 Why 段落為單一段落且完全不含句末標點
- **THEN** 摘錄為該段落全文，不回報錯誤

#### Scenario: 無 proposal 檔案
- **WHEN** 某 change 目錄下沒有 proposal 檔案
- **THEN** 該筆項目的摘錄為空字串，清單其餘項目照常回傳且整體不回報錯誤

#### Scenario: 無 Why 段落
- **WHEN** 某 change 的 proposal 存在但不含任何 `## Why` 標題
- **THEN** 該筆項目的摘錄為空字串，不回報錯誤

## MODIFIED Requirements

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

### Requirement: 讀檔範圍限定於引擎回傳路徑
系統讀取 artifact 內容時，SHALL 僅讀取 CLI `artifactPaths` 所列的檔案路徑，MUST NOT 提供依任意路徑讀取檔案的能力；詳情回應 MUST NOT 包含 `artifactPaths` 未列出的檔案內容。

清單摘錄為此規則的唯一例外，且其範圍 SHALL 從嚴界定：摘錄讀取的目標 SHALL 僅為目標專案 `openspec/changes/<change-name>/proposal.md` 這一條由慣例決定的固定路徑，其中 `<change-name>` SHALL 取自 CLI 清單輸出、MUST NOT 來自呼叫端輸入；解析後的路徑逸出該 change 目錄時 SHALL 視同讀取失敗。摘錄通道 SHALL 只對外提供抽取後的單一句子，MUST NOT 使 proposal 全文或任何其他檔案內容進入清單回應。此例外 MUST NOT 擴及詳情通道——詳情仍完全受本需求前段約束。

#### Scenario: 白名單外的檔案不外流
- **WHEN** change 目錄內存在 `artifactPaths` 未列出的檔案（如 `.openspec.yaml`）
- **THEN** 詳情回應不含該檔案的內容

#### Scenario: 摘錄不外流全文
- **WHEN** 某 change 的 proposal 有數百行且其 `## Why` 首句被抽出
- **THEN** 清單回應僅含該首句，不含 proposal 的其餘內容

#### Scenario: 摘錄只讀固定路徑
- **WHEN** 清單摘錄被取得
- **THEN** 系統對每個 change 僅嘗試讀取其 change 目錄下的 `proposal.md`，不讀取該目錄下的其他檔案

#### Scenario: 路徑逸出視同失敗
- **WHEN** 某個 change 名稱經解析後會使目標路徑落在該 change 目錄之外
- **THEN** 系統不讀取該路徑，該筆摘錄為空
