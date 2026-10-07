import type { CliUpdateCheck } from '../../../src/api/types'
import os from 'node:os'
import { normalizeCliUpdate } from '../../../src/api/normalize-cli-update'
import { runCli, toProbeFailure } from '../../utils/openspec-cli'

const ARGS = ['version', '--check', '--json']

export default defineEventHandler(async (): Promise<CliUpdateCheck> => {
  try {
    const { error, stdout, stderr } = await runCli(ARGS, os.homedir())
    if (!error)
      return normalizeCliUpdate({ exitCode: 0, stdout, stderr })
    if (typeof error.code === 'number')
      return normalizeCliUpdate({ exitCode: error.code, stdout, stderr })
    return normalizeCliUpdate({ exitCode: null, stdout, stderr, failure: toProbeFailure(error, ARGS) })
  }
  catch {
    return { status: 'unavailable' }
  }
})
