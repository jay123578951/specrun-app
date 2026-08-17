## Why

側欄的 Specs 入口自 C1 起一直是靜態殼——每天看得到、點了沒反應的死連結。M1/M2 完成後主畫面功能到齊，缺頁補齊是 C7 視覺精修前的收尾；Specs 是兩個缺頁中最薄的一頁（openspec CLI 對 specs 有完整 `--json` 支援），先做。

## What Changes

- 側欄 Specs 項活化：點擊切換主區至 Specs 頁，當前頁高亮；App 首次由單頁變多頁（簡單 state 切換，不引入 router）
- Specs 頁：capability 純列表列（mono 名稱＋requirement 數），資料來自單次 `openspec list --specs --json`
- 點擊列表項開 slideover 詳情：`openspec show <id> --type spec` 原始 Markdown 全文渲染，無 tabs；露出區切換、↑↓／Esc 鍵盤行為沿用既有 slideover 規格
- 導覽回程語意：點側欄專案名＝進入該專案的 Changes 主頁（從 Specs 點當前專案即回主頁、已在主頁則無作用）；nav 不加 Changes 項
- 切頁即關詳情面板、不記憶；進頁時重新載入，不擴 watcher
- gateway 新增 specs 清單與 spec 內容兩個讀取呼叫（web 端點＋normalize）

## Capabilities

### New Capabilities

- `specs-view`: Specs 頁的清單與詳情——capability 列表、slideover 詳情渲染、載入／空／錯誤狀態、鍵盤與切換行為

### Modified Capabilities

- `change-list`: 側欄外殼的 Specs 項由靜態殼改為可互動導覽（當前頁高亮、主區換頁）；Archive 與 Settings 仍為靜態殼不變
- `project-management`: 換專案的落點語意擴充——目前專案一換（點專案項、加入、移除目前專案）就進入該專案的 Changes 主頁（含從 Specs 頁點當前專案回主頁）
- `openspec-gateway`: 新增 specs 清單（`list --specs --json`）與 spec 內容（`show <id> --type spec` 原始 Markdown）兩類呼叫與其錯誤分類

## Impact

- `src/App.vue`：主區由固定 ChangeList 改為依 view state 切換；鍵盤監聽擴及 Specs 頁
- `src/components/AppSidebar.vue`：Specs 項活化與當前頁高亮
- 新增 Specs 頁清單元件與對應 store（view state＋specs 資料）
- `src/components/ArtifactPanel.vue` 或抽共用 slideover 外殼供 spec 詳情使用（取捨見 design.md）
- `server/api/`：新增 specs 清單與 spec 內容端點；`src/api/`：gateway 介面、型別與 normalize
- 不動 tasks 勾選、park、watcher 資料流
