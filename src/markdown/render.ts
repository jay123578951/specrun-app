import type { MarkdownIt as Md } from 'markdown-it'
import type { HighlighterCore } from 'shiki/core'
import MarkdownIt from 'markdown-it'
import taskLists from 'markdown-it-task-lists'
import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'

/**
 * artifact 的 Markdown → HTML（design D5）。
 *
 * `html: false` 是刻意保留的預設：內容雖來自本機檔案，仍不開 raw HTML 注入面。
 * shiki 走 fine-grained bundle——語言逐個 import，首包不吞下整包語法定義。
 */

/** artifact 內實際出現的語言；沒命中的 fence 退回無高亮，不是錯誤 */
const LANGS = ['markdown', 'typescript', 'vue', 'bash', 'json']
const THEME = 'vitesse-dark'

let highlighterPromise: Promise<HighlighterCore> | null = null

function getHighlighter(): Promise<HighlighterCore> {
  highlighterPromise ??= createHighlighterCore({
    themes: [import('shiki/themes/vitesse-dark.mjs')],
    langs: [
      import('shiki/langs/markdown.mjs'),
      import('shiki/langs/typescript.mjs'),
      import('shiki/langs/vue.mjs'),
      import('shiki/langs/bash.mjs'),
      import('shiki/langs/json.mjs'),
    ],
    // JS regex engine：省下 oniguruma 的 wasm 載入，這批語言用不到它的進階語法
    engine: createJavaScriptRegexEngine(),
  })
  return highlighterPromise
}

/** 兩種模式各自一個 md 實例（唯讀／可勾選），首次用到才建 */
const mdPromises = new Map<boolean, Promise<Md>>()

async function getMarkdownIt(interactive: boolean): Promise<Md> {
  let promise = mdPromises.get(interactive)
  if (!promise) {
    promise = createMarkdownIt(interactive)
    mdPromises.set(interactive, promise)
  }
  return promise
}

async function createMarkdownIt(interactive: boolean): Promise<Md> {
  const highlighter = await getHighlighter()
  const loaded = new Set(highlighter.getLoadedLanguages())

  const md = new MarkdownIt({
    html: false,
    linkify: false,
    highlight: (code, lang) => {
      const alias = normalizeLang(lang)
      if (!alias || !loaded.has(alias))
        return '' // 交回 markdown-it 的預設 escape 路徑
      return highlighter.codeToHtml(code, { lang: alias, theme: THEME })
    },
  })

  // 一律以 disabled 起手：plugin 的 enabled 是模組層共用變數、且在 render 時才讀，
  // 兩個實例給不同值會互相蓋掉。可互動的差異改由下面自己的 rule 補上。
  md.use(taskLists, { enabled: false, label: false })
  if (interactive)
    applyTaskInteractivity(md)
  applyLinkPolicy(md)
  return md
}

export interface RenderOptions {
  /** tasks 單檔時開啟：checkbox 可點並帶上來源行號（design D6） */
  interactive?: boolean
}

export async function renderMarkdown(source: string, options: RenderOptions = {}): Promise<string> {
  const md = await getMarkdownIt(options.interactive === true)
  return md.render(source, {})
}

const CHECKBOX_PREFIX = '<input class="task-list-item-checkbox"'

/**
 * 把來源行號寫進 checkbox 的 `data-line`，點擊經事件委派取回——寫入請求送的是
 * 「行號＋行原文」，checkbox 自己得帶著行號，點下去才問得出要改哪一行。
 * 行號取自 inline token 的 `map`（該 task 行的起點），與 store 手上的來源字串同一份。
 * 排在 plugin 的 `github-task-lists` 之後（push 進 core chain 尾端）。
 */
function applyTaskInteractivity(md: Md): void {
  md.core.ruler.push('specrun-task-interactivity', (state) => {
    for (const token of state.tokens) {
      if (token.type !== 'inline' || !token.map)
        continue

      const checkbox = token.children?.[0]
      if (!checkbox || checkbox.type !== 'html_inline' || !checkbox.content.startsWith(CHECKBOX_PREFIX))
        continue

      checkbox.content = checkbox.content
        .replace(' disabled=""', '')
        .replace('<input ', `<input data-line="${token.map[0]}" `)
    }
    return true
  })
}

/** shiki 的語言 id 有限，常見別名先攤平；未知者一律無高亮 */
function normalizeLang(lang: string): string | null {
  const key = lang.trim().toLowerCase()
  if (!key)
    return null
  const alias: Record<string, string> = {
    md: 'markdown',
    ts: 'typescript',
    sh: 'bash',
    shell: 'bash',
    zsh: 'bash',
    console: 'bash',
    js: 'typescript',
    javascript: 'typescript',
  }
  return alias[key] ?? (LANGS.includes(key) ? key : null)
}

/**
 * 外部 URL 一律開新分頁；桌面版現在也是開在 App 內建的 webview 裡。等桌面版接上「請系統
 * 用預設瀏覽器開這個網址」這個能力，才會改成把外部 URL 丟給使用者的預設瀏覽器開。
 * 相對路徑連結降級為非互動文字——artifact 互跳與編輯器開啟整組延後，留一個點了沒反應的
 * `<a>` 只會讓人一直點。
 */
function applyLinkPolicy(md: Md): void {
  const isExternal = (href: string) => /^(?:https?:|mailto:)/i.test(href)
  // open/close 得成對輸出同一種標籤。render 是同步的、token 又保證配對，
  // 這支 md 實例獨佔一個堆疊就夠——不必把狀態塞進 env。
  const stack: boolean[] = []

  md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
    const token = tokens[idx]!
    const external = isExternal(String(token.attrGet('href') ?? ''))
    stack.push(external)

    if (!external)
      return '<span class="md-link-inert">'

    token.attrSet('target', '_blank')
    token.attrSet('rel', 'noopener noreferrer')
    return self.renderToken(tokens, idx, options)
  }

  md.renderer.rules.link_close = (tokens, idx, options, _env, self) => {
    return stack.pop() === false ? '</span>' : self.renderToken(tokens, idx, options)
  }
}
