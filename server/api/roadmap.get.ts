import type { RoadmapFileProbe, RoadmapListProbe, RoadmapRefsProbe } from '../../src/api/types'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { archiveDirOf, listArchivedDirs, openspecDirOf } from '../utils/archive-store'
import { resolveTargetDir } from '../utils/openspec-cli'
import { isDirectory, listParkedNames, parkedDirOf, pathExists, resolveGitDir } from '../utils/parked-store'

/**
 * `GET /api/roadmap`：規劃檔清單一趟回傳（design D1）。
 *
 * 只讀 spec「讀取範圍」列的內容：`openspec/roadmap/` 頂層 `.md` 的內容與 mtime、
 * `openspec/roadmap.off` 是否存在，以及 specs／changes／archived／parked 四類名稱
 * （不含內容）。解析、分組、切段一律交給共用的 normalize-roadmap（design D2）。
 * 不做快取——與 archived 同一個規模量級。
 */

const ROADMAP_DIR = 'roadmap'
const OFF_FILE = 'roadmap.off'
const SPECS_DIR = 'specs'
const CHANGES_DIR = 'changes'
const ARCHIVE_SUBDIR = 'archive'

export default defineEventHandler(async (): Promise<RoadmapListProbe> => {
  const target = await resolveTargetDir()
  if (!target.ok) {
    return notOpenspecProject(
      target.probe.targetPath,
      target.probe.failure?.message ?? 'No project is selected.',
    )
  }

  const openspecDir = openspecDirOf(target.targetPath)
  // 沒有 openspec/ 就不是 openspec 專案——與 Changes／Specs／Archived 頁的分層一致
  if (!(await isDirectory(openspecDir))) {
    return notOpenspecProject(target.targetPath, `No openspec/ directory at ${target.targetPath}.`)
  }

  const roadmapDir = path.join(openspecDir, ROADMAP_DIR)
  const [offExists, refs, listing] = await Promise.all([
    pathExists(path.join(openspecDir, OFF_FILE)),
    buildRefs(target.targetPath, openspecDir),
    listRoadmapDir(roadmapDir),
  ])

  if (!listing.ok) {
    return {
      targetPath: target.targetPath,
      dirExists: false,
      offExists,
      files: [],
      refs,
      failure: { kind: 'read-failed', message: listing.message },
    }
  }

  const files = await Promise.all(listing.names.map(name => readRoadmapFile(roadmapDir, name)))
  return { targetPath: target.targetPath, dirExists: listing.dirExists, offExists, files, refs }
})

function notOpenspecProject(targetPath: string, message: string): RoadmapListProbe {
  return {
    targetPath,
    dirExists: false,
    offExists: false,
    files: [],
    refs: emptyRefs(),
    failure: { kind: 'not-openspec-project', message },
  }
}

function emptyRefs(): RoadmapRefsProbe {
  return { specs: [], changes: [], archived: [], parked: [] }
}

type RoadmapDirListing
  = { ok: true, dirExists: boolean, names: string[] }
    | { ok: false, message: string }

/** 目錄不存在是正常狀態（回空清單）；列舉本身失敗（如權限）才回 read-failed */
async function listRoadmapDir(dir: string): Promise<RoadmapDirListing> {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    const names = entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.md') && !entry.name.startsWith('.'))
      .map(entry => entry.name)
    return { ok: true, dirExists: true, names }
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT')
      return { ok: true, dirExists: false, names: [] }
    return { ok: false, message: describe(error) }
  }
}

/** 讀不到就是那一檔讀取失敗：仍列入清單（Other 組），其他卡片不受影響 */
async function readRoadmapFile(dir: string, name: string): Promise<RoadmapFileProbe> {
  const file = path.join(dir, name)
  const mtime = await readMtime(file)
  try {
    return { name, content: await readFile(file, 'utf8'), mtime }
  }
  catch (error) {
    return { name, readError: describe(error), mtime }
  }
}

async function readMtime(file: string): Promise<number | undefined> {
  try {
    return (await stat(file)).mtimeMs
  }
  catch {
    return undefined
  }
}

/**
 * 引用解析用的四類名稱清單，只列舉不讀內容（Requirement 讀取範圍）。列舉失敗一律
 * 視同空清單——這幾類名稱只影響引用連結成不成立，不該讓整份 roadmap 清單跟著失敗。
 */
async function buildRefs(projectPath: string, openspecDir: string): Promise<RoadmapRefsProbe> {
  const changesDir = path.join(openspecDir, CHANGES_DIR)
  const [specs, changes, archived, parked] = await Promise.all([
    listDirNames(path.join(openspecDir, SPECS_DIR)),
    listDirNames(changesDir).then(names => names.filter(name => name !== ARCHIVE_SUBDIR)),
    listArchivedDirs(archiveDirOf(projectPath)).then(listing => listing.ok ? listing.dirs : []),
    listParkedFor(projectPath),
  ])
  return { specs, changes, archived, parked }
}

async function listDirNames(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    return entries.filter(entry => entry.isDirectory()).map(entry => entry.name)
  }
  catch {
    return []
  }
}

async function listParkedFor(projectPath: string): Promise<string[]> {
  const git = await resolveGitDir(projectPath)
  if (!git.ok)
    return []
  return listParkedNames(parkedDirOf(git.gitDir))
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
