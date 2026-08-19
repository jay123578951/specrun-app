# Design — add-tauri-shell

## Context

動機見 proposal.md。技術前提：2026-08-19 capabilities spike 已實測定案（ROADMAP「已知的坑」）——shell plugin 白名單編譯期靜態、fs scope 可由 Rust runtime 擴充、遞迴 allow 不含 dotfile、watch 是 Cargo feature。既有 dev 形態：vite（5173，`/api` proxy → nitro 3210）＋nitro 併跑；前端資料入口單點 `src/api/gateway.ts`。

## Goals / Non-Goals

**Goals**

- Tauri 殼立起、桌面視窗日常可用（資料仍走 HTTP），T2 起有現成的殼可逐域切 gateway
- 薄 Rust 平台通道（spawn／授權）一次到位——T2–T4 只寫 TS，不再碰 Rust
- WKWebView 破版一次揪完，後續 change 不再背這個未知數

**Non-Goals**

- 不動 gateway 的資料路徑（tauriGateway 是 T2–T4）；不做打包（`tauri build`、icon、正式 identifier 歸 T5）
- 不做視窗狀態記憶、多視窗、系統匣等桌面加值

## Decisions

### D1 — gateway 切換機制：runtime 偵測，本張只留位

以 `window.__TAURI_INTERNALS__` 存在與否判定執行形態（新增 `isTauri()` util）；`gateway.ts` 本張仍恆 export webGateway，僅加註 T2 起依 `isTauri()` 分流。

- 為什麼不用 build 變數：runtime 偵測讓同一份 dist 同時服務兩形態，dev（Tauri 視窗載 vite devUrl）與 web dev 共用同一個前端進程，不需雙 build 通路。
- 風險自知：偵測為真但 tauriGateway 未就緒的過渡期（T1–T4 間）由「gateway.ts 尚未分流」天然遮蔽——分流動作本身就是各域完工的開關。

### D2 — dev 通路：tauri.conf 掛既有 `pnpm dev`

`beforeDevCommand: "pnpm dev"`（既有 concurrently api＋web 原樣併跑）、`devUrl: http://localhost:5173`。新增 `dev:app` script = `tauri dev`。既有 `pnpm dev` 行為零改動，web 形態開發完全不受影響。vite port 由預設改為顯式鎖 5173（devUrl 是寫死的，預設值漂移會斷）。

### D3 — 薄 Rust 命令面（spike 定案落地）

兩個 command，Result 以結構化 JSON 回前端：

- `spawn_bin(program, args, cwd) -> { status, stdout, stderr }`：`std::process::Command` 直包。不用 shell plugin（靜態白名單無法表達使用者設定的 CLI 路徑）。
- `allow_path(path)`：`fs_scope().allow_directory(path, true)` ＋ 同一呼叫內對 `path/.git` 再 allow 一次（存在才 allow；dotfile 坑由 Rust 端一次吸收，前端無感）。

不引入 persisted-scope plugin：專案清單 config 是 scope 真值來源，啟動／加入專案時由前端重新授權（T4 接 config 時落地；本張命令先就位）。

### D4 — capabilities 靜態宣告

fs：`read-text-file`／`write-text-file`／`mkdir`／`exists`／`remove`／`rename`／`read-dir`／`watch`／`unwatch` ＋ `fs:scope` 靜態僅 `$APPDATA/**`；Cargo 側 `tauri-plugin-fs` 開 `watch` feature。不宣告 shell plugin（見 D3）。dialog／opener 歸 T4 到位時再宣告，capabilities 隨用隨加、不預開。

### D5 — identifier 暫定 `dev.specrun.app`

正式命名（產品名、bundle id、icon）是 T5 的決策；本張用暫定值讓殼能跑。T5 改 identifier 對 dev 資料（`$APPDATA` 路徑）的影響屆時一併處理。

## Risks / Trade-offs

- [WKWebView 差異是未知量，首檢可能揪出成堆破版] → 首檢排在殼可跑之後的獨立 task，逐頁清單化檢查；修正僅限樣式層，若揪出結構性問題（如 Pointer Events 拖曳失效）升級回報、不硬修
- [spawn／allow_path 是高權限 IPC] → capability 僅授 main 視窗；App 不載遠端內容（devUrl 僅 dev、正式走本地 dist），攻擊面即本地 UI 本身
- [Rust 工具鏈成為協作前提] → README 補一行 rustup 安裝；web 形態開發（`pnpm dev`）不需 Rust，不影響純前端工作流

## Migration Plan

純新增，無遷移。回退＝刪 `src-tauri/` 與新增 script，web 形態不受任何影響。

## Open Questions

（無——T5 的命名與打包決策刻意延後，不屬本張未知）
