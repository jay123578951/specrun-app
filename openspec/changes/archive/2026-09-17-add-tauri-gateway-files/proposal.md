## Why

T2 之後，打包出來的桌面 App 已經列得出 change、開得出詳情、看得到 spec 全文——但它還只能看不能動。勾一個任務、把 change 停下來、翻已歸檔的舊紀錄，這三件事仍得問本地 API server，而 `.app` 裡沒有它。少了勾選，這個 App 就還不是日常拿來用的工具：實作途中想勾掉一項，還是得回瀏覽器開一份。

這張是桌面形態第一次往專案資料夾裡**寫**東西。先前三張只讀不寫（T1.6 寫的是 App 自己的設定檔），從這張起要建目錄、搬目錄、改寫使用者真正的 tasks 檔案，而且其中一半的操作落在 `.git/` 底下。

## What Changes

- 檔案操作面的七條路 SHALL 改由**當前執行形態自行持有**：tasks 勾選寫入、park、unpark、parked 清單、parked 詳情、archived 清單、archived 詳情。桌面形態走外殼的檔案通道，web 形態維持現狀走本地 API server。解析用的共用純函式不動，兩形態餵同一份。
- tasks 檔案位置的解析結果若被重用，SHALL 以目標專案與 change 名**共同**識別。現行只用 change 名識別——本地 API server 是隨開發指令起落的短命行程，撞不太到；桌面 App 一開一整天且切專案頻繁，兩個專案有同名 change 時會把勾選寫進另一個專案的檔案。勾選是全 App 唯一的寫入通道，寫錯的是使用者真正的檔案。
- park 可用性的判定 SHALL 不依賴對 `.git` 本身的存取授權。桌面形態的檔案存取是白名單制，`.git` 只在它是目錄時被放行；沿用「直接查 `.git` 是檔案還是目錄」的判法，會把 git worktree 誤報成「這不是 git repository」，提示說錯原因。
- parked 詳情對快照所列檔案 SHALL 分辨「已不存在」與「存在但讀不到」：前者略過、詳情照常開啟，後者回報失敗。這條現行只存在於實作（靠作業系統的錯誤代碼），spec 從未寫明；桌面形態的檔案通道不給錯誤代碼，不寫明就會退化成「使用者手動刪過 parked change 裡任何一個檔案，該 change 的詳情就再也打不開」。

**非目標**（留給後續 change）：

- 檔案變動通知、原生選資料夾、開啟檔案所在位置——最後一張（T4）。
- 桌面形態補打本地 API server 的那趟過渡呼叫**不在本張刪除**。本地 API server 手上還有檔案變動通知，它得知道目前專案是哪個才監看得到。本張只改寫它的保留理由。
- 打包形態下勾選成功後，**左側卡片上的進度數字不會馬上變**，切頁回來才更新。勾選的成功路徑刻意不做任何刷新（見 design D6），刷新一向交給檔案變動通知，而通知 T4 才搬過來。這是已知的過渡狀態，不是缺陷；本張不為它改動兩形態共用的寫入流程。
- 與 web 形態重複的那份實作**不抽共用層**，沿用 T2 的裁決——web 那側 T4 整批刪除，屆時桌面那份自動成為唯一一份。

## Capabilities

### New Capabilities

（無——本 change 不引入新的能力，只更換既有能力的持有者與執行形態。）

### Modified Capabilities

- `desktop-shell`：「桌面視窗形態啟動」的自持範圍由「設定、CLI 執行檔解析、change 與 spec 的讀取」擴及檔案操作面（tasks 勾選、park／unpark、parked 與 archived 的直讀）；過渡期間仍經本地 API server 的只剩檔案變動通知與原生對話框。
- `openspec-gateway`：「task 勾選寫入通道」的表述由「伺服端解析」改為形態中立的「當前執行形態解析」，並補上一條——解析結果若重用，SHALL 以目標專案與 change 名共同識別，MUST NOT 只以 change 名識別。
- `park-mechanism`：「無正常 git 目錄時 park 降級」補上判定方式的限制——判定 SHALL 不依賴對 `.git` 本身的存取授權，兩種降級原因在任何執行形態下都要分得出來；「Parked 詳情唯讀」補上快照檔案缺席與讀取失敗的分野。

## Impact

- **搬移來源**：`server/api/changes/[name]/tasks/toggle.post.ts`、`server/api/changes/[name]/park.post.ts`、`server/api/parked/[name]/unpark.post.ts`、`server/api/parked.get.ts`、`server/api/parked/[name].get.ts`、`server/api/archived.get.ts`、`server/api/archived/[name].get.ts`，以及 `server/utils/parked-store.ts`、`server/utils/archive-store.ts`、`server/utils/tasks-path-cache.ts`。解析與分類早已全數在 `src/api/normalize-parked.ts` 與 `src/api/normalize-archived.ts`，搬的只是「怎麼讀寫檔案、怎麼列目錄、失敗長什麼樣」。
- **資料入口**：`OpenSpecGateway` 的七個方法在桌面形態改由新實作承接——`toggleTask`、`parkChange`、`unparkChange`、`listParked`、`getParkedDetail`、`listArchived`、`getArchivedDetail`。介面不變，畫面端零改動。
- **新增共用模組**：一份純字串的路徑計算模組（接路徑、取上一層、算相對路徑、判斷是否落在某目錄底下）。外殼的路徑 API 沒有「算相對路徑」這個能力，而 park 的 artifact 快照非它不可（存絕對路徑的話 repo 一搬家就全失效）。
- **既有桌面模組**：`src/api/desktop/shell.ts` 補一個「這個路徑存在嗎」的包裝（權限已在清單內，只差包裝）；`src/api/desktop/projects.ts` 的過渡呼叫改寫保留理由。
- **外殼與權限**：零改動。授權通道已遞迴放行 `<專案>/.git`，寫檔、建目錄、搬移、刪除、列目錄、查基本資訊、查存在與否七項權限均已具備。
- **不刪**：七條 server route 與兩個 server 檔案層模組都留著，web 形態還要用。
- **可觀察的中間態**：本 change 完成後，打包的 App 可以勾任務、可以把 change 停下來再恢復、Archived 頁整頁可用——桌面形態自此是日常拿得起來用的工具。仍不能用的是：檔案變動的自動刷新（含勾選後卡片數字不動）、以原生對話框加入專案、開啟檔案所在位置。
