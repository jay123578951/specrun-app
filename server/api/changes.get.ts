import type { ChangeListProbe } from '../../src/api/types'
import { resolveTargetDir, runCli, toProbeFailure } from '../utils/openspec-cli'

/**
 * `GET /api/changes`：spawn `openspec list --json`，原樣轉送 stdout 與 exit code。
 *
 * 這裡刻意不做任何 normalize——解析與錯誤分類都在 src/api/normalize.ts，
 * M4 的 Tauri 版沒有這個 route，換掉 gateway 實作就能餵同一份純函式（design D1）。
 */

const ARGS = ['list', '--json']

export default defineEventHandler(async (): Promise<ChangeListProbe> => {
  const target = await resolveTargetDir()
  if (!target.ok)
    return target.probe

  const targetPath = target.targetPath
  const { error, stdout, stderr } = await runCli(ARGS, targetPath)
  if (!error)
    return { targetPath, exitCode: 0, stdout, stderr }

  // 非 0 exit：CLI 自己回報的失敗，stdout 可能帶診斷 payload → 原樣轉送給 normalize
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
