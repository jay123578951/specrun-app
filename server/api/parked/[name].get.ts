import type { Dirent } from 'node:fs'
import type { ArtifactFileProbe, ParkedArtifactProbe, ParkedDetailProbe } from '../../../src/api/types'
import type { ParkedRecord } from '../../utils/parked-store'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { resolveTargetDir } from '../../utils/openspec-cli'
import { isDirectory, isSafeChangeName, metadataFileOf, parkedDirOf, readMetadata, resolveGitDir } from '../../utils/parked-store'

/**
 * `GET /api/parked/:name`：parked change 的詳情打包（design D5）。
 *
 * tabs 的集合與順序來自 park 當下的快照——parked change 對 openspec 不可見，
 * 沒有 `openspec status` 可問，而現場列舉推不出 custom schema 的 tab 集合（design D2）。
 * 讀檔範圍同樣限定在快照列出的路徑（與 C2 詳情的白名單同構）；
 * metadata 缺失才退回現場列舉 `*.md`，總比整個詳情打不開好。
 */

export default defineEventHandler(async (event): Promise<ParkedDetailProbe> => {
  const changeName = getRouterParam(event, 'name', { decode: true }) ?? ''
  const empty = (failure: string): ParkedDetailProbe =>
    ({ changeName, changeRoot: '', artifacts: [], failure })

  if (!isSafeChangeName(changeName))
    return empty('That change name is not valid.')

  const target = await resolveTargetDir()
  if (!target.ok)
    return empty(target.probe.failure?.message ?? 'No project is selected.')

  const git = await resolveGitDir(target.targetPath)
  if (!git.ok)
    return empty('This project has no parked changes.')

  const changeRoot = parkedDirOf(git.gitDir, changeName)
  if (!(await isDirectory(changeRoot)))
    return empty('That parked change is no longer there.')

  const record = (await readMetadata(metadataFileOf(git.gitDir)))[changeName]
  const artifacts = record && Object.keys(record.artifacts).length
    ? await fromSnapshot(changeRoot, record)
    : await fromDirectoryScan(changeRoot)

  return { changeName, changeRoot, artifacts }
})

/** 快照路徑逐一讀取；鍵序即 tabs 順序，無既存檔案的 artifact 留空（詳情顯示「尚未建立」） */
async function fromSnapshot(changeRoot: string, record: ParkedRecord): Promise<ParkedArtifactProbe[]> {
  return Promise.all(
    Object.entries(record.artifacts).map(async ([id, relatives]) => ({
      id,
      files: (await Promise.all(relatives.map(relative => readOne(changeRoot, relative))))
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
  let entries: Dirent[]
  try {
    entries = await readdir(changeRoot, { withFileTypes: true })
  }
  catch {
    return []
  }

  const artifacts: ParkedArtifactProbe[] = []
  for (const entry of [...entries].sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory()) {
      const files = await collectMarkdown(path.join(changeRoot, entry.name))
      if (files.length)
        artifacts.push({ id: entry.name, files })
      continue
    }
    if (entry.isFile() && entry.name.endsWith('.md')) {
      const file = await readOne(changeRoot, entry.name)
      if (file)
        artifacts.push({ id: entry.name.slice(0, -3), files: [file] })
    }
  }
  return artifacts
}

async function collectMarkdown(dir: string): Promise<ArtifactFileProbe[]> {
  let entries: Dirent[]
  try {
    entries = await readdir(dir, { withFileTypes: true })
  }
  catch {
    return []
  }

  const files: ArtifactFileProbe[] = []
  for (const entry of [...entries].sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await collectMarkdown(full))
    }
    else if (entry.isFile() && entry.name.endsWith('.md')) {
      const file = await readOne(dir, entry.name)
      if (file)
        files.push(file)
    }
  }
  return files
}

/**
 * 快照裡的檔案可能已被手動刪掉——那是缺件不是錯誤，直接略過（回 null）；
 * 存在卻讀不到才把錯誤帶上去，交由 normalize 報「這個 change 讀不起來」。
 */
async function readOne(root: string, relative: string): Promise<ArtifactFileProbe | null> {
  const file = path.resolve(root, relative)
  // metadata 是本 App 自己寫的，仍擋一次逃出 parked 目錄的路徑（白名單精神）
  if (!file.startsWith(`${root}${path.sep}`))
    return null

  try {
    return { path: file, content: await readFile(file, 'utf8') }
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT')
      return null
    return { path: file, error: error instanceof Error ? error.message : String(error) }
  }
}
