import type { Theme } from 'unocss/preset-wind4'
import { defineConfig, presetIcons, presetWind4 } from 'unocss'

/**
 * 字級：封閉集合。十階全表見 docs/ui-structure-decisions.md，
 * 想用第十一階必須先改這裡，蔓延就會在 review 現形。
 * 只有 ui-base 與 read-base 綁行高，其餘階承接父層行高。
 */
const text = {
  'ui-base': { fontSize: '14px', lineHeight: '1.6' }, // UI 內文、按鈕、side item
  'ui-sm': { fontSize: '12.5px' }, // tabs、相對時間、chip、hover 動作
  'ui-xs': { fontSize: '11px' }, // 群組標籤、徽章
  'mono-lg': { fontSize: '20px' }, // 詳情面板主標題（單獨成列，旁邊沒有按鈕壓比例）
  'mono-base': { fontSize: '14px' }, // change 名、路徑（與終端字級對齊）
  'mono-sm': { fontSize: '11.5px' }, // n/m 進度數字、徽章數字
  'read-base': { fontSize: '15px', lineHeight: '1.85' }, // Markdown 正文
  'read-h1': { fontSize: '20px' },
  'read-h2': { fontSize: '18px' },
  'read-h3': { fontSize: '15.5px' },
  'read-code': { fontSize: '13px' }, // inline code
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

    // 次要按鈕：default／hover／focus／active／disabled 齊備；loading 由呼叫端接 aria-busy＋轉圈圖示
    'btn-quiet': 'inline-flex items-center gap-1.5 h-9 px-3 rounded border border-line text-ui-sm text-text-2 transition-[background-color,color,transform] duration-150 ease-[var(--sr-ease-out)] hover:bg-surface-hover hover:text-text active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-55 kbd-focus',

    // 側欄項目：D8 死項不灰化——保留 hover 態，但不給 pointer cursor（點了不會有事）
    'side-item': 'flex items-center gap-2.5 px-2.5 py-1.5 rounded text-ui-base text-text-2 cursor-default transition-colors duration-150 hover:bg-surface-hover hover:text-text',

    // 側欄的可點項目（＋ Add project／Show all）：side-item 的活版本，備齊 focus 與 press
    'side-action': 'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-ui-base text-text-2 transition-colors duration-150 hover:bg-surface-hover hover:text-text active:bg-line/50 disabled:cursor-not-allowed disabled:opacity-55 kbd-focus',

    // 專案清單項：current 的 accent 底由呼叫端加，這裡只備齊 hover／focus／press／disabled
    'project-item': 'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-left transition-colors duration-150 hover:bg-surface-hover active:bg-line/50 disabled:cursor-not-allowed disabled:opacity-55 kbd-focus',

    // 側欄用的緊湊按鈕；h-8 與 input-quiet 同高，成排時不會高低不齊
    'btn-quiet-sm': 'inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded border border-line text-ui-sm text-text-2 transition-[background-color,color] duration-150 hover:bg-surface-hover hover:text-text active:bg-line/50 disabled:cursor-not-allowed disabled:opacity-55 kbd-focus',

    // 破壞性動作（移除確認）：error 色只在邊框與文字，底色留給 hover——靜態就整片紅太吵
    'btn-danger': 'inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded border border-error/50 text-ui-sm text-error transition-[background-color,color] duration-150 hover:bg-error/15 active:bg-error/25 disabled:cursor-not-allowed disabled:opacity-55 kbd-focus',

    // 文字輸入：邊框恆為 1px、focus ring 走預留的 outline 槽，任何狀態都不動 layout
    'input-quiet': 'h-8 w-full min-w-0 px-2 rounded border border-line bg-bg text-mono-sm text-text font-mono outline-solid outline-2 outline-transparent outline-offset-1 transition-[background-color,border-color] duration-150 placeholder:text-text-3 hover:bg-surface-hover focus-visible:outline-accent-bright disabled:cursor-not-allowed disabled:opacity-55',

    // spec 清單列：卡片的扁平版（specs 沒有進度／時間可放，一列就是名稱＋數量）。
    // 抬升與選中底色由呼叫端切換，與 ChangeCard 同一套姿態
    'spec-row': 'w-full flex items-center gap-3 px-4.5 py-3 rounded border border-line text-left transition-[transform,background-color] duration-150 ease-[var(--sr-ease-out)] kbd-focus',

    // artifact tab：選中態的底線與文字色由呼叫端切換。40px 高是密集工具介面的點擊面積下限
    'tab-item': 'h-10 px-3 border-b-2 border-transparent text-ui-sm transition-colors duration-150 hover:text-text active:bg-surface-hover active:text-text kbd-focus',

    // 圖示按鈕：視覺 28px、實際點擊面積外擴到 44px（::before 撐開，不動版面）
    'icon-btn': 'relative h-7 w-7 flex shrink-0 items-center justify-center border border-line rounded text-text-2 transition-[background-color,color] duration-150 before:absolute before:-inset-2 before:content-[\'\'] hover:bg-surface-hover hover:text-text active:bg-line/50 disabled:cursor-not-allowed disabled:opacity-55 kbd-focus',

    // 具名層級，template 不出現裸 z 值
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
