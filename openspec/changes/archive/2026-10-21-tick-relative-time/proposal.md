# Proposal

## Why

卡片與 Roadmap 清單上的時間文字只在資料變動時重算，App 開著不動時數字停住：parked 卡的檔案沒人會動，最容易停在舊的天數。更嚴重的是跨過午夜後，前一天的時刻（如 `18:38`）會繼續以裸時刻顯示，讀起來像今天，違反 `change-list` 已有的「跨過午夜後改回相對寫法」。

## What Changes

- 新增一個全 App 共用的「現在時間」，每分鐘更新一次；視窗從看不見變回看得見時立刻補更新一次
- Changes 頁的 active 卡、parked 卡時間欄位改用這個現在時間計算，開著不動也會隨時間更新
- Roadmap 頁檔案的更新時間同樣改用這個現在時間
- 不引入 VueUse；不做「算出下一次文字會變的時間點再更新」的排程
- 時間文字的格式規則（同日顯示時刻、跨日相對寫法、單一單位）不變

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `change-list`：新增「時間欄位隨時間更新」需求，App 開著不動時卡片時間欄位也要隨時間更新
- `roadmap-view`：新增「更新時間隨時間更新」需求，清單卡片的更新時間比照 change 卡片

## Impact

- `src/utils/time.ts` 旁新增共用現在時間（含每分鐘計時器與 visibilitychange 監聽）
- `src/components/ChangeCard.vue`：`timeLabel` 改讀共用現在時間
- `src/components/RoadmapView.vue`：更新時間改讀共用現在時間
- 無新相依套件、無 API 變動
