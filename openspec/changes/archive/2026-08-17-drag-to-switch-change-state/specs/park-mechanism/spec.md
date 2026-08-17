## MODIFIED Requirements

### Requirement: 無正常 git 目錄時 park 降級
目標專案無正常 `.git/` 目錄時（非 git repo，或 `.git` 為檔案的 git worktree），park 動作 SHALL 為禁用狀態並附說明提示；MUST NOT 靜默失敗或改存他處。此禁用 SHALL 涵蓋所有觸發 park 的途徑，包含動作按鈕與卡片拖曳（拖曳的關閉行為見 `change-list`「拖曳取消與禁用」）；不同途徑的說明提示 SHALL 陳述同一個原因。

#### Scenario: 非 git repo
- **WHEN** 目標專案沒有 `.git`
- **THEN** active 卡片的 park 動作呈禁用狀態，附「非 git repository 不可 park」語意的英文提示

#### Scenario: git worktree
- **WHEN** 目標專案的 `.git` 是檔案（worktree）
- **THEN** park 動作同樣禁用並提示不支援

#### Scenario: 降級時拖曳一併禁用
- **WHEN** 目標專案無正常 `.git/` 目錄，使用者嘗試以拖曳搬移卡片
- **THEN** 拖曳不啟動，且畫面陳述的不可用原因與動作按鈕的提示一致

### Requirement: 操作失敗呈現
park／unpark 因檔案系統錯誤失敗時 SHALL 顯示自動消失的 toast。

清單 SHALL 不留下任何無標示的半完成狀態。操作進行中允許呈現樂觀狀態——卡片先行呈現於目的地群組——但該狀態 SHALL 帶可辨識的進行中標示，且其存續 SHALL 限於操作進行期間。操作失敗時 SHALL 撤回樂觀狀態，卡片回到操作前的群組與位置；操作成功後 SHALL 以重新列舉的實際目錄狀態取代樂觀狀態。無論成功或失敗，操作結束後清單 MUST NOT 保留任何樂觀或進行中狀態。

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
