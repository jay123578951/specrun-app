## Why

`src/` 底下有 224 處註解把「為什麼這樣寫」外包給規格文件——`（design D4）`、`（spec app-settings）`、`M4`／`C5` 這類代號。讀 code 的人要先猜出這個檔案屬於哪個 change，再去翻一份歸檔後會換路徑的文件，才知道那條規則為什麼存在；光「D4」一個字串，全 repo 就有 25 個互不相干的意思。

其中大多數把話講完了、引用只是補在句尾的出處，刪掉不損失資訊。**本次只處理刪不掉的那一小撮**：引用一拿掉，註解就變成沒有理由的禁令，或整句話根本不成立。

## What Changes

- 改寫兩類註解，讓它們不依賴任何規格文件也讀得懂：
  - **只寫規則沒寫理由**——註解寫了「不准這樣做」，但「為什麼」整句不在註解裡，只存在 `design.md`。把理由搬進註解，並寫出不這樣做該走哪條路。
  - **編號是句子的文法成分**——像「與 `settings` 分開存是 design D6 的直接後果」，抽掉編號句子就不成立，整句重寫。
- 純註解改動：不動任何 code 邏輯、不動格式、不動規格文件本身。
- 指向程式碼自己的引用（`見 settleMove`、`依 projects.ts 慣例`、`機制見 interactions.css`）**全部保留**——那些指的是同一棵樹裡跳得到、也不會換路徑的東西。
- 另約 200 處「句子本來就完整、只需刪掉句尾括號」的註解**不在本次範圍**，等本次驗收通過後另開一個 change 收掉。

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

（無）

本次改動只動註解文字，沒有任何使用者看得到的行為變化，也沒有任何介面契約變動——`.openspec.yaml` 設 `skip_specs: true`。不為了通過驗證而杜撰要求。

## Impact

改動範圍約 25–30 處註解，落在 17 個檔案：

| 區域 | 檔案 |
|------|------|
| 元件 | `BrandMark.vue`、`MarkdownView.vue`、`PanelShell.vue`、`AppSidebar.vue`、`SettingsModal.vue`、`ArchivedPanel.vue`、`App.vue` |
| store | `stores/settings.ts`、`stores/detail.ts`、`stores/changes.ts`、`stores/view.ts` |
| 資料層 | `api/types.ts`、`api/normalize-archived.ts` |
| 工具與樣式 | `utils/orb-color.ts`、`utils/orb-color.test.ts`、`styles/interactions.css` |
| Markdown | `markdown/render.ts` |

丙類的 17 處由機械掃描定出（引用後面接「的」「：」「實測」「定案」＝它是句子成分）；乙類的成員要逐條讀過才知道，13 處候選中判為甲類的會留給第二批。

其中 `BrandMark.vue` 與正在進行的 `add-orb-logo` 是同一個檔案，兩邊都會動到註解區。

不影響：build、測試行為、任何執行期邏輯。驗收走 lint ＋ 既有測試即可。

規範層（要求日後寫 code 時註解必須自足）不在本次處理，已記進跨專案回饋收件匣，由 kit 層統一修。
