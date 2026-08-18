## Context

見 proposal.md「Why」。以下只記與實作路徑相關的現況約束：

- 三頁的頁首目前各自是 `<header v-if="!noProject">`，左側一個 uppercase 小標、右側一顆 Refresh。但那個小標在三頁扛的語意不同：Changes 頁的 `Active (n)` 其實是群組標題（下方還有對稱的 `Parked (n)`），Specs／Archived 頁的 `Specs (n)` 才是頁標題。
- 詳情面板是清單層之上的絕對定位覆蓋（`inset-y-0 right-0`，寬度 `calc(100% - 320px)`），全幅純位移進出場，清單層不變形也不位移。
- 換頁不走 router，由 `view` store 的 `currentView` 決定；`show()` 內建「切頁即關詳情」。
- 鍵盤集中在 `App.vue` 的單一 `keydown` listener，開頭已有 `if (settings.isOpen) return` 的整段讓位先例。
- 全站 focus ring 由 `kbd-focus` shortcut 統一；overlay 進出場配方已存在於 `interactions.css`。

## Goals / Non-Goals

**Goals:**
- 麵包屑作為三頁共用的頁首元件，一處實作、三處掛載
- 併入既有 header 行，主區垂直空間零增長
- 下拉的鍵盤與 focus 行為與既有 Settings 覆蓋層同構，不引入第二套心智模型

**Non-Goals:**
- 不改 `view` store 的 API 與切頁語意（三個 view 值、`show()` 的切頁即關全部原樣沿用）
- 不改三頁各自的資料載入生命週期
- 不引入 router、不引入 URL／歷史
- 不調整側欄的垂直配重（見「Decisions - 側欄留白不處理」）

## Decisions

### 麵包屑併入既有 header 行，而非另闢一行
麵包屑佔據原本頁標的位置，Refresh 留在該行右側，總高度不變。

順帶修正一個既有含糊：Changes 頁的 `Active (n)` 原本站在「頁標題」的位置卻是群組語意，本案讓它下移回群組標題位，與 `Parked (n)` 對稱。Specs／Archived 頁的數量則改掛麵包屑——它們原本的頁標會與麵包屑的當前頁名撞名。

**Alternatives considered**：麵包屑自成一行、既有 header 原封不動——改動面最小，但 Specs／Archived 頁的頁名會講兩次，且主區頂部多一行高度。麵包屑自成一行並把 Refresh 收上去——頁首與內容分得最開，但 Refresh 離它刷新的清單更遠，且仍多一行。

### 自訂 menu button，不用原生 `<select>`
原生 `<select>` 免費拿到鍵盤、無障礙與 focus 管理，但其彈出層樣式完全不受控，在 macOS 會是系統灰底選單，與暗色板脫節。

專案在 Settings 用了原生 radio（「原生 radio 才拿得到方向鍵與群組語意」），此處不沿用同一判斷的原因是關鍵差異：原生 radio 的視覺可用 `accent-accent-bright` 上色，原生 `<select>` 的 popup 不行。

代價是鍵盤與 focus 要自己寫，但 `SettingsModal.vue` 已有可照抄的成例（Esc 關閉、關閉後 focus 回觸發項）。

### 下拉三項齊列並標示當前項，而非只列另外兩項
下拉的語意是「當前在哪」而非「可以去哪」。只列非當前頁會讓它退化成跳轉清單——從 Specs 頁看到「Changes · Archived」，控制項本身就不再回答「我現在在哪」。三項齊列讓身分與去向由同一個控制項承擔。

### 下拉不顯示各頁的項目數量
Specs 與 Archived 的 store 是「進頁載入、離頁清空、不裝 watcher」。要在下拉出數量就得預先載入三頁資料，等於推翻該生命週期決策；而只有 Changes 拿得到數量（其 store 常駐）會造成三項不一致。

### 麵包屑的專案段是純標籤
兩個候選功能都已有更好的入口：專案切換在側欄全展開（「專案下拉選單」是既有的已否決項），而「點了回 Changes」與下拉的 Changes 項重複。

### 「專案下拉選單」否決項的裁決
`docs/ui-structure-decisions.md` 的已否決項表列有「專案下拉選單」，否決理由是「要全展開快速切換」。本案是**頁**下拉不是**專案**下拉：頁切換屬低頻，正是下拉適用的場景，原理由不涵蓋本案。此裁決需明文寫回該文件，避免日後被誤讀成推翻。

### 面板覆蓋時麵包屑不做特殊處理
麵包屑留在清單層，被面板蓋掉右半，露出部分維持可互動。這不是新規則——現有的 header 今天就是這個行為；且切頁時 `view.show()` 本來就會關面板，從露出的下拉切頁在語意上一致。

**Alternatives considered**：面板開啟時麵包屑淡出——避免半截的可點控制項，但窄軌頂部空一塊，且多一組要與 slideover 對拍的進出場。麵包屑升為主區固定頂列、永遠可見——面板不再是全幅抽屜，破壞既有的全幅純位移語意與動效，且會與面板自己的標題疊成兩層頁首。

### 側欄留白不處理
移除兩列後 PROJECTS 段與釘底的 Settings 之間留白增加約 90px。該留白今天就存在（Settings 是 `mt-auto`，原本的 Specs／Archived 段並不填滿中間），本案只是讓它變大。既有決策「Settings 底部固定不捲動」與風格定調「留白慷慨」已推定答案：不動。

### 已評估並否決的側欄內方案
記錄於此以免日後重新發明：

| 方案 | 否決理由 |
|---|---|
| Specs／Archived 縮排掛在目前專案下（三列） | 多佔約 108px 且插在目前專案與其他專案之間，用低頻目的地切斷高頻的專案掃描動線；且需推翻「Changes 不另設 nav 項」那條 |
| 同上但預設摺疊、專案列帶 chevron | 專案列已塞 icon／名稱／暫時標記／徽章／絕對定位的移除鈕，chevron 無乾淨落點，且與「點列切專案」搶目標 |
| 壓成一條窄行（`Specs · Archived`）掛在目前專案下 | 重量最低且不推翻既有決策，但仍留在側欄、層級靠縮排暗示而非結構 |
| 位置不動，該段補專案名段標 | 靠文字說明不靠結構；專案列與頁入口兩個同款高亮同時亮的歧義未解 |
| 只拿掉專案清單與該段之間的分隔線 | 只解「分隔線與 Settings 同權重」一項，且易讀成「Specs 也是一個專案」 |
| 主區頂部 tabs（三頁並列） | 詳情面板開啟時會與 artifact tabs 疊成兩層 tabs |

## Risks / Trade-offs

- **半截的可點控制項**：面板開啟時麵包屑右半被蓋，Refresh 可能只露出一部分 → 現有 header 已是此行為，本案不擴大；若日後決定處理，該處理應涵蓋整個 header 行而非只針對麵包屑
- **鍵盤讓位的層數增加**：`App.vue` 的 listener 需同時考慮 Settings 與下拉兩個讓位條件 → 兩者都是「開啟即整段讓位」的同一種形狀，以相同的早退寫法處理；不做堆疊式依序關閉
- **無專案時 Specs／Archived 不可達**：這是刻意的行為變更（已寫入 spec），但屬使用者可見的能力移除 → 該狀態下兩頁本就只有與 Changes 相同的空狀態，且加入專案後既有行為已強制落在 Changes 頁
- **三頁 header 需同步改動**：麵包屑抽成共用元件後，三頁的 header 結構必須一致，任一頁漏改會出現兩種頁首 → 以共用元件承擔整個 header 行（含 Refresh 插槽），而非只抽麵包屑本身
