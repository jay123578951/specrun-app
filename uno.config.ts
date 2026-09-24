import type { Theme } from 'unocss/preset-wind4'
import { defineConfig, presetIcons, presetWind4 } from 'unocss'

/**
 * UI 字級：封閉集合。五階全表見 docs/ui-structure-decisions.md，
 * 想用第六階必須先改這裡，蔓延就會在 review 現形。
 * mono 與 sans 共用同一組數值——字體差異交由 font-mono 表達，不做光學補償。
 * 閱讀階梯（Markdown 正文）不在本檔：它的唯一消費者是 v-html 產出的 HTML，
 * 吃不到 utility，定義處為 src/styles/markdown.css，兩者刻意不共用。
 * 只有 ui-base 綁行高，其餘階承接父層行高。
 */
const text = {
  'ui-xs': { fontSize: '11px' }, // 群組標籤、徽章
  'ui-sm': { fontSize: '13px' }, // 相對時間、tabs、chip、n/m 進度數字、次要按鈕
  'ui-base': { fontSize: '15px', lineHeight: '1.6' }, // UI 內文、按鈕、side item、專案名、路徑
  'ui-title': { fontSize: '17px' }, // 卡片標題：change 名、spec id、archived 項目名
  'ui-lg': { fontSize: '21px' }, // 詳情面板主標題、側欄 wordmark
}

/** 圓角：同為封閉集合；pill 走 preset 內建的 rounded-full。 */
const radius = {
  DEFAULT: '5px', // 卡片、按鈕、輸入框
  lg: '8px', // 面板、modal
}

export default defineConfig<Theme>({
  presets: [
    presetWind4(),
    presetIcons({
      extraProperties: { 'display': 'inline-block', 'vertical-align': 'middle' },
    }),
  ],

  /**
   * 語意化組合：元件寫 shortcut、不在 template 堆長串 utility。
   * 互動八態（ui-interaction-states）在這裡一次備齊，元件只補 loading／error 的內容差異。
   */
  shortcuts: {
    // 鍵盤 focus ring：accent-bright、2px、永不做動畫（淡入的 ring 等於鍵盤使用者前半段沒有指示）。
    // 名稱刻意避開 focus-ring——那會先被解析成 focus: 變體＋ring utility。
    'kbd-focus': 'focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-accent-bright focus-visible:outline-offset-2',

    /**
     * 按鈕體系：尺寸兩階（btn 主階／btn-sm 窄脈絡）＋ icon-btn 自成一路（正方形、尺寸由圖示決定），
     * 色調正交覆蓋在尺寸階上（btn-danger）。專案只有一種按鈕色調，所以低調外觀直接內建在尺寸階裡，
     * 不拆成「盒子 class ＋ 色調 class」併寫——真的出現實心主按鈕再開名稱空間。
     * 點擊面積外擴（::before）刻意用釘死的 px 而非 rem 級距：根字級 14px 下 -inset-2 只有 7px，
     * 無障礙下限不該隨排版基準漂移（見 design.md - D4）。
     */

    // 主階按鈕：default／hover／focus／active／disabled 齊備；loading 由呼叫端接 aria-busy＋轉圈圖示
    'btn': 'inline-flex items-center gap-2 h-11 px-4 rounded border border-line text-ui-base text-text-2 cursor-pointer transition-[background-color,color,transform] duration-150 ease-[var(--sr-ease-out)] hover:bg-surface-hover hover:text-text active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-55 kbd-focus',

    // 側欄項目：唯一消費者是尚未實作的 Settings（C1 design D8「死項不灰化」）。
    // 原本連 cursor 也一併扣住，現已撤回：指標形狀在全站統一表示「這是可點的東西」，
    // 不再兼差當「這顆點了有沒有用」的訊號——那由灰化與 disabled 表達。
    'side-item': 'flex items-center gap-2.5 px-2.5 py-2 rounded text-ui-base text-text-2 cursor-pointer transition-colors duration-150 ease-[var(--sr-ease-out)] hover:bg-surface-hover hover:text-text',

    // 側欄的可點項目（＋ Add project／Show all）：side-item 的活版本，備齊 focus 與 press
    'side-action': 'w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-ui-base text-text-2 cursor-pointer transition-colors duration-150 ease-[var(--sr-ease-out)] hover:bg-surface-hover hover:text-text active:bg-line/50 disabled:cursor-not-allowed disabled:opacity-55 kbd-focus',

    // 專案清單項：current 的 accent 底由呼叫端加，這裡只備齊 hover／focus／press／disabled
    'project-item': 'w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-left cursor-pointer transition-colors duration-150 ease-[var(--sr-ease-out)] hover:bg-surface-hover active:bg-line/50 disabled:cursor-not-allowed disabled:opacity-55 kbd-focus',

    // 窄脈絡專用：服務側欄 224px 的就地確認列，主階兩顆並排會把那列撐得比專案列還高
    'btn-sm': 'inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded border border-line text-ui-sm text-text-2 cursor-pointer transition-[background-color,color] duration-150 ease-[var(--sr-ease-out)] hover:bg-surface-hover hover:text-text active:bg-line/50 disabled:cursor-not-allowed disabled:opacity-55 kbd-focus',

    // 列內動作：貼在既有一列（tabs 列的 trailing）右端的第三階，不是更小的 btn-sm。
    // 差別在盒子——btn／btn-sm 的邊框在自己那塊留白裡才成立，塞進 h-12 的 tabs 列
    // 上下只剩 5.25px，一個有邊框的盒子逼近底下的 border-b 就會顯得擠。
    // 這一階索性不畫盒子：靜態是一行帶圖示的文字，與同列的 tab 文字同一條視覺基線，
    // hover 才浮出底色。高度仍給 h-8（＝ icon-btn 的視覺尺寸）撐住點擊面積。
    'btn-inline': 'inline-flex items-center justify-center gap-1.5 h-8 px-2 rounded text-ui-sm text-text-2 cursor-pointer transition-[background-color,color] duration-150 ease-[var(--sr-ease-out)] hover:bg-surface-hover hover:text-text active:bg-line/50 disabled:cursor-not-allowed disabled:opacity-55 kbd-focus',

    // 破壞性動作（移除確認）的色調變體，用法 class="btn-sm btn-danger"：
    // error 色只在邊框與文字，底色留給 hover——靜態就整片紅太吵。
    // important 不可省：要壓過的 border-line／text-text-2 與這裡來自同一條規則，
    // 勝負只由 CSS 產生順序決定（不是 class 屬性的書寫順序），漏了會靜默變灰。
    'btn-danger': '!border-error/50 !text-error hover:!bg-error/15 active:!bg-error/25',

    // 文字輸入：邊框恆為 1px、focus ring 走預留的 outline 槽，任何狀態都不動 layout
    'input-quiet': 'h-8 w-full min-w-0 px-2 rounded border border-line bg-bg text-ui-sm text-text font-mono outline-solid outline-2 outline-transparent outline-offset-1 transition-[background-color,border-color] duration-150 ease-[var(--sr-ease-out)] placeholder:text-text-3 hover:bg-surface-hover focus-visible:outline-accent-bright disabled:cursor-not-allowed disabled:opacity-55',

    // 清單列：卡片的扁平版（specs／archived 都沒有進度條可放，一列就是名稱＋幾個數字）。
    // 抬升與選中底色由呼叫端切換，與 ChangeCard 同一套姿態
    'list-row': 'w-full flex items-center gap-3 px-4.5 py-3 rounded border border-line text-left cursor-pointer transition-[transform,background-color] duration-150 ease-[var(--sr-ease-out)] kbd-focus',

    // artifact tab：選中底線的責任已移交 ArtifactTabs 的 indicator（design D6），
    // 這裡的 border-b-2 border-transparent 只留作佔位（拿掉行盒會少 2px）；
    // 呼叫端仍切文字色，transition-colors 為它而留。
    // h-12 在根字級 14px 下 ＝ 42px，是能守住密集工具介面點擊面積下限的最小級距
    'tab-item': 'h-12 px-3 border-b-2 border-transparent text-ui-sm cursor-pointer transition-colors duration-150 ease-[var(--sr-ease-out)] hover:text-text active:bg-surface-hover active:text-text kbd-focus',

    // 麵包屑的頁下拉觸發項：與 btn-inline 同一階（不畫盒子、hover 才浮底色），
    // 但文字取 text——它是麵包屑裡唯一的焦點，旁邊的專案名與數量才是 text-3
    'crumb-page': 'inline-flex items-center gap-1.5 h-8 px-2 rounded text-ui-sm text-text cursor-pointer transition-[background-color,color] duration-150 ease-[var(--sr-ease-out)] hover:bg-surface-hover active:bg-line/50 kbd-focus',

    // 下拉選單項：唯一消費者是上面那顆觸發項展開的三頁清單；current 的 accent 底由呼叫端加
    'menu-item': 'w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left text-ui-sm text-text-2 cursor-pointer transition-colors duration-150 ease-[var(--sr-ease-out)] hover:bg-surface-hover hover:text-text active:bg-line/50 kbd-focus',

    // 圖示按鈕：視覺 28px、實際點擊面積外擴到 44px（28 ＋ 8×2；::before 撐開，不動版面）
    'icon-btn': 'relative h-8 w-8 flex shrink-0 items-center justify-center border border-line rounded text-text-2 cursor-pointer transition-[background-color,color] duration-150 ease-[var(--sr-ease-out)] before:absolute before:-inset-[8px] before:content-[\'\'] hover:bg-surface-hover hover:text-text active:bg-line/50 disabled:cursor-not-allowed disabled:opacity-55 kbd-focus',

    // 具名層級，template 不出現裸 z 值。menu 疊在內容之上（卡片自身有 z-10）、
    // 但仍在 modal 之下；toast 疊在 modal 之上——Settings 內觸發的失敗提示必須看得見
    'z-menu': 'z-30',
    'z-modal': 'z-50',
    'z-toast': 'z-100',
  },

  theme: {
    // 語意色：值定義於 src/styles/tokens.css，這裡只接 var()
    colors: {
      'bg': 'var(--sr-bg)',
      'surface': 'var(--sr-surface)',
      'surface-hover': 'var(--sr-surface-hover)',
      'line': 'var(--sr-line)',
      'text': 'var(--sr-text)',
      'text-2': 'var(--sr-text-2)',
      'text-3': 'var(--sr-text-3)',
      'accent': 'var(--sr-accent)',
      'accent-bright': 'var(--sr-accent-bright)',
      'parked': 'var(--sr-parked)',
      'done': 'var(--sr-done)',
      'error': 'var(--sr-error)',
      'overlay': 'var(--sr-overlay)',
      // Roadmap 卡片／面板標題的行內 code（真 DOM 節點，非 v-html）沿用 markdown 行內 code 同一色板
      'code-bg': 'var(--sr-code-bg)',
      'code-text': 'var(--sr-code-text)',
    },
    font: {
      ui: 'var(--sr-font-ui)',
      mono: 'var(--sr-font-mono)',
      tc: 'var(--sr-font-tc)',
      serif: 'var(--sr-font-serif)',
    },
    text,
    radius,
  },

  // theme 是深合併，字級與圓角要「封閉」得把 preset 預設階整組換掉
  configResolved(config) {
    config.theme.text = text
    config.theme.radius = radius
  },
})
