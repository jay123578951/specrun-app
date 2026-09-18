import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 桌面形態的開啟位置／開啟外部網址。不連真的 Tauri，改注入假的外殼通道
 * （vi.mock('./shell'))——驗的是這一層的映射規則：外殼的 ok／失敗兩態如何
 * 對應到各自的商業結果，以及 revealPath 不產生「這個平台辦不到」這個答案
 * （design D7：桌面形態沒有 web 形態那種「這個指令只有 macOS 有」的限制）。
 */
describe('api/desktop/opener: 桌面形態的開啟通道', () => {
  const openInFileManager = vi.fn()
  const openUrlShell = vi.fn()

  beforeEach(() => {
    vi.resetModules()
    openInFileManager.mockReset()
    openUrlShell.mockReset()
    vi.doMock('./shell', () => ({ openInFileManager, openUrl: openUrlShell }))
  })

  it('revealPath：外殼成功映射成 revealed', async () => {
    openInFileManager.mockResolvedValue({ ok: true })
    const { revealPath } = await import('./opener')

    await expect(revealPath('/repo/project/file.md')).resolves.toEqual({ status: 'revealed' })
    expect(openInFileManager).toHaveBeenCalledWith('/repo/project/file.md')
  })

  it('revealPath：外殼失敗映射成 failed，不是 unsupported', async () => {
    openInFileManager.mockResolvedValue({ ok: false, message: 'no such file' })
    const { revealPath } = await import('./opener')

    const outcome = await revealPath('/repo/project/missing.md')

    expect(outcome).toEqual({ status: 'failed' })
    expect(outcome.status).not.toBe('unsupported')
  })

  it('openUrl：外殼成功映射成 opened', async () => {
    openUrlShell.mockResolvedValue({ ok: true })
    const { openUrl } = await import('./opener')

    await expect(openUrl('https://example.com')).resolves.toEqual({ status: 'opened' })
    expect(openUrlShell).toHaveBeenCalledWith('https://example.com')
  })

  it('openUrl：外殼失敗映射成 failed', async () => {
    openUrlShell.mockResolvedValue({ ok: false, message: 'could not open' })
    const { openUrl } = await import('./opener')

    await expect(openUrl('https://example.com')).resolves.toEqual({ status: 'failed' })
  })
})
