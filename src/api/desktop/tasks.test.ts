import type { ChangeListProbe } from '../types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 桌面形態的勾選寫入。不連真的 Tauri，改注入假的外殼通道（vi.mock('./shell')）、
 * 假的指令執行（vi.mock('./cli')）與假的目標專案解析（vi.mock('./projects')）——
 * 驗的是這一層自己的規則：寫哪一個檔案、比對不過怎麼放棄、失敗分成哪兩類。
 * 翻行本身由 src/utils/task-line.ts 負責，這裡刻意不替換它。
 */

const SOURCE = '# Tasks\n\n- [ ] 1.1 first\n- [ ] 1.2 second\n'
const TASKS_IN_A = '/a/openspec/changes/add-x/tasks.md'
const TASKS_IN_B = '/b/openspec/changes/add-x/tasks.md'

function makeShell(files: Record<string, string>) {
  const store = new Map(Object.entries(files))
  return {
    store,
    pathExists: vi.fn(async (path: string) => store.has(path)),
    readTextFile: vi.fn(async (path: string) => {
      if (!store.has(path))
        throw new Error(`ENOENT: ${path}`)
      return store.get(path)!
    }),
    writeTextFile: vi.fn(async (path: string, contents: string) => {
      store.set(path, contents)
    }),
  }
}

type CliOutcome
  = { ok: true, exitCode: number | null, stdout: string, stderr: string }
    | { ok: false, failure: { kind: string, message: string } }

/** `status --change <name> --json` 的形狀：只有 tasks artifact 的既存路徑會被採用 */
function statusStdout(tasksPaths: string[]): string {
  return JSON.stringify({
    artifactPaths: {
      proposal: { existingOutputPaths: ['/a/openspec/changes/add-x/proposal.md'] },
      tasks: { existingOutputPaths: tasksPaths },
    },
  })
}

function makeCli(byCwd: Record<string, CliOutcome>) {
  return {
    runCli: vi.fn(async (_args: string[], cwd: string): Promise<CliOutcome> => {
      return byCwd[cwd] ?? { ok: false, failure: { kind: 'cli-unavailable', message: `no cli for ${cwd}` } }
    }),
  }
}

function makeProjects(targetPath: string | null) {
  const state = { targetPath }
  const probe: ChangeListProbe = {
    targetPath: '',
    exitCode: null,
    stdout: '',
    stderr: '',
    failure: { kind: 'target-missing', message: 'No project is selected.' },
  }
  return {
    state,
    resolveTarget: vi.fn(async () => (
      state.targetPath === null
        ? { ok: false as const, probe }
        : { ok: true as const, targetPath: state.targetPath }
    )),
  }
}

async function load(
  shell: ReturnType<typeof makeShell>,
  cli: ReturnType<typeof makeCli>,
  projects: ReturnType<typeof makeProjects>,
) {
  vi.doMock('./shell', () => shell)
  vi.doMock('./cli', () => cli)
  vi.doMock('./projects', () => projects)
  const { toggleTask } = await import('./tasks')
  return toggleTask
}

function ran(stdout: string): CliOutcome {
  return { ok: true, exitCode: 0, stdout, stderr: '' }
}

describe('desktop/tasks', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('單行勾選：只翻該行的勾選字元並寫回', async () => {
    const shell = makeShell({ [TASKS_IN_A]: SOURCE })
    const toggleTask = await load(
      shell,
      makeCli({ '/a': ran(statusStdout([TASKS_IN_A])) }),
      makeProjects('/a'),
    )

    expect(await toggleTask('add-x', { edits: [{ line: 2, expectedText: '- [ ] 1.1 first' }], checked: true }))
      .toEqual({ ok: true })
    expect(shell.store.get(TASKS_IN_A)).toBe('# Tasks\n\n- [x] 1.1 first\n- [ ] 1.2 second\n')
  })

  it('多行：一次讀、一次寫，檔案不會被寫超過一次', async () => {
    const shell = makeShell({ [TASKS_IN_A]: SOURCE })
    const toggleTask = await load(
      shell,
      makeCli({ '/a': ran(statusStdout([TASKS_IN_A])) }),
      makeProjects('/a'),
    )

    const result = await toggleTask('add-x', {
      edits: [
        { line: 2, expectedText: '- [ ] 1.1 first' },
        { line: 3, expectedText: '- [ ] 1.2 second' },
      ],
      checked: true,
    })

    expect(result).toEqual({ ok: true })
    expect(shell.readTextFile).toHaveBeenCalledTimes(1)
    expect(shell.writeTextFile).toHaveBeenCalledTimes(1)
    expect(shell.store.get(TASKS_IN_A)).toBe('# Tasks\n\n- [x] 1.1 first\n- [x] 1.2 second\n')
  })

  it('任一行與呼叫端所見不符＝整批放棄，回衝突且完全不寫檔', async () => {
    const shell = makeShell({ [TASKS_IN_A]: SOURCE })
    const toggleTask = await load(
      shell,
      makeCli({ '/a': ran(statusStdout([TASKS_IN_A])) }),
      makeProjects('/a'),
    )

    const result = await toggleTask('add-x', {
      edits: [
        { line: 2, expectedText: '- [ ] 1.1 first' },
        { line: 3, expectedText: '- [ ] 1.2 renamed elsewhere' },
      ],
      checked: true,
    })

    expect(result).toEqual({ ok: false, kind: 'conflict' })
    expect(shell.writeTextFile).not.toHaveBeenCalled()
    expect(shell.store.get(TASKS_IN_A)).toBe(SOURCE)
  })

  it('空 edits：沒有可寫的目標，擋下來，不讀檔也不寫檔', async () => {
    const shell = makeShell({ [TASKS_IN_A]: SOURCE })
    const toggleTask = await load(
      shell,
      makeCli({ '/a': ran(statusStdout([TASKS_IN_A])) }),
      makeProjects('/a'),
    )

    const result = await toggleTask('add-x', { edits: [], checked: true })

    expect(result).toEqual({ ok: false, kind: 'failed', message: 'This task update was malformed.' })
    expect(shell.readTextFile).not.toHaveBeenCalled()
    expect(shell.writeTextFile).not.toHaveBeenCalled()
  })

  it('目標 change 沒有單一 tasks 檔案＝拒絕寫入，不碰任何其他檔案', async () => {
    const shell = makeShell({ [TASKS_IN_A]: SOURCE })
    const toggleTask = await load(
      shell,
      makeCli({ '/a': ran(statusStdout([])) }),
      makeProjects('/a'),
    )

    expect(await toggleTask('add-x', { edits: [{ line: 2, expectedText: '- [ ] 1.1 first' }], checked: true }))
      .toEqual({ ok: false, kind: 'failed', message: 'This change has no single tasks file to update.' })
    expect(shell.writeTextFile).not.toHaveBeenCalled()
  })

  it('讀不到與存不回是兩句不同的話，且都不是衝突', async () => {
    const shell = makeShell({})
    const toggleTask = await load(
      shell,
      makeCli({ '/a': ran(statusStdout([TASKS_IN_A])) }),
      makeProjects('/a'),
    )
    const edit = { edits: [{ line: 2, expectedText: '- [ ] 1.1 first' }], checked: true }

    expect(await toggleTask('add-x', edit)).toMatchObject({
      ok: false,
      kind: 'failed',
      message: 'Could not read the tasks file.',
    })

    shell.store.set(TASKS_IN_A, SOURCE)
    shell.writeTextFile.mockRejectedValueOnce(new Error('EACCES'))
    expect(await toggleTask('add-x', edit)).toMatchObject({
      ok: false,
      kind: 'failed',
      message: 'Could not save the tasks file.',
      detail: 'EACCES',
    })
  })

  it('問不到位置與沒有目標專案，各自回對應的那句話', async () => {
    const shell = makeShell({ [TASKS_IN_A]: SOURCE })
    const projects = makeProjects('/a')
    const toggleTask = await load(
      shell,
      makeCli({ '/a': { ok: false, failure: { kind: 'cli-unavailable', message: 'Could not find "openspec".' } } }),
      projects,
    )
    const edit = { edits: [{ line: 2, expectedText: '- [ ] 1.1 first' }], checked: true }

    expect(await toggleTask('add-x', edit)).toEqual({
      ok: false,
      kind: 'failed',
      message: 'Could not locate the tasks file for this change.',
      detail: 'Could not find "openspec".',
    })

    projects.state.targetPath = null
    expect(await toggleTask('add-x', edit)).toEqual({
      ok: false,
      kind: 'failed',
      message: 'Could not reach the project folder.',
      detail: 'No project is selected.',
    })
  })

  it('切換專案後對同名 change 的勾選落在新專案，舊專案的檔案不動', async () => {
    const shell = makeShell({ [TASKS_IN_A]: SOURCE, [TASKS_IN_B]: SOURCE })
    const projects = makeProjects('/a')
    const toggleTask = await load(
      shell,
      makeCli({ '/a': ran(statusStdout([TASKS_IN_A])), '/b': ran(statusStdout([TASKS_IN_B])) }),
      projects,
    )
    const edit = { edits: [{ line: 2, expectedText: '- [ ] 1.1 first' }], checked: true }

    await toggleTask('add-x', edit)
    projects.state.targetPath = '/b'
    await toggleTask('add-x', edit)

    expect(shell.store.get(TASKS_IN_B)).toBe('# Tasks\n\n- [x] 1.1 first\n- [ ] 1.2 second\n')
    expect(shell.store.get(TASKS_IN_A)).toBe('# Tasks\n\n- [x] 1.1 first\n- [ ] 1.2 second\n')
    expect(shell.writeTextFile.mock.calls.map(([path]) => path)).toEqual([TASKS_IN_A, TASKS_IN_B])
  })

  it('同一個 change 連按兩下：後一次讀到的是前一次寫回後的內容', async () => {
    const shell = makeShell({ [TASKS_IN_A]: SOURCE })
    const toggleTask = await load(
      shell,
      makeCli({ '/a': ran(statusStdout([TASKS_IN_A])) }),
      makeProjects('/a'),
    )

    const [first, second] = await Promise.all([
      toggleTask('add-x', { edits: [{ line: 2, expectedText: '- [ ] 1.1 first' }], checked: true }),
      toggleTask('add-x', { edits: [{ line: 2, expectedText: '- [x] 1.1 first' }], checked: false }),
    ])

    expect(first).toEqual({ ok: true })
    expect(second).toEqual({ ok: true })
    expect(shell.store.get(TASKS_IN_A)).toBe(SOURCE)
  })
})
