## Why

現行詳情檢視採「容器變形」：點卡片後清單被抽換成窄軌（ChangeRail），卡片位置跳動、心智模型斷裂。改為 slideover 覆蓋模型後卡片清單永遠是同一個實體，位置不動，切換 change 就是點卡片本身，並可移除整個 ChangeRail 元件。

## What Changes

- 點擊卡片後 ArtifactPanel 改為從右側滑入的覆蓋面板（slideover），蓋在卡片清單上方；清單不變形、不移位
- 面板不滿版：左側保留固定寬的露出區，露出的卡片左半可直接點擊切換 change；當前開啟的卡片高亮
- 面板底色抬一階（surface，與 sidebar 同階），左緣以 border 分隔；無陰影、無 backdrop（遵循全域「層次靠 surface 色階＋1px 邊框、禁用 box-shadow」規範）
- 面板 header：左上為收合鈕（箭頭收合意象，非 ✕），右上為 Refresh
- 再次點擊當前開啟的卡片＝收合面板；Esc 收合行為保留
- **BREAKING（內部）**：移除 ChangeRail 元件；↑↓ 鍵盤切換與 Esc 監聽搬至 App 層

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `artifact-view`: 「詳情開啟與收合變形」改為 slideover 覆蓋語意；「窄軌互動」整條移除，由「覆蓋檢視下的清單切換」取代（露出卡片切換、當前卡片高亮、↑↓ 鍵行為保留）；新增面板 header 控制（收合鈕、Refresh）行為
- `change-list`: 「卡片點擊與 hover 動作」更新——點擊開啟語意由收合變形改為 slideover，並新增「再次點擊當前開啟卡片＝收合面板」

## Impact

- `src/App.vue`：主區佈局由雙欄 grid 換檔改為清單常駐＋絕對定位覆蓋面板；接手鍵盤監聽
- `src/components/ChangeRail.vue`：刪除
- `src/components/ArtifactPanel.vue`：header 加收合鈕與 Refresh；底色與左緣分隔調整
- `src/components/ChangeCard.vue`：當前開啟卡片高亮、再點收合
- `src/components/ChangeList.vue`：清單不再卸載，移除捲動位置的存還原
- 不動 gateway／stores 的資料流；`detail` store 的 open/close/show 介面沿用，僅移除隨窄軌一起作廢的 `listScrollTop`
