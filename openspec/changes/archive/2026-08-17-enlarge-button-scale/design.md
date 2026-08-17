## Context

動機見 proposal.md - Why。這裡只記與做法有關的現況與約束：

- **根字級 14px**（`src/styles/tokens.css:50`）是 D1 定下的密集工具介面基準，本輪視為既定約束而非可調參數。所有 rem-based utility 的實際值 = 標稱值 × 0.875，本文件一律直接寫實際 px。
- **字級表是封閉集合**（`uno.config.ts:12-18` 的註解明文寫「想用第六階必須先改這裡」），所以按鈕字級只能從既有五階中挑，不能新增。
- **側欄寬硬寫 `224px`**（`App.vue:138`，px 不是 rem），不隨根字級縮放 —— 這是排除「改根字級」方案的關鍵事實。
- **圖示尺寸寫在呼叫端**（`<span class="i-lucide-x h-3.5 w-3.5">`）而非 shortcut 內，所以 shortcut 改值無法帶動圖示，必須逐處改。
- **`input-quiet` 已無呼叫端**：`grep -rn 'input-quiet' src` 為空。它是 `add-native-folder-picker` 換掉貼路徑輸入列後留下的死碼，但 `btn-quiet-sm` 的註解仍宣稱與它同高。
- 既有互動八態、`kbd-focus`、`rounded`、`active:scale-[0.96]`、transition 設定全部正確且與本輪無關，**一律原封不動搬到新 shortcut**。

## Goals / Non-Goals

**Goals:**
- 按鈕的視覺份量與點擊面積同時加大，且加大幅度一眼可辨（不是 5% 的微調）。
- 收出一套名稱能表達大小關係的尺寸階，取代目前「四個 shortcut、三種高度、名稱看不出誰大誰小」的狀態。
- 讓程式碼註解裡宣告的 px 值與實際渲染值一致，消除「以 16px 基準推算」這個持續產生錯誤的來源。

**Non-Goals:**
- 不重開根字級 14px 的討論（D1）。
- 不引入實心主按鈕（primary）或任何新的按鈕色調。
- 不動 `side-item`／`side-action`／`project-item` 三個選單 shortcut —— 那是「選單」不是「按鈕」，且已在工作區另行加大。
- **刻意留白（非遺漏，Coder 不要順手補）**：
  - 專案列的移除入口（`ProjectSwitcher.vue` 的絕對定位小按鈕）維持原樣。它疊在專案切換鈕上，放大會從主要目標身上收回空間，取捨需單獨一輪；且該元件正由使用者在工作區迭代中，本 change 不觸碰它的任何一行。
  - `input-quiet` shortcut 保留，只刪它與按鈕的同高宣稱。刪除死碼是獨立的清理。
  - Markdown 的 task checkbox（`markdown.css:194-204`）維持 13×13px。它是全 App 最小的可點元素，但處理它需要動 HTML 產出與事件委派，屬行為變更（見 D7）。

## Decisions

### D1：加大按鈕本身，不動根字級

**選擇**：維持 `font-size: 14px`，只改按鈕 shortcut 的高度、內距、字級、圖示尺寸。

**替代方案：根字級 14px → 16px。** 一行改動就讓所有 rem 尺寸 ×1.143，`icon-btn` 24.5→28、`btn-quiet` 31.5→36、`tab-item` 35→40，三處錯誤註解還會自動變成真的。否決理由有三：

1. **側欄不跟著長**。`224px` 是硬寫的 px，但側欄內的 `px-3`、`side-item` 的 `py-2` 全是 rem —— 內距長、容器不長，等於剛加大的選單項被擠回去。
2. **爆炸半徑遠超按鈕**。`max-w-5xl` 896→1024、toast 寬 280→320、面板 `px-8` 56→64。使用者要的是按鈕變大，不是整個 App 重新排版。
3. **字級是 px、不跟著長**，所以文字相對變小、留白相對變鬆 —— 修掉「盒子太小」卻製造出「盒子太空」。

**替代方案：兩者都做（根字級當基準修正 ＋ 按鈕再推一階）。** 最徹底，但等於一次動整個空間體系，違反專案「寧可多個小 change」的慣例。若日後真要修正根字級，那應該是獨立一輪、以整體版面為驗收對象。

### D2：主階 38.5px（`h-11`），內容一併升級

**選擇**：`h-11` 38.5px／`px-4` 14px／`gap-2` 7px／`text-ui-base` 15px／圖示 `h-4` 14px。

垂直分解：`ui-base` 是唯一綁行高的階（lh 1.6），內容行盒 = 24px，上下各餘 7.25px。

**替代方案：`h-10` 35px。** 上下只剩 5.5px，盒子幾乎沒變大（+11%），實際上是靠字級 13→15 單方面撐場面，盒子會顯得繃。使用者的抱怨同時包含「不容易看」與「難點擊」，只解前者不夠。

**替代方案：`h-12` 42px。** 上下各 9px，直接達到 WCAG 2.5.5 強化標準 44px 的鄰域。否決理由是這是密集工具介面：三頁 header 的 Refresh 與 11px eyebrow 標題並排，42px 會讓次要動作在視覺重量上壓過區塊標題。38.5px（+22%）是「明顯變大但不搶戲」的落點。

**字級選 `ui-base` 而非新增一階**：字級表註解裡 `ui-base` 的用途本來就列了「按鈕」，但目前只有選單項在用 —— 這是表上留著的空位，啟用它不需破壞封閉集合。

### D3：`btn` 自帶低調外觀，色調只在需要時覆蓋

**選擇**：
```
'btn'        → h-11 px-4 gap-2 ui-base ＋ border-line/text-2 的低調外觀
'btn-sm'     → h-9  px-3        ui-sm   ＋ 同一套低調外觀
'btn-danger' → 只帶 error 色（border-error/50 text-error hover/active 底色）
'icon-btn'   → 自成一路：正方形，尺寸由圖示決定
```
用法：`class="btn"`、`class="btn-sm"`、`class="btn-sm btn-danger"`。

**替代方案：尺寸 × 色調完全正交**（`btn` 只有盒子、`btn-quiet` 只有顏色，一律兩個 class 並寫）。結構最乾淨，未來加實心主按鈕時零摩擦。否決理由：專案目前只有一種按鈕色調，讓 12 處呼叫端全部併寫兩個 class，是為尚未存在的需求預先付稅。名稱空間真的不夠用時再拆，那時的遷移成本與現在相同。

**替代方案：不改名，只換數值。** 呼叫端零改動，但「收一套尺寸階」等於沒做 —— `btn-danger` 仍自帶一整份與 `btn-quiet-sm` 重複的盒子定義，而 `btn-quiet` 比 `btn-quiet-sm` 大、`btn-danger` 與 `-sm` 同高卻不叫 `-sm`，下一個人照樣讀不出階梯。

**實作約束：`btn-danger` 的覆蓋必須用 `!` important。** `btn-sm` 自帶 `border-line`／`text-text-2`，`btn-danger` 要覆蓋的 `border-error/50`／`text-error` 來自同一條 UnoCSS 規則 —— 兩者誰勝出取決於產生的 CSS 順序，而**不是** class 屬性裡的書寫順序。不加 important 會得到「有時紅有時灰」的不穩定結果，而且不會報錯。定案寫法：

```
'btn-danger': '!border-error/50 !text-error hover:!bg-error/15 active:!bg-error/25'
```

`!text-error` 是無條件 important，連帶壓過 `btn-sm` 的 `hover:text-text`，所以 hover 態不必再寫一次文字色；底色則因 `btn-sm` 本身沒有基礎底色，只需在 hover／active 兩個變體上加 important。

**為什麼 `btn-sm` 值得留**：它唯一的呼叫端是側欄 224px 內的就地確認列 —— 那裡是真的窄（見 Risks 的寬度計算），主階 38.5px 兩顆並排會把該列撐得比專案列還高。一階服務一個真實約束，不是為對稱而設。

### D4：點擊面積用釘死的 px，不用 rem 級距

**選擇**：`icon-btn` 用 `before:-inset-[8px]`（28 + 16 = 精準 44px），toast 關閉鈕用 `before:-inset-[10px]`（24.5 + 20 = 44.5px）。

**理由**：現有 `before:-inset-2` 在 14px 根字級下是 7px，得到 38.5px —— 這正是註解宣告 44px 卻不成立的機制。點擊面積是無障礙硬指標（WCAG 2.5.5 = 44px、2.5.8 = 24px），不該隨排版基準漂移。專案已有 arbitrary value 的既有慣例（`grid-cols-[224px_1fr]`、`active:scale-[0.96]`、`max-w-[68ch]`）。

**視覺尺寸仍走 rem 級距**（`h-8`、`h-11`）：那些是排版的一部分，本來就該跟著基準走。只有點擊面積這條無障礙下限脫鉤。

### D5：`tab-item` 納入本輪，並重算 tabs 頭部留白

**選擇**：`h-10` 35px → `h-12` 42px，`px-3`、`ui-sm` 13px 維持。

**理由**：它自己的註解寫「40px 高是密集工具介面的點擊面積下限」，實際卻是 35px —— 是本輪要消除的同一個 16px 推算錯誤。42px 是能守住該宣告的最小 rem 級距。字級維持 13px：字級表把 tabs 明列在 `ui-sm`，且 tabs 是導覽不是動作，不需要跟著主階升字級。

**連帶必做**：`ArtifactPanel.vue:62` 的頭部留白是精算過的不對稱設計（`pb-1.5 pt-4.5`），註解說明 `pb` 是用來抵消 tabs 自帶的上方空白，讓「標題→按鈕」與「標題→tabs」看起來等距。該空白 = (tab 高 − 行盒 20.8) ÷ 2，隨 tab 高改變：

| tab 高 | 自帶上方空白 | 需要的 `pb` | 標題到 tabs 的視覺距離 |
|---|---|---|---|
| 35px（現在） | 7.1px | `pb-1.5` 5.25px | 12.35px |
| 42px（新） | 10.6px | 約 1.75px | 維持 12.35px |

1.75px 沒有對應的 rem 級距。Coder 選 `pb-0.5`（3.5px → 14.1px）或 arbitrary `pb-[2px]` 均可，**以目視等距為準**，別死守算式。`pt-4.5` 不受 tab 高影響，不動。`ArchivedPanel.vue:52` 同構、同樣處理。

### D6：toast 關閉鈕納入，專案列 Remove 不納入

兩顆都是就地寫的小按鈕、都低於 WCAG 24px 最低值，但約束完全不同：

- **toast 關閉鈕可以放心放大**：toast 是浮層，卡片本體不可點，`::before` 外擴到 44px 不會偷走任何人的點擊。成本最低、回報最直接。視覺定 24.5px（`h-7 w-7`）—— 刻意比 `icon-btn` 小一階且無邊框，它是浮層上的次要動作，不該與面板工具列同等份量。
- **專案列的移除入口不能**：它絕對定位疊在專案切換鈕上，任何放大都是從「切換專案」這個主要目標身上收回空間；元件註解已明文記下「不外擴點擊面積、也不撐寬」的理由。見 Non-Goals。

### D7：Markdown task checkbox 另開一輪

**現況**：`markdown.css:194-204` 硬寫 13×13px、無點擊外擴。這是全 App 最小的可點元素（比 toast 關閉 19px、專案列 ✕ 17.5px 都小），只有 WCAG 2.5.8 最低值 24px 的一半出頭，而且它不是次要動作 —— 勾選 tasks 進度是 tasks tab 的核心互動。

**選擇**：本輪不碰，另開一輪。

**為什麼不能照 `icon-btn` 那招處理**，三個障礙都是結構性的：

1. **`<input>` 是 replaced element**。本輪其他外擴全部做在 `<button>` 上，那是安全的；`appearance: none` 的 input 上的 `::before` 雖然實務上多數瀏覽器會渲染，但不在規範保證內，不該作為無障礙下限的實作手段。
2. **HTML 結構由 `markdown-it-task-lists` 產出**，前端改不動。要讓 label 區可點必須開 plugin 選項，並調整 `MarkdownView.vue:48` 以 `closest('.task-list-item-checkbox[data-line]')` 為基礎的事件委派 —— 這會改變「畫面上點得下去的集合」，正是 `openspec-gateway` 的「可勾選項的判定一致性」requirement 與 `src/markdown/task-consistency.test.ts` 在守的東西。**那是行為變更，需要 delta spec**，而本 change 是 `skip_specs: true`。
3. **13px 是配著閱讀階梯挑的**（正文 16px）。放大視覺會動到 Markdown 內文的行內節奏，`.task-list-item` 的 `padding-left: 1.45em` / `text-indent: -1.45em` 換行對齊也得重算 —— 那組數值屬於閱讀階梯的體系，不屬於按鈕體系。

**替代方案：本輪只把視覺放大到 15-16px。** 單點改 `markdown.css`、不碰行為，成本很低。否決理由是它解決不了真正的問題（點擊面積仍遠低於 24px），卻先把 `.task-list-item` 的對齊數值動過一輪 —— 等真正那一輪來時得再動第二次，而且屆時要判斷「這組數字是為什麼變成現在這樣」會多一層雜訊。要動就一次動到底。

**替代方案：本輪擴大 scope、拿掉 `skip_specs`、補 delta spec。** 讓本 change 從純樣式變成含行為變更，違反專案「寧可多個小 change 也不要一個大 change」的慣例，也讓驗收對象從「目視按鈕」變成「目視按鈕 ＋ 迴歸勾選一致性」。

## Risks / Trade-offs

- **tabs 頭部留白失準** → D5 已給公式與兩個可用值；tasks 中列為獨立步驟並要求目視驗收，`ArtifactPanel` 與 `ArchivedPanel` 兩處必須同值。
- **主階按鈕在 header 壓過標題** → 三頁 header 是 11px eyebrow 與 Refresh 並排，38.5px 已是為此壓下來的折衷（見 D2 否決 42px）。仍需逐頁目視確認主從沒有翻轉；若真的翻轉，退路是主階降到 `h-10` 35px 而非改動 header 結構。
- **側欄確認列橫向空間** → 已算過：224 − nav `px-3` 21 − 框 border 2 − 框 `px-2.5` 17.5 = 183.5px，扣 `gap-1.5` 5.25 後兩顆各 89.1px；`btn-sm` 內距 21px 留給文字 68px，13px 的 `Remove`／`Cancel` 約 51／46px。**計算上安全**，但 `btn-sm` 內距自 8.75 升至 10.5px 是新變數，仍列入目視驗收。
- **改名遺漏** → `btn-quiet` 與 `btn-quiet-sm` 在 UnoCSS 是 shortcut，改名後舊 class 不會報錯、只會靜默失去所有樣式（變成裸 `<button>`）。tasks 以「全域 grep 舊名稱應為空」作為收斂條件，不倚賴逐檔目視。
- **圖示升級遺漏** → 同理，`h-3.5` 有 12 處且分散在三種按鈕裡。tasks 以 grep 清單逐一勾稽，並排除 chip／徽章的 `h-3`（那些不是按鈕、不該動）。
- **工作區已有未提交改動且仍在變動** → 選單加大（`side-item`／`side-action`／`project-item` 的 `py-2`）、專案列 icon 換資料夾、移除入口的樣式迭代，共 3 檔（`uno.config.ts`、`AppSidebar.vue`、`ProjectSwitcher.vue`）。與本輪無關但會混在同一份 diff 裡，且 `ProjectSwitcher.vue` 正在被持續編輯。建議實作前先把那批單獨 commit；動 `uno.config.ts` 時只改按鈕相關的五個 shortcut，不要順手回退選單那三個 shortcut 已加大的 `py-2`。

## Migration Plan

純樣式變更，無資料遷移、無 API 變更、無相容性問題。回滾＝還原 commit。

順序有一個硬約束：**先改 `uno.config.ts` 的 shortcut 定義，再改呼叫端**。中間態會出現「舊 class 已失效、新 class 尚未套上」的裸按鈕，屬預期，以 `pnpm build` 或 dev server 無解析錯誤為該階段的收斂條件，畫面正確性留到呼叫端全部改完再驗。
