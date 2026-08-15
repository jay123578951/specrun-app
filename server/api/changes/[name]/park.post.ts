import type { ParkActionResult } from '../../../../src/api/types'
import type { ParkedRecord } from '../../../utils/parked-store'
import { mkdir, rename } from 'node:fs/promises'
import path from 'node:path'
import { resolveTargetDir, runCli, toProbeFailure } from '../../../utils/openspec-cli'
import {
  isDirectory,
  isSafeChangeName,
  metadataFileOf,
  parkedDirOf,
  pathExists,
  readMetadata,
  resolveGitDir,
  writeMetadata,
} from '../../../utils/parked-store'

/**
 * `POST /api/changes/:name/park`：把 change 目錄搬出 `openspec/changes/`。
 *
 * 順序是 design D3 定死的：**快照 → 搬移 → 寫 metadata**。
 * 快照必須在搬移前取（搬走之後 openspec 就查不到這個 change 了）；快照或搬移任一步失敗
 * 就整個放棄、不留半完成狀態。只有最後的 metadata 寫入失敗可以吞——「目錄為準」原則
 * 兜得住（清單照列、parkedAt 顯示未知、tabs 退回現場列舉）。
 */

export default defineEventHandler(async (event): Promise<ParkActionResult> => {
  const changeName = getRouterParam(event, 'name', { decode: true }) ?? ''
  const result = await parkChange(changeName)
  if (!result.ok)
    setResponseStatus(event, 400)
  return result
})

async function parkChange(changeName: string): Promise<ParkActionResult> {
  if (!isSafeChangeName(changeName))
    return fail('That change name is not valid.')

  const target = await resolveTargetDir()
  if (!target.ok)
    return fail('Could not reach the project folder.', target.probe.failure?.message)

  const git = await resolveGitDir(target.targetPath)
  if (!git.ok) {
    return fail(git.reason === 'git-worktree'
      ? 'Parking is not supported in a git worktree.'
      : 'Parking needs a git repository — this project has no .git directory.')
  }

  const source = path.join(target.targetPath, 'openspec', 'changes', changeName)
  if (!(await isDirectory(source)))
    return fail('That change is no longer in openspec/changes.')

  const destination = parkedDirOf(git.gitDir, changeName)
  // 先前的異常殘留：不覆蓋、不合併——請使用者自己處理，active 端一動不動（spec 殘留拒絕）
  if (await pathExists(destination))
    return fail(`Something is already parked as "${changeName}". Remove it before parking again.`)

  const snapshot = await readArtifactSnapshot(changeName, target.targetPath)
  if (!snapshot.ok)
    return fail('Could not read this change before parking it.', snapshot.detail)

  try {
    await mkdir(path.dirname(destination), { recursive: true })
    // .git 與 openspec 同 repo 同卷，整目錄 rename 是原子操作
    await rename(source, destination)
  }
  catch (error) {
    return fail('Could not move this change into the parked folder.', describe(error))
  }

  await recordMetadata(git.gitDir, changeName, snapshot.artifacts)
  return { ok: true }
}

type SnapshotOutcome
  = { ok: true, artifacts: Record<string, string[]> }
    | { ok: false, detail?: string }

/**
 * park 當下的 artifactPaths 快照（design D2）：artifact id → change 目錄內的相對路徑。
 * 鍵序即 tabs 順序，所以 id 一律取自 `artifacts` 陣列（CLI 的權威順序），
 * 沒有既存檔案的 artifact 也留一個空陣列——tab 集合要保持 park 當下的樣貌。
 */
async function readArtifactSnapshot(changeName: string, cwd: string): Promise<SnapshotOutcome> {
  const args = ['status', '--change', changeName, '--json']
  const { error, stdout, stderr } = await runCli(args, cwd)
  if (error) {
    const detail = typeof error.code === 'number'
      ? (stderr.trim() || stdout.trim())
      : toProbeFailure(error, args).message
    return { ok: false, detail }
  }

  let payload: {
    changeRoot?: unknown
    artifacts?: unknown
    artifactPaths?: Record<string, unknown>
  }
  try {
    payload = JSON.parse(stdout)
  }
  catch {
    return { ok: false, detail: 'The openspec response could not be parsed.' }
  }

  const changeRoot = typeof payload.changeRoot === 'string' ? payload.changeRoot : ''
  const paths = payload.artifactPaths ?? {}
  const ids = Array.isArray(payload.artifacts)
    ? payload.artifacts
        .map(raw => (raw as { id?: unknown })?.id)
        .filter((id): id is string => typeof id === 'string')
    : Object.keys(paths)

  const artifacts: Record<string, string[]> = {}
  for (const id of ids) {
    const existing = (paths[id] as { existingOutputPaths?: unknown })?.existingOutputPaths
    artifacts[id] = Array.isArray(existing)
      ? existing
          .filter((each): each is string => typeof each === 'string')
          .map(each => toRelative(each, changeRoot))
      : []
  }
  return { ok: true, artifacts }
}

/** 快照存相對路徑：parked 目錄之後可能隨 repo 搬家，絕對路徑會失效 */
function toRelative(absolute: string, changeRoot: string): string {
  if (!changeRoot)
    return absolute
  const relative = path.relative(changeRoot, absolute)
  return relative && !relative.startsWith('..') ? relative : absolute
}

/** 寫不進去不算失敗（design D3 第 3 步）：目錄已在該在的位置，其餘資訊有 fallback */
async function recordMetadata(
  gitDir: string,
  changeName: string,
  artifacts: Record<string, string[]>,
): Promise<void> {
  try {
    const file = metadataFileOf(gitDir)
    const metadata = await readMetadata(file)
    const record: ParkedRecord = { parkedAt: new Date().toISOString(), artifacts }
    await writeMetadata(file, { ...metadata, [changeName]: record })
  }
  catch {
    // 「目錄為準」兜底：清單照列這個 change，parkedAt 顯示未知
  }
}

function fail(message: string, detail?: string): ParkActionResult {
  return { ok: false, message, ...(detail ? { detail } : {}) }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
