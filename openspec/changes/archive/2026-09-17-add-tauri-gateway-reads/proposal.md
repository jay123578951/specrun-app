## Why

打包出來的桌面 App 現在側欄列得出專案、Settings 顯示得出 openspec 執行檔的位置（T1.6 給的），但主區一片錯誤——change 清單、change 詳情、spec 清單、spec 全文這四條讀取路都還得問本地 API server，而 `.app` 裡沒有它。這四條路就是 App 的主體：搬不過來，桌面形態就沒有內容可看。

這張是桌面形態第一次用檔案通道讀專案資料夾底下的東西。前三張碰的檔案只有應用程式自己的設定檔，專案資料夾一律交給 openspec 執行檔去跑（跑外部指令不受檔案存取範圍管）。從這張起，卡片的 Why 摘錄要讀 `proposal.md`、卡片的今昨排序要讀 change 目錄的建立時刻、詳情要讀引擎列出的每一份 artifact——先前沒被觸發的兩個前提因此浮上來：App 啟動時載入的那個專案從未取得過檔案存取授權（只有「加入專案」時才授權），而外殼的權限清單裡也沒有查詢建立時刻的那一項。

## What Changes

- change 清單、change 詳情、spec 清單、spec 全文四條讀取路 SHALL 改由**當前執行形態自行持有**：桌面形態走外殼通道，web 形態維持現狀走本地 API server。解析與錯誤分類的共用純函式不動，兩形態餵同一份。
- 目標專案的檔案存取授權 SHALL 於「開始使用該專案」時取得，不再只在加入專案時取得——啟動時從設定載入的專案、以及執行期切換過去的專案都算。授權失敗 SHALL 比照目標路徑不可用，畫面沿用既有的「這個資料夾不是 OpenSpec 專案」。
- 目標專案路徑的 canonical 化 SHALL 由當前執行形態提供。外殼補一個路徑正規化通道（解開 symlink），使兩種形態對同一個專案算出同一個路徑。現行 spec 要求以 canonical 化後的路徑與引擎回報的 root 比對，桌面形態目前只做字串層正規化，symlink 專案會被誤判為「不是 OpenSpec 專案」。
- 外殼的檔案權限清單 SHALL 涵蓋查詢檔案基本資訊，卡片的建立時刻才讀得到；讀不到時沿用既有降級（該筆時刻為空，不算錯誤）。
- 錯誤分類 SHALL 明確涵蓋執行通道的逾時與輸出截斷兩種結果，歸「呼叫或解析失敗」類——這兩者在桌面形態是帶旗標的成功回傳，不是例外，分類時容易漏掉。

**非目標**（留給後續 change）：

- tasks 勾選、park／unpark、archived 直讀——下一張。
- 檔案變動通知、原生選資料夾、開啟檔案所在位置——最後一張。
- 環境診斷已於 T1.6 搬完，不在本張範圍；其中「通知是否運作」與「能否開啟所在位置」兩項仍回未知，要等對應通道搬過去才填得出真值。
- 桌面形態補打本地 API server 的那趟過渡呼叫**不在本張刪除**。它服務的不只讀取面：本地 API server 手上還有 tasks 勾選、park 與檔案變動通知，這些都要靠那趟才知道目前專案是哪個。本張只改寫它的解除條件。
- 打包形態下仍不可用的四項（Archived 整頁、任務勾選、加入專案、開啟所在位置）維持現行的錯誤訊息，不另做「尚未支援」的標示——後兩張搬完即自然消失。

## Capabilities

### New Capabilities

（無——本 change 不引入新的能力，只更換既有能力的持有者與執行形態。）

### Modified Capabilities

- `openspec-gateway`：「目標專案路徑解析」補上兩件事——目標路徑的 canonical 化由當前執行形態提供，以及在具備授權通道的形態下，使用某專案前 SHALL 先取得其檔案存取授權且失敗比照目標路徑不可用；「非 openspec 專案的判定以 root 路徑比對為準」把 canonical 化的要求由單邊（引擎回報的 root）改為比對的兩邊皆然；「錯誤分類」補上執行通道的逾時與截斷結果的歸類。
- `desktop-shell`：「桌面視窗形態啟動」的自持範圍由「設定讀寫與 CLI 執行檔解析」擴及 change 與 spec 的讀取；「專案路徑的檔案存取授權」補上查詢檔案基本資訊亦在授權範圍內；新增「路徑正規化通道」——外殼 SHALL 提供解開 symlink 取得實際位置的通道。

## Impact

- **搬移來源**：`server/api/changes.get.ts`、`server/api/changes/[name].get.ts`、`server/api/specs.get.ts`、`server/api/specs/[id].get.ts`，以及 `server/utils/openspec-cli.ts` 的 `resolveTargetDir` 與 `toProbeFailure`。四者的解析與分類早已全數在 `src/api/normalize.ts`，搬的只是「怎麼跑指令、怎麼讀檔、失敗長什麼樣」三件事。
- **資料入口**：`OpenSpecGateway` 的四個方法在桌面形態改由新實作承接——`listChanges`、`getChangeDetail`、`listSpecs`、`getSpecContent`。介面不變，畫面端零改動。
- **既有桌面模組**：`src/api/desktop/cli.ts` 的指令執行結果要擴充成帶結束代碼與錯誤輸出的完整形狀（目前壓成成功與否加一段輸出，分類不出錯誤）；側欄徽章那一側自行收斂。`src/api/desktop/projects.ts` 的授權時機由「加入專案」擴及「開始使用」。
- **外殼**：`src-tauri/src/lib.rs` 新增路徑正規化指令；`src-tauri/capabilities/default.json` 補查詢檔案基本資訊的權限。
- **不刪**：四條 server route 與 `server/utils/openspec-cli.ts` 都留著，web 形態還要用。
- **可觀察的中間態**：本 change 完成後，打包的 App 側欄有專案可切換、主區列得出 changes、詳情點得開、Specs 頁可用；仍不能用的是任務勾選、park、Archived 整頁、加入專案、檔案變動自動刷新、開啟所在位置。也就是它還不是日常可用的工具——勾任務仍得開瀏覽器，要等下一張。
