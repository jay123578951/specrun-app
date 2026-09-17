## MODIFIED Requirements

### Requirement: 唯讀診斷資訊

Settings SHALL 呈現一組唯讀診斷資訊，涵蓋：應用程式設定檔位置、目前專案路徑、檔案變動通知（即時刷新）是否已接上、App 版本。此區 MUST NOT 提供任何修改這些值的操作——它回答「App 連到什麼」，不是設定項。

即時刷新一項 SHALL 在任何執行形態都呈現明確的已接上或未接上，MUST NOT 呈現為未知或佔位符——每個形態都問得到自己的監看有沒有建立起來。

#### Scenario: 診斷資訊呈現

- **WHEN** 使用者開啟 Settings
- **THEN** 診斷區列出設定檔位置、目前專案路徑、即時刷新是否已接上與 App 版本

#### Scenario: 即時刷新不呈現未知

- **WHEN** 使用者以桌面形態開啟 Settings，且診斷結果已取得
- **THEN** 即時刷新一項呈現為已接上或未接上，MUST NOT 呈現為佔位符

#### Scenario: 無目前專案

- **WHEN** 目前沒有選定的專案
- **THEN** 診斷區的目前專案項明確標示為無，MUST NOT 顯示空白或誤導的路徑
