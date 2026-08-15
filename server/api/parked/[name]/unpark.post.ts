import type { ParkActionResult } from '../../../../src/api/types'
import { mkdir, rename } from 'node:fs/promises'
import path from 'node:path'
import { resolveTargetDir } from '../../../utils/openspec-cli'
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
 * `POST /api/parked/:name/unpark`：park 的反向操作（design D3）。
 *
 * 撞名一律拒絕，不覆蓋也不自動改名——park 期間同名 change 又被建出來時，
 * 兩份內容都是真的，只有使用者知道該留哪一份。
 * metadata 的移除失敗同樣可以吞：留下的孤兒紀錄在列舉時被忽略，下次 park 同名時覆寫。
 */

export default defineEventHandler(async (event): Promise<ParkActionResult> => {
  const changeName = getRouterParam(event, 'name', { decode: true }) ?? ''
  const result = await unparkChange(changeName)
  if (!result.ok)
    setResponseStatus(event, 400)
  return result
})

async function unparkChange(changeName: string): Promise<ParkActionResult> {
  if (!isSafeChangeName(changeName))
    return fail('That change name is not valid.')

  const target = await resolveTargetDir()
  if (!target.ok)
    return fail('Could not reach the project folder.', target.probe.failure?.message)

  const git = await resolveGitDir(target.targetPath)
  if (!git.ok)
    return fail('This project has no parked changes to restore.')

  const source = parkedDirOf(git.gitDir, changeName)
  if (!(await isDirectory(source)))
    return fail('That parked change is no longer there.')

  const destination = path.join(target.targetPath, 'openspec', 'changes', changeName)
  if (await pathExists(destination))
    return fail(`A change named "${changeName}" already exists. Rename one of them first.`)

  try {
    await mkdir(path.dirname(destination), { recursive: true })
    await rename(source, destination)
  }
  catch (error) {
    return fail('Could not move this change back into openspec/changes.', describe(error))
  }

  await forgetMetadata(git.gitDir, changeName)
  return { ok: true }
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
