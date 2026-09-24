import type { MarkdownIt as Md, Token } from 'markdown-it'
import type { HighlighterCore } from 'shiki/core'
import type { RoadmapRefKind, RoadmapRefResolution } from '../api/types'
import MarkdownIt from 'markdown-it'
import taskLists from 'markdown-it-task-lists'
import { createHighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'

/**
 * artifact 的 Markdown → HTML。
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
  // roadmap 的兩支規則一律套用（唯讀／可互動兩個實例皆是）：兩者都只在 `env` 帶對應 key
  // 時才動作，不傳 roadmap 選項時退回原本輸出，兩個實例套用與否不影響任何既有呼叫端（design D4）
  applyRoadmapRefs(md)
  applySplitTableIcons(md)
  return md
}

export interface RoadmapRenderOptions {
  /** `code_inline` 內容對得到時才轉為 `.md-ref` 連結；對不到或不傳整個選項時維持一般行內 code（design D4） */
  resolveRef: (code: string) => RoadmapRefResolution | null
  /** 開啟時，把內容中「狀態」欄的三個固定值換成圖示——僅在渲染 `## 拆分與進度` 那一段時傳 true（design D4） */
  splitTable?: boolean
}

export interface RenderOptions {
  /** tasks 單檔時開啟：checkbox 可點並帶上來源行號 */
  interactive?: boolean
  /** roadmap 面板專用：引用連結解析與拆分表圖示；不傳時輸出與現況逐字相同（3.1 硬要求） */
  roadmap?: RoadmapRenderOptions
}

export async function renderMarkdown(source: string, options: RenderOptions = {}): Promise<string> {
  const md = await getMarkdownIt(options.interactive === true)
  return md.render(source, options.roadmap
    ? { resolveRoadmapRef: options.roadmap.resolveRef, roadmapSplitTable: options.roadmap.splitTable === true }
    : {})
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
 * 外部 URL 一律標記 `target="_blank"`、`rel="noopener noreferrer"`：畫面端
 * （`MarkdownView.vue` 的點擊委派）會擋掉這裡的預設行為、改交給執行形態自己的
 * 資料入口開啟（桌面形態丟給系統預設瀏覽器，web 形態開新分頁），這兩個屬性是
 * 接住那段若失效時的後備行為（design D4）——這裡只負責標記，不負責開啟。
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

/** `renderMarkdown` 透過 `env` 傳給兩支 roadmap 規則的資料（design D4）；不傳等同 `{}` */
interface RoadmapRenderEnv {
  resolveRoadmapRef?: (code: string) => RoadmapRefResolution | null
  roadmapSplitTable?: boolean
}

/** `env` 型別在 markdown-it 是 `Record<string|symbol, unknown>`，用 `unknown` 收，讀取端自己收斂形狀 */
function getRoadmapEnv(env: unknown): RoadmapRenderEnv {
  return (env ?? {}) as RoadmapRenderEnv
}

/** 連結目標是別頁時附的提示文案；roadmap（面板內原地切換）不附提示（Requirement 引用連結的跳轉） */
const CROSS_PAGE_LABEL: Record<RoadmapRefKind, string | null> = {
  roadmap: null,
  spec: 'Specs',
  change: 'Changes',
  archived: 'Archived',
}

/**
 * `.md-ref` 的 `data-ref-target` 值來自檔名／spec id／change 名稱，理論上是安全字元集，
 * 仍照信任邊界輸入驗證的底線轉義——不假設檔案系統內容必然不含 `"` `<` `>` `&`
 */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * `code_inline` 先問 `env.resolveRoadmapRef`：對得到才包成
 * `<button type="button" class="md-ref" data-ref-kind data-ref-target>`，跨頁的目標
 * （spec／change／archived）另附 `.md-ref-dest` 提示；對不到、或呼叫端沒傳解析函式（`env` 沒有
 * 這個 key）時，呼叫 markdown-it 原本的 `code_inline` 規則——維持 `html: false` 唯一 escape
 * 出口，不自己再 escape 一次 `token.content`（design D4、3.1 硬要求：不傳選項時逐字相同）。
 * `fence`／`code_block` 各自有自己的 renderer rule，不受這支影響。
 */
function applyRoadmapRefs(md: Md): void {
  const fallback = md.renderer.rules.code_inline!

  md.renderer.rules.code_inline = (tokens, idx, options, env, self) => {
    const token = tokens[idx]!
    const resolved = getRoadmapEnv(env).resolveRoadmapRef?.(token.content)
    if (!resolved)
      return fallback(tokens, idx, options, env, self)

    const code = fallback(tokens, idx, options, env, self)
    const page = CROSS_PAGE_LABEL[resolved.kind]
    const hint = page ? `<span class="md-ref-dest">${page} ↗</span>` : ''
    return `<button type="button" class="md-ref" data-ref-kind="${resolved.kind}" data-ref-target="${escapeAttr(resolved.target)}">${code}${hint}</button>`
  }
}

/** 拆分表狀態欄的三個固定值 → 圖示 class、`title` 說明文字、SVG path（Requirement 拆分與進度提前與狀態圖示） */
const STATUS_ICONS: Record<string, { cls: string, label: string, path: string }> = {
  '✅': { cls: 'done', label: 'Done', path: '<path d="M20 6 9 17l-5-5"/>' },
  '⬅ 接下來': { cls: 'next', label: 'Next up', path: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>' },
  '卡著': { cls: 'blocked', label: 'Blocked', path: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>' },
}

/**
 * 「拆分表模式」旗標開啟時：在 core rule 找出表頭為「狀態」的欄，該欄 inline 內容對照
 * `STATUS_ICONS` 三個固定值換成圖示 span、該列的 `tr` 加狀態 class；其餘值照原文（Requirement）。
 * 旗標關閉（未傳 roadmap 選項，或 `splitTable` 不是 `true`）時整支不動作，一般表格不受影響。
 * 單一 pass：thead 的表頭文字在 `thead_close` 才知道欄位順序全貌，所以先記下每個 `th` 的
 * inline token 索引，等找到「狀態」欄再回頭替表頭那格加 `.md-status-col`（不折行）。
 */
function applySplitTableIcons(md: Md): void {
  md.core.ruler.push('specrun-roadmap-split-icons', (state) => {
    if (getRoadmapEnv(state.env).roadmapSplitTable !== true)
      return true

    let headerCells: string[] = []
    let headerTokens: Token[] = []
    let inThead = false
    let inTbody = false
    let statusCol = -1
    let cellIndex = -1
    let rowToken: Token | null = null

    for (const token of state.tokens) {
      switch (token.type) {
        case 'table_open':
          headerCells = []
          headerTokens = []
          statusCol = -1
          cellIndex = -1
          rowToken = null
          break
        case 'thead_open':
          inThead = true
          break
        case 'thead_close':
          inThead = false
          statusCol = headerCells.indexOf('狀態')
          if (statusCol !== -1)
            headerTokens[statusCol]?.attrJoin('class', 'md-status-col')
          break
        case 'tbody_open':
          inTbody = true
          break
        case 'tbody_close':
          inTbody = false
          break
        case 'tr_open':
          cellIndex = -1
          if (inTbody)
            rowToken = token
          break
        case 'th_open':
          if (inThead) {
            cellIndex++
            headerTokens[cellIndex] = token
          }
          break
        case 'td_open':
          if (inTbody) {
            cellIndex++
            if (cellIndex === statusCol)
              token.attrJoin('class', 'md-status-col')
          }
          break
        case 'inline':
          if (inThead)
            headerCells[cellIndex] = token.content.trim()
          else if (inTbody && cellIndex === statusCol && rowToken)
            applyStatusIcon(token, rowToken)
          break
      }
    }

    return true
  })
}

/** 單一子節點是純文字、且內容精確符合三個固定值之一才轉換，其餘（含其他標記包住的同樣文字）照原文 */
function applyStatusIcon(inlineToken: Token, rowToken: Token): void {
  const icon = STATUS_ICONS[inlineToken.content.trim()]
  const child = inlineToken.children?.[0]
  if (!icon || inlineToken.children!.length !== 1 || child!.type !== 'text')
    return

  child!.type = 'html_inline'
  child!.content = `<span class="md-status-icon md-status-icon-${icon.cls}" role="img" aria-label="${icon.label}" title="${icon.label}">`
    + `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${icon.path}</svg>`
    + `</span>`
  rowToken.attrJoin('class', `md-status-row-${icon.cls}`)
}
