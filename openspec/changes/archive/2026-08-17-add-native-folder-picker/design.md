## Context

動機見 proposal.md。現況：`GatewayApi` 已有 `canPickFolder: boolean` 與 `pickFolder(): Promise<string | null>`（design D5 預留給 Tauri），web-gateway 寫死 `canPickFolder: false`；`ProjectSwitcher.startAdd()` 依此二擇一（開 dialog 或展開輸入列）。Nitro server 與瀏覽器同機，作業系統 dialog 可由 server 端 spawn `osascript` 開出。

限制：
- 瀏覽器端拿不到絕對路徑，路徑必須由 server 端產生。
- `canPickFolder` 目前是同步布林；web 版的能力實際上要問過 server 才知道。

## Goals / Non-Goals

**Goals:**
- macOS 上點「Add project」直接開原生資料夾選擇 dialog，選定即進既有驗證與加入流程。
- 能力判定在 server（平台分支），前端不寫死；不支援或失敗時無縫落回輸入列。

**Non-Goals:**
- Windows／Linux 的原生 dialog（維持輸入列）。
- App 內建資料夾瀏覽器 UI。
- Tauri gateway 的實作（介面調整需顧及它未來好接，但不在本次做）。

## Decisions

### D1: 介面收斂——用單一 `pickFolder()` 帶狀態結果，取代「同步布林＋nullable 回傳」

`canPickFolder` 是同步布林，但 web 版的能力必須問 server，硬保留布林就得引入啟動時探測與非同步初始化。改為單一方法、結果自帶狀態：

```
pickFolder(): Promise<PickFolderOutcome>
PickFolderOutcome =
  | { status: 'picked', path: string }   → 送進既有 submitPath 驗證加入
  | { status: 'canceled' }               → 無事發生
  | { status: 'unsupported' }            → 展開輸入列（fallback）
  | { status: 'failed' }                 → 展開輸入列（fallback）
  | { status: 'busy' }                   → 無事發生（已有 dialog 開著）
```

`startAdd()` 一律先呼叫 `pickFolder()`，依 status 分流。對本機 server 這一趟是毫秒級，不支援平台多付的成本可忽略；gateway 可在首次收到 `unsupported` 後於 session 內快取短路（可選微優化）。未來 Tauri gateway 實作同一介面，`unsupported` 永不出現。

替代方案：保留 `canPickFolder` 布林、由 health/projects payload 帶能力欄位——需要啟動探測與快取一致性，且「回報具能力但實開失敗」仍要 fallback 分支，狀態機反而更多；捨棄。

### D2: server 端一個 endpoint：`POST /api/pick-folder`

- 平台非 `darwin` → 直接回 `unsupported`，不 spawn。
- `darwin` → spawn `osascript -e 'tell me to activate' -e 'POSIX path of (choose folder with prompt "Select a project folder")'`。
  - `tell me to activate` 讓 osascript 自身（dialog 的宿主）到前景，不經 System Events，**不觸發 macOS 自動化權限（TCC）授權彈窗**。
  - exit 0 → stdout 為所選路徑（尾端換行修掉）→ `picked`。
  - 使用者取消 → osascript exit 非 0 且 stderr 含 `User canceled` → `canceled`。
  - 其餘非 0 → `failed`。
- 併發防護：模組層 in-flight 旗標，dialog 開著時再收到請求直接回 `busy`，不疊開第二個 dialog。
- 不設 timeout：使用者可以想選多久就選多久，本機請求掛著沒有資源疑慮。

路徑驗證不在此 endpoint 做——選出的路徑一律走既有 `POST /api/projects`（`addProject`）的驗證，維持單一驗證入口。

### D3: 結果映射抽成純函式，測試不碰 spawn

「exit code＋stdout＋stderr → PickFolderOutcome」抽成 `server/utils/` 的純函式並單元測試（cancel／成功／其他錯誤三型），沿用本專案 normalize 系列的測試風格；spawn 本身不測。

### D4: 移除手打路徑輸入列，dialog 是唯一入口（驗收回饋修訂）

原設計把輸入列留作 fallback，實測下來兩點都不成立：有選擇器就沒人會回頭手打；輸入列展開後沒有自動收起的時機，dialog 取消後畫面仍留著一個輸入框，看起來像是取消動作「打開了」它。

改為：輸入列整段移除，`startAdd()` 依 status 分流——

| status | 行為 |
| --- | --- |
| `picked` | 送進既有驗證加入；失敗以 toast 提示 |
| `canceled`、`busy` | 無事發生，不留任何痕跡 |
| `unsupported`、`failed` | toast 說明無法開啟選擇器 |

錯誤呈現一併改走全 App 共用的 toast（`changes.notify`）：輸入列消失後沒有可貼訊息的位置，而加入失敗本來就是一次性的通知，不需要常駐欄位。

### D5: 加入動作上移到 projects store

側欄與 `ChangeList`／`SpecsView`／`ArchivedView` 三處空狀態原本共用的是「把 `addFormOpen` 設為 true」這個狀態旗標；輸入列移除後沒有旗標可設，四個入口若各自呼叫 `pickFolder()` 就會有四份分流邏輯。改為 store 上開一個 `startAdd()` 動作收下全部分流（含 toast），元件只負責呼叫，`addFormOpen` 隨輸入列一併移除。

## Risks / Trade-offs

- [dialog 可能開在瀏覽器視窗後面] → `tell me to activate` 已涵蓋多數情況；若個案仍發生，Dock 會有跳動提示，屬可接受體驗。
- [非 macOS 沒有任何加入專案的入口] → 目標平台就是 macOS，M4 Tauri 外殼同樣具原生 dialog；真有跨平台需求再以另一個 change 補回輸入路徑的入口。
- [`busy` 對使用者是靜默的] → 那一刻已有 dialog 開在前景，再點一次沒有回饋是符合預期的；補 toast 反而是雜訊。
- [dev 模式 API 與 web 分屬兩個行程，osascript 由 API 行程 spawn] → dialog 宿主是 osascript 自身，與哪個行程 spawn 無關，行為一致。
- [使用者把 dialog 晾著不關，期間關掉瀏覽器分頁] → dialog 仍在，選了也只是 HTTP 回應無人接收，server 不會加入專案（加入是前端拿到路徑後另打 `/api/projects`），無殘留狀態；in-flight 旗標隨 osascript 結束釋放。
- [`User canceled` 字串比對依賴 osascript 的錯誤文案] → 以 exit code 非 0＋stderr 關鍵字寬鬆比對；比對不中最壞落入 `failed` → 展開輸入列，不會誤加專案。
