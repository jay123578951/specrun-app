## Context

現行 App.vue 以 grid 欄寬換檔實作「清單⇄窄軌＋面板」的容器變形（`detail.isOpen` 切 `grid-cols`）；ChangeRail 承載詳情模式下的切換、↑↓／Esc 鍵盤監聽與 Refresh 按鈕。動機見 proposal.md - Why。全域規範：層次靠 surface 色階＋1px 邊框，禁用 box-shadow（tokens.css）。

## Goals / Non-Goals

**Goals:**
- 清單成為常駐層，面板成為覆蓋層——兩層各自獨立，不再互相變形
- ChangeRail 及其職責（切換、鍵盤、Refresh）完整移交，不留死碼

**Non-Goals:**
- 不動 detail／changes store 的資料流與 API（open/close/show 介面沿用）
- 不做面板寬度可拖曳調整（後續議題）
- 不改 ArtifactPanel 內部的 tabs／渲染／勾選行為

## Decisions

- **覆蓋用容器內絕對定位，不用 fixed／Teleport**：面板以 `position: absolute; inset-block: 0; right: 0; width: calc(100% - 露出寬)` 釘在主區容器內（容器 `relative`），不蓋 sidebar。替代方案是 Teleport 到 body＋fixed（Nuxt UI Slideover 的做法），但那要自己對齊 sidebar 邊界，且本案無 backdrop、無堆疊 z-index 需求，容器內定位更簡單。
- **露出區起始值 320px**：足以顯示卡片名稱左段（卡名為 mono 字體、靠左），數字與時間被蓋住是接受的取捨——露出區的角色是「接手窄軌」。值以常數集中定義，方便試感覺後調整。
- **面板底色 `bg-surface`＋`border-l border-line`**：與 sidebar 同階，落在既有 elevation 規範內；markdown code block 底色為 `bg`，在 surface 上自然內凹。無陰影、無 backdrop。
- **進出場動畫只動 transform**：`translate-x-full → 0` 滑入，收合反向滑出；曲線沿用 `--sr-ease-out`，時長依 ui-motion 表（進場 ≈ 既有 220ms 檔位，退場更短）。清單層不動畫——它從未移動。
- **鍵盤監聽搬 App 層**：↑↓／Esc 的 window keydown 監聽（含輸入元素豁免）自 ChangeRail 原樣搬到 App.vue（或抽 composable），存活範圍改為「面板開啟期間」不變。
- **清單捲動位置改由 DOM 自己保留**：清單常駐後不再卸載，`detail.listScrollTop` 的存還原成死碼，一併移除。Non-Goals 的「不動 store」指的是 open/close/show 這條資料流，這個欄位只服務窄軌時代的卸載。
- **當前卡片高亮沿用 rail 的選中語意**：`bg-accent/25`＋`aria-current`，與既有窄軌選中樣式同一套 token。
- **再點收合的分流留在 ChangeCard 內**：卡片的 click handler 自己判斷 `name === detail.changeName` → `detail.close()`，否則 `detail.show(name)`。不繞經清單層——卡片為了高亮本來就得比對 `detail.changeName`，往上 emit 只會讓同一個比較存兩份，而卡片對 detail store 的依賴是既有的（原本就直接呼叫 `detail.show()`）。Park／Restore 按鈕既有的 stopPropagation 行為不變。
- **Refresh 職責**：面板 header 右上的 Refresh 沿用 rail 版語意（清單＋當前詳情一起重取）；ChangeList 自己的 Refresh 保留原位，面板開啟時被覆蓋是接受的——功能由面板版接手。

## Risks / Trade-offs

- [卡片右半（進度數字、hover 的 Park 按鈕）被面板覆蓋] → 露出區只承擔「辨識＋切換」；Park 等操作在收合狀態下進行，與窄軌時代的能力範圍一致
- [視窗過窄時面板內容區擁擠] → 320px 為起始值；極窄視窗的 min-width 防線在實作時以 `max-width` 保底，不做響應式斷點（桌面 App 形態）
- [Esc 監聽搬家時遺漏輸入元素豁免] → 原樣搬移 ChangeRail 既有的 target 檢查邏輯，驗收含此情境

## Migration Plan

單一 change 內完成：佈局改寫 → ChangeRail 刪除＋鍵盤搬家 → 面板 header 控制 → 卡片高亮與再點收合。無資料遷移；回滾即 revert。

## Open Questions

（無——露出寬 320px 與動畫時長屬實作期微調，不影響規格與任務拆分）
