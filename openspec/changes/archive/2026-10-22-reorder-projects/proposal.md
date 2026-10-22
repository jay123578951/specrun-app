# Proposal

## Why

側欄的專案清單照加入的先後排，使用者沒辦法調整。常用的專案可能卡在中間，同一個大專案底下的幾個小專案也可能被拆散在清單各處。使用者想自己決定每個專案的位置：常用的放在最上面或最下面，方便直接點；很少用的移到不顯眼的地方；相關的專案排在一起。

## What Changes

- 側欄專案清單的順序改由使用者決定，存進設定檔，重新開 App 後照樣還原。
- 用滑鼠按住專案往上或往下拖，放開後就存下新順序：
  - 按住後移動超過 5px 才算拖曳，沒移動就放開，仍是一般點擊，會切換專案。
  - 拖曳時，被拖的專案跟著滑鼠移動，其他專案讓出位置。
  - 按在移除鈕 ✕ 上不會開始拖。拖曳途中 ✕ 不出現。
- 用鍵盤也能排序：focus 在專案上時，按 Alt+↑ 往上移一格，按 Alt+↓ 往下移一格。滑鼠移到專案上時，提示文字會寫出這組按鍵。
- 以下情況不能排序，滑鼠拖曳和鍵盤都不行：
  - 切換、加入或移除專案進行中。
  - 清單收合時，要先按「Show N more」全部展開。
  - 暫時項（環境變數或工作目錄決定、沒存進清單的專案）固定在最上面，本身不能移動，其他專案也不能移到它上面。
- 新順序沒有存成功時（呼叫失敗、清單在這段時間被改過），清單彈回原本的順序，並跳出 toast 說明。
- 新加入的專案照舊接在清單最後面。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `project-management`：
  - 「專案清單持久化」：持久化的內容加上清單順序，重啟後依存下的順序還原。
  - 新增「調整專案順序」requirement：拖曳與鍵盤兩種排序方式、不能排序的情況、存檔失敗時的行為。

## Impact

- `src/api/types.ts`：gateway 介面新增 `reorderProjects`。
- `src/api/desktop/projects.ts`、`src/api/desktop-gateway.ts`：桌面版的排序實作。
- `server/utils/project-state.ts`、`server/api/project/reorder.post.ts`（新檔）、`src/api/web-gateway.ts`：開發用 API 的排序實作。
- `src/stores/projects.ts`：新增排序動作。畫面先換成新順序，存檔失敗再彈回。
- `src/components/ProjectSwitcher.vue`：拖曳與鍵盤操作。這個檔目前有另一筆還沒 commit 的側欄排版修改，開始實作前要先 commit。
- 設定檔格式不變：`projects` 本來就是有順序的陣列，這次只是改成讓使用者寫回順序。
