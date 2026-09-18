## Why

M4 的桌面通路已經整條走完——讀取、檔案操作、變動通知、資料夾選擇、開啟位置與外部連結全數由外殼自持，`tauri build` 也已驗證產得出 .app 與 .dmg。但這個 App 目前只存在於自己這台機器的 `target/` 底下：它沒有定過名字（Dock 上是 scaffold 帶進來的 `specrun-app`，但 App 自己畫面上寫的是 `specrun`）、版本三處各寫各的（設定頁顯示 `0.0.0`、下載檔名是 `0.1.0`）、repo 是私有的、沒有授權條款、README 沒有任何安裝說明。

這張把它從「自己機器上跑得動的東西」變成「別人拿得到、裝得起來的 App」。它是 M4 的最後一張。

## What Changes

**App 身分**

- 顯示名稱定為 **`specrun`**（小寫）：Dock、選單列、視窗標題、下載檔名、Release 標題都用這一個名字，與畫面上早已存在的寫法一致——側欄 wordmark、瀏覽器分頁標題與三處錯誤訊息內文本來就寫小寫 `specrun`，因此前端一個字都不用改，`brand-mark` 規格也不需要 delta。系統識別字串 `dev.specrun.app` 與設定資料夾名 `specrun-app` **不動**（動了等於換一個 App，既有設定與專案清單全部重來）。
- 版本定為 **0.1.0**，以 `package.json` 為唯一真值，打包設定改為指向它。現況是三份各寫各的，使用者在設定頁看到的版本與下載檔名對不起來。
- 清掉 `src-tauri/Cargo.toml` 的模板殘留（`name = "app"`、`description = "A Tauri App"`、`authors = ["you"]`）——`name = "app"` 讓 .app 內的執行檔與活動監視器裡的行程都叫 `app`。

**打包與發佈**

- 只出 Apple 晶片版。README 與 Release 說明必須寫明「需要 Apple 晶片的 Mac」，不然 Intel 使用者下載後只會看到打不開。
- 不簽章、不公證、不做自動更新、不出 Windows（roadmap 2026-08-19 既有裁決）。因此下載後第一次開啟必定被 macOS 擋下，README 要寫明那句嚇人的提示是正常的，並給出兩條繞法。
- repo 轉公開，`gh release create` 發第一版。
- 打包指令目前會順帶跑 `nitro build`，但打包產物只吃 `dist/`，那份輸出用不到，拿掉。

**讓 App 在沒有終端環境時真的跑得動 openspec**

- 2026-09-18 實測發現：從檔案管理器點開的 App 解析得到 openspec 的位置，卻執行不了它。`npm install -g` 裝出來的 openspec 是一層 `exec node …` 的轉接殼，而 macOS 給這類 App 的搜尋路徑固定只有 `/usr/bin:/bin:/usr/sbin:/sbin`，找不到 node。手動指定路徑走同一條執行路徑，一樣不通——兩條路都斷，使用者拿到的是完全不能用的 App。
- 修法是在第 ② 段那趟登入 shell 裡順手把它的搜尋路徑帶回來，之後每次執行 openspec 都帶著。同時讓失敗訊息指得出是「找不到」還是「找到了但執行失敗」——這兩種處境指向不同的處理方式，現在顯示的是同一句話。

**公開前的整理**

- 加 MIT 授權條款。
- `ROADMAP.md` 與 `docs/` 三份文件取消 git 追蹤並加進 `.gitignore`，本機檔案留著。**已知且接受**：不改寫 git 歷史，`git log -p` 仍讀得到這幾份檔案全文——乾淨的是 repo 現在的樣子。
- 連帶要改兩處活的引用：`README.md` 第一行、`openspec/config.yaml` 的 context。`openspec/changes/archive/` 底下那 48 處引用放著不修，它們是封存的歷史紀錄，本來就在描述當時。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `desktop-shell`：新增「打包產物的身分」——打包後的 App 在系統中呈現的名稱、版本與識別字串三者的關係與恆定性要求。既有規格只講形態與通道，沒講這個 App 對外是誰。
- `app-settings`：新增「不經終端啟動時仍解析得到 CLI」——既有規格要求自動偵測要顯示解析到的絕對路徑，但沒有規定「從檔案管理器點開、沒有繼承到終端環境」這個情況下也要成立。這正是本張唯一未經證明的技術點。同時修改「唯讀診斷資訊」，要求診斷區呈現的 App 版本與發佈產物是同一個值。

## Impact

**改到的檔案**

- `src-tauri/tauri.conf.json`：`productName`、視窗 `title`、`version` 指向 `package.json`、`beforeBuildCommand`
- `src-tauri/Cargo.toml`：`name`、`description`、`authors`、`license`、`repository`
- `src-tauri/src/main.rs`：`app_lib::run()` 跟著 `[lib] name` 改為 `specrun_lib::run()`
- `src-tauri/Cargo.lock`：套件名改動後的鎖檔連動更新
- `package.json`：`version` 拉到 `0.1.0`
- `README.md`：改名、安裝說明、晶片需求、第一次開啟被擋的兩條繞法
- `openspec/config.yaml`：context 裡指向 ROADMAP 的那句
- `.gitignore`：新增 `/ROADMAP.md` 與 `/docs/`（前導斜線把忽略範圍錨在根目錄，不波及其他層級的同名檔案與資料夾）
- 新增 `LICENSE`（MIT，Copyright (c) 2026 jay123578951）
- CLI 解析與執行：借登入 shell 解析路徑時一併帶回它的搜尋路徑，並在後續每次執行 openspec 時帶上；失敗訊息改成指得出是哪一段沒過（`src/api/cli-resolve.ts`、`src/api/desktop/cli.ts`、`src/api/desktop/shell.ts`、`src-tauri/src/lib.rs` 的 `spawn_bin`）

**不改的**

- `src/api/desktop/diagnostics.ts` 不動——它已經從 `package.json` 讀版本，只是從沒在打包形態下被真的走過，實測確認成立。
- `APP_FOLDER`、capabilities 的 `$CONFIG/specrun-app` 靜態範圍、`dev.specrun.app` 識別字串。

**repo 層的動作**

- `git rm --cached ROADMAP.md docs/`
- repo 由私有轉公開、填上一句簡介
- 建立 v0.1.0 tag 與首發 Release，附上 .dmg

**驗收必須走完整條下載路徑**：從 Release 頁下載 .dmg、拖進應用程式資料夾、繞過系統攔阻、從檔案管理器點開，確認它找得到 openspec CLI 而不是開起來一片空。在 `pnpm dev:app` 下驗不出這件事——那個形態的解析第一段就命中了，需要驗的第二段從沒走過。
