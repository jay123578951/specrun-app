## 1. App 身分收斂

- [x] 1.1 `package.json` 的 `version` 由 `0.0.0` 改為 `0.1.0`；驗證方式：`node -p "require('./package.json').version"` 印出 `0.1.0`
- [x] 1.2 `src-tauri/tauri.conf.json` 改四處——`productName` 改為 `specrun`、`app.windows[0].title` 改為 `specrun`、`version` 改為 `"../package.json"`、`build.beforeBuildCommand` 由 `pnpm build` 改為 `pnpm build:web`；驗證方式：`pnpm tauri info` 不報設定錯誤。已安裝的 CLI（2.11.4）的 `[-] App` 區塊本來就不印 version 欄位（只有 build-type、CSP、frontendDist、devUrl、framework、bundler 六項），因此不能拿「印出的 app version」當證據；改用等效更強的證據——`tauri-utils` 的 `PackageVersion` 反序列化邏輯是路徑存在就讀該檔的 `version`，路徑不存在就把字串本身當 semver 解析並報錯，所以指令不報錯本身就證明 `../package.json` 已被成功解析到專案的 `package.json`
- [x] 1.3 `src-tauri/Cargo.toml` 的 `[package]` 段改為 `name = "specrun"`、`version = "0.1.0"`、`description` 改成這個 App 的一句說明、`authors = ["jay123578951"]`、`license = "MIT"`、`repository` 填 repo 網址；同時 `[lib] name` 改為 `specrun_lib`，`src-tauri/src/main.rs` 裡的 `app_lib::run()` 跟著改為 `specrun_lib::run()`；驗證方式：`cargo check --manifest-path src-tauri/Cargo.toml` 通過
- [x] 1.4 前端與型別檢查未被上述改動波及；驗證方式：`pnpm lint`、`pnpm typecheck`、`pnpm test` 三者全過

## 2. 公開前的整理

- [x] 2.1 新增 `LICENSE`，內容為 MIT 全文，第一行著作權為 `Copyright (c) 2026 jay123578951`；驗證方式：檔案存在且 GitHub 網頁版能辨識為 MIT
- [x] 2.2 `.gitignore` 新增 `/ROADMAP.md` 與 `/docs/` 兩行（前導斜線錨定根目錄，避免命中其他層級的同名檔案／資料夾），並執行 `git rm --cached ROADMAP.md docs/ -r`；驗證方式：`git status` 顯示這四個檔案為刪除、`ls ROADMAP.md docs/` 本機檔案仍在、`git check-ignore ROADMAP.md docs/spectra-analysis.md` 兩者皆命中
- [x] 2.3 改掉兩處活的引用——`README.md` 第一行的「規劃見 `ROADMAP.md`」、`openspec/config.yaml` 的 `context` 裡「詳見 ROADMAP.md」那半句；驗證方式：`git grep -n "ROADMAP" -- README.md openspec/config.yaml` 無結果（`openspec/changes/archive/` 底下的 48 處刻意不動）
- [x] 2.4 重寫 `README.md`：專案是什麼、**需要 Apple 晶片的 Mac**（放在安裝說明的開頭，不只靠檔名裡的 `aarch64`）、下載與安裝步驟、第一次開啟會看到「已損毀，應將其丟到垃圾桶」且那不是真的損毀、兩條繞法（`xattr -d com.apple.quarantine /Applications/specrun.app` 與 系統設定 → 隱私權與安全性 → 強制打開）、需要另外安裝 openspec CLI、既有的開發與檢查指令段落保留；驗證方式：請一位沒有本專案背景的讀者（或自己以全新視角）照著讀一遍，每一步都知道下一步要做什麼
- [x] 2.5 確認 `openspec validate add-app-release --strict` 通過，且 `git status` 的待提交內容只含本張預期的檔案

## 3. 打包與本機先驗（在不可逆的發佈之前做完）

- [x] 3.1 執行 `pnpm tauri build`；驗證方式：產出 `src-tauri/target/release/bundle/macos/specrun.app` 與 `src-tauri/target/release/bundle/dmg/specrun_0.1.0_aarch64.dmg`，兩者檔名都是新的名稱與版本
- [x] 3.2 檢查 bundle 的身分欄位；驗證方式：`plutil -p .../specrun.app/Contents/Info.plist` 顯示 `CFBundleName = specrun`、`CFBundleExecutable = specrun`、`CFBundleShortVersionString = 0.1.0`、`CFBundleIdentifier = dev.specrun.app`（識別字串必須維持原值）
- [x] 3.3 把 `.app` 裝進 `/Applications`；驗證方式：`/Applications/specrun.app` 存在且 `plutil -p` 顯示的四個身分欄位與 3.2 相同。**「已損毀」那個現象不在這裡驗**——這台機器已經成功開過這個 App 一次，macOS 記住了，之後補什麼下載標記都不會再攔（原本寫的 `0081` 旗標本身也含「已通過評估」位元，等於一開始就告訴系統放行）。該現象改由 5.5 以真實下載路徑驗證，那一趟的證據力也更強
- [x] 3.4 **本張最關鍵的一項**——從 Finder（不經終端）開啟已安裝的 `/Applications/specrun.app`，驗證自動偵測真的成立；驗證方式：Settings 的 CLI 狀態呈現自動偵測成功並顯示 openspec 執行檔的絕對路徑與版本，Changes 頁列得出 change 清單，**不是一片空**。2026-09-18 首次實測**失敗**（根因與修法見 design.md）；原本寫在這裡的退路「改以手動指定路徑、偵測問題另開 change、不擋發佈」經實測不成立——手動模式走同一條執行路徑，一樣不通。本項改為在第 4 節修完並重新打包後重驗，**通過才能進第 5 節**
- [x] 3.5 驗證版本在 App 內外一致；驗證方式：上述已安裝的 App 開啟 Settings，診斷區的「App version」顯示 `0.1.0`，與 dmg 檔名上的版本相同
- [x] 3.6 逐頁走查已安裝的 App：Changes（含詳情 slideover、tasks 勾選、park 拖曳）、Specs、Archived、Settings；驗證方式：各頁與互動皆正常，確認改名與改套件名沒有波及既有行為。**要等 3.4 通過才走得完**——CLI 不可用時 Changes 與 Specs 兩頁沒有資料可走

## 4. 讓 App 在沒有終端環境時真的跑得動 openspec（3.4 失敗的修復，發佈前必須完成）

- [x] 4.1 `spawn_bin` 支援指定環境變數：`src-tauri/src/lib.rs` 的 `spawn_bin` 增加一個可選的環境變數參數，`src/api/desktop/shell.ts` 的 `spawnBin` 跟著轉傳；驗證方式：`cargo check --manifest-path src-tauri/Cargo.toml` 通過、`pnpm typecheck` 通過
- [x] 4.2 第 ② 段借登入 shell 時一併取回它的搜尋路徑，存進解析結果；驗證方式：新增單元測試——注入一個會回傳路徑與搜尋路徑的假 login shell，斷言解析結果帶著那份搜尋路徑
- [x] 4.3 後續每一次執行 openspec 都帶上那份搜尋路徑，**自動偵測與手動指定兩種模式皆適用**（手動指定的路徑同樣可能是需要其他執行環境的轉接殼）；驗證方式：單元測試斷言 `verify` 與 `runCli` 兩條路徑都收到該環境；`pnpm test` 全過
- [x] 4.4 解析失敗訊息改成指得出是哪一段沒過：第 ② 段找到路徑但執行失敗時，訊息要說的是執行失敗與其原因，不再沿用第 ① 段的訊息；驗證方式：單元測試斷言「找不到」與「找到了但執行失敗」兩種情境產生不同訊息，且後者含實際的執行錯誤
- [x] 4.5 重新打包並重驗 3.4：`pnpm tauri build` 後把新的 `.app` 換進 `/Applications`，從 Finder 點開；驗證方式：Settings 的 CLI 狀態呈現自動偵測成功、顯示 `~/Library/pnpm/openspec` 與版本，Changes 頁列得出 change 清單。通過後回頭勾 3.4 與 3.6
- [x] 4.6 確認手動指定路徑這條退路也真的可用；驗證方式：在同一個已安裝的 App 裡切到 Settings 的「Set path manually」、貼上 `~/Library/pnpm/openspec`，狀態呈現驗證成功並顯示版本，Changes 頁有資料

## 5. 發佈（不可逆，逐項人工確認後才執行）

- [ ] 5.1 人工看過一遍即將公開的內容；驗證方式：`git ls-files` 的結果裡不再有 `ROADMAP.md` 與 `docs/`，且已理解並接受這三份檔案的全文仍留在 git 歷史中（不改寫歷史是既定決策）
- [ ] 5.2 提交本張所有改動並推上 `origin/main`；驗證方式：`git status` 乾淨、`git log --oneline -1` 為本張的 commit
- [ ] 5.3 repo 由私有轉公開並填上一句簡介；驗證方式：`gh repo view --json isPrivate,description` 回報 `isPrivate: false` 且 `description` 非空
- [ ] 5.4 建立 `v0.1.0` tag 與首發 Release，附上 `specrun_0.1.0_aarch64.dmg`，Release 說明的開頭寫明需要 Apple 晶片的 Mac 並複述第一次開啟被擋的處理方式；驗證方式：`gh release view v0.1.0` 列出該 dmg 為資產
- [ ] 5.5 走一次別人會走的完整路徑收尾；驗證方式：以未登入的瀏覽器開啟 Release 頁、下載 dmg、掛載、把 App 拖進應用程式資料夾、從 Finder 點開，**確認 README 寫的「已損毀，應將其丟到垃圾桶」原句真的出現**（措辭若與 README 不符就改 README），再依 README 的繞法解除、重新開啟，確認 Settings 的 CLI 狀態為自動偵測成功且 Changes 頁有資料。若手邊有另一台沒裝過這個 App 的 Mac，優先在那台走這一趟——本機已被 macOS 記住，攔阻可能不再出現
