## Context

動機與現值對照見 proposal.md - Why／What Changes。這裡只補實作面必須先釘死的事實：

- **進出場值三頁共用一處**：`src/App.vue:36` 的 `PANEL_MOTION` 四個 class 字串，由同一個 `<Transition>` 服務 Artifact／Spec／Archived 三個面板（`App.vue:148-177`）。
- **面板外殼也已共用**：`src/components/PanelShell.vue` 是三頁的骨架，內容識別鍵 `scrollKey` 與捲動歸零 watcher 已在（`PanelShell.vue:23-26`）；`ArtifactPanel.vue:34` 的 `scrollKey` 是 `${changeName} ${currentTab}`。
- **Wind4 的 `translate-x-*` 產出 `translate:` 屬性、不是 `transform:`**（實測 `unocss@66.7.5` + `presetWind4`：`.translate-x-full{--un-translate-x:100%;translate:var(--un-translate-x) var(--un-translate-y)}`）。同時 `transition-[transform,opacity]` 會展開成 `transition-property:transform,translate,scale,rotate,opacity`，所以位移吃得到過場。
- **rem 級距受 14px 根字級縮放**：`translate-x-10` = `2.5rem` = 35px，不是 40px。
- **`renderMarkdown` 是 async**（`src/markdown/render.ts:78`，首次要建 highlighter），暖機後只剩 microtask；而 `ArtifactPanel.vue:157` 的 `:key="file.path"` 意味著換 change 時 `MarkdownView` 本來就會 remount。

## Goals / Non-Goals

**Goals**

- 進出場改成短位移＋同拍淡入，改動集中在 `PANEL_MOTION` 一處。
- 原地換內容有柔化，但**不延後內容、不吃掉身分回饋的即時性**。
- reduced motion 下的降級是「淡入淡出保留、位移移除」，且此行為由現有規則自然成立，不新增分支。

**Non-Goals**

- 不重寫 `<Transition>` 的結構、不改面板寬度／定位／層次。
- 不把動效值搬進 `uno.config.ts` 的 theme，也不新增 motion token。
- 不為手感微調預留可調參數（沒有 runtime 旋鈕，值就寫在呼叫端）。
- 不碰 `ui-motion` skill 的固定表本身；本文件只記「在表格允許範圍內選了哪個值、為什麼」（依 `docs/ui-structure-decisions.md:211`，數值表不在 design 重抄）。

## Decisions

### D1 抄結構、不抄 cross-blur

參考稿把 blur 當作補償位移的第三個屬性。**不採用**，三個理由疊起來足夠：

1. `ui-motion` 的屬性清單是 transform + opacity（clip-path 是唯一被祝福的第三個），blur 僅在 icon swap 破例。
2. 這面板是全高大面積（1440 視窗下約 896×900），每幀一次 filter pass 的成本與一顆 16px 圖示不是同一個量級。
3. 面板內是密集文字。2px blur 落在文字上讀起來是「沒對焦」，不是「柔和」——參考稿的 P3 面板裡只有色塊與線條佔位，沒有這個問題。

**替代方案**：只在極短的前段掛 blur（例如前 60ms）。否決——為了一味佐料付兩套時間軸的複雜度，而且它要解的問題（位移太短讀不出開闔）已由 opacity 解掉。

### D2 位移回歸全幅右緣（v3）

40px 短位移是配合 fade 的產物（v1／v2：位移只需指出方向，「開到底」的感覺由 fade 補）。fade 移除後（D3 v3）短位移不能留：**純移動的進出場必須從完全隱藏的位置起步**，否則是「憑空出現再滑一小段」，讀起來是故障。位移回歸 `translate-x-full`（Wind4 產出 `translate: 100%`，即面板自身寬度）；原「40px 釘死 px」的討論隨 fade 一併作廢。

### D3 純位移進出場，fade 整組移除（v3，兩輪驗收後定案）

演進：

1. **v1 同拍**（40px 短位移＋同時長同曲線的 fade，抄參考稿）——`--sr-ease-out` 前段極陡，透明度貼著位置走，位移主要行程全落在半透明窗口（進場看清楚時 40px 只剩 ~6px；退場 ~40ms 內 opacity 掉到 0.4 以下）。回饋：「fade 把移動吃掉」。
2. **v2 解耦**（位移走滿全程 in-out，opacity 進場 100ms 先到位／退場 delay 後同步收尾）——可見行程已達 ~96%／~88%，回饋仍是 fade 的存在感蓋過移動。
3. **v3 定案：fade 整組拿掉，回歸全幅純位移（drawer 式）**。fade 原本的兩個任務都換人扛：「補足短位移的開闔感」不再需要（位移回歸全幅，D2）；「reduced motion 的淡入淡出降級」改由幽靈 opacity 承接（見下）。

配方：進場 `translate 300ms var(--sr-ease-drawer)`（100% → 0）、退場 `translate 220ms var(--sr-ease-drawer)`。不回舊版 220／150ms `--sr-ease-out`——那正是「高速掃過」的原始配方；時長與曲線的選擇見 D4／D5。

**幽靈 opacity（reduced motion 的降級機制）**：`enter-from`／`leave-to` 保留 `opacity-0`，但正常模式的 opacity 過場僅 **1ms**（進場貼起點、退場 delay 到終點前 1ms），肉眼不可感知，實質是純位移。`prefers-reduced-motion` 下 `.sr-motion` 把 transition-property 蓋成 opacity，opacity 承接 shorthand 第一組時值（translate 排第一 → 300／220ms、無 delay），降級成純淡入淡出——「MUST NOT 瞬間出現」不因 fade 移除而回歸破功（這是本 change 一開始要修的 bug）。

**否決的替代案**：

| 方案 | 否決理由 |
|---|---|
| 保留 40px 短位移、只拿掉 fade | 面板憑空出現再滑 40px，讀起來是故障 |
| 回舊值 220ms `--sr-ease-out` | 就是原始「≈4000px/s 掃過」的配方，本 change 的起點 |
| reduced motion 接受瞬間出現 | 違反本 change 自己補進 spec 的 MUST NOT，也違反「降級不是關閉」 |

### D4 300ms 進 / 220ms 出

- 全幅（1440 視窗下 ≈896px）要讀得出「滑行」，時長取專案上限 300ms（`docs/ui-structure-decisions.md:199` 的 150–300ms 級）；再短就回到掃過。
- 退場 220ms = 進場的 73%，落在 `ui-motion` 要求的 60–75%。
- 不往 300ms 以上走：這個面板一天開幾十次，「更從容」的代價是每次都多等。

### D5 新增 `--sr-ease-drawer`，全幅滑動兩條既有曲線都不合

v1／v2 堅持不新增 token，但那是短位移＋fade 的前提。全幅純位移下：`--sr-ease-out` 初速約為平均速度的 4.35 倍（896px 下前段爆衝，正是舊版掃過感的來源）；`--sr-ease-in-out` 慢起，Esc 後面板有 2–3 幀不動、回饋遲滯。採 `ui-motion` token 表既有的 drawer 曲線 `cubic-bezier(0.32, 0.72, 0, 1)`（iOS 式抽屜：初速約 2.25 倍平均、收尾長），命名 `--sr-ease-drawer` 進 `tokens.css`——取自 skill 的固定表，不是手捏值。

### D6 reduced motion 的修復是副產品，規則不動、只改註解

現況失效的機制與 `interactions.css:51` 的註解說法不同：`.sr-motion` 的 `transform: none !important` 對 Wind4 的 `translate-x-*` 是**空砲**（D2 的實測：產出的是 `translate:` 屬性），真正擋掉位移的是 `transition-property: opacity !important`；而面板本來沒有 opacity 變化，於是整段變成瞬移。

v3 拿掉可見的 fade 後，這條降級改靠 D3 的幽靈 opacity 維持：from／to class 保留 `opacity-0`、正常模式 opacity 過場僅 1ms；`.sr-motion` 蓋掉 transition-property 後 opacity 承接完整時值，降級仍是**淡入淡出、位移瞬間歸位**。本輪仍**不改 `.sr-motion` 的宣告**，只把註解改成「面板與 toast」並記下 `transform: none` 對 translate 型 utility 無效這件事——否則下一個人會照著錯的機制推理。

（`transform: none` 這行不刪：手寫 CSS 的 `.card-lift:hover` 仍靠它降級。）

### D7 原地換內容：穩定元素上的 class 切換，快速連按不動畫

**做什麼**：`PanelShell` 的捲動容器（`PanelShell.vue:57`，已有 `ref="scroller"`）在 `scrollKey` 變動時，於**同一個既有 watcher** 內把自己壓到 `opacity-0`（無過場），待新內容 patch 進 DOM 後再放回 1，走 **120ms** 的 opacity 過場。header（標題、tabs）與露出區卡片高亮完全不參與——那是身分回饋，見 D8。

**時序**：Vue watcher 是 pre-flush，先於新內容的 DOM patch，所以「壓到 0」永遠發生在新內容可見之前，不會看到新內容先全亮再閃一下。放回 1 用**雙 rAF**，確保 `opacity: 0` 這個狀態先被瀏覽器算過一次，過場才會真的播。

**快速連按直接不動畫**：距上次切換 <200ms 就只換內容、不播淡入。理由是 `ui-motion` 的頻率閘門——鍵盤連續切換屬「不該動畫」那一格；不設這道閘，按住 ↑↓ 會讓內容區一直被壓回 0，讀起來是閃爍。單次點擊或單次按鍵照樣有淡入。

**兩個 class 分支互斥、不同時存在**（`opacity-0 transition-none` ⇄ `transition-opacity duration-120 ease-[var(--sr-ease-out)]`），避免 UnoCSS 同 layer 的 `transition-none` 與 `transition-opacity` 互相打斷（同 property 的覆蓋順序依產生順序，是踩過的坑）。

**替代方案**：

| 方案 | 否決理由 |
|---|---|
| keyed wrapper ＋ `@starting-style` | 會 remount 內容子樹：內容區（`role=tabpanel`、`tabindex=0`）的焦點被丟回 body；而且每個新元素都必然從 0 起手，做不到「連按時不動畫」的合併。 |
| WAAPI `element.animate()` | 一行就夠，但曲線值得從 token 層搬進 JS（或多一次 `getComputedStyle` 讀取）；專案的動效值一律住在 CSS／utility 層。 |
| Vue `<Transition mode="out-in">` | 退場先播完才進場＝新內容被延後，直接違反 spec 的「MUST NOT 因過場而延後新內容出現」。 |
| CSS keyframes | `ui-motion` 明文：快速觸發的元素用 transition，不用 keyframes（keyframes 會重頭播，不會 retarget）。 |

### D8 只淡內容區，header／tabs 與卡片高亮即時

切換的第一個問題是「我現在在哪」。標題、tab 底線、露出區卡片高亮都是這個問題的答案，連按時必須即時；內容才是需要柔化的那塊（切換前後都是滿版文字，硬切讀起來像畫面被抽換）。這條分界也讓 D7 的實作只需碰捲動容器一個元素。

**順帶收益**：`scrollKey` 本來就含 `currentTab`（`ArtifactPanel.vue:34`），所以換 tab 也會吃到同一個淡入。刻意接受——它與換 change 是同一種「內容整片換掉」。

### D9 改動落點

| 檔案 | 改什麼 |
|---|---|
| `src/App.vue:36-41` | `PANEL_MOTION`：from／to class 為 `translate-x-full opacity-0`（opacity 是幽靈值）；active class 指向 `.panel-reveal-*` 手寫 class（`sr-motion` 保留） |
| `src/components/PanelShell.vue` | 捲動容器加 opacity class 分支；既有 `scrollKey` watcher 內加淡入觸發與 200ms 閘門 |
| `src/styles/interactions.css` | 新增 `.panel-reveal-enter`／`.panel-reveal-leave`（per-property 時值，utility 組不出）；`.sr-motion` 註解修正（D6） |
| `src/styles/tokens.css` | 新增 `--sr-ease-drawer`（D5） |

三頁面板不需各自改動；`SpecPanel`／`ArchivedPanel`／`ArtifactPanel` 零改動。

## Risks / Trade-offs

- **疊字與兩段式的風險隨 fade 移除而消滅**（v3 全程不透明）→ 換來的新風險是**掃過感回歸**：靠 300ms＋drawer 曲線壓低初速；驗收慢放確認讀起來是「滑入」而非「掃過」，並隔天再看一次。
- **幽靈 opacity 是隱晦機制**（1ms 過場肉眼不可見、只為 reduced motion 存在）→ D3／D6 與 css 註解雙處記錄；驗收必須實測 reduced motion 下仍是淡入淡出。
- **「同一幀同時加上 transition 與新值」在某些引擎不會播過場** → D7 用雙 rAF 把 `opacity: 0` 的狀態先送去算一次；驗收必須真的看到淡入，不能只看 class 有沒有掛上。
- **冷路徑：首次載入 shiki 時內容晚到**（`render.ts:21` 的 highlighter 首建），淡入可能播在空白上、內容隨後才出現 → 一個 session 只發生一次，且既有規格對冷路徑本來就是「空著或小型載入提示」，不額外處理。
- **極窄視窗（`PANEL_MIN_WIDTH` 420px）下全幅距離變短、同 300ms 會顯得偏慢** → 可接受，不做斷點分支（本專案是桌面 App 形態，不做響應式斷點）。
- **200ms 閘門是個魔數** → 值本身不精確要緊，它只需要大於一般鍵盤重複間隔（~30–50ms）而小於刻意的兩次點擊；寫成具名常數並在註解說明它擋的是什麼。

## Migration Plan

無資料、無 API、無依賴變更。回滾＝還原 `PANEL_MOTION`、刪掉 `.panel-reveal-*` 與 `--sr-ease-drawer`、還原 `PanelShell` 的 watcher 段落。
