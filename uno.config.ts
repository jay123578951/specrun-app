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
