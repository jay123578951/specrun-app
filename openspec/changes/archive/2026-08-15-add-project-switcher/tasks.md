## 1. 伺服端基礎：設定檔與目前專案狀態

- [x] 1.1 新增設定檔讀寫模組（平台慣例位置、`{ projects, lastActivePath }`、損毀視為空清單、temp + rename 原子寫入）＋單元測試
- [x] 1.2 `openspec-cli.ts`：目標路徑改為伺服端執行期狀態，啟動初始化依優先序 env > lastActivePath > cwd（僅當 cwd 含 `openspec/`）> 無目標專案
- [x] 1.3 `change-watcher.ts` 支援 teardown / re-mount（換路徑重掛；掛載失敗沿既有語意不影響其他功能）

## 2. 伺服端 API：專案清單與切換

- [x] 2.1 `GET /api/projects`：回傳清單（含 current 標示、暫時項標示）與各專案徽章數（並行取數，失敗項回 null）
- [x] 2.2 `POST /api/projects`（加入）：驗證既存資料夾且含 `openspec/`、realpath 去重、成功即設為 current 並持久化
- [x] 2.3 `DELETE /api/projects`（移除）：只動清單；移除 current 時切清單第一個、清空時進無目標專案狀態
- [x] 2.4 `POST /api/project/switch`：更新 current 與 `lastActivePath`、watcher re-mount、回傳新專案基本資訊

## 3. 前端：gateway 與 stores

- [x] 3.1 `gateway.ts` 介面擴充（projects 清單／加入／移除／切換、`pickFolder()` 縫）＋ web-gateway 實作
- [x] 3.2 新增 projects store（清單、current、徽章、切換動作）；切換時 detail 清空、changes store 全量重載、世代標記丟棄晚到回應

## 4. 前端：側欄 Projects 區

- [x] 4.1 `AppSidebar.vue` Projects 區重做：多專案列項（current 樣式、點擊切換、徽章、取不到數字不顯示）、超過門檻（暫定 6）折疊 Show all
- [x] 4.2 hover ✕ 移除＋確認（文案講明只移出清單不動磁碟）
- [x] 4.3 「＋ Add project」展開貼路徑輸入列（驗證失敗提示、已存在提示並切換）
- [x] 4.4 無目標專案的空清單引導狀態（主區引導加入、側欄空清單）

## 5. 驗收與收尾

- [x] 5.1 互動狀態與動效檢查（依 ui-interaction-states / ui-motion：清單項、輸入列、確認流程的完整狀態）
- [x] 5.2 端到端驗證：加入第二專案→切換→外部改檔通知跟隨→移除 current→重啟還原；env 暫時項情境
- [x] 5.3 更新 ROADMAP（C5 列補 change 名、收掉「多專案側欄進度徽章（C5 再看）」留白項）與 `docs/ui-structure-decisions.md` 若有出入
