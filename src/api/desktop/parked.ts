import type {
  ArtifactFileProbe,
  ChangeDetailResult,
  ParkedArtifactProbe,
  ParkedDetailProbe,
  ParkedEntryProbe,
  ParkedListProbe,
  ParkedListResult,
} from '../types'
import type { ParkedMetadata, ParkedRecord } from './parked-store'
import type { DirEntry } from './shell'
import { normalizeParkedDetail, normalizeParkedList } from '../normalize-parked'
import {
  isDirectory,
  isSafeChangeName,
  listParkedNames,
  metadataFileOf,
  parkedDirOf,
  readMetadata,
  resolveGitDir,
} from './parked-store'
import { isInside, join } from './paths'
import { resolveTarget } from './projects'
import { pathExists, readDir, readTextFile, statPath } from './shell'

/**
 * 桌面形態的 parked 清單與詳情（對應 web 形態的 server/api/parked.get.ts 與
 * server/api/parked/[name].get.ts）。這一側只做 IO 並造出 probe，勾選計數、`## Why`
 * 首句摘錄與排序交給兩形態共用的 src/api/normalize-parked.ts。
 *
 * 清單以目錄列舉為準，metadata 只補 parkedAt 與快照路徑；孤兒紀錄（目錄已不在、
 * 紀錄還留著）不會出現在結果裡。詳情的 tabs 集合與順序來自 park 當下的快照——parked
 * change 對 openspec 不可見，沒有 `openspec status` 可問，而現場列舉推不出 custom
 * schema 的 tab 集合；metadata 缺失才退回現場列舉 `*.md`，總比整個詳情打不開好。
 */

/** metadata 缺項時的預設檔名；snapshot 有紀錄一律以 snapshot 為準 */
const FALLBACK_TASKS = 'tasks.md'
const FALLBACK_PROPOSAL = 'proposal.md'

export async function listParked(): Promise<ParkedListResult> {
  try {
    return normalizeParkedList(await readParkedList())
  }
  catch (error) {
    // 通道本身出事（外殼拒絕 invoke）時的兜底：這條路對外只回結果、不丟例外
    return normalizeParkedList({ parkAvailable: false, entries: [], failure: describe(error) })
  }
}

export async function getParkedDetail(changeName: string): Promise<ChangeDetailResult> {
  try {
    return normalizeParkedDetail(await readParkedDetail(changeName))
  }
  catch (error) {
    return normalizeParkedDetail(emptyDetail(changeName, describe(error)))
  }
}

async function readParkedList(): Promise<ParkedListProbe> {
  const target = await resolveTarget()
  // 無目標專案時清單本來就是空的；park 一併關掉，理由沿用「沒有 git 目錄」
  if (!target.ok)
    return { parkAvailable: false, reason: 'not-git-repo', entries: [] }

  const git = await resolveGitDir(target.targetPath)
  if (!git.ok)
    return { parkAvailable: false, reason: git.reason, entries: [] }

  const parkedRoot = parkedDirOf(git.gitDir)
  const names = await listParkedNames(parkedRoot)
  const metadata = await readMetadata(metadataFileOf(git.gitDir))

  const entries = await Promise.all(
    names.map(name => readEntry(join(parkedRoot, name), name, metadata)),
  )
  return { parkAvailable: true, entries }
}

async function readEntry(
  dir: string,
  name: string,
  metadata: ParkedMetadata,
): Promise<ParkedEntryProbe> {
  const record = metadata[name]
  // 三筆各自讀不到都只是該欄位缺席，彼此併行發出、互不影響
  const [tasks, proposal, createdAt] = await Promise.all([
    readOptional(dir, record?.artifacts.tasks?.[0] ?? FALLBACK_TASKS),
    readOptional(dir, record?.artifacts.proposal?.[0] ?? FALLBACK_PROPOSAL),
    readCreatedAt(dir),
  ])

  return {
    name,
    ...(record ? { parkedAt: record.parkedAt } : {}),
    ...(tasks === null ? {} : { tasks }),
    ...(proposal === null ? {} : { proposal }),
    ...(createdAt === null ? {} : { createdAt }),
  }
}

/**
 * change 目錄的建立時刻：park 是整目錄 rename，建立時刻因此保值，不必在 park 當下另存。
 * 檔案系統給不出（`null`）、給 `0`、或讀取失敗一律視為取不到。
 */
async function readCreatedAt(dir: string): Promise<number | null> {
  try {
    const { birthtime } = await statPath(dir)
    return birthtime !== null && birthtime > 0 ? birthtime : null
  }
  catch {
    return null
  }
}

/** 讀不到就是沒有：卡片退回「No tasks」與空摘錄，不是錯誤（清單以目錄為準） */
async function readOptional(dir: string, relative: string): Promise<string | null> {
  const file = join(dir, relative)
  // 快照來自本 App 自己寫的 metadata，仍擋一次逃出 parked 目錄的路徑
  if (!isInside(file, dir))
    return null

  try {
    return await readTextFile(file)
  }
  catch {
    return null
  }
}

async function readParkedDetail(changeName: string): Promise<ParkedDetailProbe> {
  if (!isSafeChangeName(changeName))
    return emptyDetail(changeName, 'That change name is not valid.')

  const target = await resolveTarget()
  if (!target.ok)
    return emptyDetail(changeName, target.probe.failure?.message ?? 'No project is selected.')

  const git = await resolveGitDir(target.targetPath)
  if (!git.ok)
    return emptyDetail(changeName, 'This project has no parked changes.')

  const changeRoot = parkedDirOf(git.gitDir, changeName)
  if (!(await isDirectory(changeRoot)))
    return emptyDetail(changeName, 'That parked change is no longer there.')

  const record = (await readMetadata(metadataFileOf(git.gitDir)))[changeName]
  const artifacts = record && Object.keys(record.artifacts).length
    ? await fromSnapshot(changeRoot, record)
    : await fromDirectoryScan(changeRoot)

  return { changeName, changeRoot, artifacts }
}

function emptyDetail(changeName: string, failure: string): ParkedDetailProbe {
  return { changeName, changeRoot: '', artifacts: [], failure }
}

/** 快照路徑逐一讀取；鍵序即 tabs 順序，無既存檔案的 artifact 留空（詳情顯示「尚未建立」） */
async function fromSnapshot(changeRoot: string, record: ParkedRecord): Promise<ParkedArtifactProbe[]> {
  return Promise.all(
    Object.entries(record.artifacts).map(async ([id, relatives]) => ({
      id,
      files: (await Promise.all(relatives.map(relative => readSnapshotFile(changeRoot, relative))))
        .filter((file): file is ArtifactFileProbe => file !== null),
    })),
  )
}

/**
 * metadata 缺失時的 fallback：目錄內的 `*.md` 就是全部所知。
 * 頂層檔案各自成一個 tab（`proposal.md` → `proposal`），子目錄整包收成一個 tab
 * （`specs/**` → `specs`）——這是預設 schema 的形狀，猜不中 custom schema 也認了。
 */
async function fromDirectoryScan(changeRoot: string): Promise<ParkedArtifactProbe[]> {
  const artifacts: ParkedArtifactProbe[] = []
  for (const entry of await listSorted(changeRoot)) {
    if (entry.isDirectory) {
      const files = await collectMarkdown(join(changeRoot, entry.name))
      if (files.length)
        artifacts.push({ id: entry.name, files })
      continue
    }
    if (entry.isFile && entry.name.endsWith('.md'))
      artifacts.push({ id: entry.name.slice(0, -3), files: [await readListedFile(changeRoot, entry.name)] })
  }
  return artifacts
}

async function collectMarkdown(dir: string): Promise<ArtifactFileProbe[]> {
  const files: ArtifactFileProbe[] = []
  for (const entry of await listSorted(dir)) {
    if (entry.isDirectory)
      files.push(...await collectMarkdown(join(dir, entry.name)))
    else if (entry.isFile && entry.name.endsWith('.md'))
      files.push(await readListedFile(dir, entry.name))
  }
  return files
}

/** 列不到的目錄當成空的；順序固定，詳情的 tab 順序才不會隨檔案系統的回報順序跳動 */
async function listSorted(dir: string): Promise<DirEntry[]> {
  try {
    return [...await readDir(dir)].sort((a, b) => a.name.localeCompare(b.name))
  }
  catch {
    return []
  }
}

/**
 * 快照裡的檔案可能已被手動刪掉——那是缺件不是錯誤，直接略過（回 null）；
 * 存在卻讀不到才把錯誤帶上去，交由 normalize 報「這個 change 讀不起來」。
 *
 * 兩者非分不可：normalize 那一側的規則是「列進來卻沒有內容＝整個 change 讀不起來」，
 * 缺件若走到那一行，使用者手動刪過任一份 `.md` 就再也打不開這個 change 的詳情。
 * 外殼的檔案通道只回一句人看的錯誤字串（沒有 ENOENT 這類代碼可認），所以分辨的方式
 * 是讀之前先問一次它在不在。
 */
async function readSnapshotFile(root: string, relative: string): Promise<ArtifactFileProbe | null> {
  const file = join(root, relative)
  // metadata 是本 App 自己寫的，仍擋一次逃出 parked 目錄的路徑（白名單精神）
  if (!isInside(file, root))
    return null

  try {
    if (!(await pathExists(file)))
      return null
    return { path: file, content: await readTextFile(file) }
  }
  catch (error) {
    return { path: file, error: describe(error) }
  }
}

/**
 * 現場列舉出來的檔案不問存不存在：剛列得到卻讀不到就是真失敗，與 archived 詳情同一條規則。
 * 存在與否的詢問只用在快照那一處——那份清單來自過去某一刻，中間隔了使用者動手的時間。
 */
async function readListedFile(dir: string, name: string): Promise<ArtifactFileProbe> {
  const file = join(dir, name)
  try {
    return { path: file, content: await readTextFile(file) }
  }
  catch (error) {
    return { path: file, error: describe(error) }
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
