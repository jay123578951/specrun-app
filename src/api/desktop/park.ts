import type { ParkActionResult } from '../types'
import type { ParkedRecord } from './parked-store'
import { runCli } from './cli'
import {
  isDirectory,
  isSafeChangeName,
  metadataFileOf,
  parkedDirOf,
  readMetadata,
  resolveGitDir,
  writeMetadata,
} from './parked-store'
import { join, parentDir, toRelative } from './paths'
import { resolveTarget } from './projects'
import { allowPath, makeDir, pathExists, renamePath } from './shell'

/**
 * 桌面形態的 park 與 unpark（對應 web 形態的 server/api/changes/[name]/park.post.ts
 * 與 server/api/parked/[name]/unpark.post.ts）。
 *
 * park 的順序是定死的：**快照 → 搬移 → 寫 metadata**。快照必須在搬移前取（搬走之後
 * openspec 就查不到這個 change 了）；快照或搬移任一步失敗就整個放棄、不留半完成狀態。
 * 只有最後的 metadata 寫入失敗可以吞——「目錄為準」原則兜得住（清單照列、parkedAt
 * 顯示未知、tabs 退回現場列舉）。
 *
 * unpark 是反向操作：撞名一律拒絕，不覆蓋也不自動改名——park 期間同名 change 又被
 * 建出來時，兩份內容都是真的，只有使用者知道該留哪一份。
 */

const CHANGES_DIR = ['openspec', 'changes']

export async function parkChange(changeName: string): Promise<ParkActionResult> {
  try {
    return await moveIntoParked(changeName)
  }
  catch (error) {
    // 通道本身出事（外殼拒絕 invoke）時的兜底：這條路對外只回結果、不丟例外，
    // 例外逸出的後果是卡片停在搬移中的樂觀狀態
    return fail('Could not park this change.', describe(error))
  }
}

export async function unparkChange(changeName: string): Promise<ParkActionResult> {
  try {
    return await moveBackToChanges(changeName)
  }
  catch (error) {
    return fail('Could not unpark this change.', describe(error))
  }
}

async function moveIntoParked(changeName: string): Promise<ParkActionResult> {
  if (!isSafeChangeName(changeName))
    return fail('That change name is not valid.')

  const target = await resolveTarget()
  if (!target.ok)
    return fail('Could not reach the project folder.', target.probe.failure?.message)

  const granted = await regrantAccess(target.targetPath)
  if (!granted.ok)
    return granted.result

  const git = await resolveGitDir(target.targetPath)
  if (!git.ok) {
    return fail(git.reason === 'git-worktree'
      ? 'Parking is not supported in a git worktree.'
      : 'Parking needs a git repository — this project has no .git directory.')
  }

  const source = join(target.targetPath, ...CHANGES_DIR, changeName)
  if (!(await isDirectory(source)))
    return fail('That change is no longer in openspec/changes.')

  const destination = parkedDirOf(git.gitDir, changeName)
  // 先前的異常殘留：不覆蓋、不合併——請使用者自己處理，active 端一動不動
  if (await pathExists(destination))
    return fail(`Something is already parked as "${changeName}". Remove it before parking again.`)

  const snapshot = await readArtifactSnapshot(changeName, target.targetPath)
  if (!snapshot.ok)
    return fail('Could not read this change before parking it.', snapshot.detail)

  try {
    await makeDir(parentDir(destination))
    // .git 與 openspec 同 repo 同卷，整目錄 rename 是原子操作
    await renamePath(source, destination)
  }
  catch (error) {
    return fail('Could not move this change into the parked folder.', describe(error))
  }

  await recordMetadata(git.gitDir, changeName, snapshot.artifacts)
  return { ok: true }
}

async function moveBackToChanges(changeName: string): Promise<ParkActionResult> {
  if (!isSafeChangeName(changeName))
    return fail('That change name is not valid.')

  const target = await resolveTarget()
  if (!target.ok)
    return fail('Could not reach the project folder.', target.probe.failure?.message)

  const granted = await regrantAccess(target.targetPath)
  if (!granted.ok)
    return granted.result

  const git = await resolveGitDir(target.targetPath)
  if (!git.ok)
    return fail('This project has no parked changes to restore.')

  const source = parkedDirOf(git.gitDir, changeName)
  if (!(await isDirectory(source)))
    return fail('That parked change is no longer there.')

  const destination = join(target.targetPath, ...CHANGES_DIR, changeName)
  if (await pathExists(destination))
    return fail(`A change named "${changeName}" already exists. Rename one of them first.`)

  try {
    await makeDir(parentDir(destination))
    await renamePath(source, destination)
  }
  catch (error) {
    return fail('Could not move this change back into openspec/changes.', describe(error))
  }

  await forgetMetadata(git.gitDir, changeName)
  return { ok: true }
}

/**
 * 動手前重取一次授權，不吃「這個路徑授權過了」的記憶。授權通道是在 `.git` 為資料夾時
 * 才連帶放行它的：使用者加入一個還沒 `git init` 的資料夾、之後才在裡面 `git init`，
 * 那份記憶會讓 `.git` 永遠不在放行範圍內，park 因而失敗在存取被拒這種指向錯誤原因的話。
 */
async function regrantAccess(
  targetPath: string,
): Promise<{ ok: true } | { ok: false, result: ParkActionResult }> {
  try {
    await allowPath(targetPath)
    return { ok: true }
  }
  catch (error) {
    return {
      ok: false,
      result: fail(
        'Could not reach the project folder.',
        `Could not get access to that folder: ${describe(error)}`,
      ),
    }
  }
}

type SnapshotOutcome
  = { ok: true, artifacts: Record<string, string[]> }
    | { ok: false, detail?: string }

/**
 * park 當下的 artifactPaths 快照：artifact id → change 目錄內的相對路徑。
 * 鍵序即 tabs 順序，所以 id 一律取自 `artifacts` 陣列（CLI 的權威順序），
 * 沒有既存檔案的 artifact 也留一個空陣列——tab 集合要保持 park 當下的樣貌。
 */
async function readArtifactSnapshot(changeName: string, cwd: string): Promise<SnapshotOutcome> {
  const outcome = await runCli(['status', '--change', changeName, '--json'], cwd)
  if (!outcome.ok)
    return { ok: false, detail: outcome.failure.message }
  // 非零結束時原因在兩股輸出裡（change 不存在走的就是這條）
  if (outcome.exitCode !== 0)
    return { ok: false, detail: outcome.stderr.trim() || outcome.stdout.trim() }

  let payload: {
    changeRoot?: unknown
    artifacts?: unknown
    artifactPaths?: Record<string, unknown>
  }
  try {
    payload = JSON.parse(outcome.stdout)
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
    // 快照存相對路徑：parked 目錄之後可能隨 repo 搬家，絕對路徑會失效。
    // 換算不出來（落在 change 目錄之外）時 toRelative 回原路徑
    artifacts[id] = Array.isArray(existing)
      ? existing
          .filter((each): each is string => typeof each === 'string')
          .map(each => toRelative(each, changeRoot))
      : []
  }
  return { ok: true, artifacts }
}

/** 寫不進去不算失敗：目錄已在該在的位置，其餘資訊有 fallback */
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

async function forgetMetadata(gitDir: string, changeName: string): Promise<void> {
  try {
    const file = metadataFileOf(gitDir)
    const metadata = await readMetadata(file)
    if (!(changeName in metadata))
      return
    delete metadata[changeName]
    await writeMetadata(file, metadata)
  }
  catch {
    // 孤兒紀錄：列舉以目錄為準，自然被忽略
  }
}

function fail(message: string, detail?: string): ParkActionResult {
  return { ok: false, message, ...(detail ? { detail } : {}) }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
