/**
 * Roadmap 清單／引用解析的原始輸出 → App 型別（純函式，web 與桌面版共用，design D2）。
 *
 * 與 normalize-archived、normalize-parked 同一套分工：route／desktop 層只做 IO，
 * 規劃檔對 openspec 不可見，標題、狀態字、分組、開頭段切分、引用解析全在這裡現場算。
 * 三件事集中同一個模組：
 * - `normalizeRoadmapList`：Requirement 規劃檔清單／清單分組／清單卡片內容。
 * - `splitRoadmapSections`：Requirement 開頭段重排／拆分與進度提前，供詳情面板使用
 *   （一次讀回全文、不開第二支詳情通道，design D1——面板直接對清單裡每一項的 `body`
 *   呼叫這支函式）。
 * - `resolveRoadmapRef`／`buildRoadmapRefContext`：Requirement 引用連結，同時供本模組
 *   自己解析「屬於」欄與日後 markdown-it 渲染規則（design D4）重用。
 */

import type {
  RoadmapFileProbe,
  RoadmapGroup,
  RoadmapListProbe,
  RoadmapListResult,
  RoadmapRefContext,
  RoadmapRefResolution,
  RoadmapRefsProbe,
  RoadmapRelationRow,
  RoadmapSections,
  RoadmapSummary,
} from './types'
import { splitDatePrefix } from './normalize-archived'

/** Available 組第二條件所需的四個段落標題（Requirement 清單分組） */
const REQUIRED_SECTIONS = ['開始的條件', '拆分與進度', '動工前必知', '已否決的做法']

/** 清單呈現順序，也是排序鍵——組內另依檔名字母序（Requirement 清單分組） */
const GROUP_ORDER: RoadmapGroup[] = ['in-progress', 'available', 'blocked', 'other']

const MD_REF = /^[^/]+\.md$/
const ARCHIVE_PATH_REF = /archive\/(\d{4}-\d{2}-\d{2}-[^/\s]+)/
const SPEC_PATH_REF = /specs\/([^/]+)\/spec\.md/
const KEBAB_REF = /^[a-z0-9]+(?:-[a-z0-9]+)+$/
/**
 * 「- **欄名**：內容」；冒號可全半形，欄名 1 到 6 個非空白字元（Requirement 開頭段重排）。
 * 冒號後不在正則裡吃空白——留給呼叫端 `.trim()`，避免 `\s*` 與後面的 `.*` 對空白字元
 * 的比對範圍重疊而觸發 catastrophic backtracking 的 lint 規則。
 */
const RELATION_LINE = /^-\s\*\*(\S{1,6})\*\*[:：](.*)$/

interface ParsedFile {
  name: string
  file: string
  title: string
  statusText: string
  group: RoadmapGroup
  progress: { completed: number, total: number } | null
  next: string | null
  /** 「前置」關係行的原文（未去除行內標記）；沒有這一行為 undefined */
  needsRaw: string | undefined
  /** 「屬於」關係行的原文；沒有這一行為 undefined */
  parentRaw: string | undefined
  mtime: number | null
  readFailed: boolean
  body: string
}

export function normalizeRoadmapList(probe: RoadmapListProbe): RoadmapListResult {
  if (probe.failure) {
    const { kind, message } = probe.failure
    // 兩類失敗分開呈現：非 openspec 專案沒得重試，讀取失敗才給 Try again（同 archived）
    return {
      ok: false,
      targetPath: probe.targetPath,
      error: kind === 'not-openspec-project'
        ? { kind: 'not-openspec-project', message: 'The target folder is not an OpenSpec project.', detail: message }
        : { kind: 'call-failed', message: 'Could not read the roadmap list.', detail: message },
    }
  }

  const parsedFiles = probe.files.map(parseFile)
  // 「屬於」欄只認本次清單內的規劃檔（rule 1 的存在性檢查），不需要 specs／changes／archived
  const partOfContext: RoadmapRefContext = { roadmapFiles: parsedFiles.map(p => p.file), specs: [], changes: [], archived: [] }
  const titleByFile = new Map(parsedFiles.map(p => [p.file, p.title]))

  const items: RoadmapSummary[] = parsedFiles
    .map((p): RoadmapSummary => ({
      name: p.name,
      file: p.file,
      title: p.title,
      statusText: p.statusText,
      group: p.group,
      progress: p.progress,
      next: p.next,
      needs: p.needsRaw !== undefined ? stripInlineMarkup(p.needsRaw) : null,
      partOf: resolvePartOf(p.parentRaw, partOfContext, titleByFile),
      mtime: p.mtime,
      readFailed: p.readFailed,
      body: p.body,
    }))
    .sort(byGroupThenFile)

  return {
    ok: true,
    targetPath: probe.targetPath,
    dirExists: probe.dirExists,
    offExists: probe.offExists,
    items,
    refs: probe.refs,
  }
}

function byGroupThenFile(a: RoadmapSummary, b: RoadmapSummary): number {
  const groupDiff = GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group)
  if (groupDiff !== 0)
    return groupDiff
  return a.file.localeCompare(b.file)
}

function parseFile(fileProbe: RoadmapFileProbe): ParsedFile {
  const name = fileProbe.name.replace(/\.md$/, '')
  const mtime = typeof fileProbe.mtime === 'number' ? fileProbe.mtime : null

  if (typeof fileProbe.content !== 'string') {
    // 單檔讀取失敗：以檔名列入 Other 組，其餘卡片正常（單筆降級，不拖垮清單）
    return {
      name,
      file: fileProbe.name,
      title: name,
      statusText: '',
      group: 'other',
      progress: null,
      next: null,
      needsRaw: undefined,
      parentRaw: undefined,
      mtime,
      readFailed: true,
      body: '',
    }
  }

  const { content } = fileProbe
  const titleLine = findTitleLine(content)
  const body = bodyWithoutTitle(content, titleLine?.index ?? null)
  const { title, statusText } = titleLine
    ? splitTitleLine(titleLine.line.slice(2))
    : { title: name, statusText: '' }
  // 「沒有 # 標題行」恆為 Other，不受下方 hasSection 條件影響（Requirement 清單分組）
  const group = titleLine ? classifyGroup(statusText, content) : 'other'
  const progress = parseProgress(statusText)
  const { split, relations } = splitRoadmapSections(body)

  return {
    name,
    file: fileProbe.name,
    title,
    statusText,
    group,
    progress,
    next: extractNext(split),
    needsRaw: relations.find(row => row.label === '前置')?.value,
    parentRaw: relations.find(row => row.label === '屬於')?.value,
    mtime,
    readFailed: false,
    body,
  }
}

/** 檔案中第一個以 `# ` 開頭的行（Requirement 規劃檔清單） */
function findTitleLine(content: string): { line: string, index: number } | null {
  const lines = content.split(/\r?\n/)
  const index = lines.findIndex(line => line.startsWith('# '))
  return index === -1 ? null : { line: lines[index]!, index }
}

/** 去掉第一個 `# ` 標題行（與其後緊接的空行）後的全文，供詳情面板渲染（design D1） */
function bodyWithoutTitle(content: string, titleIndex: number | null): string {
  if (titleIndex === null)
    return content
  const lines = content.split(/\r?\n/)
  lines.splice(titleIndex, 1)
  if (lines[titleIndex] !== undefined && lines[titleIndex]!.trim() === '')
    lines.splice(titleIndex, 1)
  return lines.join('\n')
}

/**
 * 標題行去 `# ` 後的文字拆成標題與狀態字：最後一段連續兩個以上空白之後的文字為狀態字
 * （Requirement 規劃檔清單）。用 `matchAll` 列出所有空白run、從後往前找第一個「後面接
 * 非空白字元」的 run 當分割點，而不是單一個 `(.*)\s{2,}(\S.*)` 正則——後者的 `.*` 與
 * `\s{2,}` 對空白字元的比對範圍重疊，會觸發 catastrophic backtracking 的 lint 規則。
 */
function splitTitleLine(text: string): { title: string, statusText: string } {
  const runs = [...text.matchAll(/\s{2,}/g)]
  for (let i = runs.length - 1; i >= 0; i--) {
    const run = runs[i]!
    const after = text.slice(run.index + run[0].length)
    if (/^\S/.test(after))
      return { title: text.slice(0, run.index).trim(), statusText: after.trim() }
  }
  return { title: text.trim(), statusText: '' }
}

function classifyGroup(statusText: string, content: string): RoadmapGroup {
  if (statusText === '卡著')
    return 'blocked'

  const frac = /^(\d+)\/(\d+)$/.exec(statusText)
  if (frac) {
    const completed = Number(frac[1])
    const total = Number(frac[2])
    if (completed > 0 && completed < total)
      return 'in-progress'
    if (completed === 0)
      return 'available'
    // N === M（全數完成未刪檔）或 N > M（畸形資料）：都不符合前三組，保守歸 Other
    return 'other'
  }

  if (statusText === '' && REQUIRED_SECTIONS.some(heading => hasHeading(content, heading)))
    return 'available'

  return 'other'
}

function hasHeading(content: string, heading: string): boolean {
  const lines = content.split(/\r?\n/)
  const inFence = fencedLines(lines)
  return lines.some((line, index) => !inFence[index] && line.startsWith(`## ${heading}`))
}

/**
 * 逐行標出哪些行落在 fenced code block 裡（含開關兩行）：fence 內的 `## `、關係行、
 * 表格列都只是範例文字，不參與切段與欄位抓取。依 CommonMark 的 fence 規則：開頭最多
 * 三格縮排、三個以上 ``` 或 ~~~，關閉須同一種字元且長度不短於開頭；沒關閉就延續到檔尾。
 */
function fencedLines(lines: string[]): boolean[] {
  let open: { char: string, length: number } | null = null
  return lines.map((line) => {
    const fence = /^ {0,3}(`{3,}|~{3,})/.exec(line)
    const info = fence ? line.slice(fence[0].length) : ''
    if (!open) {
      if (fence && !(fence[1]![0] === '`' && info.includes('`'))) {
        open = { char: fence[1]![0]!, length: fence[1]!.length }
        return true
      }
      return false
    }
    if (fence && fence[1]![0] === open.char && fence[1]!.length >= open.length && info.trim() === '')
      open = null
    return true
  })
}

function parseProgress(statusText: string): { completed: number, total: number } | null {
  const frac = /^(\d+)\/(\d+)$/.exec(statusText)
  return frac ? { completed: Number(frac[1]), total: Number(frac[2]) } : null
}

/** `## 拆分與進度` 表格中「狀態」欄含 `⬅` 那一列的「範圍」欄（Requirement 清單卡片內容） */
function extractNext(splitText: string): string | null {
  if (!splitText)
    return null

  const lines = splitText.split(/\r?\n/)
  const inFence = fencedLines(lines)
  const rows = lines.filter((line, index) => !inFence[index] && line.trim().startsWith('|'))
  if (rows.length === 0)
    return null

  const header = tableCells(rows[0]!)
  const statusIdx = header.indexOf('狀態')
  const scopeIdx = header.indexOf('範圍')
  if (statusIdx === -1 || scopeIdx === -1)
    return null

  for (const row of rows.slice(1)) {
    const cells = tableCells(row)
    if (cells.every(cell => /^:?-+:?$/.test(cell)))
      continue // 表格分隔線（`---`）
    if (cells[statusIdx]?.includes('⬅'))
      return cells[scopeIdx]?.trim() || null
  }
  return null
}

function tableCells(row: string): string[] {
  return row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim())
}

/**
 * 開頭段拆成導言與關係欄、`## 拆分與進度` 提前、其餘段落照原順序
 * （Requirement 開頭段重排、拆分與進度提前）。輸出的四塊都是 Markdown 字串／結構化列，
 * 供詳情面板（後續批次）直接渲染；不在這裡處理連結或圖示——那是 markdown-it 規則層的事
 * （design D4）。
 */
export function splitRoadmapSections(body: string): RoadmapSections {
  const { lead: rawLead, sections } = splitByH2(body)
  const { lead, relations } = extractRelations(rawLead)
  const splitIndex = sections.findIndex(section => section.heading === '拆分與進度')
  const split = splitIndex === -1 ? '' : sections[splitIndex]!.text.trim()
  const rest = sections
    .filter((_, index) => index !== splitIndex)
    .map(section => section.text.trim())
    .join('\n\n')
    .trim()

  return { lead, relations, split, rest }
}

function splitByH2(body: string): { lead: string, sections: { heading: string, text: string }[] } {
  const lines = body.split(/\r?\n/)
  const inFence = fencedLines(lines)
  const headingIndexes: number[] = []
  lines.forEach((line, index) => {
    if (!inFence[index] && line.startsWith('## '))
      headingIndexes.push(index)
  })

  const leadEnd = headingIndexes.length > 0 ? headingIndexes[0]! : lines.length
  const lead = lines.slice(0, leadEnd).join('\n')
  const sections = headingIndexes.map((start, i) => {
    const end = i + 1 < headingIndexes.length ? headingIndexes[i + 1]! : lines.length
    return { heading: lines[start]!.slice(3).trim(), text: lines.slice(start, end).join('\n') }
  })

  return { lead, sections }
}

function extractRelations(leadText: string): { lead: string, relations: RoadmapRelationRow[] } {
  const relations: RoadmapRelationRow[] = []
  const leadLines: string[] = []

  const lines = leadText.split(/\r?\n/)
  const inFence = fencedLines(lines)
  lines.forEach((line, index) => {
    const match = inFence[index] ? null : RELATION_LINE.exec(line.trim())
    if (match)
      relations.push({ label: match[1]!, value: match[2]!.trim() })
    else
      leadLines.push(line)
  })

  return { lead: leadLines.join('\n').trim(), relations }
}

/**
 * 去除行內 code 反引號與粗體記號，供卡片副行與複製標題呈現純文字
 * （Requirement 清單卡片內容、卡片的複製標題）。
 */
export function stripInlineMarkup(text: string): string {
  return text
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/__([^_]*)__/g, '$1')
    .trim()
}

/**
 * 「屬於」欄中第一個對得到本次清單內規劃檔的 `*.md` 引用，回傳其父項標題
 * （Requirement 清單卡片內容）。掃過該行所有行內 code，依序取第一個符合規則 1 形狀
 * 且存在的——不是單純取整行第一個反引號片段，行內可能還夾雜其他非 `.md` 的 code。
 */
function resolvePartOf(
  parentRaw: string | undefined,
  ctx: RoadmapRefContext,
  titleByFile: Map<string, string>,
): string | null {
  if (!parentRaw)
    return null

  const spans = [...parentRaw.matchAll(/`([^`]+)`/g)].map(match => match[1]!)
  const code = spans.find(span => MD_REF.test(span))
  if (!code)
    return null

  const resolved = resolveRoadmapRef(code, ctx)
  if (!resolved || resolved.kind !== 'roadmap')
    return null

  return titleByFile.get(resolved.target) ?? null
}

/**
 * `refs`（IO 層列舉的四類名稱）＋本次清單的規劃檔檔名，組成 `resolveRoadmapRef` 要的比對
 * 清單。`changes` 把 active 與 parked 併在一起——「別頁連結」規則本身不分兩者，見
 * `RoadmapRefContext` 的欄位說明（design D5：真的要分流時是 Changes 頁自己再查兩份清單）。
 */
export function buildRoadmapRefContext(items: RoadmapSummary[], refs: RoadmapRefsProbe): RoadmapRefContext {
  return {
    roadmapFiles: items.map(item => item.file),
    specs: refs.specs,
    changes: [...refs.changes, ...refs.parked],
    archived: refs.archived,
  }
}

/**
 * 行內 code 對到的目標，依「規格 > change（含 parked）> 封存」的優先序（Requirement
 * 引用連結）。五條規則依序測試，採第一條成立者；成立＝形狀符合且目標確實存在於
 * `ctx` 給的清單——不存在就試下一條，全部不成立回傳 `null`（維持一般行內 code）。
 */
export function resolveRoadmapRef(code: string, ctx: RoadmapRefContext): RoadmapRefResolution | null {
  const text = code.trim()
  if (!text)
    return null

  // 規則 1：形如 `名稱.md`、不含 `/`，且該檔存在於本次規劃檔清單
  if (MD_REF.test(text) && ctx.roadmapFiles.includes(text))
    return { kind: 'roadmap', target: text }

  // 規則 2：含 `archive/YYYY-MM-DD-名稱`（前面可以有任意路徑），該目錄存在於封存目錄
  const archiveMatch = ARCHIVE_PATH_REF.exec(text)
  if (archiveMatch && ctx.archived.includes(archiveMatch[1]!))
    return { kind: 'archived', target: archiveMatch[1]! }

  // 規則 3：整段為 `YYYY-MM-DD-名稱`，且該目錄存在於封存目錄
  if (ctx.archived.includes(text))
    return { kind: 'archived', target: text }

  // 規則 4：含 `specs/<id>/spec.md`，且目標專案存在該 spec
  const specMatch = SPEC_PATH_REF.exec(text)
  if (specMatch && ctx.specs.includes(specMatch[1]!))
    return { kind: 'spec', target: specMatch[1]! }

  // 規則 5：整段為小寫英數與連字號組成、至少含一個連字號，依序比對 spec → change → 封存
  if (KEBAB_REF.test(text)) {
    if (ctx.specs.includes(text))
      return { kind: 'spec', target: text }
    if (ctx.changes.includes(text))
      return { kind: 'change', target: text }
    const archivedMatch = ctx.archived.find(dir => splitDatePrefix(dir).name === text)
    if (archivedMatch)
      return { kind: 'archived', target: archivedMatch }
  }

  return null
}
