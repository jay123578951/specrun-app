import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  isDirectory,
  isSafeChangeName,
  listParkedNames,
  metadataFileOf,
  parkedDirOf,
  parseMetadata,
  pathExists,
  readMetadata,
  resolveGitDir,
  writeMetadata,
} from './parked-store'

let root: string

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'specrun-parked-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('resolveGitDir: 從嚴的 .git 檢測', () => {
  it('`.git` 是目錄才可 park', async () => {
    await mkdir(path.join(root, '.git'))

    await expect(resolveGitDir(root)).resolves.toEqual({ ok: true, gitDir: path.join(root, '.git') })
  })

  it('`.git` 是檔案（worktree／submodule）一律禁用，不解析 gitdir 指標', async () => {
    await writeFile(path.join(root, '.git'), 'gitdir: /elsewhere/.git/worktrees/x\n')

    await expect(resolveGitDir(root)).resolves.toEqual({ ok: false, reason: 'git-worktree' })
  })

  it('沒有 `.git` ＝非 git repo', async () => {
    await expect(resolveGitDir(root)).resolves.toEqual({ ok: false, reason: 'not-git-repo' })
  })
})

describe('isSafeChangeName: 路徑片段防護', () => {
  it('一般 change 名通過', () => {
    expect(isSafeChangeName('add-park-mechanism')).toBe(true)
  })

  it('帶路徑分隔或相對片段的名字一律擋掉', () => {
    for (const name of ['', '.', '..', '../escape', 'a/b', 'a\\b'])
      expect(isSafeChangeName(name)).toBe(false)
  })
})

describe('listParkedNames: 目錄為準', () => {
  it('只認目錄，散落檔案不算 parked change', async () => {
    const parked = parkedDirOf(path.join(root, '.git'))
    await mkdir(path.join(parked, 'add-old-idea'), { recursive: true })
    await mkdir(path.join(parked, 'big-refactor'))
    await writeFile(path.join(parked, '.DS_Store'), '')

    await expect(listParkedNames(parked)).resolves.toEqual(['add-old-idea', 'big-refactor'])
  })

  it('parked 目錄還不存在＝還沒 park 過任何東西，不是錯誤', async () => {
    await expect(listParkedNames(parkedDirOf(path.join(root, '.git')))).resolves.toEqual([])
  })

  it('metadata 孤兒紀錄不會憑空生出項目（清單只由目錄決定）', async () => {
    const gitDir = path.join(root, '.git')
    const parked = parkedDirOf(gitDir)
    await mkdir(path.join(parked, 'still-here'), { recursive: true })
    await writeMetadata(metadataFileOf(gitDir), {
      'still-here': { parkedAt: '2026-08-01T00:00:00.000Z', artifacts: {} },
      'already-gone': { parkedAt: '2026-07-01T00:00:00.000Z', artifacts: {} },
    })

    const names = await listParkedNames(parked)
    const metadata = await readMetadata(metadataFileOf(gitDir))

    expect(names).toEqual(['still-here'])
    // metadata 裡確實還留著孤兒，但清單走目錄列舉，它自然不會被列出
    expect(Object.keys(metadata)).toEqual(['still-here', 'already-gone'])
  })
})

describe('metadata 讀寫', () => {
  it('寫入後讀回相同內容（含快照路徑順序）', async () => {
    const file = metadataFileOf(path.join(root, '.git'))
    const metadata = {
      'add-old-idea': {
        parkedAt: '2026-08-15T10:00:00.000Z',
        artifacts: { proposal: ['proposal.md'], specs: ['specs/foo/spec.md'], design: [] },
      },
    }

    await writeMetadata(file, metadata)

    const read = await readMetadata(file)
    expect(read).toEqual(metadata)
    expect(Object.keys(read['add-old-idea']!.artifacts)).toEqual(['proposal', 'specs', 'design'])
  })

  it('檔案不存在＝目前沒有可用的 metadata（不是錯誤）', async () => {
    await expect(readMetadata(metadataFileOf(path.join(root, '.git')))).resolves.toEqual({})
  })

  it('內容壞掉一律降級成空表——parked 目錄照樣列得出來', async () => {
    const file = metadataFileOf(path.join(root, '.git'))
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, '{ not json')

    await expect(readMetadata(file)).resolves.toEqual({})
  })

  it('逐筆收斂：缺 parkedAt 的紀錄丟掉，artifacts 形狀不對就當空', () => {
    const metadata = parseMetadata(JSON.stringify({
      'good': { parkedAt: '2026-08-15T10:00:00.000Z', artifacts: { tasks: ['tasks.md', 7] } },
      'no-timestamp': { artifacts: { tasks: ['tasks.md'] } },
      'bad-artifacts': { parkedAt: '2026-08-15T10:00:00.000Z', artifacts: 'nope' },
    }))

    expect(metadata).toEqual({
      'good': { parkedAt: '2026-08-15T10:00:00.000Z', artifacts: { tasks: ['tasks.md'] } },
      'bad-artifacts': { parkedAt: '2026-08-15T10:00:00.000Z', artifacts: {} },
    })
  })
})

describe('撞名與殘留偵測', () => {
  it('park 目標已有殘留目錄時偵測得到', async () => {
    const destination = parkedDirOf(path.join(root, '.git'), 'add-old-idea')
    await mkdir(destination, { recursive: true })

    await expect(pathExists(destination)).resolves.toBe(true)
    await expect(isDirectory(destination)).resolves.toBe(true)
  })

  it('unpark 目標已有同名 change 時偵測得到；連檔案撞名也算', async () => {
    const destination = path.join(root, 'openspec', 'changes', 'add-old-idea')
    await mkdir(path.dirname(destination), { recursive: true })
    await writeFile(destination, 'not even a directory')

    await expect(pathExists(destination)).resolves.toBe(true)
    await expect(isDirectory(destination)).resolves.toBe(false)
  })

  it('目標不存在時兩個判定都是 false', async () => {
    const missing = path.join(root, 'nothing-here')

    await expect(pathExists(missing)).resolves.toBe(false)
    await expect(isDirectory(missing)).resolves.toBe(false)
  })
})
