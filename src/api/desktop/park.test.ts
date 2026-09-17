import type { ChangeListProbe } from '../types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 桌面形態的 park 與 unpark。不連真的 Tauri，改注入假的外殼通道（vi.mock('./shell')）、
 * 假的指令執行（vi.mock('./cli')）與假的目標專案解析（vi.mock('./projects')）——
 * 驗的是這一層自己的規則：動手前重取授權、快照在搬移之前、哪一步失敗要整個放棄。
 * metadata 的解析與寫入由 parked-store 負責，這裡刻意不替換它。
 */

const REPO = '/repo'
const GIT = '/repo/.git'
const SOURCE = '/repo/openspec/changes/add-x'
const PARKED = '/repo/.git/specrun-app/parked/add-x'
const METADATA = '/repo/.git/specrun-app/parked.json'

interface FakeTree {
  dirs?: string[]
  files?: Record<string, string>
}

function makeShell(tree: FakeTree) {
  const dirs = new Set(tree.dirs ?? [])
  const files = new Map(Object.entries(tree.files ?? {}))
  const writeFails = { value: false }

  const childrenOf = (path: string) => {
    const prefix = `${path}/`
    const names = new Map<string, boolean>()
    const note = (full: string, isDir: boolean) => {
      if (!full.startsWith(prefix))
        return
      const [name, ...rest] = full.slice(prefix.length).split('/')
      names.set(name!, names.get(name!) === true || rest.length > 0 || isDir)
    }
    for (const dir of dirs) note(dir, true)
    for (const file of files.keys()) note(file, false)
    return [...names].map(([name, isDirectory]) => ({
      name,
      isDirectory,
      isFile: !isDirectory,
      isSymlink: false,
    }))
  }

  const move = (from: string, to: string) => {
    for (const dir of [...dirs]) {
      if (dir === from || dir.startsWith(`${from}/`)) {
        dirs.delete(dir)
        dirs.add(to + dir.slice(from.length))
      }
    }
    for (const [file, contents] of [...files]) {
      if (file === from || file.startsWith(`${from}/`)) {
        files.delete(file)
        files.set(to + file.slice(from.length), contents)
      }
    }
  }

  return {
    dirs,
    files,
    writeFails,
    allowPath: vi.fn(async () => {}),
    readDir: vi.fn(async (path: string) => {
      if (!dirs.has(path))
        throw new Error(`ENOENT: ${path}`)
      return childrenOf(path)
    }),
    statPath: vi.fn(async (path: string) => {
      if (dirs.has(path))
        return { isDirectory: true, birthtime: 1 }
      if (files.has(path))
        return { isDirectory: false, birthtime: 1 }
      throw new Error(`ENOENT: ${path}`)
    }),
    pathExists: vi.fn(async (path: string) => dirs.has(path) || files.has(path)),
    readTextFile: vi.fn(async (path: string) => {
      if (!files.has(path))
        throw new Error(`ENOENT: ${path}`)
      return files.get(path)!
    }),
    writeTextFile: vi.fn(async (path: string, contents: string) => {
      if (writeFails.value)
        throw new Error('EACCES: read-only file system')
      files.set(path, contents)
    }),
    makeDir: vi.fn(async (path: string) => {
      dirs.add(path)
    }),
    renamePath: vi.fn(async (from: string, to: string) => {
      if (!dirs.has(from) && !files.has(from))
        throw new Error(`ENOENT: ${from}`)
      move(from, to)
    }),
    removePath: vi.fn(async (path: string) => {
      files.delete(path)
      dirs.delete(path)
    }),
  }
}

type CliOutcome
  = { ok: true, exitCode: number | null, stdout: string, stderr: string }
    | { ok: false, failure: { kind: string, message: string } }

function statusStdout(): string {
  return JSON.stringify({
    changeRoot: SOURCE,
    artifacts: [{ id: 'proposal' }, { id: 'tasks' }, { id: 'design' }],
    artifactPaths: {
      proposal: { existingOutputPaths: [`${SOURCE}/proposal.md`] },
      tasks: { existingOutputPaths: [`${SOURCE}/tasks.md`] },
      design: { existingOutputPaths: [] },
    },
  })
}

function makeCli(outcome: CliOutcome) {
  return { runCli: vi.fn(async () => outcome) }
}

function makeProjects(targetPath: string | null) {
  const probe: ChangeListProbe = {
    targetPath: '',
    exitCode: null,
    stdout: '',
    stderr: '',
    failure: { kind: 'target-missing', message: 'No project is selected.' },
  }
  return {
    resolveTarget: vi.fn(async () => (
      targetPath === null
        ? { ok: false as const, probe }
        : { ok: true as const, targetPath }
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
  return import('./park')
}

/** 一個可以 park 的專案：`.git` 是資料夾，change 還在 openspec/changes 底下 */
function repoWithChange(): FakeTree {
  return {
    dirs: [REPO, GIT, '/repo/openspec', '/repo/openspec/changes', SOURCE],
    files: {
      [`${SOURCE}/proposal.md`]: '## Why\n\nBecause.\n',
      [`${SOURCE}/tasks.md`]: '- [ ] 1.1 first\n',
    },
  }
}

function ran(stdout: string): CliOutcome {
  return { ok: true, exitCode: 0, stdout, stderr: '' }
}

describe('desktop/park', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  describe('park', () => {
    it('搬走目錄並記下相對路徑的快照，動手前重取一次授權', async () => {
      const shell = makeShell(repoWithChange())
      const cli = makeCli(ran(statusStdout()))
      const { parkChange } = await load(shell, cli, makeProjects(REPO))

      expect(await parkChange('add-x')).toEqual({ ok: true })
      expect(shell.allowPath).toHaveBeenCalledWith(REPO)
      expect(shell.dirs.has(SOURCE)).toBe(false)
      expect(shell.files.get(`${PARKED}/proposal.md`)).toBe('## Why\n\nBecause.\n')

      const metadata = JSON.parse(shell.files.get(METADATA)!)
      expect(metadata['add-x'].artifacts).toEqual({
        proposal: ['proposal.md'],
        tasks: ['tasks.md'],
        design: [],
      })
      expect(typeof metadata['add-x'].parkedAt).toBe('string')
    })

    it('目的地已有同名殘留：拒絕，來源一動不動', async () => {
      const tree = repoWithChange()
      tree.dirs!.push(PARKED)
      const shell = makeShell(tree)
      const { parkChange } = await load(shell, makeCli(ran(statusStdout())), makeProjects(REPO))

      const result = await parkChange('add-x')
      expect(result.ok).toBe(false)
      expect(result).toMatchObject({ message: expect.stringContaining('already parked') })
      expect(shell.dirs.has(SOURCE)).toBe(true)
      expect(shell.renamePath).not.toHaveBeenCalled()
    })

    it('來源已不在 openspec/changes：拒絕且不問 CLI', async () => {
      const tree = repoWithChange()
      tree.dirs = tree.dirs!.filter(dir => dir !== SOURCE)
      const shell = makeShell(tree)
      const cli = makeCli(ran(statusStdout()))
      const { parkChange } = await load(shell, cli, makeProjects(REPO))

      expect(await parkChange('add-x')).toEqual({
        ok: false,
        message: 'That change is no longer in openspec/changes.',
      })
      expect(cli.runCli).not.toHaveBeenCalled()
    })

    it('快照取不到：整個放棄，不搬移也不留半完成狀態', async () => {
      const shell = makeShell(repoWithChange())
      const cli = makeCli({ ok: false, failure: { kind: 'cli-unavailable', message: 'openspec not found' } })
      const { parkChange } = await load(shell, cli, makeProjects(REPO))

      expect(await parkChange('add-x')).toEqual({
        ok: false,
        message: 'Could not read this change before parking it.',
        detail: 'openspec not found',
      })
      expect(shell.renamePath).not.toHaveBeenCalled()
      expect(shell.dirs.has(SOURCE)).toBe(true)
    })

    it('metadata 寫不進去仍回成功：目錄已在該在的位置', async () => {
      const shell = makeShell(repoWithChange())
      shell.writeFails.value = true
      const { parkChange } = await load(shell, makeCli(ran(statusStdout())), makeProjects(REPO))

      expect(await parkChange('add-x')).toEqual({ ok: true })
      expect(shell.dirs.has(PARKED)).toBe(true)
      expect(shell.files.has(METADATA)).toBe(false)
    })

    it('git worktree：提示陳述的是 worktree 不支援', async () => {
      const tree = repoWithChange()
      tree.dirs = tree.dirs!.filter(dir => dir !== GIT)
      tree.files![GIT] = 'gitdir: /elsewhere\n'
      const { parkChange } = await load(makeShell(tree), makeCli(ran(statusStdout())), makeProjects(REPO))

      expect(await parkChange('add-x')).toEqual({
        ok: false,
        message: 'Parking is not supported in a git worktree.',
      })
    })

    it('完全沒有 `.git`：提示陳述的是非 git repository', async () => {
      const tree = repoWithChange()
      tree.dirs = tree.dirs!.filter(dir => dir !== GIT)
      const { parkChange } = await load(makeShell(tree), makeCli(ran(statusStdout())), makeProjects(REPO))

      expect(await parkChange('add-x')).toEqual({
        ok: false,
        message: 'Parking needs a git repository — this project has no .git directory.',
      })
    })

    it('搬移失敗：整個放棄，不寫 metadata，且訊息陳述搬移失敗', async () => {
      const shell = makeShell(repoWithChange())
      shell.renamePath.mockRejectedValueOnce(new Error('EACCES: permission denied'))
      const { parkChange } = await load(shell, makeCli(ran(statusStdout())), makeProjects(REPO))

      expect(await parkChange('add-x')).toEqual({
        ok: false,
        message: 'Could not move this change into the parked folder.',
        detail: 'EACCES: permission denied',
      })
      expect(shell.dirs.has(SOURCE)).toBe(true)
      expect(shell.dirs.has(PARKED)).toBe(false)
      expect(shell.writeTextFile).not.toHaveBeenCalled()
    })

    it('無效 change 名：擋下來，一次都不碰檔案系統', async () => {
      const shell = makeShell(repoWithChange())
      const cli = makeCli(ran(statusStdout()))
      const { parkChange } = await load(shell, cli, makeProjects(REPO))

      expect(await parkChange('../escape')).toEqual({
        ok: false,
        message: 'That change name is not valid.',
      })
      expect(shell.allowPath).not.toHaveBeenCalled()
      expect(cli.runCli).not.toHaveBeenCalled()
    })

    it('重取授權失敗：整個放棄，不去查 `.git` 也不搬移', async () => {
      const shell = makeShell(repoWithChange())
      shell.allowPath.mockRejectedValueOnce(new Error('scope denied'))
      const cli = makeCli(ran(statusStdout()))
      const { parkChange } = await load(shell, cli, makeProjects(REPO))

      const result = await parkChange('add-x')
      expect(result.ok).toBe(false)
      expect(result).toMatchObject({ message: 'Could not reach the project folder.' })
      expect(shell.readDir).not.toHaveBeenCalled()
      expect(shell.renamePath).not.toHaveBeenCalled()
      expect(cli.runCli).not.toHaveBeenCalled()
    })

    it('授權不吃記憶：連續兩次操作各自重取一次，不會因為上次取過就跳過', async () => {
      const shell = makeShell(repoWithChange())
      const { parkChange } = await load(shell, makeCli(ran(statusStdout())), makeProjects(REPO))

      // 第二次呼叫因第一次已搬走來源而失敗，這裡只在意授權呼叫次數
      // （regrantAccess 排在 resolveTarget 之後、任何後續判斷之前）
      await parkChange('add-x')
      await parkChange('add-x')

      expect(shell.allowPath).toHaveBeenCalledTimes(2)
    })

    it('通道本身丟例外（非預期）：不外洩，回一般化的失敗結果', async () => {
      const shell = makeShell(repoWithChange())
      const projects = {
        resolveTarget: vi.fn(async () => {
          throw new Error('boom')
        }),
      }
      const { parkChange } = await load(shell, makeCli(ran(statusStdout())), projects)

      await expect(parkChange('add-x')).resolves.toMatchObject({
        ok: false,
        message: 'Could not park this change.',
      })
    })
  })

  describe('unpark', () => {
    /** 一個已 park 的 change：目錄在 .git 底下，openspec/changes 沒有同名 */
    function parkedRepo(): FakeTree {
      return {
        dirs: [REPO, GIT, '/repo/openspec', '/repo/openspec/changes', PARKED],
        files: {
          [`${PARKED}/proposal.md`]: '## Why\n\nBecause.\n',
          [METADATA]: JSON.stringify({ 'add-x': { parkedAt: '2026-01-01T00:00:00.000Z', artifacts: {} } }),
        },
      }
    }

    it('搬回 openspec/changes 並移除 metadata 紀錄', async () => {
      const shell = makeShell(parkedRepo())
      const { unparkChange } = await load(shell, makeCli(ran('{}')), makeProjects(REPO))

      expect(await unparkChange('add-x')).toEqual({ ok: true })
      expect(shell.allowPath).toHaveBeenCalledWith(REPO)
      expect(shell.files.get(`${SOURCE}/proposal.md`)).toBe('## Why\n\nBecause.\n')
      expect(shell.dirs.has(PARKED)).toBe(false)
      expect(JSON.parse(shell.files.get(METADATA)!)).toEqual({})
    })

    it('撞名：拒絕，不覆蓋也不自動改名', async () => {
      const tree = parkedRepo()
      tree.dirs!.push(SOURCE)
      tree.files![`${SOURCE}/proposal.md`] = 'the other one\n'
      const shell = makeShell(tree)
      const { unparkChange } = await load(shell, makeCli(ran('{}')), makeProjects(REPO))

      const result = await unparkChange('add-x')
      expect(result).toMatchObject({ ok: false, message: expect.stringContaining('already exists') })
      expect(shell.files.get(`${SOURCE}/proposal.md`)).toBe('the other one\n')
      expect(shell.dirs.has(PARKED)).toBe(true)
    })

    it('來源已不在：拒絕', async () => {
      const tree = parkedRepo()
      tree.dirs = tree.dirs!.filter(dir => dir !== PARKED)
      const shell = makeShell(tree)
      const { unparkChange } = await load(shell, makeCli(ran('{}')), makeProjects(REPO))

      expect(await unparkChange('add-x')).toEqual({
        ok: false,
        message: 'That parked change is no longer there.',
      })
      expect(shell.renamePath).not.toHaveBeenCalled()
    })

    it('metadata 移除失敗仍回成功', async () => {
      const shell = makeShell(parkedRepo())
      const { unparkChange } = await load(shell, makeCli(ran('{}')), makeProjects(REPO))
      shell.writeFails.value = true

      expect(await unparkChange('add-x')).toEqual({ ok: true })
      expect(shell.dirs.has(SOURCE)).toBe(true)
    })

    it('沒有 `.git`：提示這個專案沒有可還原的 parked change', async () => {
      // 全新的最小樹，不含任何 `.git` 底下的路徑——parkedRepo() 的 parked 內容本身
      // 就落在 `.git/` 底下，留著任何一份都會讓假外殼從檔案路徑反推出 `.git` 還在
      const tree: FakeTree = { dirs: [REPO, '/repo/openspec', '/repo/openspec/changes'] }
      const { unparkChange } = await load(makeShell(tree), makeCli(ran('{}')), makeProjects(REPO))

      expect(await unparkChange('add-x')).toEqual({
        ok: false,
        message: 'This project has no parked changes to restore.',
      })
    })

    it('搬移失敗：整個放棄，parked 端一動不動', async () => {
      const shell = makeShell(parkedRepo())
      shell.renamePath.mockRejectedValueOnce(new Error('EACCES: permission denied'))
      const { unparkChange } = await load(shell, makeCli(ran('{}')), makeProjects(REPO))

      expect(await unparkChange('add-x')).toEqual({
        ok: false,
        message: 'Could not move this change back into openspec/changes.',
        detail: 'EACCES: permission denied',
      })
      expect(shell.dirs.has(PARKED)).toBe(true)
      expect(shell.dirs.has(SOURCE)).toBe(false)
    })

    it('無效 change 名：擋下來，一次都不碰檔案系統', async () => {
      const shell = makeShell(parkedRepo())
      const { unparkChange } = await load(shell, makeCli(ran('{}')), makeProjects(REPO))

      expect(await unparkChange('nested/name')).toEqual({
        ok: false,
        message: 'That change name is not valid.',
      })
      expect(shell.allowPath).not.toHaveBeenCalled()
    })

    it('重取授權失敗：整個放棄，不搬移', async () => {
      const shell = makeShell(parkedRepo())
      shell.allowPath.mockRejectedValueOnce(new Error('scope denied'))
      const { unparkChange } = await load(shell, makeCli(ran('{}')), makeProjects(REPO))

      const result = await unparkChange('add-x')
      expect(result.ok).toBe(false)
      expect(result).toMatchObject({ message: 'Could not reach the project folder.' })
      expect(shell.renamePath).not.toHaveBeenCalled()
    })

    it('通道本身丟例外（非預期）：不外洩，回一般化的失敗結果', async () => {
      const shell = makeShell(parkedRepo())
      const projects = {
        resolveTarget: vi.fn(async () => {
          throw new Error('boom')
        }),
      }
      const { unparkChange } = await load(shell, makeCli(ran('{}')), projects)

      await expect(unparkChange('add-x')).resolves.toMatchObject({
        ok: false,
        message: 'Could not unpark this change.',
      })
    })
  })

  it('無目標專案：兩條路都停在專案這一關', async () => {
    const shell = makeShell({})
    const { parkChange, unparkChange } = await load(shell, makeCli(ran('{}')), makeProjects(null))

    expect(await parkChange('add-x')).toEqual({
      ok: false,
      message: 'Could not reach the project folder.',
      detail: 'No project is selected.',
    })
    expect(await unparkChange('add-x')).toMatchObject({ ok: false })
    expect(shell.allowPath).not.toHaveBeenCalled()
  })
})
