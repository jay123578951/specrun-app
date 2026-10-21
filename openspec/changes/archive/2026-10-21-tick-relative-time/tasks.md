# Tasks

## 1. 共用的現在時間

- [x] 1.1 新增 `src/utils/now.ts`，匯出 `useNow()`（見 design D1／D2）：模組層級單一 ref 與單一 60 秒計時器，第一個元件登記時啟動計時器與 `visibilitychange` 監聽，最後一個卸載時停掉；視窗變成看得見時立刻更新 ref。驗證：`src/utils/now.test.ts` 以 `vi.useFakeTimers()` 涵蓋「推進 60 秒 ref 更新」「切回可見立即更新」「全部卸載後計時器與監聽移除」「兩個元件共用同一個計時器」，`pnpm vitest run src/utils/now.test.ts` 通過

## 2. 呼叫端改用共用現在時間

- [x] 2.1 `src/components/ChangeCard.vue` 的 `timeLabel` 改為 `formatRelativeTime(x, now.value)`，active 與 parked 兩條分支都要。驗證：新增元件測試，掛載一張昨日 18:38 的 active 卡與一張 11 天前的 parked 卡，假時鐘推進跨過午夜／滿 12 天後一分鐘內文字分別變為相對寫法與 `parked 12d ago`，測試通過
- [x] 2.2 `src/components/RoadmapView.vue` 的更新時間改為 `formatRelativeTime(item.mtime, now.value)`。驗證：在 `src/components/RoadmapView.test.ts` 補一個案例，假時鐘跨過午夜後一分鐘內更新時間改為相對寫法，測試通過

## 3. 整體檢查

- [x] 3.1 `pnpm vitest run` 全部通過，`pnpm lint` 無錯誤（由 gate 覆蓋：全部測試 66 檔 896 測試通過、pnpm lint exit 0）
- [x] 3.2 在 App 裡手動確認：開著 Changes 頁不動，parked 卡天數於跨過整天後一分鐘內自己更新；把視窗藏起來再叫回來，時間文字立刻是對的（人工驗收通過）

## Workflow follow-up

- 驗收通過後依序 `/opsx:sync`、`/opsx:archive`
