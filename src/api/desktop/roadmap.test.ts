import type { ChangeListProbe } from '../types'
import type { SpawnOutcome } from './shell'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 桌面形態的 roadmap 清單（對應 server/api/roadmap.get.ts 的行為）。不連真的 Tauri，
 * 改注入假的外殼通道（vi.mock('./shell')）與假的目標專案解析（vi.mock('./projects')）
 * ——讓 `./parked-store`、`./paths` 與 `../normalize-roadmap` 照常對假外殼跑真邏輯，
 * 驗的是 roadmap.ts 自己的 IO 規則：讀取範圍固定、目錄不存在不是錯誤、單檔讀不到
 * 只標記該檔、parked 名稱沿用既有的 listParkedNames。
 */

const REPO = '/repo'
const OPENSPEC = '/repo/openspec'
const ROADMAP = '/repo/openspec/roadmap'
const GIT = '/repo/.git'
const PARKED = '/repo/.git/specrun-app/parked'

interface FakeTree {
  dirs?: string[]
  files?: Record<string, string>
  /** 存在但讀不到（權限）：readTextFile 丟錯 */
  unreadable?: string[]
  mtimes?: Record<string, number>
  /** stat 本身失敗（檔案在 readdir 之後被刪、權限問題）：statPath 丟錯 */
  statFailures?: string[]
}

function makeShell(tree: FakeTree) {
  const dirs = new Set(tree.dirs ?? [])
  const files = new Map(Object.entries(tree.files ?? {}))
  const unreadable = new Set(tree.unreadable ?? [])
  const mtimes = new Map(Object.entries(tree.mtimes ?? {}))
  const statFailures = new Set(tree.statFailures ?? [])

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

  let readDirImpl = async (path: string) => {
    if (!dirs.has(path))
      throw new Error(`ENOENT: ${path}`)
    return childrenOf(path)
  }

  const shell = {
    readDir: vi.fn(async (path: string) => readDirImpl(path)),
    statPath: vi.fn(async (path: string) => {
      if (statFailures.has(path))
        throw new Error(`EACCES: stat ${path}`)
      if (dirs.has(path))
        return { isDirectory: true, birthtime: 1, mtime: mtimes.get(path) ?? 1_700_000_000_000 }
      if (files.has(path) || unreadable.has(path))
        return { isDirectory: false, birthtime: 1, mtime: mtimes.get(path) ?? 1_700_000_000_000 }
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
    isMacOS: vi.fn(async () => false),
    spawnBin: vi.fn(async (): Promise<SpawnOutcome> => ({ ok: false, message: 'ENOENT' })),
    setReadDirImpl: (fn: typeof readDirImpl) => { readDirImpl = fn },
  }
  return shell
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
  return import('./roadmap')
}

describe('desktop/roadmap', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('列出 roadmap/ 頂層 .md，讀內容與 mtime；子目錄、非 md、dotfile 不列入', async () => {
    const shell = makeShell({
      dirs: [REPO, OPENSPEC, ROADMAP, `${ROADMAP}/sub`],
      files: {
        [`${ROADMAP}/a.md`]: '# 培訓機構管理        1/4\n',
        [`${ROADMAP}/notes.txt`]: 'not markdown',
        [`${ROADMAP}/.hidden.md`]: 'dotfile',
      },
      mtimes: { [`${ROADMAP}/a.md`]: 1_700_000_000_000 },
    })
    const { listRoadmap } = await load(shell, makeProjects(REPO))

    const result = await listRoadmap()
    expect(result.ok).toBe(true)
    expect(result.ok && result.dirExists).toBe(true)
    expect(result.ok && result.items.map(item => item.file)).toEqual(['a.md'])
    expect(result.ok && result.items[0]).toMatchObject({
      title: '培訓機構管理',
      statusText: '1/4',
      updatedAt: 1_700_000_000_000,
    })
  })

  it('roadmap/ 目錄不存在：回空清單，不是錯誤', async () => {
    const shell = makeShell({ dirs: [REPO, OPENSPEC] })
    const { listRoadmap } = await load(shell, makeProjects(REPO))

    const result = await listRoadmap()
    expect(result).toMatchObject({ ok: true, dirExists: false, offExists: false, items: [] })
  })

  it('roadmap.off 存在：offExists 為 true', async () => {
    const shell = makeShell({
      dirs: [REPO, OPENSPEC],
      files: { [`${OPENSPEC}/roadmap.off`]: '' },
    })
    const { listRoadmap } = await load(shell, makeProjects(REPO))

    const result = await listRoadmap()
    expect(result).toMatchObject({ ok: true, dirExists: false, offExists: true })
  })

  it('roadmap/ 與 roadmap.off 同時存在：兩個旗標各自反映真實狀態，不互斥', async () => {
    const shell = makeShell({
      dirs: [REPO, OPENSPEC, ROADMAP],
      files: {
        [`${OPENSPEC}/roadmap.off`]: '',
        [`${ROADMAP}/a.md`]: '# 一般項目\n',
      },
    })
    const { listRoadmap } = await load(shell, makeProjects(REPO))

    const result = await listRoadmap()
    expect(result).toMatchObject({ ok: true, dirExists: true, offExists: true })
    expect(result.ok && result.items.map(item => item.file)).toEqual(['a.md'])
  })

  it('stat 失敗：該檔 mtime 為 null，不影響其他檔案與內容讀取', async () => {
    const shell = makeShell({
      dirs: [REPO, OPENSPEC, ROADMAP],
      files: { [`${ROADMAP}/a.md`]: '# 一般項目\n' },
      statFailures: [`${ROADMAP}/a.md`],
    })
    const { listRoadmap } = await load(shell, makeProjects(REPO))

    const result = await listRoadmap()
    expect(result.ok).toBe(true)
    expect(result.ok && result.items[0]).toMatchObject({ file: 'a.md', updatedAt: null, readFailed: false })
  })

  it('roadmap/ 存在但列舉失敗：回可重試的讀取失敗，不是空清單', async () => {
    const shell = makeShell({ dirs: [REPO, OPENSPEC, ROADMAP] })
    shell.setReadDirImpl(async (path: string) => {
      if (path === ROADMAP)
        throw new Error('EACCES: roadmap')
      throw new Error(`ENOENT: ${path}`)
    })
    const { listRoadmap } = await load(shell, makeProjects(REPO))

    const result = await listRoadmap()
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error).toEqual({
      kind: 'call-failed',
      message: 'Could not read the roadmap list.',
      detail: 'EACCES: roadmap',
    })
  })

  it('單檔讀取失敗：以檔名列入 Other 組，其他卡片正常分組', async () => {
    const shell = makeShell({
      dirs: [REPO, OPENSPEC, ROADMAP],
      files: { [`${ROADMAP}/ok.md`]: '# 一般項目\n\n## 動工前必知\n內容\n' },
      unreadable: [`${ROADMAP}/broken.md`],
    })
    const { listRoadmap } = await load(shell, makeProjects(REPO))

    const result = await listRoadmap()
    expect(result.ok).toBe(true)
    expect(result.ok && result.items.map(item => [item.file, item.readFailed, item.group])).toEqual(
      expect.arrayContaining([
        ['broken.md', true, 'other'],
        ['ok.md', false, 'available'],
      ]),
    )
  })

  it('專案沒有 openspec/：回「不是 OpenSpec 專案」，不是讀取失敗', async () => {
    const { listRoadmap } = await load(makeShell({ dirs: [REPO] }), makeProjects(REPO))

    const result = await listRoadmap()
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error).toEqual({
      kind: 'not-openspec-project',
      message: 'The target folder is not an OpenSpec project.',
      detail: `No openspec/ directory at ${REPO}.`,
    })
  })

  it('無目標專案：同樣落在「不是 OpenSpec 專案」這一類', async () => {
    const { listRoadmap } = await load(makeShell({}), makeProjects(null))

    const result = await listRoadmap()
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error.kind).toBe('not-openspec-project')
  })

  it('引用名稱清單：specs、changes（排除 archive）、archived、parked（沿用 listParkedNames）', async () => {
    const shell = makeShell({
      dirs: [
        REPO,
        OPENSPEC,
        `${OPENSPEC}/specs`,
        `${OPENSPEC}/specs/spec-a`,
        `${OPENSPEC}/changes`,
        `${OPENSPEC}/changes/add-x`,
        `${OPENSPEC}/changes/archive`,
        `${OPENSPEC}/changes/archive/2026-01-02-add-y`,
        GIT,
        `${GIT}/specrun-app`,
        PARKED,
        `${PARKED}/parked-z`,
      ],
    })
    const { listRoadmap } = await load(shell, makeProjects(REPO))

    const result = await listRoadmap()
    expect(result.ok && result.refs).toEqual({
      specs: ['spec-a'],
      changes: ['add-x'],
      archived: ['2026-01-02-add-y'],
      parked: ['parked-z'],
    })
  })

  it('沒有 .git：parked 名稱視同空清單，不影響其他名稱', async () => {
    const shell = makeShell({ dirs: [REPO, OPENSPEC, `${OPENSPEC}/specs`, `${OPENSPEC}/changes`] })
    const { listRoadmap } = await load(shell, makeProjects(REPO))

    const result = await listRoadmap()
    expect(result.ok && result.refs.parked).toEqual([])
  })

  describe('git 提交時間', () => {
    const LOG = '@1700000100\0\na.md\0'
    const spawnOk = (stdout: string, over: Partial<{ status: number | null, timedOut: boolean, truncated: boolean }> = {}): SpawnOutcome => ({
      ok: true,
      result: { status: 0, stdout, stderr: '', timedOut: false, truncated: false, ...over },
    })
    const tree = () => makeShell({
      dirs: [REPO, OPENSPEC, ROADMAP],
      files: { [`${ROADMAP}/a.md`]: '# A        1/4\n' },
      mtimes: { [`${ROADMAP}/a.md`]: 1_700_000_000_000 },
    })
    const verbOf = (args: unknown[]) => ((args[1] as string[])[0] === 'log' ? 'log' : (args[1] as string[])[0] === 'ls-files' ? 'ls-files' : 'diff')
    const answer = (over: Partial<Record<'log' | 'diff' | 'ls-files', SpawnOutcome>> = {}) =>
      async (...args: unknown[]): Promise<SpawnOutcome> =>
        over[verbOf(args)] ?? spawnOk({ 'log': LOG, 'diff': '', 'ls-files': 'a.md\0' }[verbOf(args)])
    const gitCalls = (shell: ReturnType<typeof makeShell>) =>
      shell.spawnBin.mock.calls.filter(call => (call as unknown[])[0] === 'git')

    it('成功：在 roadmap 目錄執行三條指令，結果交給 normalize 得到提交時間', async () => {
      const shell = tree()
      shell.spawnBin.mockImplementation(answer())
      const { listRoadmap } = await load(shell, makeProjects(REPO))

      const result = await listRoadmap()
      expect(result.ok && result.items[0]).toMatchObject({ updatedAt: 1_700_000_100_000 })
      const calls = gitCalls(shell)
      expect(calls).toHaveLength(3)
      expect(calls.every(call => (call as unknown[])[2] === ROADMAP)).toBe(true)
    })

    it.each([
      ['spawn 失敗', { ok: false, message: 'ENOENT' } as SpawnOutcome],
      ['非零結束', spawnOk(LOG, { status: 128 })],
      ['逾時', spawnOk(LOG, { timedOut: true })],
      ['輸出被截斷', spawnOk(LOG, { truncated: true })],
    ])('%s：不帶 git，退回檔案修改時刻', async (_name, outcome) => {
      const shell = tree()
      shell.spawnBin.mockResolvedValue(outcome)
      const { listRoadmap } = await load(shell, makeProjects(REPO))

      const result = await listRoadmap()
      expect(result.ok && result.items[0]).toMatchObject({ updatedAt: 1_700_000_000_000 })
    })

    it.each(['log', 'diff', 'ls-files'] as const)('只有 %s 那條失敗：整個不帶', async (which) => {
      const shell = tree()
      shell.spawnBin.mockImplementation(answer({ [which]: spawnOk('', { status: 1 }) }))
      const { listRoadmap } = await load(shell, makeProjects(REPO))

      const result = await listRoadmap()
      expect(result.ok && result.items[0]).toMatchObject({ updatedAt: 1_700_000_000_000 })
    })

    it('目錄不存在或沒有卡片：不執行任何外部程式', async () => {
      const empty = makeShell({ dirs: [REPO, OPENSPEC, ROADMAP] })
      await (await load(empty, makeProjects(REPO))).listRoadmap()
      expect(empty.spawnBin).not.toHaveBeenCalled()

      vi.resetModules()
      const missing = makeShell({ dirs: [REPO, OPENSPEC] })
      await (await load(missing, makeProjects(REPO))).listRoadmap()
      expect(missing.spawnBin).not.toHaveBeenCalled()
    })

    it('macOS：xcode-select 失敗時不呼叫 git，且連續載入只檢查一次', async () => {
      const shell = tree()
      shell.isMacOS.mockResolvedValue(true)
      shell.spawnBin.mockResolvedValue(spawnOk('', { status: 2 }))
      const { listRoadmap } = await load(shell, makeProjects(REPO))

      const first = await listRoadmap()
      await listRoadmap()
      expect(first.ok && first.items[0]).toMatchObject({ updatedAt: 1_700_000_000_000 })
      expect(gitCalls(shell)).toHaveLength(0)
      expect(shell.spawnBin).toHaveBeenCalledTimes(1)
      expect(shell.spawnBin.mock.calls[0]).toEqual(['/usr/bin/xcode-select', ['-p'], '/', expect.anything()])
    })

    it('macOS：xcode-select 通過後照常讀 git，只檢查一次', async () => {
      const shell = tree()
      shell.isMacOS.mockResolvedValue(true)
      shell.spawnBin.mockImplementation(answer())
      const { listRoadmap } = await load(shell, makeProjects(REPO))

      await listRoadmap()
      await listRoadmap()
      const checks = shell.spawnBin.mock.calls.filter(call => (call as unknown[])[0] === '/usr/bin/xcode-select')
      expect(checks).toHaveLength(1)
      expect(gitCalls(shell)).toHaveLength(6)
    })

    it('非 macOS：不執行 xcode-select', async () => {
      const shell = tree()
      shell.spawnBin.mockResolvedValue(spawnOk(''))
      const { listRoadmap } = await load(shell, makeProjects(REPO))

      await listRoadmap()
      expect(shell.spawnBin.mock.calls.some(call => (call as unknown[])[0] === '/usr/bin/xcode-select')).toBe(false)
    })

    it('三條指令的參數符合設計，且只讀不寫索引', async () => {
      const shell = tree()
      shell.spawnBin.mockResolvedValue(spawnOk(''))
      const { listRoadmap } = await load(shell, makeProjects(REPO))

      await listRoadmap()
      const argLists = gitCalls(shell).map(call => (call as unknown[])[1])
      expect(argLists).toContainEqual(['log', '--no-show-signature', '--root', '--format=@%at', '--name-only', '-z', '--relative', '--', '.'])
      expect(argLists).toContainEqual(['--no-optional-locks', '-c', 'diff.autoRefreshIndex=false', 'diff', '--numstat', '--no-renames', '-z', '--relative', 'HEAD', '--', '.'])
      expect(argLists).toContainEqual(['ls-files', '-z', '--', '.'])
    })

    it('多張卡片各自判斷：未提交的用檔案修改時刻，其餘用提交時間', async () => {
      const shell = makeShell({
        dirs: [REPO, OPENSPEC, ROADMAP],
        files: { [`${ROADMAP}/a.md`]: '# A        1/4\n', [`${ROADMAP}/b.md`]: '# B        1/4\n' },
        mtimes: { [`${ROADMAP}/a.md`]: 1_700_000_000_000, [`${ROADMAP}/b.md`]: 1_700_000_000_000 },
      })
      shell.spawnBin.mockImplementation(async (...args: unknown[]) => spawnOk({
        'log': '@1700000100\0\na.md\0b.md\0',
        'diff': '1\t0\ta.md\0',
        'ls-files': 'a.md\0b.md\0',
      }[verbOf(args)]))
      const { listRoadmap } = await load(shell, makeProjects(REPO))

      const result = await listRoadmap()
      const byFile = Object.fromEntries((result.ok ? result.items : []).map(item => [item.file, item.updatedAt]))
      expect(byFile).toEqual({ 'a.md': 1_700_000_000_000, 'b.md': 1_700_000_100_000 })
    })

    it('spawnBin 丟例外：不帶 git，清單照常', async () => {
      const shell = tree()
      shell.spawnBin.mockRejectedValue(new Error('invoke refused'))
      const { listRoadmap } = await load(shell, makeProjects(REPO))

      const result = await listRoadmap()
      expect(result.ok && result.items[0]).toMatchObject({ file: 'a.md', updatedAt: 1_700_000_000_000 })
    })

    it('diff 那條失敗、log 成功：整個不帶', async () => {
      const shell = tree()
      shell.spawnBin.mockImplementation(answer({ diff: spawnOk('', { truncated: true }) }))
      const { listRoadmap } = await load(shell, makeProjects(REPO))

      const result = await listRoadmap()
      expect(result.ok && result.items[0]).toMatchObject({ updatedAt: 1_700_000_000_000 })
    })

    it.each([
      ['spawn 失敗', { ok: false, message: 'ENOENT' } as SpawnOutcome],
      ['逾時', spawnOk('', { timedOut: true })],
    ])('macOS：xcode-select %s 也不呼叫 git', async (_name, outcome) => {
      const shell = tree()
      shell.isMacOS.mockResolvedValue(true)
      shell.spawnBin.mockResolvedValue(outcome)
      const { listRoadmap } = await load(shell, makeProjects(REPO))

      const result = await listRoadmap()
      expect(result.ok && result.items[0]).toMatchObject({ updatedAt: 1_700_000_000_000 })
      expect(gitCalls(shell)).toHaveLength(0)
    })

    it('macOS：同時兩次載入也只檢查一次 xcode-select', async () => {
      const shell = tree()
      shell.isMacOS.mockResolvedValue(true)
      shell.spawnBin.mockResolvedValue(spawnOk('', { status: 2 }))
      const { listRoadmap } = await load(shell, makeProjects(REPO))

      await Promise.all([listRoadmap(), listRoadmap()])
      expect(shell.spawnBin).toHaveBeenCalledTimes(1)
    })
  })
})
