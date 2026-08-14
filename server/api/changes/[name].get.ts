import type { ArtifactFileProbe, ChangeDetailProbe } from '../../../src/api/types'
import { readFile } from 'node:fs/promises'
import { resolveTargetDir, runCli, toProbeFailure } from '../../utils/openspec-cli'

/**
 * `GET /api/changes/:name`：spawn `openspec status --change <name> --json`，
 * 隨即依 CLI 回傳的 `artifactPaths` 讀齊全部既存檔案，一趟打包（design D1）。
 *
 * 這裡唯一「看懂」stdout 的地方就是撈出檔案路徑清單——讀什麼由 CLI 決定，
 * route 不提供依任意路徑讀檔的能力（design D3 白名單）；分類與組裝仍在 normalize。
 */

export default defineEventHandler(async (event): Promise<ChangeDetailProbe> => {
  const changeName = getRouterParam(event, 'name', { decode: true }) ?? ''

  const target = await resolveTargetDir()
  if (!target.ok)
    return { ...target.probe, changeName }

  const targetPath = target.targetPath
  const args = ['status', '--change', changeName, '--json']
  const { error, stdout, stderr } = await runCli(args, targetPath)

  if (error) {
    // 非 0 exit：CLI 自己回報的失敗（change 不存在也走這裡），stdout 帶診斷 payload
    if (typeof error.code === 'number')
      return { targetPath, changeName, exitCode: error.code, stdout, stderr }

    return {
      targetPath,
      changeName,
      exitCode: null,
      stdout,
      stderr,
      failure: toProbeFailure(error, args),
    }
  }

  return {
    targetPath,
    changeName,
    exitCode: 0,
    stdout,
    stderr,
    files: await readArtifactFiles(stdout),
  }
})

/** 只讀 `artifactPaths.<id>.existingOutputPaths` 列出的路徑；stdout 不成形時交給 normalize 報錯 */
async function readArtifactFiles(stdout: string): Promise<Record<string, ArtifactFileProbe[]>> {
  const files: Record<string, ArtifactFileProbe[]> = {}

  let artifactPaths: unknown
  try {
    artifactPaths = (JSON.parse(stdout) as Record<string, unknown>)?.artifactPaths
  }
  catch {
    return files
  }
  if (typeof artifactPaths !== 'object' || artifactPaths === null)
    return files

  for (const [id, entry] of Object.entries(artifactPaths as Record<string, unknown>)) {
    const paths = (entry as { existingOutputPaths?: unknown })?.existingOutputPaths
    if (!Array.isArray(paths))
      continue
    files[id] = await Promise.all(
      paths.filter((p): p is string => typeof p === 'string').map(readOne),
    )
  }

  return files
}

async function readOne(path: string): Promise<ArtifactFileProbe> {
  try {
    return { path, content: await readFile(path, 'utf8') }
  }
  catch (error) {
    return { path, error: error instanceof Error ? error.message : String(error) }
  }
}
