import type { ChangeListProbe } from '../types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 桌面形態的 parked 清單與詳情。不連真的 Tauri，改注入假的外殼通道
 * （vi.mock('./shell')）與假的目標專案解析（vi.mock('./projects')）——驗的是這一層
 * 自己的規則：清單以目錄為準、詳情的 tabs 來自快照、快照缺件與讀不到怎麼分。
 * 進度計算與摘錄由 src/api/normalize-parked.ts 負責，這裡刻意不替換它。
 */

const REPO = '/repo'
const GIT = '/repo/.git'
const PARKED_ROOT = '/repo/.git/specrun-app/parked'
const METADATA = '/repo/.git/specrun-app/parked.json'

interface FakeTree {
  dirs?: string[]
  files?: Record<string, string>
  /** 存在但讀不到（權限）：pathExists 回 true、readTextFile 丟錯 */
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
  return import('./parked')
}

function metadata(records: Record<string, { parkedAt: string, artifacts: Record<string, string[]> }>): string {
  return JSON.stringify(records)
}

describe('desktop/parked', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  describe('清單', () => {
    it('目錄列舉為準，metadata 只補 park 時間；孤兒紀錄不列出', async () => {
      const shell = makeShell({
        dirs: [REPO, GIT, PARKED_ROOT, `${PARKED_ROOT}/add-x`],
        files: {
          [`${PARKED_ROOT}/add-x/tasks.md`]: '- [x] 1.1 done\n- [ ] 1.2 next\n',
          [`${PARKED_ROOT}/add-x/proposal.md`]: '## Why\n\nBecause it hurts.\n',
          [METADATA]: metadata({
            'add-x': { parkedAt: '2026-01-02T03:04:05.000Z', artifacts: {} },
            'gone-y': { parkedAt: '2026-01-03T00:00:00.000Z', artifacts: {} },
          }),
        },
      })
      const { listParked } = await load(shell, makeProjects(REPO))

      const result = await listParked()
      expect(result).toMatchObject({ ok: true, parkAvailable: true })
      expect(result.ok && result.items).toEqual([{
        name: 'add-x',
        completedTasks: 1,
        totalTasks: 2,
        status: 'in-progress',
        parkedAt: Date.parse('2026-01-02T03:04:05.000Z'),
        summary: 'Because it hurts.',
        createdAt: 1_700_000_000_000,
      }])
    })

    it('metadata 缺項：照樣列出，park 時間為未知', async () => {
      const shell = makeShell({
        dirs: [REPO, GIT, PARKED_ROOT, `${PARKED_ROOT}/add-x`],
        files: { [`${PARKED_ROOT}/add-x/tasks.md`]: '- [ ] 1.1 first\n' },
      })
      const { listParked } = await load(shell, makeProjects(REPO))

      const result = await listParked()
      expect(result.ok && result.items).toEqual([expect.objectContaining({
        name: 'add-x',
        parkedAt: null,
        summary: '',
        totalTasks: 1,
      })])
    })

    it('單筆讀不到不拖垮整份', async () => {
      const shell = makeShell({
        dirs: [REPO, GIT, PARKED_ROOT, `${PARKED_ROOT}/add-x`, `${PARKED_ROOT}/add-y`],
        files: { [`${PARKED_ROOT}/add-y/tasks.md`]: '- [ ] 1.1 first\n' },
        unreadable: [`${PARKED_ROOT}/add-x/tasks.md`],
      })
      const { listParked } = await load(shell, makeProjects(REPO))

      const result = await listParked()
      expect(result.ok && result.items.map(item => [item.name, item.totalTasks])).toEqual([
        ['add-x', 0],
        ['add-y', 1],
      ])
    })

    it('無目標專案：空清單且 park 關掉', async () => {
      const { listParked } = await load(makeShell({}), makeProjects(null))

      expect(await listParked()).toEqual({
        ok: true,
        parkAvailable: false,
        reason: 'not-git-repo',
        items: [],
      })
    })

    it('parked 目錄還不存在：空清單，不是錯誤', async () => {
      const { listParked } = await load(makeShell({ dirs: [REPO, GIT] }), makeProjects(REPO))

      expect(await listParked()).toEqual({ ok: true, parkAvailable: true, items: [] })
    })
  })

  describe('詳情', () => {
    const CHANGE = `${PARKED_ROOT}/add-x`

    function snapshotTree(extra?: Partial<FakeTree>): FakeTree {
      return {
        dirs: [REPO, GIT, PARKED_ROOT, CHANGE, `${CHANGE}/specs`, `${CHANGE}/specs/park`],
        files: {
          [`${CHANGE}/proposal.md`]: '# Proposal\n',
          [`${CHANGE}/tasks.md`]: '- [ ] 1.1 first\n',
          [`${CHANGE}/specs/park/spec.md`]: '# Spec\n',
          [METADATA]: metadata({
            'add-x': {
              parkedAt: '2026-01-02T03:04:05.000Z',
              artifacts: {
                proposal: ['proposal.md'],
                specs: ['specs/park/spec.md'],
                tasks: ['tasks.md'],
              },
            },
          }),
        },
        ...extra,
      }
    }

    it('快照齊備：tabs 依快照的鍵序，路徑顯示為 change 目錄內的相對路徑', async () => {
      const { getParkedDetail } = await load(makeShell(snapshotTree()), makeProjects(REPO))

      const result = await getParkedDetail('add-x')
      expect(result.ok && result.detail.artifacts).toEqual([
        { id: 'proposal', files: [{ path: 'proposal.md', content: '# Proposal\n' }], missing: false },
        { id: 'specs', files: [{ path: 'specs/park/spec.md', content: '# Spec\n' }], missing: false },
        { id: 'tasks', files: [{ path: 'tasks.md', content: '- [ ] 1.1 first\n' }], missing: false },
      ])
    })

    it('快照中某檔已被刪除：詳情照常開啟，該 tab 呈現為尚未建立', async () => {
      const tree = snapshotTree()
      delete tree.files![`${CHANGE}/specs/park/spec.md`]
      const { getParkedDetail } = await load(makeShell(tree), makeProjects(REPO))

      const result = await getParkedDetail('add-x')
      expect(result.ok).toBe(true)
      expect(result.ok && result.detail.artifacts.map(each => [each.id, each.missing])).toEqual([
        ['proposal', false],
        ['specs', true],
        ['tasks', false],
      ])
    })

    it('存在卻讀不到：回報這個 change 讀不起來', async () => {
      const tree = snapshotTree()
      delete tree.files![`${CHANGE}/tasks.md`]
      tree.unreadable = [`${CHANGE}/tasks.md`]
      const { getParkedDetail } = await load(makeShell(tree), makeProjects(REPO))

      const result = await getParkedDetail('add-x')
      expect(result.ok).toBe(false)
      expect(result.ok === false && result.error.detail).toContain('Could not read')
    })

    it('metadata 缺失：退回現場列舉 `*.md`，子目錄整包收成一個 tab', async () => {
      const tree = snapshotTree()
      delete tree.files![METADATA]
      const { getParkedDetail } = await load(makeShell(tree), makeProjects(REPO))

      const result = await getParkedDetail('add-x')
      expect(result.ok && result.detail.artifacts.map(each => [each.id, each.files.map(file => file.path)]))
        .toEqual([
          ['proposal', ['proposal.md']],
          ['specs', ['specs/park/spec.md']],
          ['tasks', ['tasks.md']],
        ])
    })

    it('metadata 缺失時的現場列舉：檔案列出後讀不到判為真失敗，不像快照那一處會略過', async () => {
      // 存不存在的詢問只落在快照讀檔那一處（design D2）；現場列舉這條路完全不問，
      // 列到的項目讀失敗一律是真失敗——即使起因同樣是「檔案已經不在」。
      const tree = snapshotTree()
      delete tree.files![METADATA]
      const shell = makeShell(tree)
      const realReadDir = shell.readDir.getMockImplementation()!
      shell.readDir.mockImplementation(async (path: string) => {
        if (path === CHANGE) {
          return [
            { name: 'ghost.md', isDirectory: false, isFile: true, isSymlink: false },
            { name: 'proposal.md', isDirectory: false, isFile: true, isSymlink: false },
            { name: 'tasks.md', isDirectory: false, isFile: true, isSymlink: false },
          ]
        }
        return realReadDir(path)
      })
      const { getParkedDetail } = await load(shell, makeProjects(REPO))

      const result = await getParkedDetail('add-x')
      expect(result.ok).toBe(false)
      expect(result.ok === false && result.error.detail).toContain('Could not read')
      // 沒問過「這個檔案還在嗎」——現場列舉那條路不問存在與否，直接讀
      expect(shell.pathExists).not.toHaveBeenCalledWith(`${CHANGE}/ghost.md`)
    })

    it('快照路徑逸出 change 目錄：不讀，也不讓詳情失敗', async () => {
      const tree = snapshotTree()
      tree.files![METADATA] = metadata({
        'add-x': {
          parkedAt: '2026-01-02T03:04:05.000Z',
          artifacts: { proposal: ['../../../../openspec/AGENTS.md'] },
        },
      })
      tree.files!['/repo/openspec/AGENTS.md'] = 'secret\n'
      const shell = makeShell(tree)
      const { getParkedDetail } = await load(shell, makeProjects(REPO))

      const result = await getParkedDetail('add-x')
      expect(result.ok && result.detail.artifacts).toEqual([{ id: 'proposal', files: [], missing: true }])
      expect(shell.readTextFile).not.toHaveBeenCalledWith('/repo/openspec/AGENTS.md')
    })

    it('change 目錄已不在：回報讀不起來', async () => {
      const { getParkedDetail } = await load(makeShell({ dirs: [REPO, GIT] }), makeProjects(REPO))

      const result = await getParkedDetail('add-x')
      expect(result.ok === false && result.error.detail).toBe('That parked change is no longer there.')
    })

    it('名稱含分隔符：擋下來，一個檔案都不讀', async () => {
      const shell = makeShell(snapshotTree())
      const { getParkedDetail } = await load(shell, makeProjects(REPO))

      expect(await getParkedDetail('../add-x')).toMatchObject({ ok: false })
      expect(shell.readTextFile).not.toHaveBeenCalled()
    })
  })
})
