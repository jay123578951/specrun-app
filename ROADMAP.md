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

## 里程碑

### M1 — Viewer MVP

唯讀為主的核心畫面：專案（openspec 目錄）切換、change 列表與狀態（artifacts / tasks 進度）、spec 瀏覽。資料全部來自 openspec CLI 的 `--json`。本專案自身的 `openspec/` 目錄就是第一份測試資料（dogfooding）。

### M2 — Park 機制

Park / unpark 操作、parked 清單管理、repo 外存放與索引、git 狀態無污染驗證。

### M3 — 操作與指令合併

從 UI 觸發常用操作（archive、validate 等）、合併式指令（一鍵收尾）、錯誤與確認流程。

### M4 — Tauri 打包

套上 Tauri v2 外殼、capabilities 設定、CLI 路徑偵測、`tauri build` 產出 .app 日常使用。

### 後續觀察項（不排程）

- OpenSpec Stores 模型穩定後，評估 park 是否可映射過去。
- srun kit 的 openspec 後端行升級為一級公民（實際 dogfood 驗證覆蓋度）。
- 把自行設計的 specrun kit 整合進來。

## 工作方式

- 本檔管**方向**（里程碑全貌）；每個里程碑動工時開 openspec change 管**執行**（proposal / design / tasks）。
- 里程碑順序可調，但每次只開一個進行中的 change。
