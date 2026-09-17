import type { ResolveOutcome } from './tasks-path-cache'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * tasks 檔案位置的記錄。不連真的 Tauri，改注入假的「這個路徑還在嗎」——驗的是
 * 什麼時候免問 CLI、什麼時候重問，以及記錄的識別鍵含不含專案。
 */

function makeShell(existing: string[] = []) {
  const files = new Set(existing)
  return {
    files,
    pathExists: vi.fn(async (path: string) => files.has(path)),
  }
}

async function load(shell: ReturnType<typeof makeShell>) {
  vi.doMock('./shell', () => shell)
  const { createTasksPathCache } = await import('./tasks-path-cache')
  return createTasksPathCache()
}

function paths(...found: string[]): () => Promise<ResolveOutcome> {
  return async () => ({ kind: 'paths', paths: found })
}

describe('desktop/tasks-path-cache', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('記錄命中且檔案仍在＝免問 CLI', async () => {
    const cache = await load(makeShell(['/a/openspec/changes/x/tasks.md']))
    const viaCli = vi.fn(paths('/a/openspec/changes/x/tasks.md'))

    expect(await cache.resolve('/a', 'x', viaCli)).toEqual({ ok: true, path: '/a/openspec/changes/x/tasks.md' })
    expect(await cache.resolve('/a', 'x', viaCli)).toEqual({ ok: true, path: '/a/openspec/changes/x/tasks.md' })
    expect(viaCli).toHaveBeenCalledTimes(1)
  })

  it('記錄所指的檔案已不在＝重新解析', async () => {
    const shell = makeShell(['/a/openspec/changes/x/tasks.md'])
    const cache = await load(shell)
    const viaCli = vi.fn(paths('/a/openspec/changes/x/tasks.md'))

    await cache.resolve('/a', 'x', viaCli)
    shell.files.clear()
    shell.files.add('/a/openspec/changes/x/TASKS.md')

    expect(await cache.resolve('/a', 'x', vi.fn(paths('/a/openspec/changes/x/TASKS.md')))).toEqual({
      ok: true,
      path: '/a/openspec/changes/x/TASKS.md',
    })
    expect(viaCli).toHaveBeenCalledTimes(1)
  })

  it('多檔與零檔都不記錄：下一次仍會重問 CLI', async () => {
    const cache = await load(makeShell())

    const many = vi.fn(paths('/a/one.md', '/a/two.md'))
    expect(await cache.resolve('/a', 'x', many)).toEqual({ ok: false, kind: 'no-single-file' })
    await cache.resolve('/a', 'x', many)
    expect(many).toHaveBeenCalledTimes(2)

    const none = vi.fn(paths())
    expect(await cache.resolve('/a', 'y', none)).toEqual({ ok: false, kind: 'no-single-file' })
    await cache.resolve('/a', 'y', none)
    expect(none).toHaveBeenCalledTimes(2)
  })

  it('問 CLI 失敗時原樣往上帶，也不記錄', async () => {
    const cache = await load(makeShell())
    const broken = vi.fn(async (): Promise<ResolveOutcome> => ({ kind: 'cli-error', detail: 'change not found' }))

    expect(await cache.resolve('/a', 'x', broken)).toEqual({ ok: false, kind: 'cli-error', detail: 'change not found' })
    await cache.resolve('/a', 'x', broken)
    expect(broken).toHaveBeenCalledTimes(2)
  })

  it('切換專案後對同名 change 解析出的是新專案的路徑', async () => {
    const cache = await load(makeShell([
      '/a/openspec/changes/add-settings-modal/tasks.md',
      '/b/openspec/changes/add-settings-modal/tasks.md',
    ]))

    const inA = await cache.resolve('/a', 'add-settings-modal', paths('/a/openspec/changes/add-settings-modal/tasks.md'))
    const inB = await cache.resolve('/b', 'add-settings-modal', paths('/b/openspec/changes/add-settings-modal/tasks.md'))

    expect(inA).toEqual({ ok: true, path: '/a/openspec/changes/add-settings-modal/tasks.md' })
    expect(inB).toEqual({ ok: true, path: '/b/openspec/changes/add-settings-modal/tasks.md' })

    // 切回 A 仍是 A 的檔案：兩份記錄各自獨立，不會互相覆蓋
    const backToA = await cache.resolve('/a', 'add-settings-modal', async () => {
      throw new Error('should not re-ask the CLI')
    })
    expect(backToA).toEqual({ ok: true, path: '/a/openspec/changes/add-settings-modal/tasks.md' })
  })
})
