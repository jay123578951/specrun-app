import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const SETTLE_MS = 1200

let root: string
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const unsubscribers: Array<() => void> = []

async function start() {
  vi.doMock('./project-state', () => ({ currentProjectPath: async () => root }))
  const mod = await import('./change-watcher')
  const listener = vi.fn()
  unsubscribers.push(mod.subscribeToChanges(listener))
  await vi.waitFor(() => expect(mod.isWatching()).toBe(true))
  await wait(700)
  listener.mockClear()
  return listener
}

describe('change-watcher', () => {
  beforeEach(async () => {
    vi.resetModules()
    root = await mkdtemp(path.join(tmpdir(), 'change-watcher-'))
    await mkdir(path.join(root, 'openspec', 'changes'), { recursive: true })
  })

  afterEach(async () => {
    while (unsubscribers.length)
      unsubscribers.pop()!()
    const mod = await import('./change-watcher')
    await mod.remountWatcher()
    await rm(root, { recursive: true, force: true })
  })

  it('規劃檔修改會通知', async () => {
    await mkdir(path.join(root, 'openspec', 'roadmap'))
    await writeFile(path.join(root, 'openspec', 'roadmap', 'a.md'), 'x')
    const listener = await start()
    await writeFile(path.join(root, 'openspec', 'roadmap', 'a.md'), 'y')
    await wait(SETTLE_MS)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('roadmap.off 建立與刪除都會通知', async () => {
    const listener = await start()
    const off = path.join(root, 'openspec', 'roadmap.off')
    await writeFile(off, '')
    await wait(SETTLE_MS)
    expect(listener).toHaveBeenCalledTimes(1)
    await rm(off)
    await wait(SETTLE_MS)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('specs 與 config.yaml 的變動不通知', async () => {
    const listener = await start()
    await mkdir(path.join(root, 'openspec', 'specs', 'foo'), { recursive: true })
    await writeFile(path.join(root, 'openspec', 'specs', 'foo', 'spec.md'), 'x')
    await writeFile(path.join(root, 'openspec', 'config.yaml'), 'x')
    await wait(SETTLE_MS)
    expect(listener).not.toHaveBeenCalled()
  })

  it('規劃檔新增與刪除都會通知', async () => {
    await mkdir(path.join(root, 'openspec', 'roadmap'))
    const listener = await start()
    const file = path.join(root, 'openspec', 'roadmap', 'b.md')
    await writeFile(file, 'x')
    await wait(SETTLE_MS)
    expect(listener).toHaveBeenCalledTimes(1)
    await rm(file)
    await wait(SETTLE_MS)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('名稱只是長得像範圍的路徑不通知', async () => {
    const listener = await start()
    await writeFile(path.join(root, 'openspec', 'roadmap.offx'), '')
    await mkdir(path.join(root, 'openspec', 'roadmap-old'))
    await writeFile(path.join(root, 'openspec', 'roadmap-old', 'a.md'), 'x')
    await writeFile(path.join(root, 'openspec', 'roadmapx.md'), 'x')
    await mkdir(path.join(root, 'openspec', 'changes-old'))
    await writeFile(path.join(root, 'openspec', 'changes-old', 'a.md'), 'x')
    await wait(SETTLE_MS)
    expect(listener).not.toHaveBeenCalled()
  })

  it('roadmap 目錄原本不存在，之後出現第一個檔案會通知', async () => {
    const listener = await start()
    await mkdir(path.join(root, 'openspec', 'roadmap'))
    await writeFile(path.join(root, 'openspec', 'roadmap', 'first.md'), 'x')
    await wait(SETTLE_MS)
    expect(listener).toHaveBeenCalled()
  })

  it('連續寫入只得一則通知', async () => {
    const listener = await start()
    for (let index = 0; index < 5; index++)
      await writeFile(path.join(root, 'openspec', 'changes', `f${index}.md`), 'x')
    await wait(SETTLE_MS)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
