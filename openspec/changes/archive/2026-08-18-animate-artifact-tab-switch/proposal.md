## Why

切 artifact tab 時，底線 indicator 是「舊的原地淡出、新的原地淡入」，沒有任何位移——眼睛讀到的是跳，不是移動，tab 之間的空間關係完全沒有被表達。內容區雖已有短淡入，但時長貼在不可感知的下緣，切換讀起來像畫面閃了一下而非換了一頁。

## What Changes

- artifact tabs 的選中底線改為**一條會在 tabs 之間滑動的 indicator**：切換時自舊 tab 的位置與寬度移動到新 tab，把「從哪換到哪」演出來。
- indicator 只在**同一份 change 內換 tab** 時滑動；換 change（tabs 整批換掉）時直接就位，不從舊位置滑過去。
- 內容區的換頁淡入時長提高到可被感知的水準，並把「換 tab」與「換 change」分成不同時值——前者是同一份東西換頁，後者是身分變更。
- `ArtifactPanel` 與 `ArchivedPanel` 兩處重複的 tablist 標記抽成共用元件，indicator 的量測與滑動邏輯只存在一份，兩處行為一致。
- tabs 的對齊、間距、點擊面積與底線寬四個責任拆開歸屬，首顆 tab 不再帶任何 `first:` 特例——列的左緣對齊由 tabs 列整體承擔。
- 非目標（明確不做）：內容區的左右側滑、內容區的高度動畫、以 `<Transition mode="out-in">` 重寫成真 crossfade。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `artifact-view`：新增 tab 切換過場的行為要求（indicator 滑動、換 change 不滑、reduced motion 降級）；並把既有「覆蓋檢視下的清單切換」的內容淡入要求延伸為區分換 tab 與換 change 兩種語意。
- `archived-view`：其詳情 slideover 的動效沿用宣告延伸涵蓋 tabs 切換過場，確保兩處不各自長出一套值。

## Impact

- `src/components/ArtifactPanel.vue`、`src/components/ArchivedPanel.vue`：tablist 標記移出，改用共用元件。
- 新增共用 tabs 元件（含 indicator 量測）。
- `src/components/PanelShell.vue`：內容淡入時值調整，並區分換 tab／換 change。
- `uno.config.ts` 的 `tab-item` shortcut：選中底線的責任轉移到 indicator。
- 無 API、無資料層、無 gateway 變更；純呈現層。
