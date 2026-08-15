import type { ParkedEntryProbe, ParkedListProbe } from '../../src/api/types'
import type { ParkedMetadata } from '../utils/parked-store'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { resolveTargetDir } from '../utils/openspec-cli'
import { listParkedNames, metadataFileOf, parkedDirOf, readMetadata, resolveGitDir } from '../utils/parked-store'

/**
 * `GET /api/parked`：parked 清單＋park 可用性，一趟回傳（design D5）。
 *
 * 清單以目錄列舉為準，metadata 只補 parkedAt 與快照路徑；孤兒紀錄不會出現在結果裡。
 * 這裡只讀原始檔案內容，勾選計數與 `## Why` 首句摘錄交給 shared normalize（design D4）
 * ——parked 數量級小（單專案 0–5），不值得快取層。
 */

/** metadata 缺項時的預設檔名；snapshot 有紀錄一律以 snapshot 為準 */
const FALLBACK_TASKS = 'tasks.md'
const FALLBACK_PROPOSAL = 'proposal.md'

export default defineEventHandler(async (): Promise<ParkedListProbe> => {
  const target = await resolveTargetDir()
  if (!target.ok) {
    // 無目標專案時清單本來就是空的；park 一併關掉，理由沿用「沒有 git 目錄」
    return { parkAvailable: false, reason: 'not-git-repo', entries: [] }
  }

  const git = await resolveGitDir(target.targetPath)
  if (!git.ok)
    return { parkAvailable: false, reason: git.reason, entries: [] }

  const parkedRoot = parkedDirOf(git.gitDir)
  const names = await listParkedNames(parkedRoot)
  const metadata = await readMetadata(metadataFileOf(git.gitDir))

  const entries = await Promise.all(
    names.map(name => readEntry(path.join(parkedRoot, name), name, metadata)),
  )
  return { parkAvailable: true, entries }
})

async function readEntry(
  dir: string,
  name: string,
  metadata: ParkedMetadata,
): Promise<ParkedEntryProbe> {
  const record = metadata[name]
  const [tasks, proposal] = await Promise.all([
    readOptional(dir, record?.artifacts.tasks?.[0] ?? FALLBACK_TASKS),
    readOptional(dir, record?.artifacts.proposal?.[0] ?? FALLBACK_PROPOSAL),
  ])

  return {
    name,
    ...(record ? { parkedAt: record.parkedAt } : {}),
    ...(tasks === null ? {} : { tasks }),
    ...(proposal === null ? {} : { proposal }),
  }
}

/** 讀不到就是沒有：卡片退回「No tasks」與空摘錄，不是錯誤（spec 目錄為準） */
async function readOptional(dir: string, relative: string): Promise<string | null> {
  const file = path.resolve(dir, relative)
  // 快照來自本 App 自己寫的 metadata，仍擋一次逃出 parked 目錄的路徑
  if (file !== dir && !file.startsWith(`${dir}${path.sep}`))
    return null

  try {
    return await readFile(file, 'utf8')
  }
  catch {
    return null
  }
}
