import type { ChangeListProbe } from '../types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 桌面形態的 archived 清單與詳情。不連真的 Tauri，改注入假的外殼通道
 * （vi.mock('./shell')）與假的目標專案解析（vi.mock('./projects')）——驗的是這一層
 * 自己的規則：沒有 openspec/ 是「不是 OpenSpec 專案」不是讀取失敗、tabs 的現場列舉
 * 與順序、列得到卻讀不到就是真失敗。日期拆解、進度與排序由
 * src/api/normalize-archived.ts 負責，這裡刻意不替換它。
 */

const REPO = '/repo'
const OPENSPEC = '/repo/openspec'
const ARCHIVE = '/repo/openspec/changes/archive'

interface FakeTree {
  dirs?: string[]
  files?: Record<string, string>
  /** 存在但讀不到（權限）：readTextFile 丟錯 */
  unreadable?: string[]
}

function makeShell(tree: FakeTree) {
  const dirs = new Set(tree.dirs ?? [])
  const files = new Map(Object.entries(tree.files ?? {}))
  const unreadable = new Set(tree.unreadable ?? [])

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
    for (const file of [...files.keys(), ...unreadable]) note(file, false)
    return [...names].map(([name, isDirectory]) => ({
      name,
      isDirectory,
      isFile: !isDirectory,
      isSymlink: false,
    }))
  }

  return {
    readDir: vi.fn(async (path: string) => {
      if (!dirs.has(path))
        throw new Error(`ENOENT: ${path}`)
      return childrenOf(path)
    }),
    statPath: vi.fn(async (path: string) => {
      if (dirs.has(path))
        return { isDirectory: true, birthtime: 1_700_000_000_000 }
      if (files.has(path) || unreadable.has(path))
        return { isDirectory: false, birthtime: 1_700_000_000_000 }
      throw new Error(`ENOENT: ${path}`)
    }),
    pathExists: vi.fn(async (path: string) => dirs.has(path) || files.has(path) || unreadable.has(path)),
    readTextFile: vi.fn(async (path: string) => {
      if (unreadable.has(path))
        throw new Error(`EACCES: ${path}`)
      if (!files.has(path))
        throw new Error(`ENOENT: ${path}`)
      return files.get(path)!
    }),
    writeTextFile: vi.fn(async () => {}),
    makeDir: vi.fn(async () => {}),
    renamePath: vi.fn(async () => {}),
    removePath: vi.fn(async () => {}),
  }
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

function makeReads(probe: ChangeListProbe) {
  return { cliProbe: vi.fn(async (_args: string[], _targetPath: string) => probe) }
}

async function load(
  shell: ReturnType<typeof makeShell>,
  projects: ReturnType<typeof makeProjects>,
  reads: ReturnType<typeof makeReads> = makeReads({ targetPath: REPO, exitCode: 0, stdout: '', stderr: '' }),
) {
  vi.doMock('./shell', () => shell)
  vi.doMock('./projects', () => projects)
  vi.doMock('./reads', () => reads)
  return import('./archived')
}

describe('desktop/archived', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  describe('清單', () => {
    const listJson = JSON.stringify({
      changes: [
        { name: '2026-01-02-add-x', completedTasks: 1, totalTasks: 2, lastModified: '2026-09-01T00:00:00Z', status: 'in-progress' },
        { name: '2026-02-03-add-y', completedTasks: 1, totalTasks: 1, lastModified: '2026-02-03T00:00:00Z', status: 'complete' },
      ],
      root: { path: REPO, source: 'explicit' },
    })

    it('走 CLI 的 list --archived --json，不列目錄也不讀 tasks；日期新的排前面', async () => {
      const shell = makeShell({ dirs: [REPO, OPENSPEC, ARCHIVE] })
      const reads = makeReads({ targetPath: REPO, exitCode: 0, stdout: listJson, stderr: '' })
      const { listArchived } = await load(shell, makeProjects(REPO), reads)

      const result = await listArchived()
      expect(reads.cliProbe).toHaveBeenCalledWith(['list', '--archived', '--json'], REPO)
      expect(shell.readDir).not.toHaveBeenCalled()
      expect(shell.readTextFile).not.toHaveBeenCalled()
      expect(result).toMatchObject({ ok: true, targetPath: REPO })
      expect(result.ok && result.items).toEqual([
        { dir: '2026-02-03-add-y', name: 'add-y', archivedAt: '2026-02-03', completedTasks: 1, totalTasks: 1, status: 'complete' },
        { dir: '2026-01-02-add-x', name: 'add-x', archivedAt: '2026-01-02', completedTasks: 1, totalTasks: 2, status: 'in-progress' },
      ])
    })

    it('changes 為空：回空清單，不是錯誤', async () => {
      const reads = makeReads({ targetPath: REPO, exitCode: 0, stdout: '{"changes":[],"root":{"path":"/repo","source":"explicit"}}', stderr: '' })
      const { listArchived } = await load(makeShell({}), makeProjects(REPO), reads)

      expect(await listArchived()).toEqual({ ok: true, targetPath: REPO, items: [] })
    })

    it('1.13.2 的輸出：回 cli-outdated', async () => {
      const reads = makeReads({ targetPath: REPO, exitCode: 1, stdout: '', stderr: 'error: unknown option \'--archived\'\n' })
      const { listArchived } = await load(makeShell({}), makeProjects(REPO), reads)

      const result = await listArchived()
      expect(result.ok === false && result.error.kind).toBe('cli-outdated')
    })

    it('找不到執行檔：回 cli-unavailable', async () => {
      const reads = makeReads({
        targetPath: REPO,
        exitCode: null,
        stdout: '',
        stderr: '',
        failure: { kind: 'cli-unavailable', message: 'Could not find "openspec".' },
      })
      const { listArchived } = await load(makeShell({}), makeProjects(REPO), reads)

      const result = await listArchived()
      expect(result.ok === false && result.error.kind).toBe('cli-unavailable')
    })

    it('無目標專案：不跑 CLI，歸「不是 OpenSpec 專案」', async () => {
      const reads = makeReads({ targetPath: '', exitCode: 0, stdout: '', stderr: '' })
      const { listArchived } = await load(makeShell({}), makeProjects(null), reads)

      const result = await listArchived()
      expect(result.ok === false && result.error.kind).toBe('not-openspec-project')
      expect(reads.cliProbe).not.toHaveBeenCalled()
    })

    it('通道本身丟例外：收成 call-failed，不逸出', async () => {
      const reads = makeReads({ targetPath: REPO, exitCode: 0, stdout: '', stderr: '' })
      reads.cliProbe.mockRejectedValue(new Error('invoke refused'))
      const { listArchived } = await load(makeShell({}), makeProjects(REPO), reads)

      const result = await listArchived()
      expect(result.ok === false && result.error).toMatchObject({ kind: 'call-failed', detail: 'invoke refused' })
    })
  })

  describe('詳情', () => {
    const DIR = '2026-01-02-add-x'
    const CHANGE = `${ARCHIVE}/${DIR}`

    function changeTree(): FakeTree {
      return {
        dirs: [
          REPO,
          OPENSPEC,
          ARCHIVE,
          CHANGE,
          `${CHANGE}/specs`,
          `${CHANGE}/specs/change-list`,
          `${CHANGE}/specs/park-mechanism`,
          `${CHANGE}/specs/ui`,
          `${CHANGE}/specs/ui/detail-panel`,
        ],
        files: {
          [`${CHANGE}/proposal.md`]: '# Proposal\n',
          [`${CHANGE}/design.md`]: '# Design\n',
          [`${CHANGE}/tasks.md`]: '- [ ] 1.1 first\n',
          [`${CHANGE}/notes.md`]: '# Notes\n',
          [`${CHANGE}/specs/change-list/spec.md`]: '# List\n',
          [`${CHANGE}/specs/park-mechanism/spec.md`]: '# Park\n',
          [`${CHANGE}/specs/ui/detail-panel/spec.md`]: '# Panel\n',
        },
      }
    }

    it('tabs 現場列舉：proposal → design → delta specs → tasks → 其他', async () => {
      const { getArchivedDetail } = await load(makeShell(changeTree()), makeProjects(REPO))

      const result = await getArchivedDetail(DIR)
      expect(result.ok && result.detail.name).toBe(DIR)
      expect(result.ok && result.detail.artifacts.map(each => [each.id, each.files[0]!.path])).toEqual([
        ['proposal', 'proposal.md'],
        ['design', 'design.md'],
        ['specs/change-list', 'specs/change-list/spec.md'],
        ['specs/park-mechanism', 'specs/park-mechanism/spec.md'],
        ['specs/ui/detail-panel', 'specs/ui/detail-panel/spec.md'],
        ['tasks', 'tasks.md'],
        ['notes', 'notes.md'],
      ])
      expect(result.ok && result.detail.artifacts[0]!.files[0]!.content).toBe('# Proposal\n')
    })

    it('列得到卻讀不到：回報失敗，且不問「這個檔案還在嗎」', async () => {
      const tree = changeTree()
      delete tree.files![`${CHANGE}/design.md`]
      tree.unreadable = [`${CHANGE}/design.md`]
      const shell = makeShell(tree)
      const { getArchivedDetail } = await load(shell, makeProjects(REPO))

      const result = await getArchivedDetail(DIR)
      expect(result.ok).toBe(false)
      expect(result.ok === false && result.error.detail).toContain('Could not read design.md.')
      expect(shell.pathExists).not.toHaveBeenCalled()
    })

    it('change 目錄已不在：回報讀不起來', async () => {
      const { getArchivedDetail } = await load(makeShell({ dirs: [REPO, OPENSPEC, ARCHIVE] }), makeProjects(REPO))

      const result = await getArchivedDetail(DIR)
      expect(result.ok === false && result.error.detail).toBe('That archived change is no longer there.')
    })

    it('名稱含分隔符：擋下來，一個檔案都不讀', async () => {
      const shell = makeShell(changeTree())
      const { getArchivedDetail } = await load(shell, makeProjects(REPO))

      const result = await getArchivedDetail('../2026-01-02-add-x')
      expect(result.ok === false && result.error.detail).toBe('That change name is not valid.')
      expect(shell.readTextFile).not.toHaveBeenCalled()
    })
  })
})
