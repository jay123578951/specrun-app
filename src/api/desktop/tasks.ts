import type { TaskToggleInput, ToggleResult } from '../types'
import type { ResolveOutcome } from './tasks-path-cache'
import { toggleTaskLines } from '../../utils/task-line'
import { runCli } from './cli'
import { resolveTarget } from './projects'
import { readTextFile, writeTextFile } from './shell'
import { createTasksPathCache } from './tasks-path-cache'

/**
 * 桌面形態的勾選寫入——App 的唯一寫入通道（對應 web 形態的
 * server/api/changes/[name]/tasks/toggle.post.ts）。
 *
 * 呼叫端只帶 `{ edits: [{ line, expectedText }], checked }`：一或多行以單次讀取、
 * 單次寫回完成，且為全有全無。目標檔案一律由這一側問 `status --change <name> --json`
 * 後自 tasks artifact 的 `existingOutputPaths` 取得，呼叫端無從指定任意路徑。
 */

const tasksPathCache = createTasksPathCache()

export function toggleTask(changeName: string, input: TaskToggleInput): Promise<ToggleResult> {
  // per-change 序列化（design D9）：同一份 tasks 檔案的「重讀 → 比對 → 寫回」不交錯。
  // 桌面形態只有一個 webview，但連按兩下仍會讓後一次讀到前一次還沒寫回的內容。
  return enqueue(changeName, async () => {
    try {
      return await applyToggle(changeName, input)
    }
    catch (error) {
      // 通道本身出事（外殼拒絕 invoke、CLI 解析鏈自己 reject）時的兜底：
      // 這條路對外只回結果、不丟例外，例外逸出的後果是畫面停在寫入中
      return fail('Could not save this task.', describe(error))
    }
  })
}

async function applyToggle(changeName: string, input: TaskToggleInput): Promise<ToggleResult> {
  // 空的 edits 沒有可寫的目標：擋下來，不白跑一次讀檔也不寫回原樣的內容
  if (input.edits.length === 0)
    return fail('This task update was malformed.')

  const target = await resolveTarget()
  if (!target.ok)
    return fail('Could not reach the project folder.', target.probe.failure?.message)

  const targetPath = target.targetPath
  const resolved = await tasksPathCache.resolve(
    targetPath,
    changeName,
    () => resolveViaCli(changeName, targetPath),
  )
  if (!resolved.ok) {
    if (resolved.kind === 'cli-error')
      return fail('Could not locate the tasks file for this change.', resolved.detail)
    // 'no-single-file'：多檔 tasks（非預設 schema）與無檔皆維持唯讀
    return fail('This change has no single tasks file to update.')
  }

  let source: string
  try {
    source = await readTextFile(resolved.path)
  }
  catch (readError) {
    return fail('Could not read the tasks file.', describe(readError))
  }

  // 讀一次、全比對、寫一次：任一行不符即整批放棄，不留半勾殘局
  const toggled = toggleTaskLines(source, input.edits, input.checked)
  if (!toggled.ok) {
    return toggled.reason === 'conflict'
      ? { ok: false, kind: 'conflict' }
      : fail('A target line is not a task item.')
  }

  try {
    await writeTextFile(resolved.path, toggled.content)
  }
  catch (writeError) {
    return fail('Could not save the tasks file.', describe(writeError))
  }

  return { ok: true }
}

/** 記錄未命中時的實際解析：重問一趟 CLI，結果交回 tasksPathCache 判斷能不能記 */
async function resolveViaCli(changeName: string, targetPath: string): Promise<ResolveOutcome> {
  const outcome = await runCli(['status', '--change', changeName, '--json'], targetPath)
  if (!outcome.ok)
    return { kind: 'cli-error', detail: outcome.failure.message }
  // 非零結束時原因在兩股輸出裡（change 不存在走的就是這條）
  if (outcome.exitCode !== 0)
    return { kind: 'cli-error', detail: outcome.stderr.trim() || outcome.stdout.trim() }

  return { kind: 'paths', paths: readTasksPaths(outcome.stdout) }
}

/** 只認 `artifactPaths.tasks.existingOutputPaths`——其他 artifact 的路徑一律不經此通道寫入 */
function readTasksPaths(stdout: string): string[] {
  let entry: unknown
  try {
    const parsed = JSON.parse(stdout) as { artifactPaths?: Record<string, unknown> }
    entry = parsed?.artifactPaths?.tasks
  }
  catch {
    return []
  }

  const paths = (entry as { existingOutputPaths?: unknown })?.existingOutputPaths
  return Array.isArray(paths) ? paths.filter((p): p is string => typeof p === 'string') : []
}

function fail(message: string, detail?: string): ToggleResult {
  return { ok: false, kind: 'failed', message, ...(detail ? { detail } : {}) }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** change 名 → 該 change 的寫入尾端；同名的請求排隊、不同 change 互不阻塞 */
const queues = new Map<string, Promise<unknown>>()

function enqueue<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve()
  // 前一筆成敗都不影響下一筆排程：兩個分支都接同一個 task
  const result = previous.then(task, task)
  const tail = result.catch(() => {})
  queues.set(key, tail)
  void tail.then(() => {
    if (queues.get(key) === tail)
      queues.delete(key)
  })
  return result
}
