## ADDED Requirements

### Requirement: 變動時自動重載
收到 gateway 變動通知後，清單 SHALL 自動重新載入。重載期間與完成後 SHALL 保留既有卡片內容——MUST NOT 清空清單、顯示 skeleton 或造成版面跳動，資料有差異時原地更新。自動重載失敗 SHALL 完全靜默：MUST NOT 顯示 toast、banner 或錯誤畫面，既有卡片保留，由下一次通知或手動 refresh 自然重試。

#### Scenario: 外部新增 change
- **WHEN** 外部工具於 `openspec/changes/` 建立新的 change
- **THEN** 清單於短暫延遲後自動出現該卡片，畫面其餘部分不變

#### Scenario: 外部更新任務進度
- **WHEN** 外部工具勾選某 change 的 tasks.md 項目
- **THEN** 該卡片的進度條與 n/m 數字於短暫延遲後自動更新

#### Scenario: 自動重載失敗靜默
- **WHEN** 通知觸發的清單重載因 spawn 或解析失敗
- **THEN** 無任何錯誤提示出現，既有卡片維持顯示

## MODIFIED Requirements

### Requirement: 手動刷新
主區 SHALL 提供手動 refresh 控制；刷新期間 SHALL 保留既有清單內容、僅於控制項上顯示進行中狀態，MUST NOT 清空清單或改回 skeleton。除掛載時載入一次、手動刷新與變動通知觸發的自動重載（見「變動時自動重載」）外，系統 MUST NOT 自動重新載入。

#### Scenario: 刷新期間保留舊資料
- **WHEN** 使用者觸發 refresh 且新資料尚未回傳
- **THEN** 畫面持續顯示原有卡片，refresh 控制項呈現進行中狀態

### Requirement: 錯誤呈現分層
錯誤呈現 SHALL 對應 gateway 的三類錯誤：CLI 不可用 → 主區常駐 banner；目標路徑不是 openspec 專案 → 主區明確提示（與「沒有 change」的空狀態可區分）；呼叫或解析失敗 → 自動消失的 toast（保留既有清單內容）。呼叫或解析失敗發生在首次載入、沒有既有清單可保留時，主區 SHALL 於卡片區另外顯示可重試的提示；四種提示（CLI 不可用／非 openspec 專案／載入失敗／無 change 空狀態）的文案 SHALL 互相可區分。本需求的失敗提示適用於掛載首次載入與手動刷新；變動通知觸發的自動重載失敗 SHALL 依「變動時自動重載」完全靜默。

#### Scenario: CLI 不可用
- **WHEN** gateway 回報 CLI 不可用
- **THEN** 主區顯示常駐 banner 說明問題

#### Scenario: 路徑不是 openspec 專案
- **WHEN** gateway 回報目標路徑不是 openspec 專案
- **THEN** 主區顯示明確提示，且其文案與「專案內無 change」的空狀態不同

#### Scenario: 暫時性失敗
- **WHEN** 已有清單顯示中且一次手動 refresh 因 spawn 或解析失敗
- **THEN** 顯示自動消失的 toast，既有卡片不消失

#### Scenario: 首次載入即失敗
- **WHEN** 首次載入因 spawn 或解析失敗，畫面沒有任何既有清單可保留
- **THEN** 卡片區顯示可重試的提示（文案與空狀態、非 openspec 專案提示均不同），toast 仍照暫時性失敗規則出現
