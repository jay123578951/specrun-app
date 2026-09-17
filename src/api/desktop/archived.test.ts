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

async function load(shell: ReturnType<typeof makeShell>, projects: ReturnType<typeof makeProjects>) {
  vi.doMock('./shell', () => shell)
  vi.doMock('./projects', () => projects)
  return import('./archived')
}

describe('desktop/archived', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  describe('清單', () => {
    it('目錄列舉為準，每筆現場讀 tasks；日期新的排前面', async () => {
      const shell = makeShell({
        dirs: [REPO, OPENSPEC, ARCHIVE, `${ARCHIVE}/2026-01-02-add-x`, `${ARCHIVE}/2026-02-03-add-y`],
        files: {
          [`${ARCHIVE}/2026-01-02-add-x/tasks.md`]: '- [x] 1.1 done\n- [ ] 1.2 next\n',
          [`${ARCHIVE}/2026-02-03-add-y/tasks.md`]: '- [x] 1.1 done\n',
        },
      })
      const { listArchived } = await load(shell, makeProjects(REPO))

      const result = await listArchived()
      expect(result).toMatchObject({ ok: true, targetPath: REPO })
      expect(result.ok && result.items).toEqual([
        {
          dir: '2026-02-03-add-y',
          name: 'add-y',
          archivedAt: '2026-02-03',
          completedTasks: 1,
          totalTasks: 1,
          status: 'complete',
        },
        {
          dir: '2026-01-02-add-x',
          name: 'add-x',
          archivedAt: '2026-01-02',
          completedTasks: 1,
          totalTasks: 2,
          status: 'in-progress',
        },
      ])
    })

    it('archive 目錄還不存在：問過一次就回空清單，不是錯誤', async () => {
      const shell = makeShell({ dirs: [REPO, OPENSPEC] })
      const { listArchived } = await load(shell, makeProjects(REPO))

      expect(await listArchived()).toEqual({ ok: true, targetPath: REPO, items: [] })
      // 兩分岔的第一岔：根目錄問過（design D2），問完發現不在就直接回空清單，不繼續列目錄
      expect(shell.pathExists).toHaveBeenCalledWith(ARCHIVE)
      expect(shell.readDir).not.toHaveBeenCalled()
    })

    it('archive 目錄存在但列不出來：回可重試的讀取失敗，不是空清單（design D2）', async () => {
      const shell = makeShell({ dirs: [REPO, OPENSPEC, ARCHIVE] })
      // 目錄本身「存在」但列舉這一步失敗（權限之類）：pathExists 答有、readDir 丟錯
      shell.readDir.mockImplementation(async (path: string) => {
        if (path === ARCHIVE)
          throw new Error('EACCES: archive')
        throw new Error(`ENOENT: ${path}`)
      })
      const { listArchived } = await load(shell, makeProjects(REPO))

      const result = await listArchived()
      expect(shell.pathExists).toHaveBeenCalledWith(ARCHIVE)
      expect(result.ok).toBe(false)
      // normalizeArchivedList 把 'read-failed' 轉成 'call-failed'——畫面上才會出現 Try again
      expect(result.ok === false && result.error).toEqual({
        kind: 'call-failed',
        message: 'Could not read the archived list.',
        detail: 'EACCES: archive',
      })
    })

    it('專案沒有 openspec/：回「不是 OpenSpec 專案」，不是讀取失敗', async () => {
      const { listArchived } = await load(makeShell({ dirs: [REPO] }), makeProjects(REPO))

      const result = await listArchived()
      expect(result.ok).toBe(false)
      expect(result.ok === false && result.error).toEqual({
        kind: 'not-openspec-project',
        message: 'The target folder is not an OpenSpec project.',
        detail: `No openspec/ directory at ${REPO}.`,
      })
    })

    it('無目標專案：同樣落在「不是 OpenSpec 專案」這一類', async () => {
      const { listArchived } = await load(makeShell({}), makeProjects(null))

      const result = await listArchived()
      expect(result.ok === false && result.error.kind).toBe('not-openspec-project')
    })

    it('單筆讀不到 tasks：那張卡沒有進度，其餘照常', async () => {
      const shell = makeShell({
        dirs: [REPO, OPENSPEC, ARCHIVE, `${ARCHIVE}/2026-01-02-add-x`, `${ARCHIVE}/2026-01-03-add-y`],
        files: { [`${ARCHIVE}/2026-01-03-add-y/tasks.md`]: '- [ ] 1.1 first\n' },
        unreadable: [`${ARCHIVE}/2026-01-02-add-x/tasks.md`],
      })
      const { listArchived } = await load(shell, makeProjects(REPO))

      const result = await listArchived()
      expect(result.ok && result.items.map(item => [item.name, item.totalTasks])).toEqual([
        ['add-y', 1],
        ['add-x', 0],
      ])
    })

    it('每筆進度不問「這個檔案還在嗎」：只有 archive 根目錄問一次，逐筆 tasks 不問（那個詢問只落在 parked 詳情）', async () => {
      const shell = makeShell({
        dirs: [REPO, OPENSPEC, ARCHIVE, `${ARCHIVE}/2026-01-02-add-x`],
        files: { [`${ARCHIVE}/2026-01-02-add-x/tasks.md`]: '- [ ] 1.1 first\n' },
      })
      const { listArchived } = await load(shell, makeProjects(REPO))

      await listArchived()
      // 根目錄那一問（design D2）之外，不再多問——逐筆 tasks 檔案讀不到就是那張卡沒進度
      expect(shell.pathExists).toHaveBeenCalledTimes(1)
      expect(shell.pathExists).toHaveBeenCalledWith(ARCHIVE)
    })

    it('散落檔案不算一筆：只認目錄', async () => {
      const shell = makeShell({
        dirs: [REPO, OPENSPEC, ARCHIVE, `${ARCHIVE}/2026-01-02-add-x`],
        files: {
          [`${ARCHIVE}/2026-01-02-add-x/tasks.md`]: '- [ ] 1.1 first\n',
          [`${ARCHIVE}/.DS_Store`]: 'junk',
        },
      })
      const { listArchived } = await load(shell, makeProjects(REPO))

      const result = await listArchived()
      expect(result.ok && result.items.map(item => item.dir)).toEqual(['2026-01-02-add-x'])
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
