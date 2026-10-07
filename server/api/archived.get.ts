import type { ArchivedListProbe } from '../../src/api/types'
import { resolveTargetDir, runCli, toProbeFailure } from '../utils/openspec-cli'

const ARGS = ['list', '--archived', '--json']

export default defineEventHandler(async (): Promise<ArchivedListProbe> => {
  const target = await resolveTargetDir()
  if (!target.ok)
    return target.probe

  const targetPath = target.targetPath
  const { error, stdout, stderr } = await runCli(ARGS, targetPath)
  if (!error)
    return { targetPath, exitCode: 0, stdout, stderr }

  if (typeof error.code === 'number')
    return { targetPath, exitCode: error.code, stdout, stderr }

  return { targetPath, exitCode: null, stdout, stderr, failure: toProbeFailure(error, ARGS) }
})
