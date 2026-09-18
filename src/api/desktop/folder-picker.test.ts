import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 桌面形態的原生資料夾選擇。不連真的 Tauri，改注入假的外殼通道（vi.mock('./shell')）
 * ——驗的是這一層的映射規則：薄殼的三種結果如何對應到 `PickFolderOutcome`，
 * 以及本模組不維護任何「已有 dialog 開著」的內部狀態（design D3）。
 */
describe('api/desktop/folder-picker: 桌面形態的資料夾選擇', () => {
  const pickFolderShell = vi.fn()

  beforeEach(() => {
    vi.resetModules()
    pickFolderShell.mockReset()
    vi.doMock('./shell', () => ({ pickFolder: pickFolderShell }))
  })

  it('選定路徑映射成 picked', async () => {
    pickFolderShell.mockResolvedValue({ ok: true, path: '/repo/project' })
    const { pickFolder } = await import('./folder-picker')

    await expect(pickFolder()).resolves.toEqual({ status: 'picked', path: '/repo/project' })
  })

  it('取消（空值）映射成 canceled', async () => {
    pickFolderShell.mockResolvedValue({ ok: true, path: null })
    const { pickFolder } = await import('./folder-picker')

    await expect(pickFolder()).resolves.toEqual({ status: 'canceled' })
  })

  it('外殼失敗映射成 failed', async () => {
    pickFolderShell.mockResolvedValue({ ok: false, message: 'dialog could not be opened' })
    const { pickFolder } = await import('./folder-picker')

    await expect(pickFolder()).resolves.toEqual({ status: 'failed' })
  })

  it('連續兩次呼叫都實際呼叫外殼，不被任何內部旗標擋下', async () => {
    // 兩次呼叫要真正重疊（都不 await 就發第二次），才驗得到「不維護 dialog
    // 開著的內部狀態」——序列化呼叫（await 完再呼叫下一次）就算真有旗標，
    // 旗標也早在 finally 裡釋放掉了，測不出來。
    let resolveShell: (result: { ok: true, path: string | null }) => void = () => {}
    const pending = new Promise<{ ok: true, path: string | null }>((resolve) => {
      resolveShell = resolve
    })
    pickFolderShell.mockReturnValue(pending)
    const { pickFolder } = await import('./folder-picker')

    const first = pickFolder()
    const second = pickFolder()

    expect(pickFolderShell).toHaveBeenCalledTimes(2)

    resolveShell({ ok: true, path: '/repo/project' })

    await expect(first).resolves.toEqual({ status: 'picked', path: '/repo/project' })
    await expect(second).resolves.toEqual({ status: 'picked', path: '/repo/project' })
  })
})
