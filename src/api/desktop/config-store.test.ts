import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 桌面設定檔的唯一持有處。不連真的 Tauri，改注入假的外殼通道（vi.mock('./shell')）——
 * 驗的是這一層自己的規則：快取物件的共用、原子寫入的暫存檔清理、讀寫失敗的降級，
 * 不是 Tauri fs plugin 本身（那是外殼團隊的責任，且已有 cargo test 覆蓋 spawn 通道）。
 *
 * 每個測試都 resetModules 後重新 import，因為 config-store 的快取（config/persist）
 * 是模組層級的單例，不重置會被前一個測試的狀態汙染。
 */

function makeShell() {
  const files = new Map<string, string>()
  return {
    configRoot: vi.fn(async () => '/home/x/Library/Application Support'),
    joinPath: vi.fn(async (...parts: string[]) => parts.join('/')),
    makeDir: vi.fn(async () => {}),
    readTextFile: vi.fn(async (path: string) => {
      if (!files.has(path))
        throw new Error('ENOENT')
      return files.get(path)!
    }),
    writeTextFile: vi.fn(async (path: string, contents: string) => {
      files.set(path, contents)
    }),
    renamePath: vi.fn(async (oldPath: string, newPath: string) => {
      const contents = files.get(oldPath)
      files.delete(oldPath)
      if (contents !== undefined)
        files.set(newPath, contents)
    }),
    removePath: vi.fn(async (path: string) => {
      files.delete(path)
    }),
    files,
  }
}

const CONFIG_PATH = '/home/x/Library/Application Support/specrun-app/config.json'

describe('desktop/config-store', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('檔案不存在時回空設定，之後所有呼叫共用同一個物件（就地改欄位再 persist）', async () => {
    const shell = makeShell()
    vi.doMock('./shell', () => shell)
    const { config } = await import('./config-store')

    const first = await config()
    expect(first).toEqual({ projects: [], lastActivePath: null, openspecBin: null })
    expect(await config()).toBe(first)
  })

  it('persist 走 temp + rename，成功後只留正式檔、內容與 web 形態同格式', async () => {
    const shell = makeShell()
    vi.doMock('./shell', () => shell)
    const { config, persist } = await import('./config-store')

    const current = await config()
    current.projects = ['/a']
    await persist()

    expect(shell.writeTextFile).toHaveBeenCalledTimes(1)
    const [tempPath, contents] = shell.writeTextFile.mock.calls[0]!
    expect(tempPath).not.toBe(CONFIG_PATH)
    expect(contents).toBe('{\n  "projects": [\n    "/a"\n  ],\n  "lastActivePath": null,\n  "openspecBin": null\n}\n')
    expect(shell.renamePath).toHaveBeenCalledWith(tempPath, CONFIG_PATH)
    expect([...shell.files.keys()]).toEqual([CONFIG_PATH])
  })

  it('writeTextFile 失敗時不拋出（靜默降級），清暫存檔的呼叫本身失敗也不影響', async () => {
    const shell = makeShell()
    shell.writeTextFile = vi.fn(async () => {
      throw new Error('disk full')
    })
    vi.doMock('./shell', () => shell)
    const { config, persist } = await import('./config-store')

    await config()
    await expect(persist()).resolves.toBeUndefined()
    // write() 的 catch 分支一律嘗試清暫存檔（即使它從未真的寫入），失敗也吞掉
    expect(shell.removePath).toHaveBeenCalledTimes(1)
    expect(shell.files.size).toBe(0)
  })

  it('rename 失敗時清掉已寫入的暫存檔，且 persist 仍不拋出', async () => {
    const shell = makeShell()
    shell.renamePath = vi.fn(async () => {
      throw new Error('EXDEV')
    })
    vi.doMock('./shell', () => shell)
    const { config, persist } = await import('./config-store')

    await config()
    await expect(persist()).resolves.toBeUndefined()
    expect(shell.removePath).toHaveBeenCalledTimes(1)
    const [tempPath] = shell.removePath.mock.calls[0]!
    expect(shell.files.has(tempPath)).toBe(false)
  })

  it('讀到壞掉的內容時回空設定而非拋錯', async () => {
    const shell = makeShell()
    shell.files.set(CONFIG_PATH, '{ not json')
    vi.doMock('./shell', () => shell)
    const { config } = await import('./config-store')

    expect(await config()).toEqual({ projects: [], lastActivePath: null, openspecBin: null })
  })
})
