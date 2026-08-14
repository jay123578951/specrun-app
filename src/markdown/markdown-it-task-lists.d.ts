/** 上游沒有附型別（@types 也沒有），只補這裡用到的簽章 */
declare module 'markdown-it-task-lists' {
  import type { MarkdownIt } from 'markdown-it'

  export interface TaskListsOptions {
    /** true 才讓 checkbox 可勾；本 App 維持唯讀（勾選是 C4） */
    enabled?: boolean
    label?: boolean
    labelAfter?: boolean
  }

  const taskLists: (md: MarkdownIt, options?: TaskListsOptions) => void
  export default taskLists
}
