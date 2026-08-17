## Why

Active 與 Parked 是同頁並列的兩個群組，但兩者之間的搬移只能透過卡片 hover 才浮現的單一圖示按鈕觸發。清單在視覺上已經把「狀態」表達成「卡片在哪一群」，操作卻沒有對應的直接性——使用者看得到兩個位置，卻不能把卡片放過去。

`docs/ui-structure-decisions.md` 當初否決拖曳的理由是「hover 按鈕已夠快，拖曳邊界情況不成比例」。經 dogfood 後重新評估：那個判斷成立於「拖曳意味著完整的重排系統」的假設下。實際上本 App 只有兩個群組、且群組內順序由資料層決定（不做手動排序），拖曳的目的地永遠唯一——邊界情況遠小於當初預估，直接操作的收益則完整保留。這次推翻該否決項，並一併移除同文件與 ROADMAP 中「無 parked change 時整段隱藏」的 P1 定案：拖曳需要恆常存在的落點。

## What Changes

- **卡片可拖曳**：整張卡片可拖，超過位移門檻才進入拖曳（避免與「點擊開詳情」誤判）；卡片上的 Park／Restore 按鈕區域不啟動拖曳。不新增常駐拖曳把手。
- **拖曳中的落點提示**：因群組內不重排且僅有兩個群組，拿起卡片的瞬間唯一合法目的地即確定並立即標示，不需移動指標才浮現。來源群組永不標示。
- **原位留痕**：被拖走的位置留下與該卡片同高的凹槽，位置固定不動，直到放手。
- **拖曳落地即狀態切換**：放在對面群組＝park 或 unpark，沿用既有操作與其全部前置條件（撞名拒絕、殘留拒絕等）。
- **樂觀移動**：放手後卡片立即落位、操作於背景進行；失敗時卡片返回原位並顯示 toast。**BREAKING**（規格層）：此行為與 `park-mechanism`「操作失敗呈現」現行的「MUST NOT 留下半完成狀態可見於清單」相衝突，該需求需修改為允許明確標示為進行中的樂觀狀態。
- **同群組內放手＝取消**：無合法目的地，卡片返回原位，不視為錯誤。
- **兩群組恆常顯示**：移除「無 parked 時隱藏 Parked 群組」的行為。空群組呈現可接受拖曳的落點區，並區分三態：可用、拖曳中、因無 git 目錄而不可用。
- **拖曳的禁用邊界**：park 不可用時（非 git repo 或 git worktree）整個拖曳關閉，沿用既有降級提示文案。
- **Active 空狀態文案補充**：Active 空且有 parked change 時，需說明可從 Parked 拖回，現行文案只提到用 CLI 建立。
- 一併更新 `docs/ui-structure-decisions.md` 的「拖曳 park/unpark」否決項與空群組隱藏決策，以及 `ROADMAP.md` 的 P1 定案記述。

非目標（明確不在此範圍）：群組內重新排序與其持久化（與 lastModified／parkedAt 時間序衝突，已於探索階段決定移除）、拖到清單邊緣的自動捲動（改記為 ROADMAP 觀察項）、觸控裝置優化、Why 摘錄（另一個 change）。

## Capabilities

### New Capabilities

無。

### Modified Capabilities

- `change-list`: 新增拖曳切換狀態的互動需求（拖曳啟動門檻、落點標示、原位凹槽、取消、禁用邊界、reduced motion 降級）；修改「群組與排序」移除空群組隱藏；修改「卡片點擊與 hover 動作」界定拖曳與點擊的互斥；修改「空狀態」納入兩群組的空落點呈現與 Active 文案補充。
- `park-mechanism`: 修改「操作失敗呈現」以容納樂觀移動與失敗回滾；修改「無正常 git 目錄時 park 降級」使拖曳一併納入禁用範圍。

## Impact

- `src/components/ChangeList.vue`：移除 `showParked` 條件、兩群組改為恆常渲染；新增群組落點容器與空落點區塊；`TransitionGroup` 需與拖曳中的凹槽共存。
- `src/components/ChangeCard.vue`：新增指標事件處理與拖曳狀態樣式；拖曳期間需停用 `card-lift`（其 `:active { transform: none }` 會與浮起樣式衝突）。
- `src/stores/changes.ts`：新增樂觀移動狀態（進行中的搬移對象與方向），park／unpark 失敗時回滾；既有 `parkPending` 語意需與之整合。
- `src/components/StateNotice.vue`：容器需可作為落點並接受標示樣式。
- `src/styles/interactions.css` 與 `tokens.css`：拖曳浮起使用 `--sr-shadow-overlay`（既有 box-shadow 例外的延伸適用，需在 design 中論證）；reduced motion 區塊新增拖曳相關降級。
- `docs/ui-structure-decisions.md`、`ROADMAP.md`：更新兩處既有決策記述。
- 不影響：openspec CLI 呼叫、詳情通道、watcher、專案切換、tasks 勾選寫入。
