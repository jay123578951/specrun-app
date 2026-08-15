## Why

Change 一多就有「暫時擱置、不想每天看到」的需求：openspec 沒有 park 概念，擱置的 change 混在進行中清單裡持續產生視覺噪音。M2 引入 park 機制——把 change 暫移出 `openspec/changes/`，openspec 與 git 均無感；操作與清單一體交付，做完當天即可用真資料 dogfood。

## What Changes

- 新增 park 操作：把 change 目錄搬移至 `<repo>/.git/specrun-app/parked/<name>/`，並記錄 metadata（`parkedAt`、artifactPaths 快照）於 `.git/specrun-app/parked.json`。
- 新增 unpark 操作：把 parked change 搬回 `openspec/changes/`；目標已有同名 change 時拒絕並提示。
- Change 清單頁新增 Parked 群組（與 Active 同頁分群，依 `docs/ui-structure-decisions.md` 既定結構）；parked 卡片顯示 parked 相對時間。
- 卡片 hover 動作新增 ⏸ Park（active 卡）／▶ Restore（parked 卡）；不跳確認（操作可逆）。
- parked change 可開詳情檢視，唯讀：tabs 依 park 時的 artifactPaths 快照列出，tasks checkbox 禁用。
- 專案無正常 `.git/` 目錄（非 git repo／worktree）時 park 禁用＋提示。
- 不做 Spectra 轉接器（實測全機無既存 Spectra parked 資料，決策記於 ROADMAP M2）。

## Capabilities

### New Capabilities

- `park-mechanism`: park/unpark 操作與儲存（.git 內存放、metadata 記錄、撞名拒絕、.git 缺失降級）、parked 清單資料來源、parked 詳情唯讀變體。

### Modified Capabilities

- `change-list`: 群組與排序 requirement 擴充——清單頁自 Active 單群組變為 Active＋Parked 雙群組；卡片 hover 自「僅視覺回饋」變為帶 Park/Restore 動作按鈕；parked 卡片的時間欄位語意改為 parked 相對時間。

## Impact

- 前端：`ChangeList.vue`（雙群組）、`ChangeCard.vue`（hover 動作、parked 變體）、`ChangeRail.vue`／`ArtifactPanel.vue`（parked 詳情唯讀）、`src/stores/changes.ts`（parked 清單狀態）、`src/stores/detail.ts`（parked 詳情資料路徑）、`src/api/`（gateway 介面擴充與 normalize）。
- 後端：新增 park/unpark 與 parked 清單的 Nitro routes；`.git/specrun-app/` 的 fs 操作 utils；watcher 不擴範圍（park/unpark 為本 App 操作、操作後主動刷新）。
- 不動 openspec CLI 呼叫面；`openspec/changes/` 目錄的搬移會自然觸發既有 watcher 通知。
