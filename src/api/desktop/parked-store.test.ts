import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * park 的檔案層。不連真的 Tauri，改注入假的外殼通道（vi.mock('./shell')）——驗的是
 * 這一層自己的規則：怎麼判 park 可用性、metadata 認不得時怎麼降級、列舉只認什麼。
 */

interface FakeEntry {
  name: string
  isDirectory: boolean
  isFile: boolean
  isSymlink: boolean
}

function dir(name: string): FakeEntry {
  return { name, isDirectory: true, isFile: false, isSymlink: false }
}

function file(name: string): FakeEntry {
  return { name, isDirectory: false, isFile: true, isSymlink: false }
}

function makeShell(dirs: Record<string, FakeEntry[]> = {}) {
  const files = new Map<string, string>()
  // 目錄若在 `dirs` 有登記（不論是否有子項）就算存在；檔案照 files 表
  const knownDirs = new Set(Object.keys(dirs))
  return {
    files,
    knownDirs,
    readDir: vi.fn(async (path: string) => {
      if (!(path in dirs))
        throw new Error(`ENOENT: ${path}`)
      return dirs[path]!
    }),
    statPath: vi.fn(async (path: string) => {
      if (knownDirs.has(path))
        return { isDirectory: true, birthtime: 1 }
      if (files.has(path))
        return { isDirectory: false, birthtime: 1 }
      throw new Error(`ENOENT: ${path}`)
    }),
    readTextFile: vi.fn(async (path: string) => {
      if (!files.has(path))
        throw new Error(`ENOENT: ${path}`)
      return files.get(path)!
    }),
    writeTextFile: vi.fn(async (path: string, contents: string) => {
      files.set(path, contents)
    }),
    makeDir: vi.fn(async () => {}),
    renamePath: vi.fn(async (oldPath: string, newPath: string) => {
      const contents = files.get(oldPath)
      files.delete(oldPath)
      if (contents !== undefined)
        files.set(newPath, contents)
    }),
    removePath: vi.fn(async (path: string) => {
      files.delete(path)
    }),
  }
}

async function load(shell: ReturnType<typeof makeShell>) {
  vi.doMock('./shell', () => shell)
  return import('./parked-store')
}

describe('desktop/parked-store', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  describe('park 可用性', () => {
    it('`.git` 是資料夾＝可 park，且整趟只列了專案資料夾、沒查 `.git` 本身', async () => {
      const shell = makeShell({ '/repo': [dir('openspec'), dir('.git')] })
      const { resolveGitDir } = await load(shell)

      expect(await resolveGitDir('/repo')).toEqual({ ok: true, gitDir: '/repo/.git' })
      expect(shell.readDir.mock.calls).toEqual([['/repo']])
      expect(shell.readTextFile).not.toHaveBeenCalled()
    })

    it('`.git` 是檔案＝worktree，回的原因不是「沒有 .git」', async () => {
      const shell = makeShell({ '/wt': [dir('openspec'), file('.git')] })
      const { resolveGitDir } = await load(shell)

      expect(await resolveGitDir('/wt')).toEqual({ ok: false, reason: 'git-worktree' })
    })

    it('沒有 `.git` 這一項＝非 git repo', async () => {
      const shell = makeShell({ '/plain': [dir('openspec')] })
      const { resolveGitDir } = await load(shell)

      expect(await resolveGitDir('/plain')).toEqual({ ok: false, reason: 'not-git-repo' })
    })

    it('列不出專案資料夾時降級成非 git repo，不丟例外', async () => {
      const shell = makeShell()
      const { resolveGitDir } = await load(shell)

      expect(await resolveGitDir('/gone')).toEqual({ ok: false, reason: 'not-git-repo' })
    })
  })

  describe('metadata', () => {
    const METADATA = '/repo/.git/specrun-app/parked.json'

    it('路徑與 web 形態同一處', async () => {
      const { metadataFileOf, parkedDirOf } = await load(makeShell())

      expect(metadataFileOf('/repo/.git')).toBe(METADATA)
      expect(parkedDirOf('/repo/.git')).toBe('/repo/.git/specrun-app/parked')
      expect(parkedDirOf('/repo/.git', 'add-x')).toBe('/repo/.git/specrun-app/parked/add-x')
    })

    it('內容壞掉、檔案不存在都降級成空表', async () => {
      const shell = makeShell()
      const { readMetadata } = await load(shell)

      expect(await readMetadata(METADATA)).toEqual({})

      shell.files.set(METADATA, '{ not json')
      expect(await readMetadata(METADATA)).toEqual({})

      shell.files.set(METADATA, '["an array"]')
      expect(await readMetadata(METADATA)).toEqual({})
    })

    it('欄位缺漏：沒有 parkedAt 的整筆丟掉，artifacts 認不得的降級成空表', async () => {
      const shell = makeShell()
      const { readMetadata } = await load(shell)

      shell.files.set(METADATA, JSON.stringify({
        'no-parked-at': { artifacts: { tasks: ['tasks.md'] } },
        'bad-artifacts': { parkedAt: '2026-01-02T03:04:05.000Z', artifacts: 'nope' },
        'mixed-paths': { parkedAt: '2026-01-02T03:04:05.000Z', artifacts: { tasks: ['tasks.md', 7] } },
      }))

      expect(await readMetadata(METADATA)).toEqual({
        'bad-artifacts': { parkedAt: '2026-01-02T03:04:05.000Z', artifacts: {} },
        'mixed-paths': { parkedAt: '2026-01-02T03:04:05.000Z', artifacts: { tasks: ['tasks.md'] } },
      })
    })

    it('寫入走 temp + rename，成功後只留正式檔且讀得回來', async () => {
      const shell = makeShell()
      const { readMetadata, writeMetadata } = await load(shell)

      const metadata = { 'add-x': { parkedAt: '2026-01-02T03:04:05.000Z', artifacts: { tasks: ['tasks.md'] } } }
      await writeMetadata(METADATA, metadata)

      const temp = shell.writeTextFile.mock.calls[0]![0]
      expect(temp).toMatch(/^\/repo\/\.git\/specrun-app\/parked\.json\.\d+\.[a-z0-9]+\.tmp$/)
      expect(shell.renamePath).toHaveBeenCalledWith(temp, METADATA)
      expect([...shell.files.keys()]).toEqual([METADATA])
      expect(await readMetadata(METADATA)).toEqual(metadata)
    })

    it('寫入失敗時清掉暫存檔並往上拋', async () => {
      const shell = makeShell()
      shell.renamePath.mockRejectedValueOnce(new Error('EACCES'))
      const { writeMetadata } = await load(shell)

      await expect(writeMetadata(METADATA, {})).rejects.toThrow('EACCES')
      expect(shell.files.size).toBe(0)
    })

    it('連續兩次寫入各自用不同的暫存檔名，不會撞同一個暫存路徑（design D6）', async () => {
      const shell = makeShell()
      const { writeMetadata } = await load(shell)

      await writeMetadata(METADATA, { 'add-x': { parkedAt: '2026-01-02T03:04:05.000Z', artifacts: {} } })
      await writeMetadata(METADATA, { 'add-y': { parkedAt: '2026-01-02T03:04:06.000Z', artifacts: {} } })

      const temps = shell.writeTextFile.mock.calls.map(([path]) => path)
      expect(temps[0]).not.toBe(temps[1])
    })
  })

  describe('parked 目錄列舉與 change 名', () => {
    it('目錄不存在＝空清單，不是錯誤', async () => {
      const { listParkedNames } = await load(makeShell())

      expect(await listParkedNames('/repo/.git/specrun-app/parked')).toEqual([])
    })

    it('只認目錄，散落的檔案排除掉，結果照名字排序', async () => {
      const shell = makeShell({
        '/parked': [dir('rename-thing'), file('.DS_Store'), dir('add-x'), file('notes.md')],
      })
      const { listParkedNames } = await load(shell)

      expect(await listParkedNames('/parked')).toEqual(['add-x', 'rename-thing'])
    })

    it('change 名只收單一路徑片段', async () => {
      const { isSafeChangeName } = await load(makeShell())

      expect(isSafeChangeName('add-x')).toBe(true)
      expect(isSafeChangeName('../escape')).toBe(false)
      expect(isSafeChangeName('nested/name')).toBe(false)
      expect(isSafeChangeName('nested\\name')).toBe(false)
      expect(isSafeChangeName('.')).toBe(false)
      expect(isSafeChangeName('..')).toBe(false)
      expect(isSafeChangeName('')).toBe(false)
    })
  })

  describe('isDirectory', () => {
    it('statPath 回報是資料夾時為 true', async () => {
      const shell = makeShell({ '/repo/openspec/changes/add-x': [] })
      const { isDirectory } = await load(shell)

      expect(await isDirectory('/repo/openspec/changes/add-x')).toBe(true)
    })

    it('路徑是檔案時為 false（statPath 回報 isDirectory: false）', async () => {
      const shell = makeShell()
      shell.files.set('/repo/openspec/changes/add-x/tasks.md', '- [ ] 1.1 first\n')
      const { isDirectory } = await load(shell)

      expect(await isDirectory('/repo/openspec/changes/add-x/tasks.md')).toBe(false)
    })

    it('statPath 丟例外（路徑不存在）時降級為 false，不外拋', async () => {
      const shell = makeShell()
      const { isDirectory } = await load(shell)

      expect(await isDirectory('/gone')).toBe(false)
    })
  })
})
