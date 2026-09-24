/**
 * archived 清單／詳情的原始輸出 → App 型別（純函式，web 與日後的 Tauri 版共用）。
 *
 * 與 normalize-parked 的分工相同：route 只做 IO，所有解析集中在這裡。
 * 資料源同樣是檔案層直讀，所以日期、進度、順序全都是這裡算出來的
 * ——openspec CLI 不認識 archived change，沒有引擎答案可沿用。
 */

import type {
  ArchivedDetailProbe,
  ArchivedEntryProbe,
  ArchivedListProbe,
  ArchivedListResult,
  ArchivedSummary,
  ArtifactView,
  ChangeDetailResult,
} from './types'
import { countTasks, toTaskStatus } from './task-progress'

/** archive 的目錄命名慣例 `YYYY-MM-DD-<name>` */
const DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})-(.+)$/

export function normalizeArchivedList(probe: ArchivedListProbe): ArchivedListResult {
  if (probe.failure) {
    const { kind, message } = probe.failure
    // 兩類失敗分開呈現：非 openspec 專案沒得重試，讀取失敗才給 Try again
    return {
      ok: false,
      targetPath: probe.targetPath,
      error: kind === 'not-openspec-project'
        ? { kind: 'not-openspec-project', message: 'The target folder is not an OpenSpec project.', detail: message }
        : { kind: 'call-failed', message: 'Could not read the archived list.', detail: message },
    }
  }

  return {
    ok: true,
    targetPath: probe.targetPath,
    items: probe.entries.map(toArchivedSummary).sort(byArchivedAtDesc),
  }
}

function toArchivedSummary(entry: ArchivedEntryProbe): ArchivedSummary {
  const { completedTasks, totalTasks } = countTasks(entry.tasks ?? '')
  const { name, archivedAt } = splitDatePrefix(entry.dir)

  return {
    dir: entry.dir,
    name,
    archivedAt,
    completedTasks,
    totalTasks,
    status: toTaskStatus(completedTasks, totalTasks),
  }
}

/**
 * 目錄名拆成日期與名稱兩欄，卡片才不用把日期在名稱裡再讀一次。
 * 前綴不成立（手動搬移、命名偏離慣例）就整名照列、不顯示日期——清單不炸是底線。
 *
 * 對外匯出供 normalize-roadmap 的引用解析重用（規則 5.3「封存目錄去掉日期前綴後同名」）
 * ——同一份「去日期前綴」邏輯只該有一處，避免兩邊對「哪些算日期前綴」的認知分岔。
 */
export function splitDatePrefix(dir: string): { name: string, archivedAt: string | null } {
  const match = DATE_PREFIX.exec(dir)
  if (!match || !isRealDate(match[1]!))
    return { name: dir, archivedAt: null }

  return { name: match[2]!, archivedAt: match[1]! }
}

/**
 * 形狀對不代表日期存在：`2026-02-31` 會被 Date 靜靜捲成 3/3。
 * 原樣轉回來才算數——排序依日期，讓錯的日期混進來只會讓順序讀起來像壞掉。
 */
function isRealDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
}

/**
 * 清單排序：日期新→舊、同日名稱序、無日期墊底。
 * 無日期的排最後——它們沒有可比的位置，塞在中間只會讓順序讀起來像壞掉。
 */
function byArchivedAtDesc(a: ArchivedSummary, b: ArchivedSummary): number {
  if (a.archivedAt === b.archivedAt)
    return a.name.localeCompare(b.name)
  if (a.archivedAt === null)
    return 1
  if (b.archivedAt === null)
    return -1
  // `YYYY-MM-DD` 的字典序就是時間序，不必先轉成日期物件
  return b.archivedAt.localeCompare(a.archivedAt)
}

/**
 * archived 詳情：形狀與 active／parked 詳情全等（同一組元件渲染），差別只在來源
 * ——tabs 是 route 現場列舉的，每個 tab 恰好一個檔案。唯讀由呼叫端保證
 * （archived store 沒有寫入面）。
 */
export function normalizeArchivedDetail(probe: ArchivedDetailProbe): ChangeDetailResult {
  const failLoad = (detail?: string): ChangeDetailResult => ({
    ok: false,
    error: { kind: 'call-failed', message: 'Could not load this archived change.', ...(detail ? { detail } : {}) },
  })

  if (probe.failure)
    return failLoad(probe.failure)
  if (!probe.changeName)
    return failLoad('The response carried no change name.')

  const artifacts: ArtifactView[] = []
  for (const tab of probe.tabs) {
    // 列進來卻讀不到＝真失敗（列舉與讀取之間檔案被動過），不是缺件——archived 的
    // tab 全部來自現場列舉，本來就只會有既存檔案
    if (typeof tab.content !== 'string')
      return failLoad([`Could not read ${tab.path}.`, tab.error].filter(Boolean).join(' '))

    artifacts.push({ id: tab.id, files: [{ path: tab.path, content: tab.content }], missing: false })
  }

  return { ok: true, detail: { name: probe.changeName, artifacts } }
}
