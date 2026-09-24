import type { ChangeListProbe } from '../types'
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
      mtime: 1_700_000_000_000,
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
    expect(result.ok && result.items[0]).toMatchObject({ file: 'a.md', mtime: null, readFailed: false })
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
})
