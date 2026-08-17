# park-mechanism Specification

## Purpose

Park 機制：把暫時擱置的 change 暫移出 `openspec/changes/`（存放於 repo 的 `.git/` 內部），使其脫離進行中視野但可隨時檢視與還原；openspec 引擎與 git 狀態均無感。

## Requirements

### Requirement: Park 操作
使用者 SHALL 可對 active change 執行 park：change 目錄自 `openspec/changes/<name>/` 搬移至 `<repo>/.git/specrun-app/parked/<name>/`，並記錄 metadata（park 時間、當下的 artifact 路徑快照）。操作 MUST NOT 跳確認（操作可逆）。操作成功後清單 SHALL 即時反映群組搬移。parked 內容與 metadata MUST NOT 被 git 追蹤，工作區 MUST NOT 因此出現任何新增項目。

#### Scenario: 成功 park
- **WHEN** 使用者對 active 卡片觸發 park
- **THEN** 該 change 自 Active 群組消失、出現於 Parked 群組，且 `openspec list` 不再回報該 change

#### Scenario: parked 內容不被 git 追蹤
- **WHEN** 工作區乾淨時 park 一個未被 git 追蹤的 change
- **THEN** `git status` 仍為乾淨——parked 內容與 metadata 位於 `.git/` 內部，git 不追蹤

#### Scenario: park 已被追蹤的 change
- **WHEN** park 一個已 commit 進版控的 change
- **THEN** git 如常把原路徑顯示為刪除（把追蹤中的檔案移出工作區的必然結果），且 `.git/` 內的 parked 內容與 metadata 不產生任何新增的未追蹤項目

#### Scenario: park 目標已有殘留
- **WHEN** `.git/specrun-app/parked/<name>/` 已存在同名目錄（先前異常殘留）
- **THEN** 操作拒絕並顯示提示，active 端目錄不受影響

### Requirement: Unpark 操作
使用者 SHALL 可對 parked change 執行 unpark：目錄搬回 `openspec/changes/<name>/` 並移除對應 metadata。`openspec/changes/<name>/` 已存在同名 change 時 SHALL 拒絕並提示，MUST NOT 覆蓋或自動改名。

#### Scenario: 成功 unpark
- **WHEN** 使用者對 parked 卡片觸發 unpark
- **THEN** 該 change 回到 Active 群組並重新出現於 `openspec list`，Parked 群組中消失

#### Scenario: unpark 撞名拒絕
- **WHEN** park 期間 `openspec/changes/` 又建立了同名 change，使用者觸發 unpark
- **THEN** 操作拒絕並顯示提示，兩邊目錄均不受影響

### Requirement: Parked 清單資料以目錄列舉為準
Parked 清單 SHALL 以 `.git/specrun-app/parked/` 的目錄列舉為唯一真實來源；卡片顯示資訊（任務進度、摘要）SHALL 現場解析 parked 目錄內的檔案。metadata 與目錄不一致時 SHALL 以目錄為準：有目錄無 metadata 的項目照常列出，park 時間以 fallback 呈現。

#### Scenario: metadata 缺項 fallback
- **WHEN** 某 parked 目錄存在但 metadata 中無對應紀錄
- **THEN** 該 change 仍出現在 Parked 群組，park 時間顯示為未知（不顯示錯誤）

#### Scenario: metadata 孤兒不列出
- **WHEN** metadata 中存在紀錄但對應目錄已不存在
- **THEN** Parked 群組不列出該項

### Requirement: Parked 詳情唯讀
parked 卡片 SHALL 可點擊開啟詳情檢視；artifact tabs SHALL 依 park 時記錄的 artifact 路徑快照列出（custom schema 的 tab 集合與順序保持 park 當下樣貌）；tasks 的 checkbox SHALL 為禁用狀態（parked 為唯讀，全 App 寫入點僅限 active change 的 tasks）。

#### Scenario: 開啟 parked 詳情
- **WHEN** 使用者點擊 parked 卡片
- **THEN** 詳情檢視開啟並渲染該 change 的 artifacts

#### Scenario: parked tasks 不可勾
- **WHEN** 使用者在 parked change 的 tasks 檢視點擊 checkbox
- **THEN** 勾選狀態不改變且無寫入發生

#### Scenario: custom schema 的快照 tabs
- **WHEN** 檢視以 custom schema 建立、park 前有非預設 artifact 集合的 parked change
- **THEN** tabs 依 park 當下快照列出該集合

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
