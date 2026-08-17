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
import { extractWhy } from './why-summary'

// 進度解析與 archived 那一側共用（task-progress）、摘錄與 active 清單那一側共用
// （why-summary）；這裡續出是為了呼叫端不必知道它們搬了家
export { countTasks, extractWhy }

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
