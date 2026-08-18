## Context

見 proposal.md - Why。這裡只補動工需要的現況。

墊底路徑的判定在 `detail.ts` 的 `load()`：`const warm = detail.value !== null; loading.value = !warm`——畫面上沒有可顯示的內容才進 `loading`。`ArtifactPanel.vue` 的內容區依序是 `refreshing`（已是 `ArtifactSkeleton`）、`loading`（本次要改的 `<p>Loading…</p>`）、`error`、`missing`、內容。header 不受影響：change 名在點卡片時就從清單拿到、標題冷路徑照樣顯示，tabs 那段已有 `h-12` 佔位撐高。

`ArtifactSkeleton.vue` 現有檔頭註解寫「手動刷新專用的讀取回饋（導航動作不用動畫，見 design D8）」，其中「導航動作不用動畫」正是本次撤銷的那半條。

本次翻案的來源是已歸檔的 `2026-08-14-add-artifact-view` design D8：「skeleton 的分界＝誰觸發的讀取」。D8 排除冷路徑 skeleton 的理由是「預載＋持久化後此路徑幾乎不會被看到」——這個前提至今成立且經使用者實測確認，因此撤銷的不是 D8 的事實判斷，而是它由此推出的呈現結論：罕見不等於該用比較差的呈現，尤其當它已是全 App 唯一的純文字讀取回饋（清單側 `ChangeList`、`SpecsView`、`ArchivedView` 首次載入皆為 skeleton）。

## Goals / Non-Goals

**Goals:**
- 墊底路徑的讀取回饋與 App 其餘部分同調。
- 同一個面板的讀取中只有一種樣子，不因觸發來源分岔出兩種骨架。

**Non-Goals:**
- 不碰 `Specs`／`Archived` 兩個詳情面板的同款文字提示。那兩處的 store 無快取無預載、每次點開必進冷路徑，痛感與成因都與此處不同，值得單獨評估（很可能該補的是快取而非 skeleton）。
- 不碰快取、預載與暖路徑行為。
- 不碰 `ChangeCardSkeleton` 與清單側 skeleton 的形態。骨架語意不同（卡片 vs 文章），沒有統一的理由。

## Decisions

### D1：複用 `ArtifactSkeleton`，不為冷路徑另做一版

冷路徑與手動刷新等的是同一份 Markdown 全文，骨架形態沒有分歧的理由。`ArtifactSkeleton` 的 `max-w-[68ch]` 與行高本就照閱讀欄對齊，換上真內容時位移最小。

棄案「冷路徑用比較安靜的一版（如不 pulse、或更少行）」：那等於用視覺分級去編碼「誰觸發的讀取」，把 D8 那條分界改頭換面留下來——而使用者要的正是這個分界在呈現上消失。兩種骨架也讓之後每次調整都要改兩處。

隨之要改 `ArtifactSkeleton.vue` 的檔頭註解：用途已從「手動刷新專用」擴為「面板讀取中的通用骨架」，D8 的引用不能留著誤導下一個讀它的人。

### D2：不為 skeleton 與面板淡入的疊加做任何處理

explore 階段標記的風險，追進 `PanelShell.vue` 後結論是不需要處理——三種進入方式的實際時序都沒有問題：

```
首次開啟（面板由 App.vue 的 v-if 掛載）
  PanelShell 的 watcher 非 immediate → 掛載不觸發淡入
  → 只有 PANEL_MOTION 的面板滑入 ＋ skeleton pulse，兩者不同層、不打架

面板開著時切到另一個冷 change
  identityKey 變 → FADE_IDENTITY 180ms 淡入 skeleton → skeleton 續 pulse

skeleton → 真內容（~1s 後）
  load() 設 currentTab → contentKey 變 → FADE_CONTENT 160ms 淡入真內容
```

最後一段是意外的收穫：骨架換成內容本來就會走一次淡入，不必額外安排過場。

棄案「冷路徑抑制 PanelShell 淡入」與「延後 pulse 起跑」：都是為沒有發生的問題加分支。若實機驗收看出糊，再回頭處理——那時的訊息比現在猜測準。

### D3：不加「讀取超過 N 毫秒才顯示 skeleton」的延遲閾值

skeleton 常見的防閃爍手法在這裡沒有作用對象：進到這條路徑意味著 CLI spawn 必然要跑（實測 ~1s），不存在「骨架閃一下就被內容取代」的情形。加閾值只會讓最需要回饋的那一秒前段變成空白面板。

若日後 specs／archived 補上快取、或詳情取得變快到百毫秒等級，再重新評估。

### D4：色階修正為 `bg-surface-hover`，形態收斂為單純的文章行

實作階段驗收時發現，原本的 `ArtifactSkeleton` 在畫面上有一半是隱形的：六條文字行用 `bg-surface`（#1a1f27），而它所在的 `PanelShell` 容器背景也是 `bg-surface`（`PanelShell.vue` 的 `<section class="… bg-surface">`）——同色畫在同色上，對比為零，`animate-pulse` 只改 opacity 救不回來。畫面上只剩兩條 `bg-surface-hover` 的標題條，中間隔著一大段看似留白、其實是隱形內文的空白。

這是既有 bug 而非本次改動引入：手動刷新路徑一直是這個樣子，只是罕有人細看。全 App 其餘三處 skeleton（`ChangeCardSkeleton`、`SpecsView`、`ArchivedView`）一律是 `bg-surface-hover` 畫在 `bg-surface` 上，只有這裡用錯。修正後與其餘部分同一套色階規則。

同時撤掉「標題列＋內文段」的兩段式結構，改為單純幾行等寬文字行（末行短），行距用 `h-[1.8em]` 包條對齊 `md-body` 的 16px / 1.8 行高。理由：兩段式結構是在預告「內容有標題、有段落」，但每個 artifact 的首個元素不同（proposal 開頭是 `## Why`、tasks 開頭是 `## 1. …`），預告不準；而修好色階後那兩條較粗較短的標題條反而是視覺上最跳的元素，把注意力導向一個不成立的預期。單純的文章行只承諾「這裡正在載入、寬度到這裡」，正是骨架該說的話。

棄案「只修色階、形態不動」：修完色階就能看見原設計的樣子，但那個樣子預告的段落結構本身不成立——留著只是把一個隱形的問題變成可見的問題。

## Risks / Trade-offs

- [「導航動作不出現讀取動畫」這條原則失去唯一的實作據點] → 這是本次的目的而非副作用。原則的另一半（有快取的導航立即顯示內容、無任何讀取回饋）仍在 spec「載入與新鮮度」內，且那才是使用者實際天天走的路徑。
- [三個同構面板的冷路徑呈現出現分歧] → 已知且接受：範圍刻意鎖在 change 詳情。分歧點記在此處，日後處理 specs／archived 時是現成的起點。
- [`ArtifactSkeleton` 之後若為某一路徑調整，會同時影響另一路徑] → 這正是 D1 要的性質（單一形態），不是需要緩解的風險。
- [D4 讓 skeleton 不再預告內容的段落結構] → 接受。骨架的職責是「這裡正在載入、內容會有這麼寬」，不是預測 Markdown 的標題落點——後者本來就預測不準（每個 artifact 的首個元素不同）。
