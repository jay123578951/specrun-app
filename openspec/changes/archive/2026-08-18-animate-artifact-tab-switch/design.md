## Context

現況見 proposal.md - Why。實作面的既有條件：

- `ArtifactPanel.vue` 與 `ArchivedPanel.vue` 各自寫了一份幾乎相同的 tablist 標記（`role="tablist"` ＋ `v-for` 出 `tab-item`），選中態靠 `:class` 切 `border-accent-bright`；`tab-item` shortcut 的 `transition-colors` 已涵蓋 `border-color`，所以現在是原地換色。
- 兩處的 tabs 都套 `first:pl-0`（首個 tab 的底線對齊面板標題左緣），因此各 tab 的佔位不等寬也不等距。
- tabs 清單由 openspec CLI 回傳，名稱與數量都不寫死（custom schema 必須可用），archived 那側還會出現 `specs/<capability-path>` 這種長 tab 名。
- `PanelShell.vue` 已有一套換內容的淡入：watcher 監看 `scrollKey`，pre-flush 壓 `opacity: 0`、`nextTick` 後雙 rAF 放回，並用 `FADE_SUPPRESS_MS` 擋鍵盤連按。`scrollKey` 目前同時由 change 名與 tab 名組成，兩種切換共用同一組時值。
- 動效數值一律取自 ui-motion skill 的固定表，曲線只用 `tokens.css` 既有的 `--sr-ease-*`，不新增曲線。

## Goals / Non-Goals

**Goals:**

- 選中指示成為單一個會移動的物件，量測與滑動邏輯只有一份實作。
- 兩個面板的 tabs 行為同源，不靠「兩邊記得改成一樣」維持一致。
- 對齊在字體載入、tabs 換批、面板尺寸變動下都能自我修正。

**Non-Goals:**

- 不引入動畫函式庫（motion.dev 等）；本案沒有手勢、沒有彈簧需求。
- 不動 tabs 的資料來源、順序、fallback 規則（`artifact-view` 既有 requirement 不變）。
- 不重寫 `PanelShell` 的淡入機制，只調時值與觸發語意。
- 不碰 `SpecPanel`（它沒有 tabs）。

## Decisions

### D1：indicator 走絕對定位 bar ＋ `translate`／`scale`，不用 clip-path 複製列

tablist 內放一條 `position: absolute` 的 bar（高 2px，沿用原本 `border-b-2` 的視覺厚度），JS 量當前 tab **文字**的 `offsetLeft` / `offsetWidth` 再左右各加 3.5px 餘裕（見 D9），以個別屬性 `translate` 與 `scale` 定位，`transition: translate/scale 180ms var(--sr-ease-in-out)`。各 tab 自身不再帶選中底線，`border-b-2 border-transparent` 的佔位保留（避免行盒高度改變）。

**Alternatives considered：**

- **clip-path 複製整排 tabs**（ui-motion RECIPES 的推薦寫法）：複製一份 active 樣式的 tab list 疊上去、裁切到當前 tab。它的賣點是文字色與底線由同一個遮罩掃過、完美同步。本案文字色只從 `text-3` 走到 `text`，對比極輕，換一整份複製 DOM（還要保證兩份在任何字體 fallback 下同寬）不划算。
- **維持每顆 tab 各自的 border，只調 transition**：零風險但沒解決問題——原地換色永遠讀不出位移。
- **View Transitions API**：目標殼是 Tauri v2（macOS 走 WKWebView），跨平台 webview 的支援水位不一致，且為了一條底線引入這層機制不成比例。

### D2：bar 的基準寬度為 1px，`transform-origin: left`

bar 本體寬 1px，`scale: <文字寬 + 7> 1` 直接把量到的 px 映成縮放係數，`translate: <文字左緣 − 3.5>px 0`。好處是不依賴 tablist 的容器寬度——tabs 換批時容器寬會變，若採「bar 寬 100% ＋ scaleX = tabW / containerW」的寫法，容器寬變動會讓同一個 tab 的 scale 值跟著變，等於多一個要同步的來源。

用個別屬性（`translate` / `scale`）而非 `transform` 字串，理由與 `interactions.css` 既有的 `.card-dragging` 同源：reduced motion 才能只關掉位移、保留其餘。

### D3：換 change 不滑＝「無過場的一次就位」，由 identity key 判定

共用元件收兩個輸入：`items`（tabs）與 `current`（當前 tab id），外加一個 `identity`（change 名）。`current` 變而 `identity` 未變 → 正常播 transition；`identity` 變（或元件首次量測、tabs 集合換掉）→ 先關掉 transition、設定新位置、下一幀再掛回 transition。

**Alternatives considered：** 由呼叫端傳一個 `animate: boolean` prop。缺點是判斷邏輯回到兩個面板各寫一次，正是本案要消除的重複。

### D4：量測的三個觸發點，缺一會長期偏移

1. `current` / `items` 變動後（`nextTick`，等 DOM patch 完）。
2. `document.fonts.ready` — 字體走自架 `@fontsource`，首次繪製用 fallback，字體到位後 tab 寬度會變；不接這個，第一次開面板的 bar 會停在錯的寬度直到下次切換。
3. `ResizeObserver` 掛在 tablist 上 — 覆蓋 tabs 換批、面板寬變化導致換行、以及上面兩者漏掉的任何情形。有了它，前兩點其實是「讓第一幀就對」的最佳化，但仍保留：ResizeObserver 的回呼晚一幀，只靠它會看到一次跳位。

ResizeObserver 觸發的重量測 SHALL 走 D3 的「無過場就位」路徑——那是校正，不是使用者發起的切換，不該演出滑行。

### D5：內容淡入時值分兩檔，機制不動

`PanelShell` 的 `scrollKey` 拆成兩個輸入：`identityKey`（change 名）與 `contentKey`（tab 名）。兩者任一變動都走既有的雙 rAF 淡入與捲動歸零，差別只在時長：換 change 180ms、換 tab 160ms（換 change 是身分變更、幅度給大一階）。時長以 CSS 變數或 class 分支切換，不引入新機制。

`FADE_SUPPRESS_MS` 的連按閘門原封不動——它擋的是鍵盤 ↑↓ 連按（換 change），語意不變。

### D6：`tab-item` shortcut 的底線責任轉移

`tab-item` 保留 `border-b-2 border-transparent`（佔位）與 `transition-colors`（文字色仍需補間），選中態的 `border-accent-bright` 從呼叫端的 `:class` 移除，改由 bar 負責。呼叫端同時不再帶任何 `first:` 變體（原本的 `first:pl-0` 移除），首顆的對齊改由 D9 的列偏移承擔；表列的 `px-3` 內距因此對四顆 tab 一律成立。`docs/ui-structure-decisions.md` 的按鈕體系表列有 `tab-item`，高度與內距不變、不需改表。

### D7：reduced motion 降級

`@media (prefers-reduced-motion: reduce)` 下 bar 的 `transition-property` 縮到 `opacity`（與 `interactions.css` 既有 `.sr-motion` 同手法：位移瞬間歸位、透明度變化照播），選中指示仍在正確位置、仍看得出選了哪個。不做「整條 bar 消失、退回 per-tab border」的雙軌實作——兩套選中呈現會變成兩套要維護的視覺。

### D8：明確不做的三件事及理由

- **內容區左右側滑**：ui-motion RECIPES 明文「tab content crossfades only — never slides sideways, never animates height」。本專案的加強理由：四份 artifact 是要閱讀的長文、長度差距大，側滑會把捲動位置與高度落差一起演出來。
- **`<Transition mode="out-in">` 的真 crossfade**：out-in 把總時長推到 200ms 以上才看得出來，且會與 `PanelShell` 現有的 skeleton／loading／error 分支和捲動歸零時序打架——那套雙 rAF 寫法正是當初為了繞開這些才存在的。
- **內容區高度動畫**：同上，且 `height` 不在准許的動畫屬性內。

### D9：tabs 的對齊、間距、點擊面積、底線寬各自歸屬，不共用同一個屬性

首顆 tab 曾連續需要 `first:pl-0` → `first:px-0` → `first:mr-3` 三次特例補丁。根因不是補丁不夠好，是水平內距 `px-3`（根字級 14px 下 ＝ 10.5px）同時扛三個責任——點擊面積、tab 間距、文字起點。三者綁在同一個屬性上，動一個必然壞另外兩個：

| 補丁 | 修好 | 同時弄壞 |
|---|---|---|
| `first:pl-0` | 文字左緣對齊標題 | 底線右側多出 10.5px（文字在自己的底線裡偏左） |
| `first:px-0` | 底線貼齊文字 | 間距掉到 14px、點擊面積少 21px |
| `first:mr-3` | 間距補回 24.5px | 點擊面積仍然少 |

責任拆開後，特例自行消失：

| 責任 | 歸屬 |
|---|---|
| 列對齊標題左緣 | tablist 的 `-ml-3`（−10.5px）。與同一列既有的 `-mb-px` 是同一手法：列的對齊由列自己宣告，不叫某一顆 tab 去調自己的邊 |
| tab 間距 | `gap-1` ＋ 兩側 `px-3`，四顆一律 24.5px |
| 點擊面積 | `px-3`，四顆一致 |
| 底線寬 | 量文字（label 包一層 `<span>`）再左右各加 3.5px 餘裕 |

呼叫端的 tab class 因此回到單純的 `tab-item`，不帶任何 `first:` 變體。

餘裕 > 0 之後，文字左緣與底線左緣分開，只能挑一條落在標題線上。取**文字**：標題本身也是文字，兩行文字的左緣是讀者真正讀得到的那條線；底線是 2px 細線，探出 3.5px 不構成破線感。

餘裕取 3.5px（`--spacing` 一級）而非更大值：相鄰底線的間隙 ＝ 24.5 − 2×餘裕，取 7px 會壓到 10.5px、取 10.5px 只剩 3.5px 幾乎連成一條，分段感就沒了。

**Alternatives considered：**

- **四顆全部 `px-0` ＋ `gap-7`**：同樣零特例，且底線＝盒寬、連量測都不用改。但點擊面積退回文字寬（`tasks` 只剩約 35px），`active:bg-surface-hover` 的按壓底色會緊貼著字。與 `docs/ui-structure-decisions.md`「點擊面積用釘死 px、不隨排版基準漂移」的紀律方向相反。
- **放棄左緣對齊，四顆一律 `px-3` 不做任何偏移**：改動最小、也是零特例，而且直接回答了「這個要求值不值得」。否決理由是 header 的收合鈕、標題、tabs 目前共用同一條左緣，單獨讓 tabs 右移 10.5px 是看得出來的錯位；左緣對齊在密集工具介面是很便宜的秩序訊號，不拿它換。
- **繼續補 `first:` 變體**：每顆補丁修一個責任、壞另一個，因為三個責任始終在同一個屬性上。補到第三顆就該停下來看結構。

## Risks / Trade-offs

- **量測回 0 或量到隱藏節點** → tabs 不存在時兩個面板渲染的是 `h-12` 佔位 div，共用元件在 `items` 為空時整個不渲染 bar；量到的寬度為 0 時直接跳過該次更新，不把 bar 縮成看不見。
- **面板進場期間量測** → slideover 進場是 `translate` 位移、不改變寬度，`offsetLeft`／`offsetWidth` 在進場第一幀就是正確值；但若未來進場改成帶縮放，這裡會失準——D4 的 ResizeObserver 是這個情形的兜底。
- **bar 與 header 底線的層疊** → tablist 帶 `-mb-px` 疊在 header 的 `border-b` 上，bar 絕對定位在 tablist 底緣，需確認它壓在 header 底線之上而非被蓋掉；`z-index` 若要用，走 `uno.config.ts` 既有的具名層級慣例，template 不出現裸 z 值。
- **1px 基準寬的次像素** → 純色矩形放大不會失真，但 `scale` 值會是非整數 px 對應；bar 高度不受 X 縮放影響。若在某些縮放比下邊緣讀起來糊，改採 D2 的替代寫法（容器寬基準）即可，不影響其餘設計。
- **兩個面板的 store 形狀不同** → `detail` 與 `archived` 兩個 store 的 tab 狀態各自管理，共用元件只收 props / 發 emit，不直接讀 store，避免把兩個 store 的差異吸進元件。
- **時值感受**：160／180ms 是依 ui-motion 的頻率閘（切 tab 屬 tens-of-times/day → near-imperceptible only）取的下緣值。若驗收時仍讀不出，先驗證是不是 bar 沒動（對齊失準）再考慮加時長，MUST NOT 直接往 300ms 加。
