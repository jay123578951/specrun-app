# Design

## Context

`formatRelativeTime(epochMs, now = Date.now())` 是純函式。呼叫端有兩處：`ChangeCard.vue` 的 `timeLabel` computed，與 `RoadmapView.vue` 模板裡的直接呼叫。兩處都沒有傳 `now`，`Date.now()` 不是響應式依賴，所以只有在卡片資料換掉、元件重新渲染時才會重算。parked 卡片的檔案在 `.git/specrun-app/` 底下，檔案監看不會碰到它，因此最常停住。

專案沒有安裝 VueUse，也沒有 `composables/` 目錄；共用的小工具放在 `src/utils/`。`BrandMark.vue` 已經有「監聽 `visibilitychange`，看得見才跑」的先例。

## Goals / Non-Goals

**Goals:**
- 全 App 只有一個計時器，不論畫面上有幾張卡片
- 沒有任何元件在用時，計時器不跑

**Non-Goals:**
- 不改 `formatRelativeTime` 的格式規則與簽名
- 不改詳情面板的建立時刻（`formatCreatedAt`），那是絕對時刻，不會過期
- 不改 `title` 上的完整時刻（同樣是絕對時刻）

## Decisions

### D1：共用的「現在時間」放在 `src/utils/now.ts`，以模組層級的 ref 提供

匯出一個 `useNow()`，回傳唯讀的 `Ref<number>`。模組內部只有一個 ref 與一個計時器；元件掛載時登記使用，卸載時取消登記。第一個使用者登記時才啟動計時器與 `visibilitychange` 監聽，最後一個取消登記時一併停掉。

- 呼叫端改成 `formatRelativeTime(x, now.value)`，Vue 會把 `now` 記成依賴，ref 一變就重算
- 為什麼不在每個元件各開一個 `setInterval`：卡片數十張就是數十個計時器，而且各自的跳動時刻不同步，畫面上同一分鐘內會看到有的已經變了、有的還沒變
- 為什麼不放進 Pinia store：這不是 App 狀態，只是時鐘。放 store 會讓測試多一層 Pinia 設定，沒有好處

### D2：每 60 秒更新一次，另外在視窗變成看得見時立刻更新

- 規格要求延遲不超過一分鐘，60 秒間隔剛好滿足
- 不對齊整分鐘：對齊需要先算一次 `setTimeout` 再接 `setInterval`，多出的程式碼只換來「延遲從最多 60 秒變成最多 0 秒」，規格不要求
- 視窗看不見時不停掉計時器：系統本來就會延後背景計時器，停不停差別不大；可見時補一次更新才是確保正確的關鍵。這樣狀態只有「有人用／沒人用」兩種，比較單純

### D3：不做「算出下一次文字會變的時間點」的排程

討論時已排除：要為分、時、天、月每一階算到點時刻，為了省一個每分鐘的計時器不值得。

## Risks / Trade-offs

- [測試裡計時器殘留] → `useNow` 的登記與取消綁在元件生命週期，元件卸載即取消；單元測試用 `vi.useFakeTimers()` 驗證計時器啟停
- [每分鐘全部卡片重算一次] → 重算只是字串格式化，卡片數十張，成本可忽略；且 computed 結果字串沒變時 Vue 不會更新 DOM
