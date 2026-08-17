## Why

現行字級表（D1 定稿，`uno.config.ts:9-21`）的十階中有七個相鄰間隔比值 < 1.125，肉眼分辨不出，形成「表上有階、眼裡沒階」；且 Changes 主頁最大字僅 14px，群組標題用 11px eyebrow 手法卻沒有主角可搭配，整頁讀起來扁平。根因是字級錨點取自「ghostty 終端 font-size 14 mono」——這個參照系只對 mono 側成立，sans（Manrope）側被連帶壓小。使用者已明確解除「mono 與終端 14px 對齊」這條約束，解放了重整空間。

## What Changes

- **重整 UI 字級階梯為五階**，相鄰比值全部落在 1.13–1.24 的可辨識區間：
  | Token | 舊值 | 新值 | 用途 |
  |---|---|---|---|
  | `ui-xs` | 11 | **11** | eyebrow 群組標籤、徽章 |
  | `ui-sm` | 12.5 | **13** | 相對時間、tabs、chip、n/m 進度數字、次要按鈕 |
  | `ui-base` | 14 | **15** / lh 1.6 | UI 內文、按鈕、side item、專案名、路徑 |
  | `ui-title` | — | **17**（新增階） | 卡片標題：change 名、spec id、archived 項目名 |
  | `ui-lg` | 20 | **21** | 詳情面板主標題、側欄 wordmark |

- **廢除 mono 專用三階** `mono-lg` / `mono-base` / `mono-sm`：sans 與 mono 共用同一組數值，字體差異交由 `font-mono` 表達。舊的光學補償意圖在 D1 就已明文放棄（「不做補償」），保留三個平行階只是徒增 token 數。
- **重整閱讀階梯為四階**（維持與 UI 階梯獨立的節奏），並**廢除 `read-*` 五個 token**：閱讀字級的唯一消費者是渲染後的 Markdown HTML，它結構上吃不到 utility，實際值一直硬寫在 `src/styles/markdown.css`；`read-*` token 與該檔是兩份重複定義且已漂移（`h4` 15px、`table` 14px、`pre` 13px 在 token 表中根本無對應階）。wordmark 脫鉤後 `read-*` 將完全無人使用，故收斂為單一來源（理由與替代方案見 design.md - D2）。

  | 用途 | 舊值 | 新值 |
  |---|---|---|
  | `code` / `pre` / `table` | 13 / 13 / 14 | **14** |
  | 正文 / `h3` / `h4` | 15 / 15.5 / 15 | **16**（正文 lh 1.8；`h3` 靠 600 字重、`h4` 靠 `text-2` 色階區分，維持「`###` 不靠字級」的原意圖） |
  | `h2` | 18 | **19** |
  | `h1` | 20 | **22** |

- 字級 token 總數 11 → **5**（UI 五階；閱讀階梯改由 `markdown.css` 單獨承載）。
- 卡片標題（change 名）自 14px 升至 17px，與同列的 n/m、相對時間（13px）形成 1.31 比值，卡片內部主從成立；標題字重維持 400，不加 IBM Plex Mono 500。
- `n/m` 進度數字自 11.5px 升至 13px，與相對時間同階，兩者改以語意色（`text-done`／`text-2`／`text-parked`）而非 1px 字差區分。
- 側欄 wordmark（`AppSidebar.vue:14`）自 `text-read-h1` 改掛 `ui-lg`，脫離閱讀階梯——wordmark 借用閱讀階梯本屬誤用，且 `read-h1` 升至 22 會連帶拖動它。
- **七處**以容器字級推算的 `h-[1.6em]` 統一改為固定 `h-7`（28px）：`ChangeCard.vue:80`、`ChangeCardSkeleton.vue:4`、`SpecsView.vue:109,155`、`ArchivedView.vue:93,140,146`。標題 17／數字 13 混排後容器不再有單一字級，原寫法會讓實列與 skeleton 高度失準、同列元素垂直錯位（明細見 design.md - D4）。
- 同步改寫 `docs/ui-structure-decisions.md` 的字級定稿表，並記錄「mono 與終端對齊」約束解除的理由，避免日後重新發明。

**非破壞性變更**：本 change 不新增、不移除、不修改任何功能行為，僅調整既有元素的視覺尺寸。

## Capabilities

### New Capabilities

無。本 change 不引入任何新能力。

### Modified Capabilities

無。字級屬視覺樣式層，既有 specs（`change-list`、`artifact-view`、`specs-view`、`archived-view`、`park-mechanism`、`project-management`、`openspec-gateway`）皆只描述「顯示什麼、何時顯示」，未涵蓋「顯示得多大」；本 change 不改動其中任何一條 requirement。

因此 `.openspec.yaml` 設 `skip_specs: true`，沿用 D1（`add-design-foundation`）與 `scaffold-app-shell` 的既有慣例——純樣式重構不虛構 requirement 來滿足驗證。

## Impact

**設定層**
- `uno.config.ts`：`text` 字級表整表改寫為 UI 五階（刪除 `mono-*` 三階與 `read-*` 五階）；`configResolved` 的封閉集合覆寫沿用不動。
- `uno.config.ts` shortcuts 內嵌的字級需重新指派：`btn-quiet`、`btn-quiet-sm`、`btn-danger`、`tab-item`（`ui-sm`）、`side-item`、`side-action`（`ui-base`）、`input-quiet`（原 `mono-sm` 11.5px，改掛 `ui-sm` 13px）。

**元件層**（使用字級 class 者）
- 卡片標題升階：`ChangeCard.vue`、`ChangeCardSkeleton.vue`、`SpecsView.vue`、`ArchivedView.vue`
- 面板標題改掛 `ui-lg`：`ArtifactPanel.vue`、`SpecPanel.vue`、`ArchivedPanel.vue`
- mono 階替換：`ProjectSwitcher.vue`、`StateNotice.vue`、`ToastStack.vue`、`ChangeList.vue`
- wordmark 脫鉤：`AppSidebar.vue`

**樣式層**
- `src/styles/markdown.css`：閱讀階梯四階改寫（含 `h4`、`table`、`pre` 三個原本無 token 對應的值），頂部註解改寫為「本檔即閱讀字級的定義處」。

**文件**
- `docs/ui-structure-decisions.md`：字級定稿表改寫＋約束解除理由＋閱讀階梯改由 CSS 承載的說明。

**風險**
- `ui-base` 14→15 會使 `side-item`／`side-action`（`py-1.5` ＋ lh 1.6）列高自 34.4px 增至 36px，需目視確認側欄比例；`btn-quiet` 等固定高度（`h-9`／`h-8`）不受影響，但內文字級變動後的垂直居中需檢查。
- 側欄寬 224px，專案名自 14px 升至 15px 會略增截斷機率（既有 `truncate` 已覆蓋，不致溢出）。
