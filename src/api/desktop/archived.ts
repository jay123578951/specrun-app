import type {
  ArchivedDetailProbe,
  ArchivedListProbe,
  ArchivedListResult,
  ArchivedTabProbe,
  ChangeDetailResult,
} from '../types'
import type { DirEntry } from './shell'
import { normalizeArchivedDetail, normalizeArchivedList } from '../normalize-archived'
import { isDirectory, isSafeChangeName } from './parked-store'
import { isInside, join } from './paths'
import { resolveTarget } from './projects'
import { cliProbe } from './reads'
import { readDir, readTextFile } from './shell'

/**
 * 清單走 CLI 的 `list --archived --json`；詳情仍直讀
 * `<project>/openspec/changes/archive/` 底下的 Markdown：`status`／`show` 不認得 archived change。
 *
 * 詳情的 tabs 只能現場列舉——archived change 既沒有 `openspec status` 可問，也沒有
 * park 那樣的快照。集合是頂層 `*.md` ＋ `specs/**\/spec.md`，順序 proposal → design →
 * delta specs → tasks → 其他。tab 清單是現場列舉出來的，列得到卻讀不到即回報失敗，
 * 不問「它還在嗎」。
 */

const OPENSPEC_DIR = 'openspec'
const ARCHIVE_DIR = ['changes', 'archive']
const ARCHIVED_LIST_ARGS = ['list', '--archived', '--json']
const SPECS_DIR = 'specs'
const SPEC_FILE = 'spec.md'
/** 慣例上的閱讀順序；其餘頂層檔案排在最後、依字母序 */
const LEADING_TABS = ['proposal', 'design']
const TRAILING_TABS = ['tasks']

export async function listArchived(): Promise<ArchivedListResult> {
  try {
    return normalizeArchivedList(await readArchivedList())
  }
  catch (error) {
    // 通道本身出事（外殼拒絕 invoke）時的兜底：這條路對外只回結果、不丟例外
    return normalizeArchivedList({
      targetPath: '',
      exitCode: null,
      stdout: '',
      stderr: '',
      failure: { kind: 'spawn-failed', message: describe(error) },
    })
  }
}

export async function getArchivedDetail(changeName: string): Promise<ChangeDetailResult> {
  try {
    return normalizeArchivedDetail(await readArchivedDetail(changeName))
  }
  catch (error) {
    return normalizeArchivedDetail(emptyDetail(changeName, describe(error)))
  }
}

/** archived change 的存放根目錄；帶 dir 時直接給該 change 的目錄 */
function archiveDirOf(projectPath: string, dir?: string): string {
  const root = join(projectPath, OPENSPEC_DIR, ...ARCHIVE_DIR)
  return dir === undefined ? root : join(root, dir)
}

async function readArchivedList(): Promise<ArchivedListProbe> {
  const target = await resolveTarget()
  if (!target.ok)
    return target.probe

  return cliProbe(ARCHIVED_LIST_ARGS, target.targetPath)
}

async function readArchivedDetail(changeName: string): Promise<ArchivedDetailProbe> {
  if (!isSafeChangeName(changeName))
    return emptyDetail(changeName, 'That change name is not valid.')

  const target = await resolveTarget()
  if (!target.ok)
    return emptyDetail(changeName, target.probe.failure?.message ?? 'No project is selected.')

  const changeRoot = archiveDirOf(target.targetPath, changeName)
  if (!(await isDirectory(changeRoot)))
    return emptyDetail(changeName, 'That archived change is no longer there.')

  const [top, specs] = await Promise.all([
    listTopLevel(changeRoot),
    listSpecTabs(join(changeRoot, SPECS_DIR), SPECS_DIR),
  ])

  const tabs = await Promise.all(
    orderTabs(top, specs.sort(byName)).map(id => readTab(changeRoot, id)),
  )
  return { changeName, tabs }
}

function emptyDetail(changeName: string, failure: string): ArchivedDetailProbe {
  return { changeName, tabs: [], failure }
}

/** 頂層 `*.md` 各自一個 tab（`proposal.md` → `proposal`）；子目錄不在這一輪 */
async function listTopLevel(changeRoot: string): Promise<string[]> {
  return (await listSorted(changeRoot))
    .filter(entry => entry.isFile && entry.name.endsWith('.md'))
    .map(entry => entry.name.slice(0, -3))
}

/** `specs/` 底下每個含 `spec.md` 的目錄就是一個 delta spec tab，tab 名即它的相對路徑 */
async function listSpecTabs(dir: string, id: string): Promise<string[]> {
  const entries = await listSorted(dir)

  const tabs: string[] = []
  // `specs/` 自己不成 tab：capability 一定在下一層（`specs/<capability-path>/spec.md`）
  if (id !== SPECS_DIR && entries.some(entry => entry.isFile && entry.name === SPEC_FILE))
    tabs.push(id)

  for (const entry of entries.filter(entry => entry.isDirectory))
    tabs.push(...await listSpecTabs(join(dir, entry.name), `${id}/${entry.name}`))

  return tabs
}

function orderTabs(top: string[], specs: string[]): string[] {
  const leading = LEADING_TABS.filter(id => top.includes(id))
  const trailing = TRAILING_TABS.filter(id => top.includes(id))
  const rest = top
    .filter(id => !leading.includes(id) && !trailing.includes(id))
    .sort(byName)

  return [...leading, ...specs, ...trailing, ...rest]
}

async function readTab(changeRoot: string, id: string): Promise<ArchivedTabProbe> {
  const relative = id.startsWith(`${SPECS_DIR}/`) ? join(id, SPEC_FILE) : `${id}.md`
  const file = join(changeRoot, relative)
  // 名稱來自現場列舉，仍擋一次逃出 change 目錄的路徑（白名單精神，比照 parked）
  if (!isInside(file, changeRoot))
    return { id, path: relative, error: 'Refused to read outside this change directory.' }

  try {
    return { id, path: relative, content: await readTextFile(file) }
  }
  catch (error) {
    return { id, path: relative, error: describe(error) }
  }
}

/**
 * 列不到的目錄當成空的：詳情這一側缺 `specs/` 是常態，少一個子目錄不該讓整份 tab
 * 清單失敗。順序固定，tab 順序與清單順序才不會隨檔案系統的回報順序跳動。
 */
async function listSorted(dir: string): Promise<DirEntry[]> {
  try {
    return sortByName(await readDir(dir))
  }
  catch {
    return []
  }
}

function sortByName(entries: DirEntry[]): DirEntry[] {
  return [...entries].sort((a, b) => a.name.localeCompare(b.name))
}

function byName(a: string, b: string): number {
  return a.localeCompare(b)
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
