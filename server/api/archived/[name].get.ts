import type { Dirent } from 'node:fs'
import type { ArchivedDetailProbe, ArchivedTabProbe } from '../../../src/api/types'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { archiveDirOf } from '../../utils/archive-store'
import { resolveTargetDir } from '../../utils/openspec-cli'
import { isDirectory, isSafeChangeName } from '../../utils/parked-store'

/**
 * `GET /api/archived/:name`：archived change 的詳情打包（design D2／D4）。
 *
 * tabs 只能現場列舉——archived change 沒有 `openspec status` 可問，也沒有 park 那樣的
 * 快照 metadata。集合是頂層 `*.md` ＋ `specs/**\/spec.md`（delta spec 正是回顧的主要動機），
 * 順序 proposal → design → delta specs → tasks → 其他。讀檔範圍即列舉到的檔案。
 */

const SPECS_DIR = 'specs'
const SPEC_FILE = 'spec.md'
/** 慣例上的閱讀順序；其餘頂層檔案排在最後、依字母序（design D4） */
const LEADING_TABS = ['proposal', 'design']
const TRAILING_TABS = ['tasks']

export default defineEventHandler(async (event): Promise<ArchivedDetailProbe> => {
  const changeName = getRouterParam(event, 'name', { decode: true }) ?? ''
  const empty = (failure: string): ArchivedDetailProbe => ({ changeName, tabs: [], failure })

  if (!isSafeChangeName(changeName))
    return empty('That change name is not valid.')

  const target = await resolveTargetDir()
  if (!target.ok)
    return empty(target.probe.failure?.message ?? 'No project is selected.')

  const changeRoot = archiveDirOf(target.targetPath, changeName)
  if (!(await isDirectory(changeRoot)))
    return empty('That archived change is no longer there.')

  const [top, specs] = await Promise.all([
    listTopLevel(changeRoot),
    listSpecTabs(path.join(changeRoot, SPECS_DIR), SPECS_DIR),
  ])

  const tabs = await Promise.all(
    orderTabs(top, specs.sort(byName)).map(id => readTab(changeRoot, id)),
  )
  return { changeName, tabs }
})

/** 頂層 `*.md` 各自一個 tab（`proposal.md` → `proposal`）；子目錄不在這一輪 */
async function listTopLevel(changeRoot: string): Promise<string[]> {
  return (await readEntries(changeRoot))
    .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
    .map(entry => entry.name.slice(0, -3))
}

/** `specs/` 底下每個含 `spec.md` 的目錄就是一個 delta spec tab，tab 名即它的相對路徑 */
async function listSpecTabs(dir: string, id: string): Promise<string[]> {
  const entries = await readEntries(dir)

  const tabs: string[] = []
  // `specs/` 自己不成 tab：capability 一定在下一層（`specs/<capability-path>/spec.md`）
  if (id !== SPECS_DIR && entries.some(entry => entry.isFile() && entry.name === SPEC_FILE))
    tabs.push(id)

  for (const entry of entries.filter(entry => entry.isDirectory()))
    tabs.push(...await listSpecTabs(path.join(dir, entry.name), `${id}/${entry.name}`))

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
  const relative = id.startsWith(`${SPECS_DIR}/`) ? path.join(id, SPEC_FILE) : `${id}.md`
  const file = path.resolve(changeRoot, relative)
  // 名稱來自現場列舉，仍擋一次逃出 change 目錄的路徑（白名單精神，比照 parked）
  if (!file.startsWith(`${changeRoot}${path.sep}`))
    return { id, path: relative, error: 'Refused to read outside this change directory.' }

  try {
    return { id, path: relative, content: await readFile(file, 'utf8') }
  }
  catch (error) {
    return { id, path: relative, error: error instanceof Error ? error.message : String(error) }
  }
}

/** 目錄讀不到＝這一層沒有東西可列（缺 `specs/` 是常態，不是錯誤） */
async function readEntries(dir: string): Promise<Dirent[]> {
  try {
    return await readdir(dir, { withFileTypes: true })
  }
  catch {
    return []
  }
}

function byName(a: string, b: string): number {
  return a.localeCompare(b)
}
