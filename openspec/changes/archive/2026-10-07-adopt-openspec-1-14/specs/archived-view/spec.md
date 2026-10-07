# Spec Delta

## MODIFIED Requirements

### Requirement: Archived 清單
主區切至 Archived 頁時 SHALL 列出目標專案 `openspec/changes/archive/` 下的所有 archived change；清單與進度 SHALL 來自 openspec CLI 的 archived 清單（見 openspec-gateway「archived 清單以單次 CLI 呼叫取得」），MUST NOT 自行列舉目錄或解析 `tasks.md` 取得清單與進度。每張卡片 SHALL 顯示：change 名稱（目錄名去除 `YYYY-MM-DD-` 日期前綴）、archived 日期（由該前綴解析；解析不到則不顯示日期，MUST NOT 顯示佔位文字）、tasks 進度（CLI 回報的完成數／總數；總數為 0 則不顯示進度）。日期 MUST NOT 取自 CLI 回報的修改時間——那是檔案最後修改的時刻，不是歸檔日。全完成的進度 SHALL 淡化呈現，未全完成的進度 SHALL 醒目呈現（歸檔時未完成是值得一眼看到的異常訊號）。UI 文案 SHALL 一律使用英文。

#### Scenario: 列表顯示
- **WHEN** archive 目錄下有 10 個 archived change 目錄
- **THEN** Archived 頁列出 10 張卡片，各卡顯示去前綴名稱、日期與任務進度

#### Scenario: 未完成即醒目
- **WHEN** 某 archived change 的 tasks.md 為 7/9 完成
- **THEN** 該卡進度以醒目樣式呈現，與全完成卡片有可辨識的視覺差異

#### Scenario: 目錄名無日期前綴
- **WHEN** 某 archived change 目錄名不含 `YYYY-MM-DD-` 前綴
- **THEN** 卡片顯示完整目錄名為名稱、不顯示日期，清單仍正常呈現

#### Scenario: 日期不受檔案修改時間影響
- **WHEN** 目錄 `2026-08-14-add-x` 內的檔案在 2026-10-01 被修改過
- **THEN** 卡片顯示的日期為 2026-08-14，排序位置也依 2026-08-14 決定

#### Scenario: 進度與 Changes 頁同一套算法
- **WHEN** 同一份 tasks.md 內容分別出現在一個進行中 change 與一個 archived change
- **THEN** 兩頁顯示的完成數與總數相同

#### Scenario: 載入中
- **WHEN** Archived 頁首次載入尚未取得資料
- **THEN** 顯示載入佔位（skeleton），不顯示空狀態文案

### Requirement: 空與錯誤狀態
目標專案無 archive 目錄或其下無任何 archived change 時 SHALL 顯示空狀態文案；無目標專案、非 openspec 專案、讀取失敗各情境 SHALL 分層呈現，語意與 Specs 頁的分層一致，MUST NOT 靜默留白。讀取失敗 SHALL 可手動重試。

CLI 不可用與 CLI 版本低於 1.14 SHALL 各自呈現，兩者都 SHALL 附開啟 Settings 的入口，MUST NOT 提供重試——兩者都要使用者換或升級 CLI 才解得開。版本過舊的說明 SHALL 指出 Archived 頁需要 openspec 1.14 以上。系統 MUST NOT 在 CLI 版本過舊時改以直接讀取目錄呈現清單。

#### Scenario: 空狀態
- **WHEN** 目標專案的 `openspec/changes/archive/` 不存在或為空
- **THEN** Archived 頁顯示空狀態文案，不顯示錯誤

#### Scenario: 讀取失敗
- **WHEN** 清單讀取因 CLI 呼叫或解析失敗未完成
- **THEN** Archived 頁顯示錯誤狀態與訊息，可手動重試

#### Scenario: 單一 change 讀取失敗不拖垮清單
- **WHEN** 清單中某個 archived change 的 tasks.md 讀取失敗
- **THEN** 該卡仍顯示名稱與日期（不顯示進度），其他卡片正常

#### Scenario: CLI 不可用
- **WHEN** 找不到 openspec 執行檔時進入 Archived 頁
- **THEN** Archived 頁顯示 CLI 不可用的說明與 Open settings 入口，不顯示重試

#### Scenario: CLI 版本過舊
- **WHEN** 目前生效的 openspec 為 1.13.2 時進入 Archived 頁
- **THEN** Archived 頁說明需要 openspec 1.14 以上並附 Open settings 入口，不顯示重試，也不顯示任何 archived 卡片

#### Scenario: 升級後回到 Archived 頁
- **WHEN** 使用者在終端機把 openspec 升到 1.14 以上，再從其他頁切回 Archived 頁
- **THEN** 清單重新載入並正常呈現，不再顯示版本過舊
