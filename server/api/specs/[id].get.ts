import type { SpecContentProbe } from '../../../src/api/types'
import { resolveTargetDir, runCli, toProbeFailure } from '../../utils/openspec-cli'

/**
 * `GET /api/specs/:id`：spawn `openspec show <id> --type spec`，stdout 即 spec.md 原文。
 *
 * 用動詞在前的 `show` 而非 `spec show`：兩者 stdout 逐 byte 相同，但後者已被 CLI
 * 標記 deprecated。內容不解析、不改寫——spec 不存在時 CLI 以非 0 退出且 stdout 為空，
 * 分類交給 normalize。
 */

export default defineEventHandler(async (event): Promise<SpecContentProbe> => {
  const specId = getRouterParam(event, 'id', { decode: true }) ?? ''

  const target = await resolveTargetDir()
  if (!target.ok)
    return { ...target.probe, specId }

  const targetPath = target.targetPath
  const args = ['show', specId, '--type', 'spec']
  const { error, stdout, stderr } = await runCli(args, targetPath)

  if (!error)
    return { targetPath, specId, exitCode: 0, stdout, stderr }

  // 非 0 exit：CLI 自己回報的失敗（spec 不存在也走這裡），訊息在 stderr
  if (typeof error.code === 'number')
    return { targetPath, specId, exitCode: error.code, stdout, stderr }

  return {
    targetPath,
    specId,
    exitCode: null,
    stdout,
    stderr,
    failure: toProbeFailure(error, args),
  }
})
