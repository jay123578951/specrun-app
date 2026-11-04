import type { RoadmapFileProbe, RoadmapListProbe, RoadmapListResult, RoadmapRefsProbe } from '../types'
import type { SpawnLimits } from './shell'
import { normalizeRoadmapList } from '../normalize-roadmap'
import { CHANGED_ARGS, GIT_MAX_BUFFER, GIT_TIMEOUT_MS, LOG_ARGS, TRACKED_ARGS } from '../roadmap-git-args'
import { isDirectory, listParkedNames, parkedDirOf, resolveGitDir } from './parked-store'
import { join } from './paths'
import { resolveTarget } from './projects'
import { isMacOS, pathExists, readDir, readTextFile, spawnBin, statPath } from './shell'

/**
 * 桌面形態的 roadmap 清單（對應 web 形態的 server/api/roadmap.get.ts）。這一側只做 IO
 * 並造出 probe——解析、分組、切段全在兩形態共用的 src/api/normalize-roadmap.ts（design D2）。
 *
 * 只讀 spec「讀取範圍」列的內容：`openspec/roadmap/` 頂層 `.md` 的內容與 mtime、
 * `openspec/roadmap.off` 是否存在，以及 specs／changes／archived／parked 四類名稱
 * （不含內容）。parked 名稱沿用桌面形態既有的 `listParkedNames`（同 parked.ts、archived.ts）。
 * 另外在 `openspec/roadmap/` 內執行三條唯讀 git 指令（log、diff、ls-files），取得各檔的提交時間。
 */

const OPENSPEC_DIR = 'openspec'
const ROADMAP_DIR = 'roadmap'
const OFF_FILE = 'roadmap.off'
const SPECS_DIR = 'specs'
const CHANGES_DIR = 'changes'
const ARCHIVE_SUBDIR = 'archive'

const GIT_LIMITS: SpawnLimits = { timeoutMs: GIT_TIMEOUT_MS, maxOutputBytes: GIT_MAX_BUFFER }

let gitUsable: Promise<boolean> | undefined

export async function listRoadmap(): Promise<RoadmapListResult> {
  try {
    return normalizeRoadmapList(await readRoadmapList())
  }
  catch (error) {
    // 通道本身出事（外殼拒絕 invoke）時的兜底：這條路對外只回結果、不丟例外
    return normalizeRoadmapList({
      targetPath: '',
      dirExists: false,
      offExists: false,
      files: [],
      refs: emptyRefs(),
      failure: { kind: 'read-failed', message: describe(error) },
    })
  }
}

function openspecDirOf(projectPath: string): string {
  return join(projectPath, OPENSPEC_DIR)
}

function emptyRefs(): RoadmapRefsProbe {
  return { specs: [], changes: [], archived: [], parked: [] }
}

async function readRoadmapList(): Promise<RoadmapListProbe> {
  const target = await resolveTarget()
  if (!target.ok) {
    return notOpenspecProject(
      target.probe.targetPath,
      target.probe.failure?.message ?? 'No project is selected.',
    )
  }

  const openspecDir = openspecDirOf(target.targetPath)
  // 沒有 openspec/ 就不是 openspec 專案——與 Changes／Specs／Archived 頁的分層一致
  if (!(await isDirectory(openspecDir)))
    return notOpenspecProject(target.targetPath, `No openspec/ directory at ${target.targetPath}.`)

  const roadmapDir = join(openspecDir, ROADMAP_DIR)
  const [offExists, refs, listing] = await Promise.all([
    pathExists(join(openspecDir, OFF_FILE)),
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
  const git = files.length > 0 ? await readRoadmapGit(roadmapDir) : undefined
  return { targetPath: target.targetPath, dirExists: listing.dirExists, offExists, files, refs, ...(git && { git }) }
}

/** 沒裝 Xcode 開發工具的 Mac 上執行 /usr/bin/git 會跳出系統安裝提示，所以先問一次，整個 App 執行期間只問一次 */
function isGitUsable(): Promise<boolean> {
  gitUsable ??= checkGitUsable()
  return gitUsable
}

async function checkGitUsable(): Promise<boolean> {
  if (!(await isMacOS()))
    return true
  const outcome = await spawnBin('/usr/bin/xcode-select', ['-p'], '/', GIT_LIMITS)
  return outcome.ok && !outcome.result.timedOut && outcome.result.status === 0
}

async function readRoadmapGit(roadmapDir: string): Promise<RoadmapListProbe['git']> {
  try {
    if (!(await isGitUsable()))
      return undefined
    const [log, changed, tracked] = await Promise.all([
      runGit(roadmapDir, LOG_ARGS),
      runGit(roadmapDir, CHANGED_ARGS),
      runGit(roadmapDir, TRACKED_ARGS),
    ])
    return log === undefined || changed === undefined || tracked === undefined ? undefined : { log, changed, tracked }
  }
  catch {
    return undefined
  }
}

async function runGit(cwd: string, args: string[]): Promise<string | undefined> {
  const outcome = await spawnBin('git', args, cwd, GIT_LIMITS)
  if (!outcome.ok)
    return undefined
  const { result } = outcome
  if (result.timedOut || result.truncated || result.status !== 0)
    return undefined
  return result.stdout
}

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

type RoadmapDirListing
  = { ok: true, dirExists: boolean, names: string[] }
    | { ok: false, message: string }

/** 目錄不存在是正常狀態（回空清單）；列舉本身失敗才回 read-failed */
async function listRoadmapDir(dir: string): Promise<RoadmapDirListing> {
  if (!(await pathExists(dir)))
    return { ok: true, dirExists: false, names: [] }

  try {
    const names = (await readDir(dir))
      .filter(entry => entry.isFile && entry.name.endsWith('.md') && !entry.name.startsWith('.'))
      .map(entry => entry.name)
    return { ok: true, dirExists: true, names }
  }
  catch (error) {
    return { ok: false, message: describe(error) }
  }
}

/** 讀不到就是那一檔讀取失敗：仍列入清單（Other 組），其他卡片不受影響 */
async function readRoadmapFile(dir: string, name: string): Promise<RoadmapFileProbe> {
  const file = join(dir, name)
  const mtime = await readMtime(file)
  try {
    return { name, content: await readTextFile(file), mtime }
  }
  catch (error) {
    return { name, readError: describe(error), mtime }
  }
}

async function readMtime(file: string): Promise<number | undefined> {
  try {
    const { mtime } = await statPath(file)
    return mtime ?? undefined
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
  const changesDir = join(openspecDir, CHANGES_DIR)
  const [specs, changes, archived, parked] = await Promise.all([
    listDirNames(join(openspecDir, SPECS_DIR)),
    listDirNames(changesDir).then(names => names.filter(name => name !== ARCHIVE_SUBDIR)),
    listDirNames(join(changesDir, ARCHIVE_SUBDIR)),
    listParkedFor(projectPath),
  ])
  return { specs, changes, archived, parked }
}

async function listDirNames(dir: string): Promise<string[]> {
  try {
    return (await readDir(dir)).filter(entry => entry.isDirectory).map(entry => entry.name)
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
