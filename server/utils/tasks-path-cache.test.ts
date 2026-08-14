import type { ResolveOutcome } from './tasks-path-cache'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTasksPathCache } from './tasks-path-cache'

/**
 * 用真實暫存檔驗證「檔案是否仍存在」的判斷，不 mock fs——
 * 這正是快取失效判定唯一該測的行為（design D1 風險欄）。
 */
describe('createTasksPathCache', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'tasks-path-cache-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('快取命中且檔案仍存在時，不再呼叫 resolveViaCli', async () => {
    const filePath = path.join(dir, 'tasks.md')
    await writeFile(filePath, '- [ ] a\n')
    const cache = createTasksPathCache()
    let calls = 0
    const resolveViaCli = async (): Promise<ResolveOutcome> => {
      calls++
      return { kind: 'paths', paths: [filePath] }
    }

    const first = await cache.resolve('change-a', resolveViaCli)
    const second = await cache.resolve('change-a', resolveViaCli)

    expect(first).toEqual({ ok: true, path: filePath })
    expect(second).toEqual({ ok: true, path: filePath })
    expect(calls).toBe(1)
  })

  it('快取的檔案消失後，退回重新呼叫 resolveViaCli 並更新快取', async () => {
    const oldPath = path.join(dir, 'old-tasks.md')
    const newPath = path.join(dir, 'new-tasks.md')
    await writeFile(oldPath, '- [ ] a\n')
    await writeFile(newPath, '- [ ] a\n')
    const cache = createTasksPathCache()
    let calls = 0
    const resolveViaCli = async (): Promise<ResolveOutcome> => {
      calls++
      return { kind: 'paths', paths: [newPath] }
    }

    const first = await cache.resolve('change-b', resolveViaCli)
    expect(first).toEqual({ ok: true, path: newPath })
    expect(calls).toBe(1)

    await rm(newPath)
    const second = await cache.resolve('change-b', resolveViaCli)

    expect(second).toEqual({ ok: true, path: newPath })
    expect(calls).toBe(2)
  })

  it('回傳路徑一律來自 resolveViaCli，快取不會憑空產生路徑', async () => {
    const filePath = path.join(dir, 'tasks.md')
    await writeFile(filePath, '- [ ] a\n')
    const cache = createTasksPathCache()

    const result = await cache.resolve('change-c', async () => ({ kind: 'paths', paths: [filePath] }))

    expect(result.ok).toBe(true)
    expect(result.ok && result.path).toBe(filePath)
  })

  it('resolveViaCli 回傳非單一路徑時，不寫入快取（下一次仍會重新解析）', async () => {
    const filePath = path.join(dir, 'tasks.md')
    await writeFile(filePath, '- [ ] a\n')
    const cache = createTasksPathCache()
    let calls = 0
    const resolveViaCli = async (): Promise<ResolveOutcome> => {
      calls++
      // 第一次模擬「尚無單一 tasks 檔」，第二次才補齊
      return calls === 1 ? { kind: 'paths', paths: [] } : { kind: 'paths', paths: [filePath] }
    }

    const first = await cache.resolve('change-d', resolveViaCli)
    expect(first).toEqual({ ok: false, kind: 'no-single-file' })

    const second = await cache.resolve('change-d', resolveViaCli)
    expect(second).toEqual({ ok: true, path: filePath })
    expect(calls).toBe(2)
  })

  it('不同 change 名各自獨立快取', async () => {
    const pathA = path.join(dir, 'a.md')
    const pathB = path.join(dir, 'b.md')
    await writeFile(pathA, '- [ ] a\n')
    await writeFile(pathB, '- [ ] b\n')
    const cache = createTasksPathCache()

    const resultA = await cache.resolve('change-a', async () => ({ kind: 'paths', paths: [pathA] }))
    const resultB = await cache.resolve('change-b', async () => ({ kind: 'paths', paths: [pathB] }))

    expect(resultA).toEqual({ ok: true, path: pathA })
    expect(resultB).toEqual({ ok: true, path: pathB })
  })

  it('target-missing／cli-error 原樣透傳，且不寫入快取', async () => {
    const cache = createTasksPathCache()

    const targetMissing = await cache.resolve('change-e', async () => ({ kind: 'target-missing', detail: 'no dir' }))
    expect(targetMissing).toEqual({ ok: false, kind: 'target-missing', detail: 'no dir' })

    const cliError = await cache.resolve('change-e', async () => ({ kind: 'cli-error', detail: 'boom' }))
    expect(cliError).toEqual({ ok: false, kind: 'cli-error', detail: 'boom' })
  })
})
