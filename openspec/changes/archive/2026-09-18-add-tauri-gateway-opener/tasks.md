## 1. 動手前的實測（design D5 的假設）

- [x] 1.1 在 `src-tauri/Cargo.toml` 新增 Tauri 官方負責把東西交給作業系統開的外掛（版本線與既有的檔案外掛一致），並在 `src-tauri/src/lib.rs` 的 builder 註冊它；`src-tauri/capabilities/default.json` 暫時加入「在檔案管理器中選取項目」這一項權限。驗證：`cargo check` 通過
- [x] 1.2 **實測外掛的「在檔案管理器中選取項目」指令會不會擴大檔案可讀範圍**：改以原始碼與權限定義查證（理由與證據見 `design.md` D5）。結論：假設成立，照 D5 繼續（design D5）
- [x] 1.3 `src-tauri/capabilities/default.json` 補上外掛現成的預設網址集權限（涵蓋 mailto／tel／https／http），不自列網址清單。驗證：`cargo check` 通過，原有的檔案可讀範圍設定零改動；本張實際新增三項權限而非字面的兩項，理由見 `design.md` D6 附記（design D6）

## 2. 外殼通道薄層

- [x] 2.1 `src/api/desktop/shell.ts` 新增 `revealItemInDir` 包裝：呼叫外掛的選取項目指令，失敗照該檔既有姿態收束成可辨識的失敗形狀，不放任何商業規則、不做平台分支。沿用既有做法不安裝外掛的 JS 套件。驗證：`pnpm typecheck` 通過（design D5、D8）
- [x] 2.2 `src/api/desktop/shell.ts` 新增 `openUrl` 包裝：呼叫外掛的開啟網址指令，同樣只收束型別與錯誤形狀。驗證：`pnpm typecheck` 通過（design D8）

## 3. 資料入口的型別與 web 形態

- [x] 3.1 `src/api/types.ts` 的 `EnvironmentDiagnostics` 把「能不能開啟所在位置」由三態收窄為兩態（移除「未知」），並更新該欄位的說明。驗證：`pnpm typecheck` 指出所有讀它的地方（預期為 `src/api/desktop/diagnostics.ts`、`src/stores/settings.ts`、`src/components/SettingsModal.vue`）（spec：開啟位置能力不回報未知；design D3）
- [x] 3.2 `src/api/types.ts` 的 `OpenSpecGateway` 新增開啟外部網址的方法，回傳成功／失敗兩態的結果型別（不設「此環境不支援」），並確認 `RevealOutcome` 三態原樣不動。驗證：`pnpm typecheck` 通過（spec：開啟外部網址通道；design D3）
- [x] 3.3 `src/api/web-gateway.ts` 實作開啟外部網址：**開新分頁必須是方法內的第一件事**，不得排在任何等待之後。驗證：`src/api/web-gateway.test.ts` 以假的開窗函式斷言它在該方法回傳的 promise 尚未 settle 之前就已被呼叫（即同一個同步區段內），並斷言開窗失敗時回報失敗而非拋錯（design 的 Risks 第二項）
- [x] 3.4 確認 `server/api/reveal.post.ts`、`server/utils/reveal.ts`、`src/api/web-gateway.ts` 的 `revealPath` 零改動——web 形態沒有別的通道。驗證：`git diff main --stat` 確認前兩者不在改動清單中（design 的 Non-Goals）

## 4. 桌面形態的實作

- [x] 4.1 新增 `src/api/desktop/opener.ts`：`revealPath` 呼叫 2.1 的薄層，成功回「開了」、失敗回「失敗」，**不產生「這個平台辦不到」**；開啟外部網址呼叫 2.2 的薄層，成功／失敗兩態。驗證：`src/api/desktop/opener.test.ts` 以假的外殼通道斷言四種映射各自成立，並斷言 `revealPath` 在任何情況下都不回「這個平台辦不到」（spec：桌面視窗形態回報可用；design D7、D8）
- [x] 4.2 `src/api/desktop/diagnostics.ts` 的「能不能開啟所在位置」改答固定的可用，不做平台分支，並更新該檔的檔頭說明。驗證：`src/api/desktop/diagnostics.test.ts` 斷言該項為可用且不為未知（spec：桌面視窗形態回報可用；design D7）
- [x] 4.3 `src/api/desktop-gateway.ts` 補上 `revealPath` 與開啟外部網址兩個方法，**拿掉展開 `webGateway` 的那一行**，並改寫檔頭說明——桌面形態的資料入口至此全數自持，不再有沿用自 web 形態的方法。驗證：`src/api/desktop-gateway.test.ts` 斷言介面上每一個方法都不落在 web 形態的實作上（以逐一比對兩份實作的方法參照為準，不是只測這兩個新的）（spec：桌面視窗形態啟動；design 的 Context）

## 5. 畫面端

- [x] 5.1 `src/components/MarkdownView.vue` 的點擊委派改成唯讀模式下也運作：現行那道「不是可勾選模式就整段退出」的守衛收緊成只圍住勾選那一段。外部連結的點擊擋掉預設行為後交給資料入口，開啟失敗以全 App 共用的非阻斷提示告知（錯誤語氣）；**不看鍵盤修飾鍵**。相對路徑連結與其他 scheme 維持不可點、不進入這條路。驗證：元件測試以三種模式（可勾選、唯讀、pending）各自斷言點擊外部連結都會呼叫資料入口一次；斷言按著 Cmd 點擊行為相同；斷言點擊不可點的相對路徑連結不呼叫資料入口；斷言開啟失敗時跳出提示（spec：連結行為、按修飾鍵點擊不改道、開啟失敗；design D1、D2）
- [x] 5.2 確認 `src/markdown/render.ts` 的連結處理程式邏輯零改動——`target="_blank"`、`rel` 與 `^(?:https?:|mailto:)` 那個判定原樣保留，它同時是通道的入口守衛。驗證：該檔程式邏輯零改動（`target="_blank"`、`rel`、`^(?:https?:|mailto:)` 判定原樣保留），僅更新已失效的註解；既有的 `src/markdown/*.test.ts` 全過（spec：允許範圍以外的 scheme；design D4、D6）
- [x] 5.3 `src/components/SettingsModal.vue` 移除「這個形態還沒有這個通道」那一句說明與它的分支，其餘三種成因的措辭、`aria-disabled`／`aria-describedby`／`title` 三條取得路徑、按鈕樣式皆不動。驗證：`pnpm typecheck` 通過（3.1 的型別收窄會點名這裡）；元件測試斷言三種禁用成因的說明文字彼此不同，且不再有第四種（spec：開啟所在位置不可用時的呈現）
- [x] 5.4 確認 `src/stores/settings.ts` 的 `reveal` 流程零改動——它讀的仍是同一組結果。驗證：既有 `src/stores/settings.test.ts` 全過（design 的 Non-Goals）

## 6. 收尾

- [x] 6.1 移除 `src/api/index.ts` 的 `getHealth`，並移除隨之無人使用的型別（若 `HealthResponse` 再無呼叫端則一併移除，`server/api/health.get.ts` 保留不動）。驗證：`grep -rn "getHealth" src` 無結果，`pnpm typecheck`、`pnpm lint` 通過（design D10）
- [x] 6.2 `ROADMAP.md` 的 T4c 那一列補上 change 名稱與狀態，並確認堆疊說明中「開啟所在位置為禁用、外部連結點了沒反應」的敘述已不再成立、一併更新。驗證：人工讀過該表

## 7. 驗收

- [x] 7.1 `pnpm test`、`pnpm typecheck`、`pnpm lint` 全數通過，`cargo test` 既有測試全過（由 gate 覆蓋：Tester gate ＋ orchestrator 實測，518 前端測試／17 Rust 測試全過，typecheck 與 lint 乾淨）
- [x] 7.2 以桌面形態啟動，開啟 Settings：確認 Config file 與 Current project 兩顆按鈕**可按**（不是禁用），按下後 Finder 開到該路徑所在資料夾並選取該項（spec：桌面視窗形態下可用）（人工驗收 PASS：兩顆皆可按，Finder 開到該路徑所在資料夾並選取該項）
- [x] 7.3 在沒有選定專案的情況下開啟 Settings：確認 Current project 那顆仍為禁用，說明是「這一項沒有可開的路徑」，且畫面上找不到任何「這個形態還沒有這個通道」的措辭（spec：該項沒有路徑可開、開啟所在位置不可用時的呈現）（人工驗收 PASS：以清空專案清單進入該狀態，Current project 顯示 `No project selected` 且該顆禁用，同畫面 Config file 仍可按）
- [x] 7.4 以鍵盤逐項移動到被禁用的那顆按鈕：確認仍可聚焦、輔助技術讀得到禁用原因（spec：鍵盤與輔助技術取得禁用原因）（人工驗收 PASS）
- [x] 7.5 以桌面形態開啟一個含外部連結的 artifact（本專案的 artifact 沒有外部連結，請臨時在某個 change 的 `proposal.md` 加一行 `[test](https://example.com)`，驗完刪除）：點它，確認系統的預設瀏覽器開起該網址、App 視窗沒有導航、仍停在同一個 change 與同一個 tab、捲動位置不變（spec：桌面視窗形態的外部連結、開啟後檢視狀態不變）（人工驗收 PASS：系統瀏覽器開起該網址，App 視窗無導航，change／tab／捲動位置皆不變）
- [x] 7.6 同一個連結按著 Cmd 點：確認行為與一般點擊相同（spec：按修飾鍵點擊不改道）（人工驗收 PASS）
- [x] 7.7 在 Specs 全文與已歸檔詳情兩處各驗一次同樣的外部連結——這兩處永遠是唯讀模式，是 5.1 最容易漏掉的地方（spec：連結行為）（人工驗收 PASS：兩處唯讀模式皆正常開啟外部連結）
- [x] 7.8 在同一份內容裡放一個相對路徑連結與一個 `file:` 開頭的連結：確認兩者都渲染為不可點的樣式，點下去沒有任何導航或開啟（spec：相對路徑連結、允許範圍以外的 scheme）（人工驗收 PASS：兩者皆渲染為不可點，點擊無導航、無開啟）
- [x] 7.9 **打包後驗證**：以 `pnpm exec tauri build` 產出 `.app`，在本地 API server **未執行**的情況下啟動它，重跑 7.2 與 7.5。這是本張的存在理由，開發形態不算數（spec：不經本地 API server 也開得了檔案所在位置、也點得動外部連結）（驗收 PASS：`tauri build` 產出 `.app`，在 3210／5173 皆無行程的狀態下啟動，側欄專案、change 清單、artifact 全文皆正常載入即證明不經本地 API server。7.2 重跑——Config file 開到所在資料夾並選取 `config.json`；Current project 指向 `Desktop/TCERT/ui` 時開到 `Desktop/TCERT/` 並選取 `ui`。**已知限制**：專案若直接放在桌面第一層（如 `Desktop/specrun-app`），Finder 只開到桌面而不選取該資料夾；此為 macOS 行為，系統自帶的 `open -R` 對桌面第一層資料夾亦相同，與本張實作無關。7.5 重跑——點外部連結後 Chrome 開出 `Example Domain` 視窗，App 視窗無導航、change／tab／捲動位置皆不變；順帶重跑 7.6，Cmd 點擊後 App 同樣無任何變化）
- [x] 7.10 以瀏覽器形態（`pnpm dev` 的 5173）重跑 7.5：確認外部連結仍於新分頁開啟、App 畫面不變；並確認 Settings 的兩顆按鈕在 macOS 上仍可按（web 形態走本地 API server 那一條，本張沒動它）（spec：外部連結、能力判定在執行形態）（由 gate 覆蓋：操作流程驗證 PASS——三處外部連結皆開新分頁、大寫 scheme 行為一致、Cmd 點擊不改道、相對路徑與 `file:` 不可點、App 無導航、Settings 兩顆按鈕非禁用且舊措辭已無，無 console error／network 異常）

> 7.2–7.9 全部是**桌面視窗形態**與**打包形態**的驗收，playwright 驅動不了 Tauri 視窗，只能人工補做。其中 7.7、7.8 的等效行為已在瀏覽器形態驗過（見 7.10）；7.3、7.4 的三種禁用成因措辭、鍵盤可聚焦、`aria-describedby` 說明可讀，已有 `src/components/SettingsModal.test.ts` 的元件測試把關。
