## Context

動機見 `proposal.md - Why`。以下只列影響作法的現況約束。

**字級目前有兩個互不相通的載體：**

1. `uno.config.ts` 的 `text` 表（11 階），透過 `configResolved` 覆寫成封閉集合，元件以 `text-*` utility 取用。
2. `src/styles/markdown.css` 的硬寫 px（6 個值：body 15、h1 20、h2 18、h3 15.5、h4 15、code/pre 13、table 14）。

`markdown.css:5` 的註解寫著「字級走 read-* 階」，但機制上兩者毫無關聯——同一個值抄了兩份，且**已經漂移**：`h4 15px`、`table 14px`、`pre 13px` 這三個值在 token 表裡根本不存在對應階。

**read-\* token 實際上已是死 token。** 全 codebase 對 `text-read-*` 的唯一引用是 `AppSidebar.vue:14` 的 wordmark（`text-read-h1`），而它是誤用——wordmark 不屬於閱讀階梯。此誤用一旦解除（proposal 已定案），`read-base` / `read-h2` / `read-h3` / `read-code` / `read-h1` 五個 token 將沒有任何使用者。

**渲染後的 Markdown HTML 沒有 class 可掛 utility**（`v-html` 產出），只能靠 `.md-body` 後代選擇器上樣式——這是 `markdown.css` 存在的原因，也是它無法直接吃 `text-*` utility 的原因。

## Goals / Non-Goals

**Goals:**

- 字級的每個值只有一個定義處，改一次就到位。
- 相鄰階比值 ≥ 1.125，確保螢幕上肉眼可辨（診斷見 proposal）。
- 保留 D1「封閉集合」的紀律：想用第十一階必須先改集合定義，蔓延要在 review 現形。

**Non-Goals:**

- 不動顏色、間距、圓角、字體家族——本 change 只碰字級。
- 不建立響應式字級（`clamp()`／斷點縮放）：桌面 App 單一視窗語境，沒有需求。
- 不引入 rem 相對單位。全表維持 px；使用者全域字級調整已在 D1 記為 M4 Tauri webview zoom 的觀察項，不在此處理。
- 不改任何功能行為（本 change `skip_specs: true`）。

## Decisions

### D1. 廢除 mono 專用三階，sans 與 mono 共用同一組數值

**選擇**：刪除 `mono-lg` / `mono-base` / `mono-sm`，改由 `ui-*` 五階 ＋ `font-mono` 表達。

**理由**：mono 專用階的原始意圖是光學補償（mono 同字級視覺比 sans 大半圈），但 D1 定稿當時就已明文**放棄補償**（「change 名刻意與終端字級對齊，不做補償」）。既然沒有補償，三個平行階承載的資訊只剩「這是 mono」——而那已經由 `font-mono` 表達了。保留只是讓 token 數翻倍、且製造「11 vs 11.5」這種無意義的相鄰階。

**替代方案**：真正做光學補償（mono 階＝對應 sans 階 −0.5px）。否決——0.5px 差在 Retina 上仍然肉眼無感，付出一整組 token 換取看不見的精緻度，恰好是本 change 要消滅的問題。

### D2. 閱讀階梯的單一來源：廢除 read-\* token，`markdown.css` 為唯一載體

**選擇**：五個 `read-*` token 一併從 `uno.config.ts` 刪除，閱讀字級只留在 `markdown.css`。

**理由**：閱讀階梯的唯一消費者是渲染後的 Markdown HTML，而它結構上就吃不到 utility。token 存在的前提（有元件會用 `text-read-*`）在 wordmark 脫鉤後不再成立。留著等於維持一份沒人讀、且已經與真實值漂移的副本。

**替代方案 A**：把字級值提到 `tokens.css` 成 CSS var（`--sr-text-read-base` 等），`uno.config.ts` 與 `markdown.css` 雙邊引用 `var()`，比照顏色的既有作法。
否決理由——顏色需要 CSS var 是因為它同時被 utility 與裸 CSS 消費；字級不是：UI 階梯只有 utility 一個消費者，閱讀階梯只有裸 CSS 一個消費者，兩者不重疊。為零個交集的情境建一層間接層是純負債。

**替代方案 B**：維持雙寫，靠註解要求同步。
否決理由——現況就是這樣，而它已經漂移了三個值。註解攔不住漂移。

**紀律補償**：`markdown.css` 頂部註解改寫，明確標示「閱讀字級的定義處就是本檔，UI 階梯在 `uno.config.ts`，兩者刻意不共用」，並列出四階全表。封閉集合的紀律以檔案邊界承擔，而非以 token 承擔。

### D3. `ui-title` 立為獨立階，而非讓卡片標題借用 `ui-lg`

**選擇**：新增 17px 這一階。

**理由**：卡片標題與詳情面板標題是不同層級——面板標題獨佔一列、旁邊沒有東西壓比例（D1 原註解已載明此前提）；卡片標題與 n/m、時間同列競爭。若卡片標題直接用 21px，同列的 13px 元素被壓成 1.62 比值，卡片右側會塌成註腳。17px 對 13px 是 1.31，主從分明但仍在同一個視覺群組裡。

**替代方案**：卡片標題用 `ui-base` 15px、靠字重（500）突出。否決——proposal 已定案「只升字級、字重維持 400」；且 15px 對 13px 只有 1.15 比值，突出程度不足以解決診斷 C。

### D4. `h-[1.6em]` 改為固定 px 高度（七處，同一個值）

**選擇**：全部七處 `h-[1.6em]` 換成固定 `h-7`（28px ≈ 17px × 1.6 取整）。七處必須用同一個值，否則卡片、清單列與各自的 skeleton 之間會高度不齊。

| 檔案 | 行 | 角色 |
|---|---|---|
| `ChangeCard.vue` | 80 | 卡片標題列容器 |
| `ChangeCardSkeleton.vue` | 4 | 對應 skeleton |
| `SpecsView.vue` | 109 | 內嵌 skeleton 列容器 |
| `SpecsView.vue` | 155 | 實列標題 span |
| `ArchivedView.vue` | 93 | 內嵌 skeleton 列容器 |
| `ArchivedView.vue` | 140 | 實列標題 span |
| `ArchivedView.vue` | 146 | 實列右側數字群容器 |

**理由**：`em` 相對於**容器**字級計算。現況這些容器都掛 `text-mono-base`，標題與數字一律繼承它，`1.6em` 因此恰好等於「一行標題的高度」。改動後標題升 17px、數字降 13px，容器不再有能代表整列的單一字級——`1.6em` 會算出一個既不是標題行高、也不是數字行高的值。更關鍵的是 `ArchivedView.vue:146` 這類容器裡**只有數字**：它若繼承 13px，算出的高度會比同列標題的 `1.6em` 矮，整列元素垂直錯位。skeleton（無文字內容）與實列的計算基準一旦分歧，載入完成的瞬間版面就會跳動。

**替代方案**：容器保留 `text-ui-title`，讓 `1.6em` 仍算標題行高，數字用 `text-ui-sm` 覆寫。否決——能動但脆弱：這等於讓一個排版常數隱式依賴「容器字級恰好等於標題字級」，且七處都得維持這個隱式約定，下次有人調整標題階就會再踩一次同樣的坑。固定 px 把意圖寫死在明面上。

**替代方案**：容器保留 `text-ui-title`，讓 `1.6em` 仍算標題行高，數字用 `text-ui-sm` 覆寫。否決——能動但脆弱：這等於讓一個排版常數隱式依賴「容器字級恰好等於標題字級」，下次有人調整標題階就會再踩一次同樣的坑。固定 px 把意圖寫死在明面上。

### D5. 階梯數值的推導

以 15px（`ui-base`，Manrope 在 MacBook Retina 上的舒適內文尺寸）為錨，向兩端以 ~1.15 比值展開後取整數：

| 階 | 值 | 對前一階比值 |
|---|---|---|
| `ui-xs` | 11 | — |
| `ui-sm` | 13 | 1.18 |
| `ui-base` | 15 | 1.15 |
| `ui-title` | 17 | 1.13 |
| `ui-lg` | 21 | 1.24 |

閱讀階梯（`markdown.css`）獨立成四階，body 16px／lh 1.8：

| 用途 | 舊值 | 新值 | 對前一階比值 |
|---|---|---|---|
| `code` / `pre` / `table` | 13 / 13 / 14 | **14** | — |
| body / `h3` / `h4` | 15 / 15.5 / 15 | **16** | 1.14 |
| `h2` | 18 | **19** | 1.19 |
| `h1` | 20 | **22** | 1.16 |

`h3` 與 `h4` 收斂到與正文同階（16px），維持 D1「`###` 靠字重而非字級區分」的原意圖：`h3` 用 600 字重、`h4` 用 600 ＋ `text-2` 色階。`pre` 與 inline `code` 統一到 14px（原本就同為 13px，只是 `pre` 另外硬寫了一次）。`table` 自 14 維持 14——相對正文從 1.07 比值（無感）變成 1.14（有感），密集規格表的緊湊感反而更明確。

全表相鄰比值皆 ≥ 1.13，`h4`／`h3`／body 的同階是刻意的（層級由字重與顏色承擔，不由字級）。

## Risks / Trade-offs

- **`ui-base` 14→15 撐高側欄列高**（`side-item`／`side-action`，`py-1.5` ＋ lh 1.6：34.4px → 36px）→ 側欄總高增加約 5%，密度定調本就是「寬鬆」，方向一致；實作後目視確認側欄不出現非預期捲動。
- **`btn-quiet` 等固定高度按鈕內文字級變動**（`h-9`／`h-8` 不變，內文 12.5→13）→ 高度由 `h-*` 鎖死不受影響，但需確認垂直居中與左右內距（`px-3`／`px-2.5`）在新字級下仍平衡。
- **側欄專案名 14→15px 增加截斷機率**（側欄寬 224px）→ `ProjectSwitcher.vue:113` 既有 `truncate` 已覆蓋，不會溢出；截斷點提前約一個字元，可接受。
- **`input-quiet` 原掛 `text-mono-sm`（11.5px），廢階後須重新指派** → 指派為 `ui-sm`（13px）。輸入框自 11.5 升至 13px 是本 change 中相對幅度最大的單點變動（+13%），但 `h-8`（32px）容得下，且 11.5px 的輸入框本就偏小。
- **read-\* token 廢除後，日後若有元件真的需要閱讀字級，無 utility 可用** → 屆時該元件應該直接掛 `.md-body`（它已是閱讀語境的載體），而非重建 token；若出現 `.md-body` 覆蓋不了的情境，再回頭評估替代方案 A。
- **一次改動 12 個元件＋config＋CSS，回歸面廣但全屬視覺** → 無行為變更，測試無法涵蓋；驗收依賴人工目視。Migration 一節說明分批順序以降低目視負擔。

## Migration Plan

單向變更，無資料遷移、無相容性問題。回滾即 `git revert`。

實作順序（每步結束都能跑起來看，避免中間態畫面壞掉）：

1. **先改 `uno.config.ts` 字級表與 shortcuts**——舊 `mono-*` / `read-*` 階被刪除的當下，仍引用它們的元件會失去字級（回落到繼承值），畫面暫時異常屬預期。
2. **接著掃完所有元件的字級指派**，讓步驟 1 的異常歸零。
3. **再改 `markdown.css`** ——與前兩步完全獨立，可單獨驗收。
4. **最後統一七處 `h-[1.6em]` 為 `h-7`**——需要在標題已升階的前提下才能目視確認實列與 skeleton 對齊。
5. **同步 `docs/ui-structure-decisions.md`** 的字級定稿表。

驗收逐頁目視：Changes（含 Active／Parked 兩群組、skeleton 載入態、空狀態）、詳情滑出面板（各 artifact tab ＋ Markdown 渲染）、Specs、Archived、側欄（專案清單／Add project 展開態／wordmark）、toast。

## Open Questions

無。
