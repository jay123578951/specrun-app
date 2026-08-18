# UI 結構決策筆記

2026-08-14 explore 討論收斂結果。此文件是 D1（設計基礎）與 C1 起各 UI change 的 propose 底稿；風格層（tokens／主題／密度）尚未討論，見文末待辦。

討論順序遵循：元件盤點 → 佈局配置 → 風格（未完成）。

## 全域原則

- **App UI 文案一律使用英文**（介面文字、按鈕、空狀態、錯誤訊息）。
- 引擎外包 openspec CLI：列表渲染等被動操作絕不掛 LLM 或主動執行 validate。
- Specs／Archive／Parked／Changes 本質同構（清單 → Markdown），共用同一套 master-detail pattern，僅資料來源不同——低頻區域用共用元件收進來，不做專屬 UI。

## 整體佈局

兩欄：左側欄＋主區。無頂部 menu bar——導覽項目少，被側欄吸收。

```
┌──────────────┬──────────────────────────────────────┐
│ ◆ specrun    │ Active (2)                           │
│──────────────│ ▸ add-park-mechanism    3/7 · 2h ago │
│ PROJECTS     │   ▓▓▓▓▓▓░░░░░░░░                     │
│ ● specrun ③  │   「why 首句摘錄（兩行 clamp）」        │
│ ○ side-proj ①│ ▸ fix-watcher-debounce  1/4 · 1d ago │
│ ＋ Add       │                                      │
│──────────────│ PARKED (2)                           │
│ Specs        │ ⏸ old-idea       5/9 · parked 3w ago │
│ Archive      │ ⏸ big-refactor   0/12 · parked 1mo   │
│──────────────│                                      │
│ ⚙ Settings   │                                      │
└──────────────┴──────────────────────────────────────┘
```

### 側欄（上到下）

1. **Logo＋App 名**——套 Tauri 後兼作視窗拖曳區（macOS 無邊框需求）。
2. **專案清單**：全展開直接點擊切換（不用下拉）；過多才收合（C5 定案：超過 6 個折疊「Show all」，current 永遠可見）；每項掛進行中 change 數徽章；hover 浮現 ✕ 移除（C5 實作為就地確認列——側欄 224px 放不下對話框，文案講明只移出清單不動磁碟）；底部「＋ Add project」（web 過渡期展開貼路徑輸入列，Tauri 後換原生選資料夾）。
3. **Specs／Archive**：低頻入口，共用清單→Markdown pattern。
4. **⚙ Settings**：底部固定不捲動。

### 主區：雙群組同頁

- **Active＋Parked 兩群組，不分頁**——change 總量少（單專案 ~5 個），一頁掌握全部狀態，park/unpark 即群組間搬移。
- Parked 不是獨立區段，是 Changes 頁的一部分；切到 Specs/Archive 時看不到 parked（可接受，主頁就是重點頁）。
- **只要存在任何卡片，兩群組皆呈現**（含標題與數量 0）——狀態切換可用拖曳，落點必須恆常存在，否則「第一次以拖曳 park」永無可能成立。空群組不是空白一行，而是放得下卡片的落點區塊。
- 例外：兩群組皆空時 Parked 整段不顯示（`drag-to-switch-change-state` 定案）。此時沒有任何卡片可拖、落點無作用，滿版功能性 UI 只是新專案首屏的噪音；連帶 Active 空狀態文案不得提「自 Parked 拖回」——那個群組當下不存在。
- 排序：預設 lastModified 新→舊（roadmap 既有決策）。

## Change 卡片規格

| 元素 | 說明 |
|---|---|
| 標題 | change 名 |
| 長條進度條 | tasks 完成百分比，旁附 n/m 數字；一排卡片的進度條構成總覽視圖 |
| 相對時間 | 最後修改；parked 卡片改顯示停放時點（parked 3w ago） |
| Why 摘錄 | proposal `## Why` 首句（到第一個句號），**純機械抽取不做 AI 加工**，去 markdown 語法，CSS 兩行 clamp。品質天花板＝proposal 第一句寫作品質，接受之（反向形成寫作紀律） |
| hover 動作 | ⏸ Park（parked 為 ▶ Restore）／⧉ 複製 change 名稱到剪貼簿（貼終端用）／✕ 刪除整個 change 目錄（跳確認對話框） |

明確不放：artifact 完成度點列（propose 一口氣生完時全亮＝噪音，dogfood 後有需要再加）、schema 名、validate 狀態。

## 詳情檢視：收合變形（非換頁、非彈窗）

點開卡片 → 主區在同一畫面內變形：清單縮成窄軌，內容面板拿走其餘寬度（Markdown 需要完整橫寬，左右並排會一直換行——已否決三欄與固定兩欄 master-detail）。

```
┌─側欄─┬─窄軌────┬─內容面板──────────────────────────┐
│      │ scaff…  │ add-park-mechanism   [Open in editor]│
│ (不動)│▸add-park│ [proposal] design  specs  tasks     │
│      │ fix-wat…│─────────────────────────────────────│
│      │         │ ## Why                              │
│      │         │ （Markdown 全寬渲染）                │
└──────┴─────────┴─────────────────────────────────────┘
```

- **窄軌**：只留標題＋進度；點擊任一項或 ↑↓ 鍵盤直接切換 change，內容原地更新；當前項高亮。
- **Esc** 回全寬清單，捲動位置不丟。
- **artifact tabs**：依 `openspec status --json` 的 `artifactPaths` 動態列出（custom schema 必須可用）；**首次點開預設 proposal**（使用者掃描動線：先看 why）；**切換 change 時保持當前 tab**，目標 change 無該 artifact 才 fallback 回 proposal。
- **缺件 artifact 的 tab**：可點擊，點了顯示空狀態提示（不灰化禁用——避免「壞掉還是沒東西」的不確定感）。
- **specs 多檔**：串接成一頁往下捲，各檔前加檔名標頭（change 切小的慣例下多為 1–2 檔，省一層導航）。
- **tasks 檢視**：純 Markdown 渲染＋checkbox 可勾（C4，全 App 唯一寫入點；併發策略見 roadmap），不加額外輔助功能；勾選後窄軌與 tabs 列進度即時更新。
- **頭部**：標題＋動作（含「Open in editor」）；不放 schema／created 等 metadata。
- **動作按鈕區**（M3 才填）：位置預留於頭部右側。

## 行為政策

- **Markdown 內部連結**：同 change 的 artifact 連結 → 切 tab；其他檔案路徑 → 用編輯器開啟；外部 URL → 系統瀏覽器。
- **Watcher 即時回饋**（C3 資料層＋C7 視覺打磨）：外部（Claude Code／CLI）改動時，變更卡片短暫高亮、進度條補間動畫。設計意圖：App 是「監視器」不只是「查看器」——旁邊跑 `/srun:feat` 時進度條即時爬升是招牌時刻。
- **錯誤呈現**：暫時性錯誤（spawn 失敗、JSON 解析錯）→ toast 自動消失；CLI 完全不可用 → 主區常駐 banner＋導向設定頁。
- **空狀態**：無專案 → 引導加入目錄；專案內無 change → 空狀態文案（roadmap 既有決策）。

## 設定頁

| 區塊 | 內容 |
|---|---|
| openspec CLI | 路徑（自動偵測＋手動覆寫；macOS GUI 不繼承 shell PATH 的已知坑）＋偵測到的版本＋檢查更新——**只查 npm registry 顯示新版與更新指令，不代跑套件管理器**（引擎生命週期不歸殼管；且 CLI 更新可能帶 `--json` 格式變動，需人在場） |
| 編輯器 | 「Open in editor」使用哪個（系統預設／VS Code／自訂指令） |
| 外觀 | 主題切換（是否雙主題待風格討論） |
| Parked | 存放位置顯示（M2 起，先唯讀） |
| 關於 | App 版本；M4 套 Tauri 後加自我更新（updater plugin） |

設定頁開啟形態（overlay vs 主區切換）留待風格階段順帶定。

## 已否決項（附理由，防止重新發明）

| 項目 | 否決理由 |
|---|---|
| 三欄佈局／固定兩欄 master-detail | 壓縮 Markdown 橫寬導致一直換行 |
| 詳情用換頁 | 快速掃描情境要快進快出、保清單狀態 |
| modal 蓋板式 overlay | 留下的清單邊要可點擊切換（互動軌），收合變形更貼合 |
| 頂部區段 tabs（Changes/Specs/Archive/Parked 並列） | Parked 與 Changes 須同頁；Specs/Archive 低頻不配一級 tab |
| 專案下拉選單 | 要全展開快速切換 |
| 搜尋／過濾 | 單專案 ~5 change，為不存在的規模設計 |
| Command palette（⌘K） | 操作面太小，儀式感大於效率；↑↓＋Esc 已覆蓋掃描動線 |
| in-app 編輯 | 記入 ROADMAP 觀察項——先以「Open in editor」滿足（5% 成本吃 90% 需求）；成本在併發衝突與編輯體驗無底洞 |
| 摘錄用 LLM 加工 | 薄殼原則，被動渲染不掛 LLM |

**已推翻的否決項**

- **拖曳 park/unpark**（原否決理由：hover 按鈕已夠快，拖曳邊界情況不成比例）——`drag-to-switch-change-state` 重新評估後推翻。原判斷成立於「拖曳＝完整重排系統」的假設；實際只有兩個群組、群組內順序由資料層決定（不做手動排序），目的地永遠唯一，邊界情況遠小於原估，直接操作的收益完整保留。hover 按鈕保留為等價操作（鍵盤可及路徑），不因拖曳可用而移除。

## 風格層決策

路線合成：**antfu 暗色底 × 參考圖（Mondays/Sundays SaaS）的柔軟表層 × transitions.dev 動效語言**。柔軟感由留白與低對比承擔，不靠圓角。

### 定調

- **暗色優先**，亮色主題日後有需要再加（不預做雙主題）。
- **密度寬鬆**：App 資訊量本來不多，重點是 change 查看與管理；卡片內距充足、區塊留白慷慨。
- **圓角克制**：4–6px（明確否決參考圖的 12–16px 大圓角）。

### 色彩（v2 定稿，經 HTML 打樣人工確認）

使用者錨點色：`#2E5C6E`／`#080808`（但黑不全黑）／`#434343`；暗色偏好經 ghostty 主題 **TokyoNight Night** 校準——冷藍調底、非中性黑；accent 家族自 TokyoNight 色相取位、飽和度壓至錨點水位。v1 打樣反饋「層次太融為一體」→ v2 全體提亮一檔、層與層明度差加大；accent 自錨點 `#2E5C6E` 提亮至 `#3A7791`（色相不變，使用者已確認）。

| Token | 值 | 用途 |
|---|---|---|
| bg | `#11151A` | 視窗底（微藍冷、非全黑） |
| surface | `#1A1F27` | 卡片、側欄 |
| surface-hover | `#222834` | hover 抬升 |
| border | `#323B48` | 分隔線與卡片輪廓 |
| text | `#DFE5ED` | 主文字（非純白） |
| text-2 | `#A7B0BD` | 次要（時間、n/m） |
| text-3 | `#6C7583` | 摘錄、佔位 |
| accent | `#3A7791` | 品牌色：進度條填色、選中底、chip 底 |
| accent-bright | `#82B4C9` | active 文字、focus ring、圖示高亮 |
| parked | `#C4956B` | 霧橙（TokyoNight orange 降飽和） |
| done | `#6BAFA3` | 霧青綠（TokyoNight teal 降飽和） |
| error | `#C07886` | 霧紅（TokyoNight red 降飽和） |

打樣檔存於 `docs/style-preview.html`（瀏覽器開啟可看色板、字體、版面實際渲染），D1 實作 tokens 時以上表為準。

色彩紀律：全色板飽和度鎖同一低水位；accent 是唯一「顏色」，語意色是它的親戚；chip 用半透明色底（色相 10–15% alpha 底＋亮字），不做參考圖式多色粉彩。

### 字體（定稿，經打樣四組並排比較後人工選定）

- **UI**：Manrope（文案一律英文）——半幾何、字腔開闊，與寬鬆密度、微藍冷色板同一種呼吸感
- **Mono**：IBM Plex Mono——change 名稱、路徑（slug 本質，devtool 血統點綴，寬鬆語境裡唯一的「硬」元素）
- **中文**（Markdown 內容主體是繁中）：IBM Plex Sans TC，打包 subset（~1–2MB）；閱讀區 16px／行高 1.8／欄寬 68ch
- **Wordmark**：Lora（書法筆意現代襯線），只用於側欄 logo「specrun」一處
- 落選記錄：Inter（太通用無記憶點）、DM Sans、IBM Plex Sans（原 B 方案，打樣比較後改 Manrope）；wordmark 落選 Playfair Display（太華麗）、Instrument Serif

### 字級（定稿；2026-08-17 由 retune-type-scale 重整為五階，取代原十一階表）

**階數紀律：只有下表這些階，任何元件不得新增字級**（封閉集合實作於 `uno.config.ts` 的 `configResolved`）。相鄰階比值全部 ≥ 1.13，確保螢幕上肉眼可辨。

| Token | 值 | 用途 |
|---|---|---|
| ui-xs | 11px | 群組標籤（大寫＋字距）、徽章數字 |
| ui-sm | 13px | 相對時間、tabs、chip、n/m 進度數字、次要按鈕、路徑、輸入框 |
| ui-base | 15px / lh 1.6 | UI 內文、按鈕、side item、專案名 |
| ui-title | 17px | 卡片標題：change 名、spec id、archived 項目名 |
| ui-lg | 21px | 詳情面板主標題、側欄 wordmark |

- **原「參考點＝ghostty 終端 font-size 14 mono」的約束已由使用者解除。** 該參照系只對 mono 側成立，卻連帶把 sans（Manrope）側一起壓小，使 Changes 主頁最大字僅 14px、整頁扁平。解除後字級才能以 15px 內文為錨自由展開。
- **mono 不再有專用階**（原 `mono-lg`／`mono-base`／`mono-sm` 已廢除）：sans 與 mono 共用同一組數值，字體差異由 `font-mono` 表達。光學補償在原表就已明文放棄，保留三個平行階只是讓 token 數翻倍。
- **閱讀階梯已移出本表**，`read-*` 五個 token 一併廢除。理由：閱讀字級的唯一消費者是 `v-html` 產出的 Markdown HTML，它結構上吃不到 utility，實際值一直硬寫在 `src/styles/markdown.css`，token 只是一份會漂移的副本。現以該檔為唯一定義處，四階為 14（code／pre／table）／16（正文 lh 1.8、`h3`、`h4`）／19（`h2`）／22（`h1`）；層級靠字重與色階承擔，不全靠字級。日後若有元件真需要閱讀字級，直接掛 `.md-body`，不重建 token。
- 卡片標題列高不再用 `1.6em` 推算（標題 17／數字 13 混排後容器已無單一字級），七處統一為固定 `h-7`。
- 使用者全域字級調整（Cmd+/-）：記觀察項，M4 Tauri 套殼時評估 webview zoom，不進 D1。

### 按鈕尺寸（定稿；2026-08-17 由 enlarge-button-scale 收斂）

**尺寸兩階 ＋ 圖示鈕自成一路，色調正交覆蓋。** 下表一律寫根字級 14px 下的實際渲染值（rem utility 的標稱值 ×0.875），不寫標稱值——「以 16px 推算」正是上一輪四處註解與實際不符的來源。

| Shortcut | 高度 | 內距／字級 | 用途 |
|---|---|---|---|
| `btn` | 38.5px（`h-11`） | `px-4` 14px／`ui-base` 15px／圖示 14px | 主階：Refresh、Add project、Try again |
| `btn-sm` | 31.5px（`h-9`） | `px-3` 10.5px／`ui-sm` 13px | 窄脈絡專用：側欄 224px 的就地確認列 |
| `icon-btn` | 視覺 28px（`h-8 w-8`）・點擊 44px | 圖示 14px | 面板收合、面板 Refresh、卡片 park |
| `tab-item` | 42px（`h-12`） | `px-3`／`ui-sm` 13px | artifact／archived tabs |
| `btn-danger` | 無盒子 | — | 色調變體，用法 `class="btn-sm btn-danger"` |

- **低調外觀內建在尺寸階裡**，不拆成「盒子 class ＋ 色調 class」併寫。專案目前只有一種按鈕色調，讓每個呼叫端預先付兩個 class 的稅不划算；真要加實心主按鈕時再開名稱空間，遷移成本與現在相同。
- **`btn-danger` 的覆蓋必須帶 `!`**：它要壓過的 `border-line`／`text-text-2` 與自己來自同一條 UnoCSS 規則，勝負由 CSS 產生順序決定、不是 class 屬性的書寫順序，漏了會靜默變灰而不報錯。
- **點擊面積外擴用釘死的 px，不用 rem 級距**（`before:-inset-[8px]`、`before:-inset-[10px]`）。WCAG 2.5.5 的 44px 與 2.5.8 的 24px 是無障礙硬指標，不該隨排版基準漂移——`before:-inset-2` 在 14px 根字級下只有 7px，宣告 44px 實得 38.5px。視覺尺寸仍走 rem 級距（那本來就是排版的一部分），只有點擊面積這條下限脫鉤。
- **`tab-item` 的內距只管點擊面積，不兼差當對齊工具**：tabs 列要與面板標題左緣對齊，是由 tablist 的 `-ml-3` 抵掉首顆的左內距達成（與同一列的 `-mb-px` 同一手法：對齊是列的事，由列自己宣告）。曾經改用 `first:pl-0`／`first:px-0` 去雕第一顆的盒子，結果是內距同時扛點擊面積、tab 間距、文字起點三個責任，補一個必壞另外兩個。選中底線同理量文字而非盒寬（`ArtifactTabs.vue`，change `animate-artifact-tab-switch` design D9）。
- **`tab-item` 一改高度，兩個面板頭部的 `pb` 就得跟著重算**：頭部上下留白刻意不對稱，`pb` 是用來抵消 tabs 自帶的垂直置中空白（= (tab 高 − 行盒 20.8) ÷ 2），讓「標題→按鈕」與「標題→tabs」看起來等距。`ArtifactPanel` 與 `ArchivedPanel` 必須同值。
- **刻意的例外**：專案列的移除入口（`ProjectSwitcher.vue` 絕對定位的小按鈕）維持小尺寸、不外擴點擊面積。它疊在專案切換鈕上，放大等於從「切換專案」這個主要目標身上收回空間；它低於 WCAG 24px 是已知取捨，要處理得連該列的資訊層級一起重排。Markdown 的 task checkbox（13px，`markdown.css`）同樣不在本表——它的點擊面積受限於 `markdown-it-task-lists` 的 HTML 產出與事件委派，屬行為變更。

### 動效

- 原則：**任何操作都有動畫反饋**，豐富但短促（150–300ms 級）。
- 詞彙庫：transitions.dev（CSS 直接用；React 範例重寫為 Vue `<Transition>`）；具體數值與曲線由 ui-motion skill 表格接管。
- 招牌時刻：清單⇄窄軌 collapse morph／park·unpark 群組間搬移／checkbox 勾選＋進度條補間／watcher 更新卡片高亮／卡片 hover 浮起／toast 進出場。

### 實作決策（D1 design.md 素材，2026-08-14 補訂）

1. **Tokens 載體**：CSS variables 定義於 `:root`，UnoCSS theme 引用 `var()`，元件用語意化 utility（與 antfu-design skill 的 class-based semantic tokens 路線對齊）。
2. **字體管線**：字體套件自架打包，Manrope／IBM Plex Mono／Lora 走 `@fontsource`，IBM Plex Sans TC 走官方 `@ibm/plex-sans-tc`（fontsource 沒有這個家族），TC 用現成 unicode-range 分片；不依賴 CDN（Tauri 離線需求）。
3. **間距階**：4px 基準——4 / 8 / 12 / 16 / 24 / 32 / 48；寬鬆體現在預設取大一階（卡片內距 16–18、群組間 24–32）。
4. **圓角**：`rounded` 5px（卡片、按鈕、輸入框）／`rounded-lg` 8px（面板、modal）／`rounded-full` pill（chip、徽章、進度條）。
5. **Elevation**：不用 box-shadow，靠 surface 色階＋1px 邊框分層；陰影只保留浮層（dropdown、toast）一種弱陰影。
6. **Icon**：UnoCSS preset-icons ＋ Lucide。
7. 動效數值與互動八態不在 design 重抄——引用 ui-motion／ui-interaction-states skill 的固定表為規範。

### 後續

結構層＋風格層＋實作決策均已收斂 → D1 propose；結構層依本文件進 C1 起各 change 的 design wireframe。設定頁開啟形態（overlay vs 主區切換）於 D1 或 C1 design 時順帶定。
