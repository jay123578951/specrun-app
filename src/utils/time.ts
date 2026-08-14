const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const MONTH = 30 * DAY
const YEAR = 365 * DAY

/**
 * 卡片用的相對時間（英文、精簡）：`2h ago`、`3d ago`。
 * 只到單一單位——這是掃描用的時間感，不是精確時刻（精確值放 title）。
 */
export function formatRelativeTime(epochMs: number, now: number = Date.now()): string {
  const elapsed = now - epochMs
  if (elapsed < MINUTE)
    return 'just now'
  if (elapsed < HOUR)
    return `${Math.floor(elapsed / MINUTE)}m ago`
  if (elapsed < DAY)
    return `${Math.floor(elapsed / HOUR)}h ago`
  if (elapsed < MONTH)
    return `${Math.floor(elapsed / DAY)}d ago`
  if (elapsed < YEAR)
    return `${Math.floor(elapsed / MONTH)}mo ago`
  return `${Math.floor(elapsed / YEAR)}y ago`
}

export function formatAbsoluteTime(epochMs: number): string {
  return new Date(epochMs).toLocaleString()
}
