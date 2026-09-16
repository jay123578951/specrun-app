import { describe, expect, it } from 'vitest'
import { formatCreatedAt, formatCreatedAtFull, formatRelativeTime } from './time'

/** 本機時間建構：避免用 ISO/UTC 字面值，兩端都用同一套本機時鐘換算，測試才不受執行環境時區影響 */
function local(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): number {
  return new Date(year, month - 1, day, hour, minute, second).getTime()
}

describe('formatRelativeTime：既有相對寫法各階（沿用既有輸出，不因新增同日分支而改變）', () => {
  // 分／時兩階刻意跨過午夜邊界，確保加入「同一天顯示時分」分支後這裡的既有案例仍然成立
  // ——同一天的裸時刻會被新分支蓋過，只有跨日的案例才留在相對寫法裡
  it('未滿一分鐘：just now', () => {
    const now = local(2026, 3, 2, 0, 0, 10)
    const epochMs = now - 15_000 // 2026-03-01 23:59:55，跨日
    expect(formatRelativeTime(epochMs, now)).toBe('just now')
  })

  it('未滿一小時：Xm ago', () => {
    const now = local(2026, 3, 2, 0, 0, 10)
    const epochMs = now - 40 * 60_000 // 2026-03-01 23:20:10，跨日
    expect(formatRelativeTime(epochMs, now)).toBe('40m ago')
  })

  it('未滿一天：Xh ago', () => {
    const now = local(2026, 3, 2, 0, 0, 10)
    const epochMs = now - 3 * 60 * 60_000 // 2026-03-01 21:00:10，跨日
    expect(formatRelativeTime(epochMs, now)).toBe('3h ago')
  })

  it('未滿一月：Xd ago', () => {
    const now = local(2026, 3, 5, 12, 0, 0)
    const epochMs = now - 3 * 24 * 60 * 60_000 // 三天前
    expect(formatRelativeTime(epochMs, now)).toBe('3d ago')
  })

  it('未滿一年：Xmo ago', () => {
    const now = local(2026, 6, 1, 12, 0, 0)
    const epochMs = now - 61 * 24 * 60 * 60_000 // 61 天前，落在 2 個月階
    expect(formatRelativeTime(epochMs, now)).toBe('2mo ago')
  })

  it('滿一年：Xy ago', () => {
    const now = local(2027, 3, 2, 12, 0, 0)
    const epochMs = now - 400 * 24 * 60 * 60_000 // 400 天前
    expect(formatRelativeTime(epochMs, now)).toBe('1y ago')
  })
})

describe('formatRelativeTime：同一本機日曆日顯示時刻', () => {
  it('同日：輸出 24 小時制時分，即使 elapsed 落在其他相對階也不顯示相對寫法', () => {
    const now = local(2026, 3, 15, 18, 40, 0)
    const epochMs = local(2026, 3, 15, 16, 38, 0) // 同日、已超過一小時
    expect(formatRelativeTime(epochMs, now)).toBe('16:38')
  })

  it('同日：時、分個位數需補零', () => {
    const now = local(2026, 3, 10, 14, 0, 0)
    const epochMs = local(2026, 3, 10, 5, 7, 0)
    expect(formatRelativeTime(epochMs, now)).toBe('05:07')
  })

  it('跨日回到相對寫法：昨天的時刻改顯示 Xh ago', () => {
    const epochMs = local(2026, 3, 14, 18, 38, 0)
    const now = local(2026, 3, 15, 9, 0, 0) // 隔天，相距 14h22m
    expect(formatRelativeTime(epochMs, now)).toBe('14h ago')
  })

  it('午夜前後的分界：同一個 epoch，午夜前顯示時分、午夜後顯示相對', () => {
    const epochMs = local(2026, 3, 15, 23, 50, 0)

    const beforeMidnight = local(2026, 3, 15, 23, 55, 0)
    expect(formatRelativeTime(epochMs, beforeMidnight)).toBe('23:50')

    const afterMidnight = local(2026, 3, 16, 0, 5, 0)
    expect(formatRelativeTime(epochMs, afterMidnight)).toBe('15m ago')
  })
})

describe('formatCreatedAt／formatCreatedAtFull：詳情面板建立時刻文案', () => {
  it('不含年份的月日時分，時分為 24 小時制', () => {
    expect(formatCreatedAt(local(2026, 9, 15, 16, 38, 0))).toBe('09-15 16:38')
  })

  it('含年份的完整值供 title 使用', () => {
    expect(formatCreatedAtFull(local(2026, 9, 15, 16, 38, 0))).toBe('2026-09-15 16:38')
  })

  it('月、日、時、分個位數皆補零', () => {
    expect(formatCreatedAt(local(2026, 1, 5, 8, 3, 0))).toBe('01-05 08:03')
  })
})
