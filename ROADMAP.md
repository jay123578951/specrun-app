# specrun-app Roadmap

OpenSpec 相容的桌面 spec 管理 App——取代 Spectra，引擎外包給 openspec CLI，只做薄殼 UI，吃到 OpenSpec 的更新紅利。

## 背景與動機

- Spectra（第三方，Tauri v2）已三個月未更新，與 OpenSpec 的演進脫鉤（v1.5~v1.8 的 stores、`skip_specs`、非英文 validate 等都吃不到）。
- Spectra 的維護困境根因：它把整個引擎（validate / archive / schema）重寫進自己的 Rust 核心，OpenSpec 每次演進都要追。
- 本專案的核心架構決策與其相反：**引擎完全交給 openspec CLI（spawn + `--json`），UI 只做薄殼**——openspec 升級即自動獲得引擎紅利。

## 已收斂的技術決策

| 決策點 | 結論 |
|---|---|
| 桌面外殼 | Tauri v2（GUI + 官方 plugin：shell / fs / dialog；不寫 Rust，殼用模板） |
| 前端 | Vue 3 + Vite + UnoCSS + Pinia |
| 引擎 | openspec CLI（`status` / `list` / `instructions` `--json`），不重新實作任何規格語意 |
| Park 機制 | UI 自己的檔案層操作，repo 外目錄（如 `~/.local/share/specrun-app/parked/<repo>/<name>`）＋小索引；openspec 無感 |
| 指令合併 | slash command 層解決（如收尾＝verify → sync → archive 串一個指令），不進引擎 |
| 開發策略 | 先以本地 web 形態開發（Vite dev），前端與後端呼叫抽 interface，最後套 Tauri 殼 |

### 已知的坑（動工前記住）

- macOS GUI App 不繼承 shell PATH：openspec CLI 路徑要可設定或啟動時偵測（目前本機在 `~/Library/pnpm/openspec`）。
- Tauri webview 是 WKWebView（Safari 核心），避免 Chrome-only CSS。
- Tauri v2 capabilities 權限模型：fs 路徑與 shell 指令需明確白名單。

## 里程碑與 change 堆疊

**原則：change 一律切小、功能逐步堆疊，一次只開一個進行中的 change。** 每個 change 小到「審 spec 五分鐘、做完當天 archive」。

### M1 — Viewer（拆為小 change 堆疊）

資料全部來自 openspec CLI 的 `--json`。本專案自身的 `openspec/` 目錄就是第一份測試資料（dogfooding）。

| # | change | 內容 | 狀態 |
|---|--------|------|------|
| C0 | scaffold-app-shell | 純環境骨架（Vite+Vue+Nitro 通路），**零視覺決策** | ✅ 2026-08-14 archived |
| D1 | （待討論後命名） | 設計基礎：tokens、主題、視覺語言——先進行 UI 美觀需求討論再 propose（使用者對美觀要求高，需專門收斂） | 待討論 |
| C1 | | change 列表＋任務進度（design 附 wireframe 審過才做；路徑先寫死單專案） | |
| C2 | | artifact 唯讀渲染（Markdown） | |
| C3 | | file watcher 即時刷新 | |
| C4 | | tasks checkbox 勾選（唯一寫入；併發策略見決策清單） | |
| C5 | | 多專案清單與切換（路徑管理從這裡才真正做） | |
| C6 | | parked 唯讀清單（資料來源屆時再決策：Spectra 轉接器 vs 自訂目錄） | |
| C7 | | UI 視覺精修（畫面到齊後的整體打磨） | |

**UI 設計的兩層時間線**：結構層（佈局 wireframe）跟著每個 change 的 design.md 走、動工前人工審；視覺層（tokens／主題）D1 打底、中間 change 只用 tokens 不追求美、C7 收尾精修。

### M2 — Park 機制

Park / unpark 操作、parked 清單管理、repo 外存放與索引、git 狀態無污染驗證。

### M3 — 操作與指令合併

從 UI 觸發常用操作（archive、validate 等）、合併式指令（一鍵收尾）、錯誤與確認流程。

### M4 — Tauri 打包

套上 Tauri v2 外殼、capabilities 設定、CLI 路徑偵測、`tauri build` 產出 .app 日常使用。

## 已收斂決策補充（srun:decisions 產出，propose 時寫入各 change design）

- tasks 勾選併發策略：寫入前重讀檔案、只翻目標行、該行已變則放棄並提示（C4）
- artifact 顯示依 `openspec status --json` 的 `artifactPaths` 動態列出，不寫死名稱（custom schema 必須可用）
- 專案清單手動加入、不做全機掃描；設定存平台慣例位置（macOS：`~/Library/Application Support/`）
- 空狀態：無專案引導加入目錄；openspec CLI 缺失時明確提示
- 仍開放（刻意留白）：change 列表排序（預設 lastModified 新→舊）、多專案側欄進度徽章（C5 再看）

### 後續觀察項（不排程）

- OpenSpec Stores 模型穩定後，評估 park 是否可映射過去。
- srun kit 的 openspec 後端行升級為一級公民（實際 dogfood 驗證覆蓋度）。
- 把自行設計的 specrun kit 整合進來。

## 工作方式

- 本檔管**方向**（里程碑全貌與 change 堆疊順序）；執行細節在各 change 的 proposal / design / tasks。
- 堆疊順序可調，但每次只開一個進行中的 change；change 完成 archive 後更新上表狀態欄。
- 流程：探索討論（/opsx:explore）→ 決策收斂（/srun:decisions，分支多時）→ propose → 人工審 spec → 實作（/srun:feat）→ archive。
