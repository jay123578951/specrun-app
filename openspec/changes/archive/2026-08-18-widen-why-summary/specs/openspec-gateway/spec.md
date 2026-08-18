## REMOVED Requirements

### Requirement: 清單項目的 Why 摘錄
**Reason**: 抽取單位由「第一段的首句」改為「第一段全文」，句末判定的全部規則（中英文句末標點、半形句號需後接空白的保護、縮寫誤切的已知代價、無句末標點時的退回行為）隨之失去對象，其對應的四條 scenario 皆已無從驗證。此為抽取語意的置換而非既有行為的調整，故整條移除後以新需求取代。

**Migration**: 由本 delta 的「清單項目的 Why 段落摘錄」承接。摘錄欄位的名稱、型別、來源路徑與空值降級行為皆不變，呼叫端無須調整；唯一可觀察的差異是該欄位的內容自首句擴為整段（實測平均 74 → 143 字元），截斷改由呈現層負責。

## ADDED Requirements

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

## MODIFIED Requirements

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
