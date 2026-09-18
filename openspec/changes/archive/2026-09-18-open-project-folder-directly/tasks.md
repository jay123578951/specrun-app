## 1. 桌面外殼的開啟指令（Rust）

- [x] 1.1 `src-tauri/src/lib.rs` 新增一個判定路徑種類的小函式：收一個路徑，回「是資料夾／不是資料夾／摸不到」三選一，不碰任何外掛。跟隨 symlink（`std::fs::metadata` 而非 `symlink_metadata`）。驗證：比照 `allow_dir_listing` 既有測試的寫法（`temp_dir_named`）新增 `#[cfg(test)]` 測試，斷言資料夾、檔案、不存在三種輸入各得其果，並斷言指向資料夾的 symlink 被判為資料夾；`cargo test` 通過（design D3）
- [x] 1.1b `src-tauri/src/lib.rs` 新增 `is_application_bundle`：解過 symlink 的路徑副檔名是不是 `app`（忽略大小寫）。`file_manager_action` 以 `std::fs::canonicalize` 解一次 symlink，把「是資料夾且是應用程式包」導到 `Reveal`，解不開時同樣導到 `Reveal`（走選取那一條，選取不執行任何東西），是一般資料夾則把解出來的路徑一起帶給 `Open`——判定與開啟用同一次解析的答案。驗證：餵一個真實的 `.app` 目錄，斷言 `file_manager_action` 回 `Reveal` 而非 `Open`；`cargo test` 通過（design D3）
- [x] 1.2 `src-tauri/src/lib.rs` 新增 `open_in_file_manager` 指令並註冊進 `invoke_handler`：以 1.1 判型別，**一般**資料夾呼叫 `tauri_plugin_opener::open_path(…, None::<&str>)`，交出的是 1.1b 解過 symlink 的那個路徑而非前端交來的原字串；其餘（檔案，以及 1.1b 認定的應用程式包）呼叫 `tauri_plugin_opener::reveal_item_in_dir(&path)`——那支自己第一件事就是 `canonicalize`，不必另外解；摸不到則回 `Err`。宣告成 `async`（理由同 `canonical_path`：`metadata()` 在網路磁碟區上會卡住主執行緒）。檔頭比照 `pick_folder` 記下「包外掛的 Rust API、不讓 webview 直呼它的 JS 指令」的理由與查證出處。驗證：`cargo check` 通過；開啟那一步會真的開起 Finder，不寫自動測試，留給第 6 組人工驗收（spec：請求開啟一個指向檔案的路徑、請求開啟一個指向資料夾的路徑、呼叫端不需講明路徑的型別；design D1、D2、D3）
- [x] 1.3 確認 `src-tauri/capabilities/default.json` **沒有新增任何一項權限**，特別是沒有 `opener:allow-open-path`（該條移除發生在 2.3，不在此）。驗證：`git diff` 該檔在本組之後仍無新增行（design D2；spec：開啟路徑不擴大檔案可讀範圍）

## 2. 桌面形態的前端薄層

- [x] 2.1 `src/api/desktop/shell.ts` 新增 `openInFileManager` 包裝：invoke 1.2 的指令，失敗照該檔既有姿態收束成 `{ ok: false, message }`，不放商業規則、不做平台分支、不判型別。驗證：`pnpm typecheck` 通過（design D1、D2）
- [x] 2.2 `src/api/desktop/opener.ts` 的 `revealPath` 改呼叫 2.1，成功回 `revealed`、失敗回 `failed`，仍不產生 `unsupported`。檔頭那段講「只請 Finder 選取一個絕對路徑，不給讀取權」的說明要改寫——現在多了一條會交給作業系統開啟的路，**路徑來源必須是診斷值**這件事因此更重要，把 D1 的空窗風險一併記進去。驗證：改寫 `src/api/desktop/opener.test.ts` 對應的兩個案例（假的外殼通道改成 `openInFileManager`），斷言 ok／失敗兩種映射成立且失敗不是 `unsupported`；`pnpm test` 通過（spec：桌面視窗形態回報可用；design D1、D2）
- [x] 2.3 移除 `src/api/desktop/shell.ts` 的 `revealItemInDir` 與 `RevealItemInDirShellOutcome`（已確認唯一呼叫者是 2.2 改掉的那一處），並從 `src-tauri/capabilities/default.json` 移除 `opener:allow-reveal-item-in-dir`——這條權限至此沒有呼叫者，開著沒人走的門不留。驗證：`grep -rn "revealItemInDir" src/ src-tauri/` 無結果；`cargo check`、`pnpm typecheck` 通過（design 的 Risks 的「`shell.ts` 的 `revealItemInDir()` 可能變成沒有呼叫者」那一項）

## 3. web 形態

- [x] 3.1 `server/utils/reveal.ts` 的 `revealPath` 依型別分岔：先 `stat`（`node:fs/promises`），是一般資料夾就 `execFile('/usr/bin/open', ['--', resolved])`（交出的是解過 symlink 的路徑，比照 1.2），否則（含檔案與應用程式包）維持 `execFile('/usr/bin/open', ['-R', '--', target])`；`stat` 失敗回 `{ status: 'failed' }`。應用程式包的判定比照 1.1b，以 `realpath`（`node:fs/promises`）解過 symlink 之後看副檔名是不是 `.app`（忽略大小寫），`realpath` 失敗時當成應用程式包。`canReveal()` 不動。檔頭那段「`open -R` 在 Finder 中選取該項目（不是開啟它）」的說明要改寫成分岔後的兩句。驗證：新增 `server/utils/reveal.test.ts`，以假的 `execFile`、`stat` 與 `realpath` 斷言一般資料夾走不帶 `-R` 的那條、檔案走帶 `-R` 的那條、`.app` 路徑走帶 `-R` 的那條、`stat` 失敗回 `failed`、非 macOS 仍回 `unsupported`；`pnpm test` 通過（spec：請求開啟一個指向檔案／資料夾的路徑；design D3、D4）
- [x] 3.2 確認 `server/api/reveal.post.ts` 與 `src/api/web-gateway.ts` 的 `revealPath` **零改動**——兩者只轉交路徑與狀態，分岔不經過它們。驗證：`git diff --stat` 兩檔不在改動清單中（design D4）

## 4. 畫面與提示

- [x] 4.1 `src/components/SettingsModal.vue` 的 `rows` 為兩個可開啟的項目各帶一個表明種類的欄位（`config` 是檔案、`project` 是資料夾），`revealHint()` 在三個禁用成因之後依種類回不同的一句，`aria-label` 改為各行自帶字串而非 `Show ${label} in its folder` 樣板。三個禁用成因的措辭、`aria-disabled`／`aria-describedby`／`title` 三條取得路徑、按鈕位置與圖示全部不動。確切文字：Config file 為 `Show in Finder`／`Show config file in its folder`（維持現狀），Current project 為 `Open in Finder`／`Open current project folder`。驗證：`src/components/SettingsModal.test.ts` 新增案例斷言兩列的 `title` 彼此不同、兩列的 `aria-label` 彼此不同，且三種禁用成因的說明仍彼此不同；`pnpm test` 通過（spec：兩列的動作說明分得出來、開啟所在位置不可用時的呈現；design D6）
- [x] 4.2 `src/stores/settings.ts` 的 `reveal` 改寫兩句提示：失敗由 `Could not open the enclosing folder.` 改為 `Could not open that location.`，`unsupported` 那句同樣改成不提 enclosing folder 的寫法。`RevealOutcome` 與流程本身不動。驗證：`src/stores/settings.test.ts` 既有案例更新後全過；`grep -rn "enclosing folder" src/` 無結果（design D5）
- [x] 4.3 確認 `src/api/types.ts` 的 `RevealOutcome` 三個狀態與 `EnvironmentDiagnostics` 零改動，僅更新已不準確的註解（`revealPath` 的說明、`RevealOutcome` 的 `revealed` 現在涵蓋兩種成功）。驗證：`git diff src/api/types.ts` 只有註解行（design D5、Non-Goals）

## 5. 收尾

- [x] 5.1 `ROADMAP.md` 的 T4c 那一列更新：該列現在寫「按下後 Finder 選取該項」，本張推翻其中資料夾那一半；連同 T4c 驗收時記下的「專案放在桌面第一層時 Finder 只開到桌面」這個已知限制一併標記為已解除。驗證：人工讀過該列
- [x] 5.2 `pnpm test`、`pnpm typecheck`、`pnpm lint` 全數通過，`cargo test` 既有測試連同 1.1 新增的全過

## 6. 驗收

> 6.2 起全部是**桌面視窗形態**與**打包形態**的驗收，playwright 驅動不了 Tauri 視窗，只能人工補做。

- [x] 6.1 以瀏覽器形態（`pnpm dev` 的 5173）開啟 Settings，兩顆按鈕各按一次：Config file 開到 `specrun-app` 設定目錄並選取 `config.json`；Current project 直接開進專案資料夾、看得到 `src/`、`openspec/`、`package.json`，**不是**停在它的上一層（spec：該項指向一個檔案、該項指向一個資料夾）
- [x] 6.2 以桌面形態啟動，重跑 6.1（spec：桌面視窗形態下可用）
- [x] 6.3 **回歸：設定檔那一列不可以跳出編輯器。** 按下 Config file 那顆之後確認沒有任何程式開起 `config.json`，只有檔案管理器跳到前景並選取它。這是本張最大的風險——`open_path` 對檔案路徑的行為就是交給預設程式開啟，型別判定一旦反向就會撞上這裡（spec：該項指向一個檔案；design D1）
- [x] 6.4 把目前專案切到**直接放在桌面第一層**的那一個（例如 `Desktop/specrun-app`），按下 Current project：確認 Finder 開的是該專案資料夾本身。T4c 驗收時記下的「只開到桌面、什麼都沒選取」在改完之後應當不再出現——那個現象的成因是選取，而這一列已經不走選取了（proposal 的 Why 講「macOS 對直接放在桌面第一層的資料夾不做選取」的那一段）
- [x] 6.5 在沒有選定專案的情況下開啟 Settings：Current project 那顆仍為禁用，說明仍是「這一項沒有可開的路徑」，措辭一字未變（spec：該項沒有路徑可開）
- [x] 6.6 以指標停留與鍵盤聚焦各讀一次兩顆按鈕的說明：確認兩句話分得出來——一句講把它指出來、一句講把它打開（spec：兩列的動作說明分得出來）（由操作流程驗證 gate 覆蓋：以 DOM 屬性讀出兩列的 title 與 aria-label，確認彼此不同且與定案文字逐字相符；指標停留與鍵盤聚焦這兩種讀法本身未實際操作）
- [x] 6.7 把目前專案資料夾在檔案管理器裡搬走（或改名），回到 App 按下 Current project：確認跳出的是失敗提示而不是任何 Finder 視窗，且 App 不崩。**已知取捨**：這則提示不會說「那個資料夾已經不在了」，只說開不起來（design D5）。驗完把資料夾搬回原位
- [x] 6.8 **打包後驗證**：以 `pnpm exec tauri build` 產出 `.app`，在本地 API server **未執行**的情況下啟動它，重跑 6.2、6.3、6.4。本張的動機就是從打包後實測長出來的，開發形態不算數（spec：不經本地 API server 也開得了檔案所在位置、不經本地 API server 也開得進目前專案）
- [x] 6.9 **應用程式不可以被啟動。** 對著一個 `.app` 路徑觸發開啟動作（例如把目前專案暫時指到 `/Applications` 底下的某個 App），確認檔案管理器跳到它的上一層並選取它，**沒有任何程式被啟動**。這是判定唯一擋下的那一類，自動測試只驗得到「分岔走到哪一條命令」，走到之後是不是真的不啟動只有人眼看得到（spec：該項指向一個應用程式、請求開啟一個指向應用程式的路徑、開啟動作收到的路徑指向一個應用程式）
