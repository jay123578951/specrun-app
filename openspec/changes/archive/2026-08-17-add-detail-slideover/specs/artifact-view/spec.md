# artifact-view Delta

## REMOVED Requirements

### Requirement: 詳情開啟與收合變形

**Reason**: 詳情呈現改為 slideover 覆蓋模型，清單不再變形為窄軌。
**Migration**: 由本 delta 的「詳情滑出面板」取代。

### Requirement: 窄軌互動

**Reason**: ChangeRail（窄軌）元件隨覆蓋模型移除。
**Migration**: 切換行為由本 delta 的「覆蓋檢視下的清單切換」取代。

## ADDED Requirements

### Requirement: 詳情滑出面板

點擊 change 卡片後，內容面板 SHALL 自主區右側滑入、覆蓋於卡片清單上方；清單 MUST NOT 變形、移位或重排，MUST NOT 以換頁或彈窗呈現。面板 MUST NOT 滿版：左側 SHALL 保留固定寬度的露出區，清單於露出區內維持可見與可互動。面板 SHALL 以抬升一階的底色與左緣分隔線呈現層次，MUST NOT 使用陰影，MUST NOT 使用 backdrop 或任何攔截清單互動的遮罩。面板 header SHALL 提供收合控制（收合語意的圖示，MUST NOT 使用關閉「✕」意象）與手動 refresh 控制。按 Esc、點擊收合控制、或再次點擊當前開啟的卡片，面板 SHALL 滑出收合；收合後清單捲動位置 SHALL 與開啟前一致。

#### Scenario: 點卡片滑出面板

- **WHEN** 使用者點擊某張 change 卡片
- **THEN** 內容面板自右側滑入覆蓋清單，卡片維持原位，左側露出區仍可見清單

#### Scenario: 收合控制

- **WHEN** 使用者點擊面板 header 的收合控制
- **THEN** 面板滑出收合，畫面回到完整清單，捲動位置與開啟前一致

#### Scenario: Esc 收合

- **WHEN** 使用者於面板開啟時按 Esc
- **THEN** 面板收合，行為與收合控制一致

#### Scenario: 無遮罩

- **WHEN** 面板開啟中
- **THEN** 左側露出區的清單無任何變暗或遮罩，卡片可直接點擊

### Requirement: 覆蓋檢視下的清單切換

面板開啟期間，當前開啟的 change 卡片 SHALL 以可辨識的選中狀態高亮；點擊露出區內其他卡片或按 ↑↓ 鍵 SHALL 切換至該 change，面板原地更新內容，MUST NOT 收合再重開。↑↓ 鍵切換 SHALL 依清單順序移動，切換到的卡片若在捲動範圍外 SHALL 被帶進視野。

#### Scenario: 點擊露出卡片切換

- **WHEN** 面板開啟於 change A，使用者點擊露出區內 change B 的卡片
- **THEN** 面板內容原地更新為 B，B 卡片高亮，面板不收合

#### Scenario: 鍵盤切換

- **WHEN** 面板開啟時使用者按 ↓ 鍵
- **THEN** 切換至清單順序的下一個 change，行為與點擊一致
