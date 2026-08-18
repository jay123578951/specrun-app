import type { TaskToggleEdit, TaskToggleInput, ToggleResult } from '../../../../../src/api/types'
import type { ResolveOutcome } from '../../../../utils/tasks-path-cache'
import { readFile, writeFile } from 'node:fs/promises'
import { toggleTaskLines } from '../../../../../src/utils/task-line'
import { resolveTargetDir, runCli, toProbeFailure } from '../../../../utils/openspec-cli'
import { createTasksPathCache } from '../../../../utils/tasks-path-cache'

/**
 * `POST /api/changes/:name/tasks/toggle`：App 的唯一寫入端點（design D1）。
 *
 * body 只帶 `{ edits: [{ line, expectedText }], checked }`——一或多行以單次讀取、
 * 單次寫回完成，且為全有全無（design D1／D6）。目標檔案一律由伺服端解析
 * `openspec status --change <name> --json` 後自 tasks artifact 的 `existingOutputPaths`
 * 取得，呼叫端無從指定任意路徑（白名單策略與 C2 的詳情讀檔同構）。
 *
 * 這裡是少數需要「看懂」CLI 輸出的地方，理由同 C2：讀寫什麼由 CLI 決定。
 *
 * 路徑解析結果以 change 名為鍵快取（design D1）：CLI 一趟實測 ~1s，逐次重跑會把
 * in-flight 鎖定窗口拉長到肉眼可感、連續勾選的第二下被吃掉。快取命中且檔案仍存在
 * 才免 CLI；「路徑換了但同名舊檔仍在」的殘餘窗由下方既有的 expectedText 逐行比對兜底。
 */

const tasksPathCache = createTasksPathCache()

export default defineEventHandler(async (event): Promise<ToggleResult> => {
  const changeName = getRouterParam(event, 'name', { decode: true }) ?? ''
  const input = readToggleInput(await readBody(event))

  const result = input
    // per-change 序列化：同一份 tasks 檔案的「重讀 → 比對 → 寫回」不交錯（design 風險欄）
    ? await enqueue(changeName, () => applyToggle(changeName, input))
    : fail('This task update was malformed.')

  if (!result.ok)
    setResponseStatus(event, result.kind === 'conflict' ? 409 : 500)
  return result
})

async function applyToggle(changeName: string, input: TaskToggleInput): Promise<ToggleResult> {
  const resolved = await tasksPathCache.resolve(changeName, () => resolveViaCli(changeName))
  if (!resolved.ok) {
    if (resolved.kind === 'target-missing')
      return fail('Could not reach the project folder.', resolved.detail)
    if (resolved.kind === 'cli-error')
      return fail('Could not locate the tasks file for this change.', resolved.detail)
    // 'no-single-file'：多檔 tasks（非預設 schema）與無檔皆維持唯讀（design D6）
    return fail('This change has no single tasks file to update.')
  }

  const path = resolved.path
  let source: string
  try {
    source = await readFile(path, 'utf8')
  }
  catch (readError) {
    return fail('Could not read the tasks file.', describe(readError))
  }

  // 讀一次、全比對、寫一次：任一行不符即整批放棄，不留半勾殘局（design D6）
  const toggled = toggleTaskLines(source, input.edits, input.checked)
  if (!toggled.ok) {
    return toggled.reason === 'conflict'
      ? { ok: false, kind: 'conflict' }
      : fail('A target line is not a task item.')
  }

  try {
    await writeFile(path, toggled.content, 'utf8')
  }
  catch (writeError) {
    return fail('Could not save the tasks file.', describe(writeError))
  }

  return { ok: true }
}

/** 快取未命中時的實際解析：重跑 CLI，結果交回 tasksPathCache 判斷是否可快取 */
async function resolveViaCli(changeName: string): Promise<ResolveOutcome> {
  const target = await resolveTargetDir()
  if (!target.ok)
    return { kind: 'target-missing', detail: target.probe.failure?.message }

  const args = ['status', '--change', changeName, '--json']
  const { error, stdout, stderr } = await runCli(args, target.targetPath)
  if (error) {
    const detail = typeof error.code === 'number'
      ? (stderr.trim() || stdout.trim())
      : toProbeFailure(error, args).message
    return { kind: 'cli-error', detail }
  }

  return { kind: 'paths', paths: readTasksPaths(stdout) }
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

function readToggleInput(body: unknown): TaskToggleInput | null {
  const input = body as Partial<TaskToggleInput> | null
  if (!input || typeof input !== 'object' || typeof input.checked !== 'boolean')
    return null
  // 空的 edits 沒有可寫的目標——當 malformed 擋下，不放進佇列白跑一次讀檔
  if (!Array.isArray(input.edits) || input.edits.length === 0)
    return null

  const edits: TaskToggleEdit[] = []
  for (const edit of input.edits as Partial<TaskToggleEdit>[]) {
    if (!edit || typeof edit !== 'object')
      return null
    if (typeof edit.line !== 'number' || !Number.isInteger(edit.line) || edit.line < 0)
      return null
    if (typeof edit.expectedText !== 'string')
      return null
    edits.push({ line: edit.line, expectedText: edit.expectedText })
  }

  return { edits, checked: input.checked }
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
