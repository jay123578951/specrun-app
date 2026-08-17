import type { SpecListProbe } from '../../src/api/types'
import { resolveTargetDir, runCli, toProbeFailure } from '../utils/openspec-cli'

/**
 * `GET /api/specs`：spawn `openspec list --specs --json`，原樣轉送 stdout 與 exit code。
 *
 * 與 `changes.get.ts` 同一套姿態——解析與錯誤分類都在 src/api/normalize.ts（design D1）。
 */

const ARGS = ['list', '--specs', '--json']

export default defineEventHandler(async (): Promise<SpecListProbe> => {
  const target = await resolveTargetDir()
  if (!target.ok)
    return target.probe

  const targetPath = target.targetPath
  const { error, stdout, stderr } = await runCli(ARGS, targetPath)
  if (!error)
    return { targetPath, exitCode: 0, stdout, stderr }

  if (typeof error.code === 'number')
    return { targetPath, exitCode: error.code, stdout, stderr }

  return {
    targetPath,
    exitCode: null,
    stdout,
    stderr,
    failure: toProbeFailure(error, ARGS),
  }
})
