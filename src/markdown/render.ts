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

let mdPromise: Promise<Md> | null = null

async function getMarkdownIt(): Promise<Md> {
  mdPromise ??= (async () => {
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

    // checkbox 只呈現狀態、不可互動（勾選是 C4 的事）；plugin 預設就帶 disabled
    md.use(taskLists, { enabled: false, label: false })
    applyLinkPolicy(md)
    return md
  })()
  return mdPromise
}

export async function renderMarkdown(source: string): Promise<string> {
  const md = await getMarkdownIt()
  return md.render(source, {})
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
 * design D6：外部 URL 新分頁開啟（M4 換系統瀏覽器）；相對路徑連結降級為非互動文字——
 * artifact 互跳與編輯器開啟整組延後，留一個點了沒反應的 `<a>` 只會讓人一直點。
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
