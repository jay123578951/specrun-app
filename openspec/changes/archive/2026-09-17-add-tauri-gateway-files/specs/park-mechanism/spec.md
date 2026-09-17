## MODIFIED Requirements

### Requirement: Parked 詳情唯讀
parked 卡片 SHALL 可點擊開啟詳情檢視；artifact tabs SHALL 依 park 時記錄的 artifact 路徑快照列出（custom schema 的 tab 集合與順序保持 park 當下樣貌）；tasks 的 checkbox SHALL 為禁用狀態（parked 為唯讀，全 App 寫入點僅限 active change 的 tasks）。

快照所列的檔案在 park 之後可能被使用者於檔案總管或編輯器中刪除。系統 SHALL 分辨「該檔案已不存在」與「該檔案存在但讀不到」兩種情形：前者 SHALL 略過該檔案、詳情照常開啟（缺件不是錯誤，該 artifact 的 tab 在無任何既存檔案時呈現為尚未建立）；後者 SHALL 回報該 change 讀不起來。兩者 MUST NOT 混為一談——把缺件當成讀取失敗會讓使用者刪過任一檔案後就再也打不開該 change 的詳情。這道分辨本身若無法完成（詢問檔案是否存在的通道自己失敗），SHALL 保守地歸入「存在但讀不到」，MUST NOT 靜默當成缺件。

快照遺失而改以現場列舉 parked 目錄取得 tabs 時，上述缺件寬容 SHALL NOT 適用：現場列舉得到的檔案讀不到即為讀取失敗。兩條路的差別在清單的來源時點——快照是過去某一刻的記錄，與磁碟現況之間隔了一段可讓使用者刪檔的時間；現場列舉的清單則是當下取得的。

快照所列路徑 SHALL 限於該 parked change 目錄之內。落在該目錄之外的路徑（含以相對路徑片段向上逸出、以及快照記錄為絕對路徑者）SHALL 被略過且不讀取，詳情仍照常開啟；該路徑所屬 artifact 若因此無任何既存檔案，其 tab 呈現為尚未建立。此限制 MUST NOT 導致整份詳情失敗——逸出是防線，不是錯誤狀態。

#### Scenario: 開啟 parked 詳情
- **WHEN** 使用者點擊 parked 卡片
- **THEN** 詳情檢視開啟並渲染該 change 的 artifacts

#### Scenario: parked tasks 不可勾
- **WHEN** 使用者在 parked change 的 tasks 檢視點擊 checkbox
- **THEN** 勾選狀態不改變且無寫入發生

#### Scenario: custom schema 的快照 tabs
- **WHEN** 檢視以 custom schema 建立、park 前有非預設 artifact 集合的 parked change
- **THEN** tabs 依 park 當下快照列出該集合

#### Scenario: 快照檔案已被刪除
- **WHEN** 使用者於 park 之後手動刪除該 parked change 目錄內某一份快照所列的檔案，隨後開啟它的詳情
- **THEN** 詳情照常開啟，其餘 artifact 內容正常渲染，被刪除者所屬的 tab 在無其他既存檔案時呈現為尚未建立

#### Scenario: 現場列舉的檔案讀不到即為失敗
- **WHEN** 某 parked change 的快照已遺失，詳情改以現場列舉該目錄取得 tabs，而列舉得到的某個檔案讀取失敗
- **THEN** 回報該 change 讀不起來，MUST NOT 比照快照缺件略過

#### Scenario: 快照路徑逸出 change 目錄
- **WHEN** 快照中某筆路徑指向該 parked change 目錄之外（向上逸出或記錄為絕對路徑）
- **THEN** 該路徑不被讀取，詳情照常開啟，其所屬 artifact 的 tab 在無其他既存檔案時呈現為尚未建立

### Requirement: 無正常 git 目錄時 park 降級
目標專案無正常 `.git/` 目錄時（非 git repo，或 `.git` 為檔案的 git worktree），park 動作 SHALL 為禁用狀態並附說明提示；MUST NOT 靜默失敗或改存他處。此禁用 SHALL 涵蓋所有觸發 park 的途徑，包含動作按鈕與卡片拖曳（拖曳的關閉行為見 `change-list`「拖曳取消與禁用」）；不同途徑的說明提示 SHALL 陳述同一個原因。

兩種降級原因 SHALL 在所有執行形態下都分辨得出來，且該判定 MUST NOT 依賴對 `.git` 本身的存取授權——在以白名單管理檔案存取的執行形態中，`.git` 是檔案時不會落在放行範圍內，直接查詢它會把 git worktree 誤報為非 git repository，提示因而陳述錯誤的原因。

判定所需的專案資料夾內容本身取得不到時（存取被拒、資料夾已被搬走），SHALL 歸入「非 git repo」這一種降級，MUST NOT 另立第三種提示——使用者在這個情境能做的事與真的沒有 `.git` 時相同。`.git` 存在但既非一般資料夾也非檔案時（例如指向他處的連結），SHALL 視為可 park；park 若因此在後續步驟失敗，失敗訊息照「操作失敗呈現」呈現，MUST NOT 靜默改存他處。

#### Scenario: 非 git repo
- **WHEN** 目標專案沒有 `.git`
- **THEN** active 卡片的 park 動作呈禁用狀態，附「非 git repository 不可 park」語意的英文提示

#### Scenario: git worktree
- **WHEN** 目標專案的 `.git` 是檔案（worktree）
- **THEN** park 動作同樣禁用並提示不支援

#### Scenario: 降級時拖曳一併禁用
- **WHEN** 目標專案無正常 `.git/` 目錄，使用者嘗試以拖曳搬移卡片
- **THEN** 拖曳不啟動，且畫面陳述的不可用原因與動作按鈕的提示一致

#### Scenario: worktree 在桌面形態不被誤報
- **WHEN** 以打包後的桌面 App 開啟一個 `.git` 為檔案的 git worktree 專案
- **THEN** park 呈禁用狀態且提示陳述的是 worktree 不支援，MUST NOT 陳述為「這個專案沒有 .git」

#### Scenario: 專案資料夾內容取得不到
- **WHEN** 判定 park 可用性時連專案資料夾的內容都列不出來（存取被拒或資料夾已被搬走）
- **THEN** park 呈禁用狀態，提示陳述為非 git repository，MUST NOT 出現第三種說法

### Requirement: Parked 清單資料以目錄列舉為準
Parked 清單 SHALL 以 `.git/specrun-app/parked/` 的目錄列舉為唯一真實來源；卡片顯示資訊（任務進度、摘要）SHALL 現場解析 parked 目錄內的檔案。metadata 與目錄不一致時 SHALL 以目錄為準：有目錄無 metadata 的項目照常列出，park 時間以 fallback 呈現。

清單為取得卡片顯示資訊而依 metadata 快照讀取檔案時，快照路徑 SHALL 同樣限於該 parked change 目錄之內；落在目錄之外者 SHALL 視同該檔案不存在，該卡片以缺少該項資訊的樣貌呈現，MUST NOT 使整份清單失敗。

#### Scenario: metadata 缺項 fallback
- **WHEN** 某 parked 目錄存在但 metadata 中無對應紀錄
- **THEN** 該 change 仍出現在 Parked 群組，park 時間顯示為未知（不顯示錯誤）

#### Scenario: metadata 孤兒不列出
- **WHEN** metadata 中存在紀錄但對應目錄已不存在
- **THEN** Parked 群組不列出該項

#### Scenario: 清單的快照路徑逸出
- **WHEN** 某筆 metadata 快照所記路徑指向該 parked change 目錄之外
- **THEN** 該路徑不被讀取，該卡片照常列出（缺少該項資訊），清單其餘項目不受影響

### Requirement: 操作失敗呈現
park／unpark 因檔案系統錯誤失敗時 SHALL 顯示自動消失的 toast。

清單 SHALL 不留下任何無標示的半完成狀態。操作進行中允許呈現樂觀狀態——卡片先行呈現於目的地群組——但該狀態 SHALL 帶可辨識的進行中標示，且其存續 SHALL 限於操作進行期間。操作失敗時 SHALL 撤回樂觀狀態，卡片回到操作前的群組與位置；操作成功後 SHALL 以重新列舉的實際目錄狀態取代樂觀狀態。無論成功或失敗，操作結束後清單 MUST NOT 保留任何樂觀或進行中狀態。

park／unpark 動手前為取得專案檔案存取授權而發出的請求若自己失敗，SHALL 比照「連目標專案都取不到」呈現同一則訊息，MUST NOT 另立一種使用者無從分辨的說法。park／unpark 的檔案通道若拋出未預期的失敗，SHALL 一律收斂為該操作的一般化失敗訊息並附原始錯誤細節，MUST NOT 讓失敗以未處理的形式逸出而使畫面停在進行中狀態。

#### Scenario: 搬移失敗
- **WHEN** park 或 unpark 的目錄搬移因權限或 IO 錯誤失敗
- **THEN** 顯示 toast 說明失敗，兩群組內容與操作前一致

#### Scenario: 進行中的樂觀狀態帶標示
- **WHEN** 使用者觸發搬移，操作尚在進行
- **THEN** 卡片可呈現於目的地群組，但帶進行中標示，MUST NOT 與已完成的卡片無從區分

#### Scenario: 失敗撤回樂觀狀態
- **WHEN** 樂觀呈現於目的地群組後操作失敗
- **THEN** 卡片回到操作前的群組與位置，樂觀狀態不殘留，並顯示失敗 toast

#### Scenario: 成功後樂觀狀態不殘留
- **WHEN** 搬移操作成功並完成清單重新載入
- **THEN** 清單內容全數來自重新列舉的實際目錄狀態，無進行中標示殘留

#### Scenario: 取得存取授權的那一步失敗
- **WHEN** park 或 unpark 在動手前重新取得專案檔案存取授權，而該請求失敗
- **THEN** 顯示與「連目標專案都取不到」相同的失敗訊息，清單回到操作前的狀態

#### Scenario: 檔案通道拋出未預期失敗
- **WHEN** park 或 unpark 過程中檔案通道拋出未預期的失敗
- **THEN** 顯示該操作的一般化失敗訊息（附原始錯誤細節），清單回到操作前的狀態，MUST NOT 停在進行中狀態
