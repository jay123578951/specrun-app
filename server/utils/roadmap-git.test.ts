import { execFileSync, spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, realpath, rm, stat, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeRoadmapList } from '../../src/api/normalize-roadmap'
import { readRoadmapGit } from './roadmap-git'

let root: string

beforeEach(async () => {
  // 被測的 readRoadmapGit 也繼承 process.env，一併隔離開發者的全域與系統 git 設定
  vi.stubEnv('GIT_CONFIG_GLOBAL', '/dev/null')
  vi.stubEnv('GIT_CONFIG_SYSTEM', '/dev/null')
  vi.stubEnv('GIT_CONFIG_NOSYSTEM', '1')
  root = await realpath(await mkdtemp(path.join(tmpdir(), 'specrun-roadmap-git-')))
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await rm(root, { recursive: true, force: true })
})

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', args, {
    cwd,
    stdio: 'ignore',
    env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' },
  })
}

function commit(cwd: string, message: string, date: string): void {
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', message, '--date', date], {
    cwd,
    stdio: 'ignore',
    env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null', GIT_COMMITTER_DATE: '2030-01-01T00:00:00Z' },
  })
}

async function seed(repo: string, sub = ''): Promise<string> {
  const dir = path.join(repo, sub, 'openspec', 'roadmap')
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, 'a.md'), '# A  1/4\n')
  await writeFile(path.join(dir, '中文.md'), '# 中文\n')
  git(repo, 'add', '.')
  commit(repo, 'init', '2020-01-01T00:00:00Z')
  return dir
}

function probeOf(gitOut: { log: string, changed: string, tracked: string } | undefined) {
  return {
    targetPath: root,
    dirExists: true,
    offExists: false,
    files: ['a.md', '中文.md'].map(name => ({ name, content: '# x\n', mtime: 999 })),
    refs: { specs: [], changes: [], archived: [], parked: [] },
    ...(gitOut && { git: gitOut }),
  }
}

function timesOf(result: ReturnType<typeof normalizeRoadmapList>): Record<string, number | null> {
  if (!result.ok)
    throw new Error('not ok')
  return Object.fromEntries(result.items.map(i => [i.file, i.updatedAt]))
}

const hasSshKeygen = spawnSync('ssh-keygen', ['-?'], { stdio: 'ignore' }).error === undefined

const T2020 = Date.parse('2020-01-01T00:00:00Z')

describe('readRoadmapGit', () => {
  it('一般 repo：作者時間、中文檔名，且不改 .git/index', async () => {
    git(root, 'init', '-q')
    const dir = await seed(root)
    const before = (await stat(path.join(root, '.git', 'index'))).mtimeMs

    const out = await readRoadmapGit(dir)

    expect(out).toBeDefined()
    expect(timesOf(normalizeRoadmapList(probeOf(out)))).toEqual({ 'a.md': T2020, '中文.md': T2020 })
    expect((await stat(path.join(root, '.git', 'index'))).mtimeMs).toBe(before)
  })

  it('有未提交修改的檔案用檔案修改時刻，內容沒變的重寫不算，且不改 .git/index', async () => {
    git(root, 'init', '-q')
    const dir = await seed(root)
    const indexPath = path.join(root, '.git', 'index')
    await writeFile(path.join(dir, 'a.md'), '# A  2/4\n')
    await writeFile(path.join(dir, '中文.md'), '# 中文\n')
    // 明確改掉修改時間，避免和索引同一秒時 git 判斷不出差異而不需要刷新
    const later = new Date(Date.now() + 3_600_000)
    await utimes(path.join(dir, 'a.md'), later, later)
    await utimes(path.join(dir, '中文.md'), later, later)
    const before = { mtimeMs: (await stat(indexPath)).mtimeMs, bytes: await readFile(indexPath) }

    const out = await readRoadmapGit(dir)

    expect(timesOf(normalizeRoadmapList(probeOf(out)))).toEqual({ 'a.md': 999, '中文.md': T2020 })
    expect((await stat(indexPath)).mtimeMs).toBe(before.mtimeMs)
    expect((await readFile(indexPath)).equals(before.bytes)).toBe(true)
  })

  it('changed：內容沒變的重寫不列入，內容有改的列入', async () => {
    git(root, 'init', '-q')
    const dir = await seed(root)
    await writeFile(path.join(dir, '中文.md'), '# 中文\n')
    const unchanged = await readRoadmapGit(dir)
    expect(unchanged?.changed).toBe('')

    await writeFile(path.join(dir, 'a.md'), '# A  2/4\n')
    const edited = await readRoadmapGit(dir)
    expect(edited?.changed).toMatch(/^1\t1\ta\.md\0$/)
  })

  it('專案在 repo 的子目錄', async () => {
    git(root, 'init', '-q')
    const dir = await seed(root, 'pkg')

    const out = await readRoadmapGit(dir)

    expect(timesOf(normalizeRoadmapList(probeOf(out)))).toEqual({ 'a.md': T2020, '中文.md': T2020 })
  })

  it('git worktree', async () => {
    const main = path.join(root, 'main')
    await mkdir(main)
    git(main, 'init', '-q')
    await seed(main)
    const wt = path.join(root, 'wt')
    git(main, 'worktree', 'add', '-q', '-b', 'other', wt)

    const out = await readRoadmapGit(path.join(wt, 'openspec', 'roadmap'))

    expect(timesOf(normalizeRoadmapList(probeOf(out)))).toEqual({ 'a.md': T2020, '中文.md': T2020 })
  })

  it('非 git 目錄回 undefined', async () => {
    const dir = path.join(root, 'plain')
    await mkdir(dir)

    await expect(readRoadmapGit(dir)).resolves.toBeUndefined()
  })

  it('取每檔最後一次提交；子目錄同名檔、改檔名、已暫存修改、未追蹤檔', async () => {
    git(root, 'init', '-q')
    const dir = await seed(root)
    await mkdir(path.join(dir, 'sub'))
    await writeFile(path.join(dir, 'sub', 'a.md'), '# sub\n')
    await writeFile(path.join(dir, 'old.md'), '# old\n')
    await writeFile(path.join(dir, 'staged.md'), '# s\n')
    git(root, 'add', '.')
    commit(root, 'second', '2021-01-01T00:00:00Z')
    git(root, 'mv', path.join(dir, 'old.md'), path.join(dir, 'new.md'))
    commit(root, 'rename', '2022-01-01T00:00:00Z')
    await writeFile(path.join(dir, 'staged.md'), '# s changed\n')
    git(root, 'add', '.')
    await writeFile(path.join(dir, 'untracked.md'), '# u\n')

    const out = await readRoadmapGit(dir)
    const probe = probeOf(out)
    probe.files = ['a.md', 'new.md', 'staged.md', 'untracked.md'].map(name => ({ name, content: '# x\n', mtime: 999 }))

    expect(timesOf(normalizeRoadmapList(probe))).toEqual({
      'a.md': T2020,
      'new.md': Date.parse('2022-01-01T00:00:00Z'),
      'staged.md': 999,
      'untracked.md': 999,
    })
  })

  it('被 git 忽略的 roadmap 目錄：讀取成功但沒有紀錄，全部用檔案修改時刻', async () => {
    git(root, 'init', '-q')
    await writeFile(path.join(root, '.gitignore'), 'openspec/\n')
    const dir = path.join(root, 'openspec', 'roadmap')
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, 'a.md'), '# A\n')
    await writeFile(path.join(dir, '中文.md'), '# 中文\n')

    const out = await readRoadmapGit(dir)

    expect(timesOf(normalizeRoadmapList(probeOf(out)))).toEqual({ 'a.md': 999, '中文.md': 999 })
  })

  it('曾提交後 git rm --cached 加 .gitignore 並提交的 roadmap 目錄：全部卡片用檔案修改時刻', async () => {
    git(root, 'init', '-q')
    const dir = await seed(root)
    git(root, 'rm', '-r', '-q', '--cached', 'openspec')
    await writeFile(path.join(root, '.gitignore'), 'openspec/\n')
    git(root, 'add', '.gitignore')
    commit(root, 'untrack', '2023-01-01T00:00:00Z')

    const out = await readRoadmapGit(dir)

    expect(out).toBeDefined()
    expect(timesOf(normalizeRoadmapList(probeOf(out)))).toEqual({ 'a.md': 999, '中文.md': 999 })
  })

  it('git rm 提交後再建立同名的未追蹤檔：用檔案修改時刻', async () => {
    git(root, 'init', '-q')
    const dir = await seed(root)
    git(root, 'rm', '-q', path.join(dir, 'a.md'))
    commit(root, 'remove a', '2023-01-01T00:00:00Z')
    await writeFile(path.join(dir, 'a.md'), '# A again\n')

    const out = await readRoadmapGit(dir)

    expect(timesOf(normalizeRoadmapList(probeOf(out)))).toEqual({ 'a.md': 999, '中文.md': T2020 })
  })

  it.skipIf(!hasSshKeygen)('使用者設定 log.showSignature=true：解析結果仍正確', async () => {
    git(root, 'init', '-q')
    // 用 ssh 金鑰簽 commit：log.showSignature=true 時，簽章檢查結果會混進 log 輸出
    const key = path.join(root, '.git', 'sign-key')
    execFileSync('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-f', key], { stdio: 'ignore' })
    git(root, 'config', 'log.showSignature', 'true')
    git(root, 'config', 'gpg.format', 'ssh')
    git(root, 'config', 'user.signingkey', `${key}.pub`)
    git(root, 'config', 'commit.gpgsign', 'true')
    const dir = await seed(root)

    const out = await readRoadmapGit(dir)

    expect(out).toBeDefined()
    expect(timesOf(normalizeRoadmapList(probeOf(out)))).toEqual({ 'a.md': T2020, '中文.md': T2020 })
  })

  it('使用者設定 log.showRoot=false：只在第一個 commit 改過的卡片仍顯示該 commit 的作者時間', async () => {
    git(root, 'init', '-q')
    git(root, 'config', 'log.showRoot', 'false')
    const dir = await seed(root)

    const out = await readRoadmapGit(dir)

    expect(timesOf(normalizeRoadmapList(probeOf(out)))).toEqual({ 'a.md': T2020, '中文.md': T2020 })
  })

  it('merge commit：合併進來的卡片顯示原 commit 的作者時間，其他卡片不受影響', async () => {
    git(root, 'init', '-q', '-b', 'main')
    const dir = await seed(root)
    git(root, 'checkout', '-q', '-b', 'side')
    await writeFile(path.join(dir, 'b.md'), '# B\n')
    git(root, 'add', '.')
    commit(root, 'add b', '2021-01-01T00:00:00Z')
    git(root, 'checkout', '-q', 'main')
    await writeFile(path.join(dir, 'a.md'), '# A  2/4\n')
    git(root, 'add', '.')
    commit(root, 'edit a', '2022-01-01T00:00:00Z')
    git(root, '-c', 'user.name=t', '-c', 'user.email=t@t', 'merge', '-q', '--no-ff', '-m', 'merge side', 'side')

    const out = await readRoadmapGit(dir)
    const probe = probeOf(out)
    probe.files = ['a.md', 'b.md', '中文.md'].map(name => ({ name, content: '# x\n', mtime: 999 }))

    expect(timesOf(normalizeRoadmapList(probe))).toEqual({
      'a.md': Date.parse('2022-01-01T00:00:00Z'),
      'b.md': Date.parse('2021-01-01T00:00:00Z'),
      '中文.md': T2020,
    })
  })

  describe('改檔名（--no-renames）', () => {
    const names = ['a.md', 'new.md', '中文.md']
    async function setup() {
      git(root, 'init', '-q')
      const dir = await seed(root)
      git(root, 'mv', path.join(dir, 'a.md'), path.join(dir, 'new.md'))
      return dir
    }
    const probeWith = (dir: string, out: Awaited<ReturnType<typeof readRoadmapGit>>) => {
      const probe = probeOf(out)
      probe.files = names.filter(n => n !== 'a.md').map(name => ({ name, content: '# x\n', mtime: 999 }))
      return probe
    }

    it('git mv 尚未提交：新檔名用檔案修改時刻，沒動的檔仍用提交時間', async () => {
      const dir = await setup()

      const out = await readRoadmapGit(dir)

      expect(timesOf(normalizeRoadmapList(probeWith(dir, out)))).toEqual({ 'new.md': 999, '中文.md': T2020 })
    })

    it('提交之後：新檔名顯示該 commit 的作者時間', async () => {
      const dir = await setup()
      commit(root, 'rename', '2024-01-01T00:00:00Z')

      const out = await readRoadmapGit(dir)

      expect(timesOf(normalizeRoadmapList(probeWith(dir, out)))).toEqual({
        'new.md': Date.parse('2024-01-01T00:00:00Z'),
        '中文.md': T2020,
      })
    })
  })

  it('沒有 HEAD 的空 repo：diff HEAD 失敗，整個回 undefined', async () => {
    git(root, 'init', '-q')
    const dir = path.join(root, 'openspec', 'roadmap')
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, 'a.md'), '# A\n')

    await expect(readRoadmapGit(dir)).resolves.toBeUndefined()
  })
})
