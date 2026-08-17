/**
 * parked 清單／詳情的原始輸出 → App 型別（純函式，web 與 M4 Tauri 版共用）。
 *
 * 與 normalize.ts 的分工相同：route 只做 IO，所有解析集中在這裡。
 * 差別在資料源——parked change 對 openspec 不可見，所以進度與摘錄都是現場從檔案
 * 內容算出來的（design D4），metadata 只補 park 時間與快照路徑。
 */

import type {
  ArtifactFile,
  ArtifactView,
  ChangeDetailResult,
  ParkedDetailProbe,
  ParkedEntryProbe,
  ParkedListProbe,
  ParkedListResult,
  ParkedSummary,
} from './types'
import { countTasks, toTaskStatus } from './task-progress'

// 進度解析與 archived 那一側共用（task-progress）；這裡續出是為了呼叫端不必知道它搬了家
export { countTasks }

export function normalizeParkedList(probe: ParkedListProbe): ParkedListResult {
  if (probe.failure) {
    return {
      ok: false,
      error: { kind: 'call-failed', message: 'Could not read the parked list.', detail: probe.failure },
    }
  }

  const items = probe.entries.map(toParkedSummary).sort(byParkedAtDesc)
  return {
    ok: true,
    parkAvailable: probe.parkAvailable,
    ...(probe.reason ? { reason: probe.reason } : {}),
    items,
  }
}

/**
 * Parked 群組的排序：park 時間新→舊（spec 群組與排序）。
 * 時間未知的排在最後——它們沒有可比的位置，塞在中間只會讓順序讀起來像壞掉。
 */
function byParkedAtDesc(a: ParkedSummary, b: ParkedSummary): number {
  if (a.parkedAt === b.parkedAt)
    return a.name.localeCompare(b.name)
  if (a.parkedAt === null)
    return 1
  if (b.parkedAt === null)
    return -1
  return b.parkedAt - a.parkedAt
}

function toParkedSummary(entry: ParkedEntryProbe): ParkedSummary {
  const { completedTasks, totalTasks } = countTasks(entry.tasks ?? '')
  return {
    name: entry.name,
    completedTasks,
    totalTasks,
    status: toTaskStatus(completedTasks, totalTasks),
    parkedAt: toEpochMs(entry.parkedAt),
    summary: extractWhy(entry.proposal ?? ''),
  }
}

const WHY_HEADING = /^#{1,6}[ \t]+why[ \t]*$/i

/**
 * proposal `## Why` 的首句（到第一個句號為止），純機械抽取、不做 AI 加工
 * （docs/ui-structure-decisions.md 的卡片規格）。品質天花板就是 proposal 第一句的寫作品質。
 */
export function extractWhy(source: string): string {
  const lines = source.split(/\r?\n/)
  const start = lines.findIndex(line => WHY_HEADING.test(line.trim()))
  if (start === -1)
    return ''

  const paragraph: string[] = []
  for (const line of lines.slice(start + 1)) {
    const text = line.trim()
    // 下一個標題＝Why 段落結束；段落已開始時空行也是結束（只要第一段）
    if (text.startsWith('#'))
      break
    if (!text) {
      if (paragraph.length)
        break
      continue
    }
    paragraph.push(text)
  }

  return firstSentence(stripMarkdown(paragraph.join(' ')))
}

/**
 * 中英文句號都算句末；找不到句號就整段帶回（clamp 交給 CSS）。
 * 全形標點自己就是句末，半形 `.` 得跟著空白或結尾才算——否則 `design.md`、`e.g.`
 * 這類寫法會把句子攔腰切斷。
 */
function firstSentence(text: string): string {
  const end = text.search(/[。！？]|[.!?](?:\s|$)/)
  return end === -1 ? text : text.slice(0, end + 1)
}

/** 只去掉行內語法記號，不做重排；摘錄要的是可讀的一句話，不是還原後的 Markdown */
function stripMarkdown(text: string): string {
  return text
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

function toEpochMs(value: string | undefined): number | null {
  if (!value)
    return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

/**
 * parked 詳情：形狀與 active 詳情全等（同一組元件渲染），差別只在來源——
 * artifact 順序來自 park 當下的快照而非 CLI。唯讀是呼叫端的事（detail store 分流）。
 */
export function normalizeParkedDetail(probe: ParkedDetailProbe): ChangeDetailResult {
  const failLoad = (detail?: string): ChangeDetailResult => ({
    ok: false,
    error: { kind: 'call-failed', message: 'Could not load this parked change.', ...(detail ? { detail } : {}) },
  })

  if (probe.failure)
    return failLoad(probe.failure)
  if (!probe.changeName)
    return failLoad('The response carried no change name.')

  const artifacts: ArtifactView[] = []
  for (const artifact of probe.artifacts) {
    const files: ArtifactFile[] = []
    for (const entry of artifact.files) {
      // 列進來卻讀不到＝真失敗；已被刪掉的檔案在 route 端就不會出現（缺件不是錯誤）
      if (typeof entry.content !== 'string')
        return failLoad([`Could not read ${entry.path}.`, entry.error].filter(Boolean).join(' '))
      files.push({ path: displayPath(entry.path, probe.changeRoot), content: entry.content })
    }
    artifacts.push({ id: artifact.id, files, missing: files.length === 0 })
  }

  return { ok: true, detail: { name: probe.changeName, artifacts } }
}

function displayPath(absolute: string, changeRoot: string): string {
  const prefix = changeRoot.replace(/[/\\]+$/, '')
  if (prefix && absolute.startsWith(prefix))
    return absolute.slice(prefix.length).replace(/^[/\\]+/, '') || absolute
  return absolute
}
