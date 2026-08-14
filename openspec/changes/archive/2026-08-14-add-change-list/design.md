# add-change-list Design

## Context

- C0 已有通路：Vite dev（proxy `/api` → Nitro :3210）、`server/api/*.get.ts` route 慣例、前端 `src/api/`（`index.ts` + `types.ts`）呼叫層雛形。
- D1 已有 tokens（`src/styles/tokens.css`）與結構決策文件 `docs/ui-structure-decisions.md`——本 design 的佈局與卡片規格以該文件為準，此處只畫 C1 範圍的 wireframe。
- CLI 探測結論（1.8.0，已對原始碼驗證）：`openspec list --json` 單次呼叫含卡片全欄位；spawn 約 1.1s wall（Node 冷啟動）；`status` 三值（`no-tasks`／`in-progress`／`complete`）；預設排序即 lastModified 新→舊；進度為 schema-aware 計算。
- 動機見 proposal.md「Why」；行為契約見兩份 delta spec。

## Goals / Non-Goals

**Goals:**

- 立起 gateway 邊界：M4 套 Tauri 時被替換的檔案收斂到一個。
- 清單畫面以真實比例呈現（含側欄殼），供後續 change 堆疊。

**Non-Goals:**

- 不做 Why 摘錄（規格已定於結構文件卡片規格；C2 隨 fs 通道一起實作——此為排期非砍規格）。
- 不做卡片點擊詳情、hover 動作、watcher、checkbox 寫入、多專案管理、設定頁本體。

## Decisions

### D1. 前後端邊界：gateway 介面在前端，normalize 為 shared 純函式

```
                ┌── shared normalize（純函式：CLI stdout JSON → App 型別＋錯誤分類）
                │        ▲                      ▲
Vue ──▶ gateway 介面 ────┤                      │
        ├ webGateway ────└ fetch /api/changes ──▶ Nitro route：只 spawn ＋
        │                                         原樣轉送 stdout / exit code
        └ tauriGateway（M4 才寫）──▶ shell plugin spawn，直接餵 normalize
```

- 理由：Tauri 版沒有 Node server，可替換縫必須開在前端；Nitro route 壓到最薄（spawn＋轉送），normalize 集中一處讓 web／Tauri 共用同一份純函式，M4 只換 gateway 實作檔。
- 替代方案（否決）：normalize 放 Nitro server 端——Tauri 版得重寫一份，錯誤分類邏輯分岔。
- 落點沿 C0 慣例：gateway 介面與型別在 `src/api/`，route 在 `server/api/`。

### D2. 資料來源：單次 `list --json`，不用 `status --json`、不 N+1

spawn 1.1s 是硬地板：5 個 change 逐一 `status` 即 6 秒。`list --json` 已含卡片全欄位（name／completedTasks／totalTasks／status／lastModified／root），C1 對 `status --json` 零需求。前端零排序、零進度計算（引擎 schema-aware，App 自數必錯——見 spec）。

### D3. 錯誤判定：root.path canonical 比對＋exit 1 診斷 payload＋implicit 補強

CLI 的 `root.source` 有五值（`nearest`／`declared`／`store`／`global_default`／`implicit`），「路徑不是 openspec repo」不保證得到 `implicit`：機器有註冊 store 時 CLI 以 exit 1＋JSON 診斷 payload 失敗；設有 global defaultStore 時會靜默解析到別的 repo（`list` 成功但資料來自他處）。判準為：**exit 0 時比對 `root.path` 與目標路徑（canonical 化）**，不一致即「非 openspec 專案」；**exit 非 0 時解析診斷 payload**。

**實作補訂（2026-08-14）**：上面兩條漏了一個分支。機器**沒有**註冊 store、也沒設 global defaultStore 時（本機即是），把 CLI 指向非 openspec 資料夾會得到 exit 0＋`root.source: "implicit"`＋`root.path` 與目標路徑**相符**——CLI 找不到任何 root 就拿 cwd 造一個 implicit root（已對 `root-selection.js` 驗證）。只靠路徑比對會把它誤判成「有效專案、零個 change」而顯示空狀態。故補第三條：**exit 0 且路徑相符，但 `root.source` 為 `implicit` 時亦視為「非 openspec 專案」**。`root.source` 僅作為路徑比對之外的補強訊號，不是唯一判準（spec 的 MUST NOT 仍成立）。

### D4. 專案路徑：env fallback repo 自身

環境變數（命名與讀取方式留給實作，如 Nitro runtimeConfig）指定目標專案；未設定 fallback App repo 自身（dogfooding）。開發時可指向有多筆 change 的測試 repo，避開空清單。多專案管理 C5 才做。

### D5. 刷新策略：掛載抓一次＋手動 refresh

focus 重抓在 1.1s spawn 下太吵；C3 watcher 上線後 refresh 按鈕自然降格為備援。refresh 保留舊資料、僅按鈕轉圈（spec 已定）。

### D6. 首載 skeleton（使用者裁定）

2–3 張與真卡片同尺寸的骨架（標題條＋進度條位置微光），無 layout shift；微光動畫數值由 ui-motion skill 表格接管。

### D7. 設定頁開啟形態（本 change 僅定案，不實作）

**右側滑入非蓋板 drawer**：無背景壓暗、清單保持可見可操作（參考 Mondays 式右側面板）。理由：開設定時仍要看清單切換，符合「監視器」定位。結構文件遺留給 C1 的決策，記於此供後續 change 引用。

### D8. 側欄死項不灰化

類推結構文件對 artifact tabs「不灰化禁用」的裁決：Specs／Archive／Settings 以正常樣式呈現、保留 hover 態、點擊無反應，讓 wireframe 審的是真實比例畫面。

### D9. 主區內容欄封頂 1024px（驗收時使用者裁定）

主區內容（banner／群組頭部／卡片區）收在 `max-width: 1024px` 並於主區內置中；視窗窄於此則封頂不生效、卡片照樣填滿。理由：進度條是「一排掃過去」的總覽視圖，卡片寬到 1200px+ 時條長比例讀不出來。Wireframe 畫的是滿寬，此為驗收後的修正。其餘 UI 細節（密度、hover 幅度、完成態辨識度、文案語氣、側欄寬度比例）依 roadmap 留到 C7 視覺精修，不在本 change 收斂。

## Wireframe（C1 範圍；人工審過才動工）

```
┌──────────────┬────────────────────────────────────────┐
│ ◆ specrun    │ ACTIVE (2)                    ⟳ Refresh│
│──────────────│ ┌────────────────────────────────────┐ │
│ PROJECTS     │ │ add-change-list        2/4 · 2h ago│ │
│ ● specrun ②  │ │ ▓▓▓▓▓▓▓░░░░░░░                     │ │
│              │ └────────────────────────────────────┘ │
│──────────────│ ┌────────────────────────────────────┐ │
│ Specs        │ │ probe-alpha        No tasks · 1d ago│ │
│ Archive      │ │ ░░░░░░░░░░░░░░░                     │ │
│──────────────│ └────────────────────────────────────┘ │
│ ⚙ Settings   │                                        │
└──────────────┴────────────────────────────────────────┘
```

- 與結構文件的完整藍圖相比，C1 缺席項（皆為排期）：Why 摘錄兩行（C2）、Parked 群組（M2）、多專案項（C5）、hover 動作（M2/M3）。
- Refresh 控制位於主區頭部右側（確切位置實作時定）。
- 載入態：主區為 2–3 張 skeleton 卡片；空狀態／錯誤提示置於卡片區位置。

## Risks / Trade-offs

- [CLI `--json` 格式變動] → normalize 集中一處，變動只改一檔；本機鎖 1.8.0 開發。
- [首載 1.1s 為體感下限] → skeleton 交代結構；不做預快取（複雜度不成比例，C3 watcher 後另議）。
- [E2E 驗證資料薄（本 repo 僅本 change 一筆）] → env 指向多 change 測試 repo 驗證多卡片、no-tasks、complete 各態。

## Open Questions

無——可安全後決的項目已在 Decisions 中標為留給實作（env 命名、refresh 按鈕確切位置、skeleton 動畫數值）。
