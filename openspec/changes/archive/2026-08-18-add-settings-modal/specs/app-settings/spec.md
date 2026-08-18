## Purpose

App 與外部環境接線的唯一調整處：指定並驗證 openspec CLI 執行檔，並集中呈現「App 目前連到什麼」的唯讀診斷。這裡只放環境接點，使用者偏好不屬於此 capability。

## ADDED Requirements

### Requirement: Settings 為覆蓋層而非頁

Settings SHALL 以覆蓋層（modal）呈現，MUST NOT 成為主區的一個頁：開啟時主區當前頁與其詳情面板 SHALL 維持原狀不被卸載或關閉，關閉 Settings 後 SHALL 回到開啟前完全相同的畫面狀態（含當前頁、已開啟的詳情、清單捲動位置）。Settings 的開啟狀態 MUST NOT 影響專案切換以外的任何既有導覽狀態。

#### Scenario: 詳情開啟時開 Settings

- **WHEN** 使用者開著某個 change 的詳情面板，接著開啟 Settings
- **THEN** 詳情面板不被關閉或擠掉，Settings 疊在其上；關閉 Settings 後詳情仍開在同一個 change

#### Scenario: 非 Changes 頁開 Settings

- **WHEN** 使用者停在 Specs 頁並開啟 Settings，隨後關閉
- **THEN** 主區仍為 Specs 頁，未被切回 Changes

### Requirement: Settings 的開啟入口

側欄的 Settings 項 SHALL 為 Settings 的主要開啟入口。此外，任何頁面因 CLI 不可用而顯示的常駐提示 SHALL 提供前往 Settings 的入口，且該提示的文案 MUST NOT 指示使用者只能透過 PATH 安裝來解決——可設定路徑後該指引即為錯誤。

#### Scenario: 側欄開啟

- **WHEN** 使用者點擊側欄 Settings 項
- **THEN** Settings 開啟

#### Scenario: 自 CLI 不可用提示進入

- **WHEN** Changes 或 Specs 頁顯示 CLI 不可用的常駐提示，使用者點擊其中的前往設定入口
- **THEN** Settings 開啟且停在 CLI 路徑設定處

### Requirement: Settings 的關閉與焦點行為

Settings 開啟期間 SHALL 攔截 Esc：Esc 關閉 Settings 本身，MUST NOT 穿透關閉其背後已開啟的詳情面板。點擊 Settings 以外的遮罩區域 SHALL 關閉 Settings。焦點 SHALL 於開啟期間限制在 Settings 之內，關閉後 SHALL 歸還至開啟它的觸發元素。

#### Scenario: Esc 不穿透

- **WHEN** 使用者開著詳情面板並開啟 Settings，然後按 Esc
- **THEN** Settings 關閉，詳情面板仍為開啟狀態

#### Scenario: 點遮罩關閉

- **WHEN** 使用者點擊 Settings 之外的遮罩區域
- **THEN** Settings 關閉

#### Scenario: 焦點歸還

- **WHEN** 使用者以側欄 Settings 項開啟後關閉 Settings
- **THEN** 焦點回到側欄 Settings 項

### Requirement: CLI 路徑的兩種模式

Settings SHALL 提供「自動偵測」與「手動指定」兩種互斥模式，並 SHALL 標示目前生效的模式。自動偵測模式下 SHALL 顯示實際解析到的執行檔絕對路徑（解析成功時），並提供重新偵測的動作。手動指定模式 SHALL 提供可編輯的路徑輸入欄，並 SHALL 提示使用者取得路徑的方法。系統 MUST NOT 要求使用者透過檔案選擇對話框指定路徑——openspec 常見安裝位置為隱藏目錄，對話框預設不可見。

#### Scenario: 自動偵測成功

- **WHEN** 使用者開啟 Settings 且系統已自動解析到 openspec 執行檔
- **THEN** 模式顯示為自動偵測，並顯示解析到的絕對路徑與其版本

#### Scenario: 重新偵測

- **WHEN** 使用者在自動偵測模式下觸發重新偵測
- **THEN** 系統重跑解析並更新顯示的路徑與狀態

#### Scenario: 切換至手動

- **WHEN** 使用者切換為手動指定
- **THEN** 出現可編輯的路徑輸入欄與取得路徑方式的提示

### Requirement: 驗證與套用為單一動作

手動指定的路徑 SHALL 以單一「驗證並套用」動作生效，MUST NOT 存在「已驗證但尚未儲存」的中間狀態。該動作 SHALL 以執行 `openspec --version` 判定成功：成功時 SHALL 持久化該路徑並使其立即生效；失敗時 MUST NOT 寫入持久化設定，先前生效的解析結果 SHALL 維持不變。

#### Scenario: 驗證成功即套用

- **WHEN** 使用者輸入有效的 openspec 執行檔路徑並觸發驗證並套用
- **THEN** 系統顯示該執行檔版本，路徑被持久化，後續資料請求使用該執行檔

#### Scenario: 驗證失敗不寫入

- **WHEN** 使用者輸入無法執行的路徑並觸發驗證並套用
- **THEN** 系統顯示失敗原因，設定未被寫入，原先生效的執行檔不受影響

### Requirement: 驗證結果就地呈現

驗證與偵測的結果 SHALL 呈現於 Settings 內的狀態位置，MUST NOT 以自動消失的 toast 呈現。狀態 SHALL 可區分為三種：尚未驗證、成功（含版本字串）、失敗（含可據以排除問題的訊息）。

#### Scenario: 成功顯示版本

- **WHEN** 驗證成功
- **THEN** 狀態位置顯示成功態與該執行檔的版本字串

#### Scenario: 失敗就地顯示

- **WHEN** 驗證失敗
- **THEN** 狀態位置顯示失敗態與訊息，且畫面上不出現承載同一訊息的 toast

### Requirement: 套用後的資料重載範圍

CLI 執行檔變更並套用成功後，系統 SHALL 重載受該執行檔影響的資料：change 清單、目前所在頁的引擎資料，以及各專案徽章。archived 資料與檔案變動通知 MUST NOT 因此重載或重掛——前者以檔案層直讀取得、CLI 零參與，後者監看檔案系統、與 CLI 無關。重載期間 Settings SHALL 維持開啟，MUST NOT 因套用成功而自動關閉。

#### Scenario: 套用後清單更新

- **WHEN** 先前 CLI 不可用導致清單為空，使用者於 Settings 指定有效路徑並套用成功
- **THEN** change 清單重新載入並呈現資料，Settings 仍為開啟狀態且顯示成功態

#### Scenario: archived 不受影響

- **WHEN** 使用者套用新的 CLI 路徑
- **THEN** archived 資料不因此重新載入

### Requirement: CLI 路徑覆寫的持久化

使用者明示指定的 CLI 路徑 SHALL 持久化於既有的應用程式設定檔，App 重啟後 SHALL 續用該路徑。自動偵測的解析結果 MUST NOT 被寫入持久化設定——偵測結果是機器環境的衍生物，持久化後將成為會過期的資料。設定中無明示覆寫時 SHALL 視為自動偵測模式。設定資料損毀或該欄位形狀不符時 SHALL 降級為自動偵測，MUST NOT 因此無法啟動。

#### Scenario: 重啟續用

- **WHEN** 使用者手動指定路徑並套用成功後重啟 App
- **THEN** 系統仍使用該路徑，Settings 顯示為手動指定模式

#### Scenario: 偵測結果不落地

- **WHEN** 使用者從未手動指定，系統以自動偵測解析到執行檔
- **THEN** 設定檔中不存在 CLI 路徑覆寫，重啟後仍重新偵測

#### Scenario: 覆寫路徑已失效

- **WHEN** 持久化的覆寫路徑在此機器上不存在或無法執行（如設定隨機器更換而失效）
- **THEN** App 正常啟動，狀態呈現為失敗並引導重新指定，MUST NOT 崩潰或空白無提示

### Requirement: 唯讀診斷資訊

Settings SHALL 呈現一組唯讀診斷資訊，涵蓋：應用程式設定檔位置、目前專案路徑、檔案變動通知（即時刷新）目前是否運作、App 版本。此區 MUST NOT 提供任何修改這些值的操作——它回答「App 連到什麼」，不是設定項。

#### Scenario: 診斷資訊呈現

- **WHEN** 使用者開啟 Settings
- **THEN** 診斷區列出設定檔位置、目前專案路徑、即時刷新狀態與 App 版本

#### Scenario: 無目前專案

- **WHEN** 目前沒有選定的專案
- **THEN** 診斷區的目前專案項明確標示為無，MUST NOT 顯示空白或誤導的路徑

### Requirement: 開啟所在位置的平台降級

診斷區的設定檔位置與目前專案路徑 SHALL 提供開啟其所在位置的動作。執行環境不支援該動作時，該動作 SHALL 呈現為禁用並說明原因，MUST NOT 直接隱藏——隱藏會使使用者無從得知該能力存在及其不可用的原因。能力判定 SHALL 由伺服端進行，MUST NOT 於前端寫死平台分支。

#### Scenario: 不支援平台

- **WHEN** 執行環境不支援開啟檔案所在位置
- **THEN** 該動作呈現為禁用，並可得知不支援的原因
