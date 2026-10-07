import type { CliUpdateCheck, CliUpdateProbe } from './types'
import { isCliTooOld } from './cli-version'

export function normalizeCliUpdate(probe: CliUpdateProbe): CliUpdateCheck {
  if (isCliTooOld(probe))
    return { status: 'too-old' }
  if (probe.failure || probe.exitCode !== 0)
    return { status: 'unavailable' }

  let update: unknown
  try {
    update = (JSON.parse(probe.stdout) as { update?: unknown } | null)?.update
  }
  catch {
    return { status: 'unavailable' }
  }
  if (typeof update !== 'object' || update === null)
    return { status: 'unavailable' }

  const { status, latest, command } = update as Record<string, unknown>
  if (status === 'current')
    return { status: 'current' }
  if (status === 'available' && typeof latest === 'string' && latest) {
    return typeof command === 'string' && command
      ? { status: 'available', latest, command }
      : { status: 'available', latest }
  }
  return { status: 'unavailable' }
}
