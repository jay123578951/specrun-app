## ADDED Requirements

### Requirement: CLI 執行檔解析

系統 SHALL 依下列優先序決定 spawn 的 openspec 執行檔：使用者持久化的明示覆寫 ＞ 自動偵測結果。自動偵測 SHALL 依序嘗試：(1) 直接以命令名執行，藉此吃到行程本身的 PATH；(2) 借使用者 login shell 的環境解析命令位置，並取得絕對路徑。第二階段 SHALL 設有逾時上限，逾時視同該階段未命中；執行環境不具備 login shell 能力時 SHALL 跳過該階段。兩階段皆未命中且無明示覆寫時，系統 SHALL 回報 CLI 不可用（沿用既有錯誤分類），MUST NOT 靜默失敗。

解析結果 SHALL 為伺服端持有、可於執行期更換的狀態；更換後所有資料請求 SHALL 使用新的執行檔，MUST NOT 要求個別請求自行指定執行檔。系統 MUST NOT 維護一份寫死的常見安裝位置清單作為偵測手段。

#### Scenario: 行程 PATH 即可命中

- **WHEN** openspec 位於行程本身的 PATH 上
- **THEN** 系統以該執行檔運作，不進入 login shell 階段

#### Scenario: 行程 PATH 未命中而 login shell 命中

- **WHEN** 行程 PATH 上沒有 openspec，但使用者 login shell 的環境找得到（如 GUI 啟動不繼承 shell PATH 的情形）
- **THEN** 系統取得其絕對路徑並以該執行檔運作

#### Scenario: 明示覆寫優先於偵測

- **WHEN** 使用者已持久化一個明示覆寫路徑，且行程 PATH 上另有一個 openspec
- **THEN** 系統使用明示覆寫的執行檔

#### Scenario: 全數未命中

- **WHEN** 無明示覆寫，且兩個偵測階段皆未命中
- **THEN** 系統回報「CLI 不可用」類錯誤

#### Scenario: login shell 逾時

- **WHEN** login shell 解析未於逾時上限內完成
- **THEN** 該階段視同未命中，系統不因此無限期等待

#### Scenario: 執行期更換

- **WHEN** 使用者於執行期套用新的執行檔路徑後重新取得清單
- **THEN** 資料來自以新執行檔進行的呼叫，請求本身未附帶執行檔路徑

### Requirement: CLI 執行檔的驗證通道

系統 SHALL 提供驗證指定執行檔的通道：以 `--version` 執行該路徑，成功時回傳其版本字串，失敗時回傳可據以排除問題的診斷訊息。驗證 MUST NOT 因驗證失敗而改變目前生效的解析結果。

#### Scenario: 驗證成功回版本

- **WHEN** 以有效的 openspec 執行檔路徑請求驗證
- **THEN** 系統回傳成功與該執行檔的版本字串

#### Scenario: 驗證失敗附訊息

- **WHEN** 以不存在或不可執行的路徑請求驗證
- **THEN** 系統回傳失敗與診斷訊息，且目前生效的執行檔不變

### Requirement: 環境診斷通道

系統 SHALL 提供取得環境診斷的通道，涵蓋：應用程式設定檔的絕對路徑、目前目標專案路徑（無目標時明確表達為無）、檔案變動通知目前是否運作、App 版本，以及「開啟檔案所在位置」在此執行環境是否可用。系統 SHALL 提供開啟指定檔案所在位置的通道，其可用性判定 SHALL 在伺服端。

#### Scenario: 取得診斷

- **WHEN** 請求環境診斷
- **THEN** 回傳設定檔路徑、目前專案路徑、通知運作狀態、App 版本與開啟位置能力

#### Scenario: 通知未運作

- **WHEN** 檔案變動 watcher 掛載失敗
- **THEN** 診斷回報通知未運作，其餘欄位照常回傳

#### Scenario: 能力判定在伺服端

- **WHEN** 執行環境不支援開啟檔案所在位置
- **THEN** 診斷回傳該能力為不可用，前端據此呈現而不自行判斷平台
