## 1. 殼與相依

- [x] 1.1 加入 `@tauri-apps/cli`（devDependency）、`@tauri-apps/api` 相依；vite dev port 顯式鎖 5173
- [x] 1.2 建立 `src-tauri/`（官方模板 scaffold）：視窗設定、identifier 暫定 `dev.specrun.app`、`beforeDevCommand: "pnpm dev"`、`devUrl: http://localhost:5173`、模板 icons 佔位
- [x] 1.3 Cargo 相依：`tauri-plugin-fs`（開 `watch` feature）；不加 shell plugin

## 2. 薄 Rust 平台通道

- [x] 2.1 `spawn_bin(program, args, cwd)`：`std::process::Command` 直包，回傳 `{ status, stdout, stderr }` 結構化 JSON；程式不存在回錯誤結果不 panic
- [x] 2.2 `allow_path(path)`：遞迴 allow 該目錄＋同呼叫內對 `path/.git` 補 allow（存在才補）
- [x] 2.3 capabilities 宣告：fs 各操作＋`fs:scope` 靜態僅 `$APPDATA/**`，僅授 main 視窗

## 3. dev 通路與切換位

- [x] 3.1 `package.json` 加 `dev:app` script（`tauri dev`）；確認 `pnpm dev` 行為零改動
- [x] 3.2 新增 `isTauri()` util（偵測 `window.__TAURI_INTERNALS__`）；`gateway.ts` 加註 T2 起依此分流，本張仍恆 webGateway
- [x] 3.3 `dev:app` 啟動驗證：桌面視窗載入 Changes 主頁，資料經既有 HTTP 路徑正常顯示

## 4. WKWebView 首檢

- [x] 4.1 逐頁走查：Changes（清單、詳情 slideover、tasks 勾選、park 拖曳）、Specs、Archived、Settings、頁切換與動畫，記錄破版清單
- [x] 4.2 修正揪出的 Chrome-only 樣式（僅樣式層；結構性問題升級回報不硬修）

## 5. 收尾

- [x] 5.1 README 補 Rust 工具鏈前提與 `dev:app` 說明
- [x] 5.2 `lint`／`typecheck`／`test` 全綠；`src-tauri/target` 入 .gitignore
