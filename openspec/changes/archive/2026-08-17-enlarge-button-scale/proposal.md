## Why

使用者回報「按鈕（非選單）都偏小，除了不容易看，也有點難點擊」。根因有兩層：

1. **根字級是 14px**（`src/styles/tokens.css:50`，D1 定稿），所以每個 rem-based utility 的實際渲染值都是標稱值 ×0.875 —— `h-9` 是 31.5px 不是 36px、`h-7` 是 24.5px 不是 28px。但字級表（`text-ui-*`）是 px 定義、不受影響。結果是一種特定的失衡：**字沒縮，盒子與留白縮了 12.5%**。
2. **按鈕被上一輪重整落下**。`retune-type-scale`（D 已歸檔）把 `ui-base` 升到 15px、`ui-title` 新增 17px，選單項（`side-item`／`side-action`／`project-item`）跟著長；按鈕卻仍停在 `ui-sm` 13px 的次要字級與 D1 的原始盒子上，落差因此更明顯。

順帶暴露的問題：三處註解是按 16px 根字級推算寫的，宣告值與實際不符 —— `icon-btn` 寫「視覺 28px、點擊面積 44px」實為 24.5px／38.5px；`tab-item` 寫「40px 是密集工具介面的點擊面積下限」實為 35px，自己就沒守住自己宣告的下限。`icon-btn` 24.5px 貼著 WCAG 2.5.8 的 24px 最低目標尺寸，toast 關閉鈕 ≈19px 則明確不足。

## What Changes

**加大手段：不動根字級 14px，只改按鈕本身的盒子與內容。** 把根字級拉到 16px 是一行改動，但側欄寬是硬寫的 `224px`（`App.vue:138`，px 不是 rem）不會跟著長，剛加大的選單項會在更擠的側欄裡重新變醜；`max-w-5xl`、toast 寬、面板內距也會一併位移（替代方案評估見 design.md - D1）。

- **按鈕收斂為兩個尺寸階 ＋ 一路圖示鈕**，尺寸與色調正交：

  | 名稱 | 舊值（實際 px） | 新值（實際 px） | 用途 |
  |---|---|---|---|
  | `btn`（原 `btn-quiet`） | `h-9` 31.5／`px-3` 10.5／`gap-1.5` 5.25／`ui-sm` 13／圖示 12.25 | **`h-11` 38.5／`px-4` 14／`gap-2` 7／`ui-base` 15／圖示 14** | 主階：Refresh、Add project、Try again（10 處） |
  | `btn-sm`（原 `btn-quiet-sm`） | `h-8` 28／`px-2.5` 8.75／`ui-sm` 13 | **`h-9` 31.5／`px-3` 10.5／`ui-sm` 13** | 窄脈絡：側欄 224px 的就地確認列（1 處） |
  | `btn-danger` | `h-8` 28／`px-2.5` 8.75／`ui-sm` 13 ＋ error 色（自帶整個盒子） | **只留 error 色**，用法 `class="btn-sm btn-danger"` | 破壞性動作的色調變體（1 處） |
  | `icon-btn` | 視覺 `h-7 w-7` 24.5／圖示 12.25／`before:-inset-2` → 點擊 38.5 | **視覺 `h-8 w-8` 28／圖示 14／`before:-inset-[8px]` → 點擊 44** | 面板收合、面板 Refresh ×3、卡片 park（5 處） |
  | `tab-item` | `h-10` 35 | **`h-12` 42** | artifact／archived tabs（2 處） |
  | toast 關閉（就地寫在 `ToastStack.vue:42`） | `p-1` ≈19／圖示 12.25 | **視覺 `h-7 w-7` 24.5／圖示 14／`before:-inset-[10px]` → 點擊 ≈44** | toast（1 處） |

- **`btn`／`btn-sm` 自帶目前唯一的低調外觀**（border ＋ 透明底），不拆成「尺寸 class ＋ 色調 class」併寫。專案只有一種按鈕色調，為尚未存在的實心主按鈕預先付兩個 class 的稅不划算；真的需要時再開名稱空間（比較見 design.md - D3）。
- **主階字級升到 `ui-base` 15px**：這是字級表上本來就標註「按鈕」、卻只有選單項在用的既有階，不新增第六階（字級表是封閉集合）。
- **`::before` 點擊外擴改用釘死的 px**（`-inset-[8px]`／`-inset-[10px]`）而非 rem 級距。點擊面積是無障礙硬指標，不該隨 rem 基準漂移 —— `before:-inset-2` 在 14px 根字級下只有 7px，正是註解宣告 44px 卻只有 38.5px 的來源。
- **解除 `btn` 與 `input-quiet` 的同高綁定**。`btn-quiet-sm` 註解宣稱「與 `input-quiet` 同高，成排時不會高低不齊」，但 `input-quiet` **全專案零呼叫端** —— web 過渡期的貼路徑輸入列在 `add-native-folder-picker` 換成原生資料夾 dialog 後就沒人使用了。該句刪除；shortcut 本身保留不刪（死碼清理是獨立的事）。
- **圖示尺寸 `h-3.5` 12.25px → `h-4` 14px，共 12 處**（6 處在 `btn`、5 處在 `icon-btn`、1 處在 toast 關閉）。圖示尺寸寫在呼叫端而非 shortcut 裡，所以必須逐處改。不動 chip／徽章裡的 `h-3`（那些不是按鈕）。
- **矯正 4 處與實際不符的 px 註解**：`uno.config.ts:71`（icon-btn 28／44）、`:68`（tab-item 40 → 42 真值）、`:56`（刪 input-quiet 同高宣稱）、`PanelShell.vue:34`（「24.5px 的 icon-btn」→ 28px）。
- 同步更新 `docs/ui-structure-decisions.md`，記錄按鈕尺寸階與「點擊面積用釘死 px」的理由。

**非破壞性變更**：本 change 不新增、不移除、不修改任何功能行為，僅調整既有可點元素的視覺尺寸與點擊面積。

**刻意不做（非遺漏）**

- **根字級維持 14px**。密集工具介面的基準由 D1 定下，本輪不重開。
- **專案列的移除入口不碰**（`ProjectSwitcher.vue` 的絕對定位小按鈕）。它疊在專案切換鈕上，放大等於從「切換專案」這個主要目標身上收回空間，元件註解也明文寫了「不外擴點擊面積、也不撐寬」；它低於 WCAG 24px 是事實，但那個取捨值得單獨一輪處理。該元件目前正由使用者在工作區另行迭代，本 change 一律不觸碰它。
- **`input-quiet` 死碼不刪**，本輪只解除它與按鈕的關係宣稱。
- **Markdown 的 task checkbox 不碰**（`src/styles/markdown.css:194-204`，13×13px、無點擊外擴）。它其實是全 App 最小的可點元素、且是 tasks tab 的核心互動，但它與本輪的其他按鈕不同種：HTML 由 `markdown-it-task-lists` 產出、樣式刻意定義在 `markdown.css`（v-html 的產物吃不到 utility），要真正解決點擊面積就得開 plugin 的 label 包裝、改 `render.ts` 與 `MarkdownView.vue` 的事件委派，那是**行為變更**，會動到 `openspec-gateway` 的「可勾選項的判定一致性」requirement 與 `src/markdown/task-consistency.test.ts`。混進來會讓本輪從「改數值」變成「改架構」，另開一輪處理（理由見 design.md - D7）。

## Capabilities

### New Capabilities

無。本 change 不引入任何新能力。

### Modified Capabilities

無。按鈕尺寸屬視覺樣式層，既有 specs（`change-list`、`artifact-view`、`specs-view`、`archived-view`、`park-mechanism`、`project-management`、`openspec-gateway`）皆只描述「顯示什麼、何時顯示、點了會怎樣」，未涵蓋「顯示得多大」；本 change 不改動其中任何一條 requirement。唯一涉及尺寸的 `change-list` 第 59 條講的是「skeleton 與真實卡片同尺寸」，是相對約束且不含按鈕，不受影響。

因此 `.openspec.yaml` 設 `skip_specs: true`，沿用 `retune-type-scale`、`add-design-foundation`、`scaffold-app-shell` 的既有慣例 —— 純樣式重構不虛構 requirement 來滿足驗證。

## Impact

**設定層**
- `uno.config.ts`：`btn-quiet` → `btn`（改名＋改值）、`btn-quiet-sm` → `btn-sm`（改名＋改值）、`btn-danger` 剝離盒子只留色、`icon-btn` 改值、`tab-item` 改值；四處註解矯正。`kbd-focus`、`side-item`、`side-action`、`project-item`、`list-row`、`input-quiet` 不動。

**元件層**（11 檔）
- `btn` 改名＋圖示升級：`ChangeList.vue`、`SpecsView.vue`、`ArchivedView.vue`（各 3 處呼叫端：header Refresh、空狀態 Add project、錯誤態 Try again），`SpecPanel.vue`、`ArtifactPanel.vue`、`ArchivedPanel.vue`（各 1 處 Try again）
- `icon-btn` 圖示升級：`PanelShell.vue`、`ArtifactPanel.vue`、`SpecPanel.vue`、`ArchivedPanel.vue`、`ChangeCard.vue`
- `btn-sm` 改名與 `btn-danger` 併用：`ProjectSwitcher.vue`
- toast 關閉鈕就地改寫：`ToastStack.vue`
- tabs 頭部留白重算：`ArtifactPanel.vue`、`ArchivedPanel.vue`

**文件**
- `docs/ui-structure-decisions.md`：新增按鈕尺寸階定稿表與點擊面積規則。

**風險**
- **tabs 頭部的留白精算會失準**。`ArtifactPanel.vue:62` 的註解說明上下留白刻意不對稱（`pb-1.5 pt-4.5`），是為了抵消 `h-10` tabs 自帶的約 7.5px 上方空白；`h-12` 後該空白變成約 10.6px，`pb`／`pt` 必須重算，否則「標題到按鈕」與「標題到 tabs」的視覺等距會破。`ArchivedPanel.vue:52` 同構。
- **主階按鈕在 header 可能壓過標題**。三頁 header 是 `ui-xs` 11px 的 eyebrow 標題與 Refresh 並排，按鈕自 31.5 長到 38.5px 後對比更懸殊，需目視確認主從關係沒有翻轉。
- **側欄確認列的橫向空間**。`Remove`／`Cancel` 兩顆 `flex-1` 並排在 224px 側欄內，內距自 8.75 升至 10.5px，13px 字的文案需確認不被截斷。
- **附帶效益**：`ChangeCard` 的標題列容器是固定 `h-7`（28px），`icon-btn` 自 24.5 升到 28px 後正好填滿該列，park 按鈕與標題的垂直關係反而更齊。
