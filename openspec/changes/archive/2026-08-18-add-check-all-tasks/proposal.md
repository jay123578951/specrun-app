## Why

驗收完一份 tasks 之後，把整份標記為完成目前只能一顆一顆點——檢查是一次做完的，登記卻要重複二十次。這段勞動沒有任何判斷成分，純粹是介面沒提供批次入口。

## What Changes

- tasks artifact tab 的 tab 列右端新增一顆 **Check all** 按鈕：一次把當前 tasks 檔案中所有未勾選的 task 行標記為完成。
- 寫入端點自「單行翻轉」擴充為「一次翻轉一或多行」：一次讀檔、翻完全部目標行、寫一次檔，批次因此為原子操作。單顆 checkbox 的點擊成為只帶一行的特例，走同一條通道。
- 批次衝突採全有全無：任一目標行的當前內容與呼叫端所見不符（外部工具已改寫），整批放棄寫入並回報衝突，不留半勾殘局。
- 按鈕只做單向勾選，不提供「全部取消」，也不提供 undo——誤勾單項仍可單點改回。
- 全部項目皆已勾選時按鈕灰化（disabled）而非隱藏，避免勾完最後一項時該列突然少一塊。
- 按鈕的出現條件與既有 checkbox 可互動條件同源（非 parked、tasks tab、單檔 tasks），不另立一套判定。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `openspec-gateway`: 「task 勾選寫入通道」自單行擴為一次一或多行；「勾選寫入的併發安全」增訂批次的全有全無語意。
- `artifact-view`: 新增 tasks 全部勾選的批次操作要求（入口位置、可用條件、樂觀更新與失敗彈回）。

## Impact

- `server/api/changes/[name]/tasks/toggle.post.ts`：request 型別改吃多行、逐行比對後一次寫回；per-change 序列化不變。
- `src/api/types.ts`／`src/api/web-gateway.ts`：`TaskToggleInput` 與 `toggleTask` 簽章調整。
- `src/utils/task-line.ts`：`toggleTaskLine` 擴充為可翻多行（伺服端與前端樂觀更新仍共用同一份，逐 byte 相同的保證不變）。
- `src/stores/detail.ts`：新增批次動作、`pendingTaskLines` 涵蓋批次中的所有行。
- `src/components/ArtifactTabs.vue`：新增 trailing slot（`ArchivedPanel` 不填，唯讀不受影響）。
- `src/components/ArtifactPanel.vue`：填入按鈕與可用條件。
