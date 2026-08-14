import type { ProjectEntry, ProjectsSnapshot } from '../../src/api/types'
import path from 'node:path'
import { runCli } from './openspec-cli'
import { currentProjectPath, projectEntries } from './project-state'

/**
 * 側欄清單的組裝：清單原料（project-state）＋顯示名消歧＋徽章數。
 *
 * 徽章是每項一趟 CLI（~1s），所以是可選的：清單端點帶、切換／加入／移除不帶
 * ——那些操作的關鍵路徑不該被 N 趟 CLI 拖住（spec 徽章只要求啟動與切換時刷新）。
 */

/** 並行取數的上限：清單通常個位數，開太寬只是同時壓 N 個 node process */
const BADGE_CONCURRENCY = 4

export async function buildSnapshot(options: { badges: boolean }): Promise<ProjectsSnapshot> {
  const entries = await projectEntries()
  const paths = entries.map(entry => entry.path)
  const names = displayNames(paths)
  const badges = options.badges ? await countAll(paths) : null

  const projects: ProjectEntry[] = entries.map((entry, index) => ({
    path: entry.path,
    name: names[index]!,
    current: entry.current,
    temporary: entry.temporary,
    badge: badges?.[index] ?? null,
  }))

  return {
    projects,
    currentPath: await currentProjectPath(),
    badgesIncluded: options.badges,
  }
}

/** 目錄名即顯示名；撞名才帶一層父目錄消歧（design D2：不另存顯示名欄位） */
function displayNames(paths: string[]): string[] {
  const bases = paths.map(each => path.basename(each) || each)
  const counts = new Map<string, number>()
  for (const base of bases)
    counts.set(base, (counts.get(base) ?? 0) + 1)

  return paths.map((each, index) => {
    const base = bases[index]!
    if ((counts.get(base) ?? 0) < 2)
      return base
    const parent = path.basename(path.dirname(each))
    return parent ? `${parent}/${base}` : base
  })
}

async function countAll(paths: string[]): Promise<Array<number | null>> {
  const counts = Array.from<number | null>({ length: paths.length }).fill(null)
  let cursor = 0

  const workers = Array.from(
    { length: Math.min(BADGE_CONCURRENCY, paths.length) },
    async () => {
      while (cursor < paths.length) {
        const index = cursor++
        counts[index] = await countActiveChanges(paths[index]!)
      }
    },
  )
  await Promise.all(workers)

  return counts
}

/**
 * 未 archive 的 change 數。任何一步不確定就回 null——路徑失效、CLI 失敗、
 * 輸出讀不懂都不編數字（spec「取數失敗不編數字」）。
 */
async function countActiveChanges(dir: string): Promise<number | null> {
  const { error, stdout } = await runCli(['list', '--json'], dir)
  if (error)
    return null

  try {
    const parsed = JSON.parse(stdout) as {
      changes?: unknown
      root?: { source?: unknown } | null
    }
    // CLI 在非 openspec 目錄會以 cwd 造一個 implicit root：那是「沒有專案」不是「零個 change」
    if (parsed.root?.source === 'implicit')
      return null
    return Array.isArray(parsed.changes) ? parsed.changes.length : null
  }
  catch {
    return null
  }
}
