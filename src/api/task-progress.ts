/**
 * tasks 檔案的進度解析（純函式，web 與日後的 Tauri 版共用）。
 *
 * openspec 看不見的 change（parked、archived）都得自己算進度，兩邊共用這一份——
 * 「什麼算一個 task」只能有一種認知，否則同一份 tasks.md 在兩頁會顯示不同數字。
 */

import type { ChangeStatus } from './types'
import { isCheckedLine, isTaskLine, splitLines } from '../utils/task-line'

/**
 * 進度現場解析：認 task 行的規則與勾選寫入共用同一份（src/utils/task-line），
 * 兩邊對「什麼算一個 task」的認知才不會分岔。
 */
export function countTasks(source: string): { completedTasks: number, totalTasks: number } {
  let completedTasks = 0
  let totalTasks = 0

  for (const raw of splitLines(source)) {
    const text = raw.replace(/\r?\n$/, '')
    if (!isTaskLine(text))
      continue
    totalTasks++
    if (isCheckedLine(text))
      completedTasks++
  }
  return { completedTasks, totalTasks }
}

/** 與 CLI 的三值語意對齊：沒有 task 就是 no-tasks，全勾完才是 complete */
export function toTaskStatus(completedTasks: number, totalTasks: number): ChangeStatus {
  if (totalTasks === 0)
    return 'no-tasks'
  return completedTasks >= totalTasks ? 'complete' : 'in-progress'
}
