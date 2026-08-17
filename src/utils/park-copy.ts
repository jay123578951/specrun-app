import type { ParkUnavailableReason } from '../api'

/**
 * park 不可用的說明文案。卡片按鈕的 tooltip 與 Parked 空落點區塊共用同一句——
 * spec（park-mechanism 降級）要求不同途徑陳述同一個原因，兩處各寫一份遲早分岔。
 */
export function parkUnavailableCopy(reason: ParkUnavailableReason | null): string {
  return reason === 'git-worktree'
    ? 'Parking is not supported in a git worktree'
    : 'Parking needs a git repository — this project has no .git directory'
}
