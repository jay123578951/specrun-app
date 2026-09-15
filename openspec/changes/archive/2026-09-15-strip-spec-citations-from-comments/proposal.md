## Why

`make-comments-self-contained` 處理的是「引用一拿掉就讀不懂」的那二三十處。剩下的約 200 處是另一種：句子本來就把話講完了，規格文件引用只是補在句尾的出處。

它們單看每一處都無害，但留著有兩個後果。一是同一個 repo 裡會並存兩種寫法，下一個人不知道該照哪一種寫。二是這些引用指的東西照樣找不到——`design D4` 沒寫是哪個 change，而 `D4` 這個字串全 repo 有 25 個互不相干的意思。

## What Changes

- **刪掉句尾的規格文件出處，句子其餘部分一字不動**。約 200 處，形態有四種：`（design Dn）`、`（spec <capability>「要求標題」）`、寫出 `.md` 路徑的、以及少數寫在句中的。
- **把內部代號換成它實際指的事**。14 處，這批不是純刪除，要改寫：

  | 代號 | 出現處 | 它其實在講 |
  |------|--------|-----------|
  | `M4 Tauri 版` | `normalize.ts`、`normalize-parked.ts`、`normalize-archived.ts`、`task-progress.ts`、`why-summary.ts`、`types.ts` 三處 | 日後的 Tauri 版 |
  | `T1`／`T2` | `gateway.ts` 兩處 | 目前恆走 web／日後依執行環境分流 |
  | `M3 才填` | `ArtifactPanel.vue` | 這批按鈕之後才做 |
  | `C4` | `markdown-it-task-lists.d.ts` | 可勾選是後來才開的 |
  | `C5 起` | `AppSidebar.vue` | 專案清單改成可互動之後 |
  | `C3` | `ChangeCard.vue` | 進度補間那次改動 |

  `AppSidebar.vue` 那處同時還寫著 `依 docs/ui-structure-decisions.md`，一併拿掉。

- 純註解改動：不動 code 邏輯、不動格式。
- 指向程式碼自己的引用（`見 settleMove`、`依 projects.ts 慣例`、`機制見 interactions.css`）**全部保留**。

**執行順序**：必須排在 `make-comments-self-contained` 之後。本次的範圍是「前一個 change 逐條判定後沒動到的其餘所有引用」——順序顛倒的話，那些只寫規則沒寫理由的註解會被當成一般出處直接刪掉，理由就跟著沒了。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

（無）

只改註解文字，沒有行為變化，也沒有介面契約變動——`.openspec.yaml` 設 `skip_specs: true`。不為了通過驗證而杜撰要求。

## Impact

約 200 處刪除 ＋ 14 處代號改寫，落在約 40 個檔案。密度最高的幾個：

| 檔案 | 處數 |
|------|------|
| `api/types.ts` | 29 |
| `stores/detail.ts` | 17 |
| `api/normalize.ts` | 15 |
| `components/ChangeCard.vue` | 10 |
| `components/ChangeList.vue` | 9 |
| `components/SettingsModal.vue` | 8 |
| `components/ArtifactTabs.vue` | 8 |

確切數字等前一個 change 的判定表產出後才算得準——本次的範圍是用排除法定義的，不是一份固定名單。

不影響：build、測試行為、任何執行期邏輯。驗收走 lint ＋ 既有測試即可。

規範層（要求日後寫 code 時註解必須自足）同樣不在本次處理，已記進跨專案回饋收件匣，由 kit 層統一修。
