## Why

App 與外部世界只有一個真正的接點——openspec CLI——而它目前寫死為 `execFile('openspec', …)`，完全依賴 process PATH。macOS GUI App 不繼承 shell PATH（`.app` 從 Finder 啟動時 PATH 僅 `/usr/bin:/bin:/usr/sbin:/sbin`），使用者裝在 `~/Library/pnpm/openspec` 的執行檔屆時偵測不到，整個 App 開起來是空的且無從修復。這是 ROADMAP「已知的坑」的第一條，也是 M4 Tauri 打包的前置條件。

同時，側欄的 Settings 項自 D1 起就是明文規定「點擊無反應」的死項，掛了三個里程碑。本 change 讓它落地——但只放**真的設定**：盤點下來，這個 App 只有 CLI 路徑一項可調，其餘全是偏好或想像。

> ROADMAP 原將 Settings 併入 M3（理由：等操作面到齊才有內容可放）。該理由已在探索階段被推翻——M3 的操作面帶來的是**確認流程**而非設定，而唯一的真設定（CLI 路徑）的痛點時機是 M4。里程碑表需相應更新。

## What Changes

- **新增 Settings modal**：由側欄底部 Settings 項開啟，疊在任何頁之上，與詳情面板零耦合（不佔用 `App.vue` 的單一面板槽，不會擠掉使用者開著的詳情）。這是 App 的第一個 modal，也是繼 dropdown、toast 之後的第三個浮層。
- **openspec CLI 路徑設定**：自動偵測（三段降級）／手動指定兩種模式，單一「驗證並套用」動作，狀態列即時回報版本或錯誤，另有「重新偵測」。使用者的明示覆寫持久化於既有的 `config.json`。
- **CLI 執行檔解析改為可覆寫**：gateway 層的 spawn 目標從寫死的 `openspec` 改為「使用者覆寫 ＞ 自動偵測結果」。自動偵測先試 process PATH，未命中再借使用者 login shell 的真實 PATH。
- **唯讀診斷區**：設定檔位置、目前專案路徑（兩者可開啟所在位置）、即時刷新（watcher）狀態、App 版本。這一區不是設定，是「App 到底連到什麼」的答案——三個外部接點目前全部無跡可循。
- **推翻側欄死項規定**：change-list 的「側欄靜態殼」需求明文要求 Settings 項無功能，本 change 撤銷該條款與對應 scenario。
- **CLI 不可用提示補上出口**：Changes 與 Specs 兩頁的常駐 banner 現有文案「reachable on PATH, then refresh」在設定落地後即為錯誤指引，改寫並加上前往 Settings 的入口。

**明確不做**（非目標，避免下游誤補）：

- 主題切換——App 只有一套深色主題，沒有第二個值可切。
- 排序偏好——ROADMAP 已列為刻意留白，且順序沿用引擎輸出（`openspec-gateway` 明文 MUST NOT 重新排序）。
- 刷新間隔、CLI timeout、密度、語言——內部常數或為不存在的規模設計。
- 預設編輯器、破壞性操作的確認開關——依賴 M3 的操作面，屆時再評估；且好的預設值通常勝過開關。

## Capabilities

### New Capabilities

- `app-settings`: Settings modal 的開啟／關閉與焦點行為、openspec CLI 路徑的兩種模式與驗證套用流程、CLI 路徑覆寫的持久化，以及唯讀診斷資訊的呈現與其平台能力降級。

### Modified Capabilities

- `openspec-gateway`: 新增「CLI 執行檔解析」需求——spawn 目標依「使用者覆寫 ＞ 自動偵測（process PATH → login shell）」決定，並可於執行期更換；既有「錯誤分類」中的「CLI 不可用」語意不變，但改為在解析全數失敗後才成立。
- `change-list`: 「側欄靜態殼」需求撤銷 Settings 項無功能的規定與「死項點擊」scenario，改為可開啟 Settings。

## Impact

**前端**

- 新增 Settings modal 元件與其 store（不進 `view.ts` 的 `AppView` 聯集——Settings 是覆蓋層，不是第四個頁）。
- `AppSidebar.vue`：Settings 由靜態 `div` 改為可互動項。
- `App.vue`：全域 keydown handler（`if (!panelOpen.value) return`）需讓位給 modal，否則 Esc 會穿透關掉背後的詳情面板。
- `ChangeList.vue`、`SpecsView.vue`：cli-unavailable banner 文案改寫並加入口。
- `tokens.css`：`--sr-shadow-overlay` 的適用範圍延伸至 modal（既有浮層例外的適用，非新增例外）；新增遮罩色值。

**伺服端**

- `openspec-cli.ts`：`CLI_BIN` 常數改為執行期解析的執行檔路徑。
- 新增 CLI 偵測與驗證邏輯（含 login shell spawn 與非 darwin 平台的能力降級）。
- `app-config.ts`：`AppConfig` 新增 `openspecBin: string | null` 欄位與其逐欄位收斂。
- 新增診斷與 CLI 設定的 API route。

**文件**

- `ROADMAP.md`：Settings 自 M3 移出，改列為 M4 前置；里程碑表狀態欄更新。
