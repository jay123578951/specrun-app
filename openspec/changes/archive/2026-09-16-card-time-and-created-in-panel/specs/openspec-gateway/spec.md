## ADDED Requirements

### Requirement: 清單項目的建立時刻
清單資料的每一筆 SHALL 帶一個建立時刻欄位，其值 SHALL 為該 change 目錄於檔案系統上的建立時間。該欄位 SHALL 以檔案層直讀取得，MUST NOT 藉 `openspec status --change` 或任何逐一 change 的 CLI 呼叫取得——比照 Why 摘錄，檔案層讀取不構成額外的 CLI 呼叫。各筆的讀取 SHALL 並行發出，MUST NOT 逐一序列等待。

active 與 parked 兩側 SHALL 適用同一套取得與降級規則。park 與 unpark 為整目錄搬移，MUST NOT 改寫該 change 的建立時刻——同一個 change 在 park 前後回報的建立時刻 SHALL 相同。系統 MUST NOT 為此欄位於 park metadata 另存任何欄位。

下列情形 SHALL 一律回傳空值，且 MUST NOT 使該筆項目或整份清單回報錯誤：目錄不存在、讀取失敗、檔案系統未提供建立時間、以及該筆的 change 名稱解析出的目錄落在 changes 目錄之外。最後一項 SHALL 與其他取不到的情形同等對待，MUST NOT 另行回報為錯誤或安全事件——名稱來自 CLI 輸出，防線的目的是不讀取範圍外的路徑，而非診斷來源。

#### Scenario: 每一筆都帶建立時刻
- **WHEN** 目標專案有 N（N > 1）個進行中 change 且清單資料被請求
- **THEN** 回傳的每一筆均帶該 change 目錄的建立時刻

#### Scenario: 取得建立時刻不追加 CLI 呼叫
- **WHEN** 目標專案有 N（N > 1）個進行中 change 且清單資料（含建立時刻）被請求
- **THEN** 系統仍只執行一次 CLI 程序，建立時刻全數以檔案層讀取取得

#### Scenario: parked 一側同樣帶建立時刻
- **WHEN** parked 清單資料被請求
- **THEN** 每一筆均帶該 change 的建立時刻，取得規則與 active 一側相同

#### Scenario: park 不改寫建立時刻
- **WHEN** 某 change 於建立後被 park，其後 parked 清單資料被請求
- **THEN** 該筆回報的建立時刻與 park 之前相同，MUST NOT 變成 park 當下的時刻

#### Scenario: 名稱解析出的目錄落在範圍外
- **WHEN** 某一筆的 change 名稱解析出的目錄不落在 changes 目錄底下
- **THEN** 該筆建立時刻為空，與讀取失敗同等對待，清單其餘項目正常且不回報錯誤

#### Scenario: 單筆取不到不拖垮清單
- **WHEN** 某一個 change 的目錄建立時間因權限或檔案系統限制無法取得
- **THEN** 該筆建立時刻為空，其餘項目正常，清單整體不回報錯誤
