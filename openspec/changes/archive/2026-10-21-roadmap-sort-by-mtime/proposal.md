# Proposal

## Why

Roadmap 頁每一組裡的卡片目前照檔名字母序排，最近在動的開發項常被擠在中間或底下，要一張一張找。改成最近修改過的排在最上面，打開 Roadmap 頁第一眼就看到最近在處理的項目。

## What Changes

- 每一組裡的卡片改照規劃檔的最後修改時刻排，由新到舊。
- 修改時刻相同的檔，以檔名字母序決定先後。
- 讀不到修改時刻的檔（卡片本來就不顯示更新時間），排在該組最下面；這些檔彼此之間照檔名字母序。
- 分組規則與四組的先後順序（In progress → Available → Blocked → Other）不變。
- 使用者看得到的副作用：
  - 在編輯器存檔某個規劃檔後，App 重新讀到時，那張卡片會跳到它那一組的第一個。
  - `00-執行順序.md` 這類靠檔名數字排第一的總覽檔，不再固定排在 Other 組最上面。
- UI 仍然不提供排序切換。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `roadmap-view`：「清單分組」requirement 的組內排序規則，從檔名字母序改為依最後修改時刻由新到舊。

## Impact

- `src/api/normalize-roadmap.ts`：清單排序函式。
- `src/api/normalize-roadmap.test.ts`：排序相關測試。
- 不動資料來源：修改時刻原本就隨清單一起讀進來（卡片的更新時間用的就是它）。
- ↑↓ 鍵盤切換直接跟著清單順序走，不需另外修改。
