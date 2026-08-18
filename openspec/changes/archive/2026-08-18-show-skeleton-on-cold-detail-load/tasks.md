## 1. 面板實作

- [x] 1.1 `ArtifactPanel.vue`：`v-else-if="detail.loading"` 的 `<p class="text-ui-sm text-text-3">Loading…</p>` 改為 `<ArtifactSkeleton />`（design D1），連同該分支上方引用 D8 的註解一併改寫為新的理由
- [x] 1.2 `ArtifactSkeleton.vue`：檔頭註解由「手動刷新專用的讀取回饋（導航動作不用動畫，見 design D8）」改為「面板讀取中的通用骨架」語意，移除已撤銷的 D8 引用（design D1）

## 1b. 骨架形態修正（實作驗收發現，design D4）

- [x] 1b.1 `ArtifactSkeleton.vue`：文字行色階由 `bg-surface` 改為 `bg-surface-hover`——面板容器背景即 `bg-surface`，同色畫同色對比為零、六條文字行實際隱形（design D4）
- [x] 1b.2 `ArtifactSkeleton.vue`：撤掉「標題列＋內文段」兩段式結構，改為五行等寬文字行（末行 `w-3/5`），行距用 `h-[1.8em]` 對齊 `md-body` 的 16px / 1.8（design D4）
- [x] 1b.3 `design.md` 撤除 Non-Goals「不改 `ArtifactSkeleton` 的視覺內容」並補 D4；`specs/artifact-view/spec.md`「詳情手動刷新」的「標題列＋文字行」改為「數行等寬的文字行」並補上行距對齊與色階對比的約束

## 2. 驗收

- [x] 2.1 冷路徑實機驗證：新建一個 change 後立即點開（趕在預載排到它之前），確認面板顯示 skeleton 而非 `Loading…` 文字，且不顯示前一個 change 的內容
- [x] 2.2 形態一致驗證：同一面板按下 refresh，確認 skeleton 與 2.1 看到的完全同形（spec「墊底路徑的 skeleton 與手動刷新同形」），且五行文字行清晰可見、行距貼合真內容的行高（design D4）
- [x] 2.3 暖路徑未受影響：點開已預載的 change，確認立即顯示內容、無任何讀取回饋（spec「啟動預載後點開」）
- [x] 2.4 動效觀察（design D2 的待驗證項）：冷路徑首次開啟時面板滑入與 skeleton pulse 是否互相干擾、skeleton 換成真內容時的淡入是否順暢；若明顯糊再回頭處理，順暢則 D2 成立、不動
- [x] 2.5 `Specs`／`Archived` 兩個面板的 `Loading…` 文字確認仍在原樣（本次刻意不動，見 design Non-Goals）
