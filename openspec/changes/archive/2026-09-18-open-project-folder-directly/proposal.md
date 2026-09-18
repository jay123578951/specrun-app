## Why

Settings 診斷區的「設定檔位置」與「目前專案路徑」各帶一顆按鈕，兩顆共用同一條行為：跳到該路徑的上一層資料夾、並在那裡選取該項。

這條行為當初是為**設定檔**那一列選的，理由寫在 `server/utils/reveal.ts` 的檔頭：按下去不該跳出編輯器。對一個檔案來說，「直接打開」就是交給預設程式，那不是使用者按這顆按鈕時要的。

**目前專案**那一列指的是一個資料夾，它是跟著設定檔那一列一起被決定的，沒有被單獨問過。對資料夾來說，「直接打開」的意思完全不同——是看到它裡面裝了什麼，而這正是使用者按這顆按鈕時想做的下一件事。

T4c 打包後實測讓這個落差浮出來：目前專案是 `Desktop/specrun-app`，按下去 Finder 跳到桌面，專案本身只是桌面上眾多資料夾的其中一個。使用者的原話是「正常他應該把 specrun-app 開起來」。

還有一個讓現況更難看的巧合：macOS 對**直接放在桌面第一層的資料夾**不做選取。實測 `Desktop/specrun-app`、`Desktop/specrun`、`Desktop/EOC` 三個都一樣，改用系統自帶的 `open -R` 跑同一組結果完全相同，所以這是 macOS 的行為、不是實作寫壞。但後果是：專案放在桌面第一層時，這顆按鈕只開出一個什麼都沒指到的 Finder 視窗，看起來跟「按了沒反應」分不出來。

## What Changes

- **診斷區的開啟動作 SHALL 依該項指向的是檔案還是資料夾分岔**：
  - 指向**檔案**時維持現狀——開啟該檔所在的資料夾並選取該檔，MUST NOT 以預設程式開啟該檔。
  - 指向**資料夾**時 SHALL 直接開啟該資料夾本身，使用者看到的是它的內容，MUST NOT 退到它的上一層。
- **兩個執行形態一起改**：桌面形態與 web 形態走各自的通道但呈現同一個行為。同一顆按鈕在瀏覽器裡和在桌面視窗裡做不同的事，是使用者分辨不出也不該遇到的差異。
  - 這推翻了 `add-tauri-gateway-opener` 的一條非目標（「`/api/reveal` 與 `server/utils/reveal.ts` 原樣留著」）。那條在當時成立——那張問的是「通道由誰持有」，web 那一份沒有理由跟著動；本張問的是「按鈕該做什麼」，答案必須兩個形態一致。
- **按鈕的說明文字與輔助技術名稱 SHALL 跟著分岔**：現行兩列共用的 `Show in Finder` 在資料夾那一列不再準確——它不再是指給你看，而是帶你進去。兩列的措辭 SHALL 彼此分得出來。
- **桌面形態的開啟資料夾由自寫指令持有，權限清單不增加**：外掛的 `open_path` 指令 `add-tauri-gateway-opener` 當時刻意沒接。動手前已查證它的權限形狀（見 `design.md` D2）：那條權限本身不帶路徑範圍，但指令本體要求路徑範圍非空才放行，所以單獨加上去會一律被拒；要讓它能開任意專案路徑，只能配一個包山包海的範圍，等於把「叫作業系統開啟任何路徑」整個開給 webview。因此改比照 `pick_folder` 的既定做法，以自寫指令包該外掛的 **Rust API**——`src-tauri/capabilities/default.json` 的權限清單一個字都不增加。

**非目標**（維持現況，或留給後續）：

- **禁用的三種成因不動**：診斷還沒回來／這個平台辦不到／那一項沒有路徑可開，措辭與三條取得路徑（指標、鍵盤、輔助技術）全部原樣。
- **按鈕的位置、圖示、鍵盤行為不動**：變的只有按下去之後發生什麼事，以及說明文字。
- **不接「用編輯器開啟檔案」**：設定檔那一列維持不開啟該檔。那是另一個題目（`artifact` 的「用編輯器開啟」觀察項），本張不碰。
- **artifact 內容裡的連結行為不動**：外部連結、相對路徑連結、允許範圍以外的 scheme 全部維持 `add-tauri-gateway-opener` 定案的樣子。
- **診斷區的條列不增減**：仍是設定檔位置、目前專案路徑、即時刷新、App 版本四項。

**前置條件**：本張的 delta 建立在 `add-tauri-gateway-opener` 已 sync 並 archive 之後的主 spec 上——被本張改寫的那幾條 scenario（開啟並選取該項）目前還在那張的 delta 裡，尚未進主 spec。

## Capabilities

### New Capabilities

（無——本 change 不引入新的能力區塊，只改寫既有能力的一條行為。）

### Modified Capabilities

- `app-settings`：「開啟所在位置不可用時的呈現」中，可按時的行為由單一的「開啟所在位置並選取該項」改為依指向的是檔案還是資料夾分岔；按鈕說明文字新增「兩列措辭要分得出來」的要求。
- `openspec-gateway`：開啟所在位置的通道，其結果行為同樣依指向的是檔案還是資料夾分岔。
- `desktop-shell`：桌面形態不經本地 API server 開啟位置的那條 scenario，跟著改為分岔後的行為。

## Impact

- **畫面**：`src/components/SettingsModal.vue` 的按鈕說明文字與輔助技術名稱（`revealHint`、`aria-label`）。
- **資料入口**：`src/api/types.ts` 的結果型別可能需要區分「開了資料夾」與「選取了檔案」兩種成功，或維持單一成功態——留給 design 收斂。
- **桌面形態**：`src-tauri/src/lib.rs` 新增一個自行判定型別並開啟的指令，`src/api/desktop/shell.ts`、`src/api/desktop/opener.ts` 各加一層薄殼接它；`src-tauri/capabilities/default.json` 不新增任何權限（原有的 `opener:allow-reveal-item-in-dir` 若失去唯一呼叫者則一併移除）。
- **web 形態**：`server/utils/reveal.ts` 依目標型別改走 `open` 或 `open -R`；`server/api/reveal.post.ts`、`src/api/web-gateway.ts` 視結果型別是否變動而定。
- **不受影響**：`src/stores/settings.ts` 的 `reveal` 流程、診斷區的四項條列、`src/markdown/` 全部。
