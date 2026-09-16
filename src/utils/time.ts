const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const MONTH = 30 * DAY
const YEAR = 365 * DAY

/**
 * 卡片用的相對時間（英文、精簡）：`2h ago`、`3d ago`。
 * 只到單一單位——這是掃描用的時間感，不是精確時刻（精確值放 title）。
 *
 * 同一本機日曆日一律改輸出 24 小時制時分（如 `18:38`）：不帶日期的裸時刻
 * 只有在「必為今日」的前提下才無歧義，因此這條分支蓋過下面所有以 elapsed 分階的寫法
 * ——即使剛過去幾分鐘，只要仍是今天就顯示時刻而非「5m ago」。跨過午夜後兩者不再同一天，
 * 才落回相對寫法。
 */
export function formatRelativeTime(epochMs: number, now: number = Date.now()): string {
  if (isSameLocalDay(epochMs, now))
    return formatClockTime(epochMs)

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

/**
 * 詳情面板建立時刻文案：不含年份的月日時分（如 `09-15 16:38`），24 小時制——
 * 詳情面板需要顯示建立時刻，省略年份換取精簡。滑鼠停留的完整值見 `formatCreatedAtFull`。
 */
export function formatCreatedAt(epochMs: number): string {
  const date = new Date(epochMs)
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${formatClockTime(epochMs)}`
}

/** 含年份的完整建立時刻（如 `2026-09-15 16:38`），供 title 呈現——省略年份的版本跨年後仍要有出處 */
export function formatCreatedAtFull(epochMs: number): string {
  return `${new Date(epochMs).getFullYear()}-${formatCreatedAt(epochMs)}`
}

function isSameLocalDay(a: number, b: number): boolean {
  const da = new Date(a)
  const db = new Date(b)
  return da.getFullYear() === db.getFullYear()
    && da.getMonth() === db.getMonth()
    && da.getDate() === db.getDate()
}

function formatClockTime(epochMs: number): string {
  const date = new Date(epochMs)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
