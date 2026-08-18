## Why

change 詳情面板的墊底路徑（無快取可顯示）目前只給一行 `Loading…` 純文字，是整個 App 裡唯一還在用文字回饋讀取中的地方——清單側三處（Changes／Specs／Archived 的首次載入）早已全面 skeleton。這條路徑雖罕見（預載＋持久化讓它只在「全新 change 搶在預載排到它之前被點開」時出現），但一出現就是約一秒的空面板配一行小灰字，與 App 其餘部分的讀取回饋不同調。

## What Changes

- change 詳情面板在墊底路徑改以 skeleton 呈現讀取中，取代原本的一行 `Loading…` 文字。
- 沿用手動刷新已在用的同一份 skeleton（標題列＋文字行），不新增第二種骨架形態——同一個面板的讀取中只有一種樣子。
- 規格層翻案：解除墊底路徑的 skeleton 禁令。原禁令來自已歸檔的 `2026-08-14-add-artifact-view` design D8（「skeleton 的分界＝誰觸發的讀取」），其中「導航動作不出現讀取動畫」的那一半在此撤銷；「手動刷新用 skeleton」的那一半保留，但其立論不再依賴與導航動作的對比。
- 不改動的部分（明確劃界）：詳情快取與預載機制、暖路徑「立即顯示、無任何讀取動畫」的行為、Specs 與 Archived 兩個詳情面板的同款文字提示。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `artifact-view`: 「載入與新鮮度」的墊底路徑呈現由「MUST NOT 顯示 skeleton 動畫」改為 SHALL 顯示 skeleton；「詳情手動刷新」的敘述改為不再以「與導航動作的無動畫載入形成刻意對比」立論。

## Impact

- `src/components/ArtifactPanel.vue`：`detail.loading` 分支的 `<p>Loading…</p>` 改為既有的 `ArtifactSkeleton`。
- `openspec/specs/artifact-view/spec.md`：「載入與新鮮度」Requirement 敘述與其「墊底路徑」Scenario、「詳情手動刷新」Requirement 敘述。
- 不新增元件、不新增依賴、不動 store。`ArtifactSkeleton.vue` 檔頭註解提及「手動刷新專用」，需隨用途擴大調整。
- 待驗證的互動：面板首次開啟時 `PanelShell` 會把內容區壓 `opacity-0` 再淡入，而 skeleton 自帶 pulse，兩者會疊在同一秒內——是否需要處理由 design 判斷。
