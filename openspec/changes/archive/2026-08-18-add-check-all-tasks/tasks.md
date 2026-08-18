# add-check-all-tasks Tasks

## 1. 共用翻行邏輯（先鋪路，單行行為不變）

- [x] 1.1 `src/utils/task-line.ts`：`toggleTaskLine` 改為 `toggleTaskLines(content, edits, checked)`——切一次行、逐 edit 比對 `expectedText` 與 task 行語法、全部成立才 join；任一不符回既有的 `conflict`／`not-a-task-line` 且不產出內容（design D2）
- [x] 1.2 `src/utils/task-line.test.ts` 更新為多行簽章，並補上多行案例：N 行全部翻轉後其餘 byte 不變、批次中單行不符則整批不產出內容、混合縮排與大寫標記的批次（spec 勾選寫入的併發安全）

## 2. 寫入端點與 gateway 介面

- [x] 2.1 `src/api/types.ts`：`TaskToggleInput` 改為 `{ edits: { line, expectedText }[], checked }`；`toggleTask` 的介面註解同步為「一或多行、單次寫入」語意
- [x] 2.2 `server/api/changes/[name]/tasks/toggle.post.ts`：輸入驗證改吃 `edits` 陣列（空陣列視為 malformed）、改呼叫 `toggleTaskLines`、維持讀一次寫一次與 per-change 佇列；衝突為全有全無（design D1／D6）
- [x] 2.3 `src/api/web-gateway.ts`：`toggleTask` 依新 shape 送出，三分結果轉送邏輯不變

## 3. store 的單顆與批次動作

- [x] 3.1 `src/stores/detail.ts`：既有 `toggleTask(line)` 改為組成單元素 `edits` 走新通道，樂觀更新改用 `toggleTaskLines`，行為與現況等價
- [x] 3.2 `src/stores/detail.ts` 新增 `checkAllTasks()`：自來源字串掃出所有 `isTaskLine && !isCheckedLine` 的行組 edits（design D3）、樂觀更新、整批行號進 `pendingTaskLines`、失敗整片彈回並沿用衝突／一般失敗兩種 toast（spec 批次勾選的樂觀更新與失敗彈回）
- [x] 3.3 `src/stores/detail.ts` 導出批次可用性所需狀態：當前 tasks 是否還有未勾行（無檔案或非 tasks tab 時為 false）

## 4. 入口 UI

- [x] 4.1 `src/components/ArtifactTabs.vue`：tablist 尾端新增 `trailing` slot（`ml-auto` 靠右、垂直置中），確認 indicator 量測與 ResizeObserver 行為無回歸（design D5）
- [x] 4.2 `src/components/ArtifactPanel.vue`：填入 Check all 按鈕（`btn-inline` ＋ 圖示 ＋ 文字），出現條件沿用 `interactiveTasks`，停用條件為「無未勾行 或 `pendingTaskLines` 非空」，停用時不隱藏並帶說明用 title（spec tasks 全部勾選、design D4）
- [x] 4.3 依 ui-interaction-states 檢查該按鈕的完整狀態（default／hover／focus-visible／active／disabled）與 aria-busy 表現；`ArchivedPanel` 未填 slot 確認唯讀面板無任何新增控制項

## 5. 驗收

- [x] 5.1 `pnpm test` 全過
- [x] 5.2 本專案 dogfood：對一個有數十項的 tasks 檔案按 Check all——一次寫入、清單與卡片進度由引擎重算後更新、畫面無閃爍；勾完後按鈕轉停用；切至其他 tab 按鈕消失且動作槽不位移
- [x] 5.3 邊界情形：parked change 的 tasks 無入口；單顆點擊進行中時批次入口停用；批次進行中點擊已勾項仍正常；以外部編輯器改寫某一行後按 Check all，驗證整批放棄、畫面彈回並出現衝突 toast
