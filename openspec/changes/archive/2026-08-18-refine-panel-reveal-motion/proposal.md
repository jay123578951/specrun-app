## Why

三頁 slideover 面板（Artifact／Spec／Archived）目前的進出場是**一整片大面積高速掃過**：`translate-x-full` 等於面板自身寬度（`calc(100% - 320px)`，1440 視窗下約 **896px**），220ms 走完約 4000px/s，而且只動位移、沒有任何淡入。

`docs/ui-structure-decisions.md:200` 早就把 transitions.dev 定為本專案的動效詞彙庫。該站的 **panel-reveal（P3）** 正是治這個症狀的處方：位移砍短，用同拍的 opacity（與它自己的 cross-blur）把「開到底」的感覺補回來 —— 位移短了，但讀起來仍是完整的一次開闔，而且安靜。

順帶暴露兩件事：

1. **reduced motion 下面板是「瞬間出現」**，等於關閉動效，違反 `src/styles/interactions.css:40` 自己宣告的「降級不是關閉」。機制真相與註解寫的不同：`.sr-motion` 的 `transform: none !important` 對 Wind4 的 `translate-x-*` 是空砲（實測產出的是 `translate:` 屬性，不是 `transform:`），真正把位移擋掉的是 `transition-property: opacity !important`；而面板本來沒有 opacity 變化，於是整段變成瞬移。
2. **面板開著時點另一張卡片＝原地換內容，完全沒有動效**（`src/components/PanelShell.vue:23` 只做了捲動歸零）。內容是硬切的，切換前後都是滿版文字，讀起來像畫面被抽換。

## What Changes

**panel-reveal 的 fade 配方經兩輪驗收後放棄**（v1 同拍、v2 解耦都被「fade 吃掉移動」的回饋打回，見 design D3）。定案為**全幅純位移的 drawer 式進出場**：位移維持右緣全幅，把時長放慢、曲線換成 drawer 專用曲線，讓「滑行」讀得出來；淡入淡出僅存於 reduced motion 的降級。cross-blur 自始未採。

| 項目 | 現值 | 新值 |
|---|---|---|
| 進出場位移 | `translate-x-full`（≈896px）高速掃過 | **不變全幅，時長與曲線換掉讓它讀成「滑行」** |
| 淡入淡出 | 無 | **維持無**（v1 同拍、v2 解耦曾加過，驗收後整組移除；design D3） |
| 進場時長 | 220ms | **300ms**（專案上限） |
| 退場時長 | 150ms | **220ms**（進場的 73%） |
| 曲線 | `--sr-ease-out`（初速爆衝，掃過感來源） | **`--sr-ease-drawer`（新增 token，ui-motion 固定表的 drawer 曲線）** |
| 模糊 | 無 | **維持無**（不抄參考稿的 2px cross-blur） |
| reduced motion | 瞬間出現／消失 | **淡入淡出取代位移**（幽靈 opacity 機制，design D3／D6） |

- **位移全幅、不再短距。** v1／v2 的 40px 短位移是 fade 的配套；fade 移除後，純移動的進出場必須從完全隱藏處起步，否則是憑空出現（design D2）。
- **原地換內容補上淡入**：面板捲動內容區在內容識別鍵（change ＋ tab）變動時以 **120ms 淡入**呈現新內容；面板外殼與 header（標題、tabs、卡片高亮）**維持即時、不淡入** —— 那是身分回饋，鍵盤 ↑↓ 連按時必須立刻讀到自己在哪。手法用穩定元素上的 class 切換（transition 而非 keyframes，連按不排隊；design D7）。
- **一處改、三頁受益**：進出場值在 `src/App.vue:36` 的 `PANEL_MOTION` 三頁共用；內容淡入放在 `src/components/PanelShell.vue` 的共用外殼。Spec 頁與 Archived 頁不需各自實作。
- **`.sr-motion` 只改註解不改宣告**：把「浮層（toast）」的敘述改為含面板，並記下 `transform: none` 對 Wind4 translate 是空砲這個事實；進出場時值另以 `.panel-reveal-*` 手寫規則承載（per-property 時值 utility 組不出）。

**非破壞性變更**：不新增、不移除任何功能，僅調整既有面板的進出場與內容切換動效。

**刻意不做（非遺漏）**

- **不採用 cross-blur。** `ui-motion` 明列 transform + opacity only（clip-path 是唯一被祝福的第三個），blur 只在 icon swap 破例；且這是全高大面積，每幀一次 filter pass 成本不低，面板內又是密集文字，2px blur 進場容易讀成「沒對焦」而不是柔和。理由詳見 design.md - D1。
- **不動清單那側。** 清單不變形、不移位是既有規格（`artifact-view`「詳情滑出面板」），本輪不碰。
- **不加 backdrop、不加陰影。** 既有規格明文禁止，短位移不是放寬它的理由。
- **不碰 toast 動效**，也不碰卡片 hover／press／拖曳那組值。
- **不手捏曲線值。** 新增的 `--sr-ease-drawer` 取自 ui-motion 固定表（design D5），不自創 bezier。
- **header／tabs 不淡入**（理由見上）。
- **tab 切換會吃到同一個內容淡入**，因為內容識別鍵本來就含 `currentTab`（`ArtifactPanel.vue:34`）。這是刻意接受的順帶收益，不是漏網。

## Capabilities

### New Capabilities

無。

### Modified Capabilities

- `artifact-view`：「詳情滑出面板」補上進出場的動效語意（全幅純位移滑入滑出、退場短於進場、reduced motion 以淡入淡出取代位移）；「覆蓋檢視下的清單切換」補上原地換內容的動效語意（內容區淡入、外殼與身分回饋即時）。
- `specs-view`：「spec 詳情 slideover」補一句動效沿用 artifact-view（比照該條既有的「Markdown 渲染沿用」寫法）。
- `archived-view`：「詳情 slideover（唯讀）」補同一句沿用。

## Impact

- `src/App.vue`：`PANEL_MOTION` 四個 class 字串（三頁共用）。
- `src/components/PanelShell.vue`：捲動容器加淡入 class 分支與連按閘門；既有捲動歸零 watcher 保留。
- `src/styles/interactions.css`：新增 `.panel-reveal-enter`／`.panel-reveal-leave` 進出場規則（per-property 時值，utility 組不出）；`.sr-motion` 註解修正。
- `src/styles/tokens.css`：新增 `--sr-ease-drawer`。
- 無 API、無 store、無 gateway 變更；無新依賴。
