## Why

M1／M2 的功能面已完整，App 仍只能以瀏覽器分頁形態使用；M4 定案 M4 直上（C10 已完成、M3 後補），第一步是把 Tauri v2 外殼立起來——套殼後 App 立即以桌面視窗形態可用、開始 dogfood，後續 T2–T4 才能逐域把 gateway 從 HTTP 換到 Tauri IPC。capabilities 權限模型的技術風險已由 2026-08-19 spike 解除，結論（薄 Rust 包裝、`.git` 顯式授權、watch feature）記於 ROADMAP「已知的坑」。

## What Changes

- 新增 `src-tauri/` 外殼（官方模板 scaffold）：視窗設定、capabilities 宣告（fs 各操作＋靜態 scope 僅 `$APPDATA`、fs plugin 開 `watch` Cargo feature）、identifier 暫定（正式命名歸 T5）
- 新增薄 Rust IPC 命令（依 spike 定案，僅平台接線、不含任何規格語意）：
  - `spawn_bin`：以動態程式路徑＋動態 cwd 執行外部指令並回傳結果——shell plugin 靜態白名單無法表達使用者設定的 CLI 路徑，故不用 shell plugin
  - `allow_path`：runtime 擴充 fs scope；授權專案路徑時 MUST 同時顯式授權 `<repo>/.git`（遞迴 allow 不含 dotfile 的實測坑）
- 新增 dev 通路：`tauri dev` 併跑既有 nitro——App 內功能經 webGateway 走既有 HTTP 路徑，本 change 不動 gateway；`src/api/gateway.ts` 留切換位（機制見 design）
- WKWebView 首檢：以 Tauri 視窗跑一遍既有 UI，揪出並修正 Chrome-only CSS 破版（樣式修正屬本 change 範圍）

## Capabilities

### New Capabilities

- `desktop-shell`: App 的桌面外殼形態——桌面視窗啟動與 dev 通路（功能等同 web 形態）、薄 Rust IPC 命令（動態 spawn、fs scope runtime 授權含 `.git` 雙授權）、fs 靜態 scope 邊界

### Modified Capabilities

（無——既有各 capability 的行為不變，本 change 只新增執行形態）

## Impact

- 新增 `src-tauri/`（Cargo 專案，約數十行 Rust）、根目錄 `package.json` 增 dev／build script 與 `@tauri-apps/*` 相依
- `src/api/gateway.ts` 留 gateway 切換位（本 change 仍恆為 webGateway）
- 既有 Vue／Nitro 程式碼不動；Chrome-only CSS 若有破版，修正該樣式檔
- 開發環境新前提：Rust 工具鏈（rustup stable，已於 spike 時安裝）
