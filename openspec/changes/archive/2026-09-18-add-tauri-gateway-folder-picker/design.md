## Context

見 `proposal.md` 的 Why。這裡只記動手時需要的現況與限制。

**現況的通道**：`src/api/desktop-gateway.ts` 以 `...webGateway` 起頭，凡桌面形態尚未自持的方法都自動落回 web 形態那一份。`pickFolder` 就是其中之一，它去打 `/api/pick-folder`，由 `server/utils/folder-picker.ts` 以 `osascript` 執行 AppleScript 的 `choose folder`。因此有三個綁在一起的限制：只在 macOS 成立、取消與否要靠 stderr 的關鍵字去猜、dialog 由另一個程式開啟所以主視窗仍可點（於是需要一個 `inFlight` 旗標擋第二次觸發）。

**外殼既有的指令寫法**：`src-tauri/src/lib.rs` 已有五個自有指令（外部指令執行、兩種路徑授權、路徑正規化、平台查詢），前端經 `src/api/desktop/shell.ts` 這層薄殼呼叫。薄殼的既定姿態是「只做型別與錯誤形狀的收束，不放任何商業規則」，且刻意不安裝 JS binding 套件——fs 那一組就是直接 `invoke('plugin:fs|...')`。

**授權是單向的**：`allow_dir_listing` 只放行資料夾本身（`allow_file`），`allow_path` 才遞迴放行整棵樹，兩者之間隔著 `openspec/` 驗證。這個兩階段不是隨手寫的——`lib.rs` 的註解寫明 Tauri 的 `Scope` 只能加不能減，`forbid_directory` 永久優先於 allow，所以驗不過的路徑撤不回來。

## Goals / Non-Goals

**Goals:**

- 打包形態下加得了專案，且加入之後的每一步行為與現況逐字相同。
- 選定一個非專案資料夾，不換來該資料夾內任何檔案的讀取權。
- 移除「重複開啟 dialog」這個失敗模式本身，而不是再寫一層防呆去擋它。

**Non-Goals:**

- 不抽共用層。桌面與 web 兩份實作並存，沿用 T2 的裁決：真正共用的部分（結果分類）本來就是純資料，重複的只有開視窗那一步，而那正是兩形態唯一真正不同的地方。
- 不擴大驗收平台。現況只在 macOS 驗收，本張維持；Windows／Linux 由外掛自己負責，不另行驗證。
- 不碰 `src/api/desktop/projects.ts` 的加入流程。

## Decisions

### D1：外殼提供自有的 `pick_folder` 指令，不讓 webview 直接呼叫對話框外掛

在 `src-tauri/src/lib.rs` 新增一個自有指令，內部使用對話框外掛的 **Rust API**（`FileDialogBuilder`）。webview 端的權限清單**不加** `dialog:allow-open`。

**理由**：外掛的 JS 指令在 `directory: true` 時，會在回傳路徑之前自行對選定路徑呼叫 `allow_directory(path, false)`，把該資料夾第一層的所有檔案加進 fs scope。這發生在 `openspec/` 驗證之前，而且撤不回來。使用者挑錯一次（家目錄、隨手一個含 `.env` 的資料夾），App 就在該次執行期間持有那些檔案的讀取權。兩階段授權的整段設計會因此作廢——`allow_dir_listing` 那一大段註解防的正是這件事。

外掛的 Rust API 不碰 fs scope，自動放行只存在於它的 JS 指令那一層，繞過去就不會發生。

**曾考慮**：
- *直接用外掛的 JS 指令，接受自動放行*。程式最少，但要放棄一個已經寫下理由的安全邊界，且放棄的當下畫面上看不出任何差別——這種退化不會有人發現。
- *自己包 rfd*。同樣避開自動放行，但要多一個直接相依，並自行處理三個平台的差異；用外掛的 Rust API 可以同時拿到平台處理與乾淨的授權邊界。

### D2：dialog 以主視窗的附屬視窗開啟

建構 dialog 時以 `parent()` 指定 main 視窗。macOS 上呈現為自標題列滑下的 sheet，Windows／Linux 上為以主視窗為擁有者的強制回應視窗；三者的共同保證是「開啟期間主視窗不接受輸入」，規格寫的也是這一句，不是「sheet」。

**理由**：這是「為這個視窗挑一個資料夾」在桌面平台的慣例形態，而且它讓 D3 成立。

**曾考慮**：*不指定 parent，維持現況的獨立浮動視窗*。與今天的觀感一致，但主視窗仍可點，就得繼續維護重複開啟的守衛。

### D3：不保留「已有 dialog 開著」的守衛

`inFlight` 旗標與 `busy` 這個結果不搬到桌面形態。

**理由**：D2 的附屬視窗保證只在 dialog 真的呈現之後成立——從 `startAdd` 呼叫 `gateway.pickFolder()` 到 rfd 真的呼叫 `begin_modal` 之間，這一趟要先跨行程走一次 IPC（`invoke` → 丟進 async runtime → `run_on_main_thread` 排進事件迴圈），這段期間主視窗照常收點擊，「按鈕點不到」在這段還不成立。這段缺口不靠系統維護「已有 dialog 開著」的全域狀態去補（那正是這裡要拒絕的做法），而是由入口按鈕自己的「選擇進行中」狀態補：`src/stores/projects.ts` 的 `startAdd` 在等待 `gateway.pickFolder()` 期間對外呈現這個狀態，四個入口統一綁上它，效果僅止於讓按鈕不可點——`startAdd` 自己的控制流不因此改變，不提早 return，也不回一個結果。按鈕不可點之後，第二次觸發（透過這四個按鈕）確實不存在觸發條件，`inFlight`／`busy` 那一種「攔下第二次呼叫並回結果」的守衛仍然沒有存在的理由：為一個不可能發生的情況寫防呆，會留下一段永遠不會被執行、也無法被測試涵蓋的分支。

**代價**：如果日後有人拿掉 `parent()`，重複開啟會無聲地回來。規格把「開啟期間主視窗不接受輸入」寫成正式需求就是為了讓這件事不是靠實作記得——拿掉 parent 會違反規格，不只是改壞一個細節。

### D4：指令的回傳形狀是「有路徑／沒路徑／錯誤」三選一

指令回 `Result<Option<String>, String>`：`Ok(Some(path))` ＝選定，`Ok(None)` ＝取消，`Err` ＝ dialog 開不起來。薄殼把這三者映射成既有的 `PickFolderOutcome`：

| 外殼回什麼 | 映射成 | 畫面上 |
| --- | --- | --- |
| `Ok(Some(path))` | `picked` | 進入既有的加入流程 |
| `Ok(None)` | `canceled` | 什麼都不發生，不留痕跡 |
| `Err` | `failed` | toast：無法開啟選擇器 |

`Err` ＝「dialog 開不起來」只在 macOS 驗證成立（見 Non-Goals）。rfd 在 Linux 走 xdg-desktop-portal，portal 失敗會退到呼叫 `zenity`；`zenity` 也開不起來時 rfd 只記一行 log 就回 `None`（`rfd-0.16.0/src/backend/xdg_desktop_portal.rs:149-169`），與使用者按取消回傳的值完全一樣。也就是說在 Linux 上，「dialog 開不起來」有機會落成 `canceled`（畫面上什麼都不發生、不留痕跡）而不是這裡表格寫的 `failed`。這不是本張要處理的缺陷——Linux／Windows 由外掛自己負責、不在驗收範圍——但日後若要把這張的 D4 套用到其他平台，不能直接照這張表當三平台通則。

**理由**：取消變成一個明確的值，取代現行以 stderr 關鍵字寬鬆比對的猜法——比對不中會落成 `failed`，也就是取消一次跳一則錯誤 toast。這個猜法在桌面形態直接消失。

`unsupported` 與 `busy` 在桌面形態不會回，但 `PickFolderOutcome` 的聯集**不縮**：web 形態兩者都還會回，而 `src/stores/projects.ts` 的 `startAdd` 是兩形態共用的同一段分流。

### D5：指令宣告為 async，等待以通道完成

指令宣告成 `async`，內部以一次性通道等待外掛的回呼。

**理由**：沿用 `canonical_path` 已經立過的同一個理由——Tauri 只把 async command 丟到 async runtime，同步的會在主執行緒上跑。選資料夾的等待長度由使用者決定，卡在主執行緒上等於整個視窗停止回應。外掛的回呼版本自己負責把開視窗那一步送回主執行緒，呼叫端不必處理。

### D6：不設起始目錄、標題沿用現行文案

不呼叫 `set_directory`；標題沿用 `Select a project folder`。

**理由**：現況就沒設，由作業系統自己記住上次的位置。改成指定起點是另一個題目（要記在哪、記幾個、換專案要不要換），不屬於本張的搬移範圍。

### D7：web 形態那一份原樣留著

`server/api/pick-folder.post.ts` 與 `server/utils/folder-picker.ts` 不動，`src/api/web-gateway.ts` 的 `pickFolder` 不動。`desktop-gateway.ts` 的 `...webGateway` 這一行本張也不拿掉——開啟檔案所在位置還靠它落回 web 形態。

## Risks / Trade-offs

- **外掛的回呼在哪個執行緒、能不能在 async command 裡安全等待** → D5 的通道寫法是標準做法，但實際行為要在桌面視窗裡實測一次：開得出來、選完回得來、取消也回得來、期間視窗不卡。三件事都要在同一次驗收裡看到。
- **附屬視窗在非 macOS 平台的呈現不同** → 規格只要求「開啟期間主視窗不接受輸入」，sheet 與強制回應視窗都滿足。呈現差異不入規格，也不擴大驗收平台（見 Non-Goals）。
- **新增一個 Rust 相依** → 是 Tauri 官方外掛，與既有的檔案外掛同一條版本線，不引入第三方維護風險。
- **拿掉 parent 會讓重複開啟無聲回來** → 見 D3 的代價；規格層已寫成正式需求，違反它是規格問題不是實作細節。
- **本張到後半之間，桌面形態仍有一條路落回 web 形態** → 開啟檔案所在位置。它在畫面上已呈現為禁用並說明原因，不會讓人誤以為壞掉；artifact 裡的外部連結則仍是點了沒反應，驗收時要當成預期行為，不要回報為缺陷。

## Migration Plan

無資料遷移。gateway 依執行形態分流，桌面形態換掉 `pickFolder` 的來源即生效，web 形態完全不受影響。回退方式是把 `desktopGateway` 上的 `pickFolder` 那一行拿掉，讓它重新落回 `...webGateway`。
