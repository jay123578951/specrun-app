import { describe, expect, it, vi } from 'vitest'
import { version } from '../../../package.json'

/**
 * 桌面形態的環境診斷。檔案變動通知一項改讀 watch.ts 的「現在有沒有接上」，
 * 兩態、不回未知；「開啟所在位置」一律回 true，不做平台分支（design D7）。
 * `./watch` 整支模組以假模組取代，不連真的監看與其 projects.ts 接線。
 */
describe('desktop/diagnostics', () => {
  it('watching 接上時為 true，canReveal 固定為 true，其餘三項照常回傳', async () => {
    vi.resetModules()
    vi.doMock('./config-store', () => ({
      configFilePath: vi.fn(async () => '/Users/dev/Library/Application Support/specrun-app/config.json'),
    }))
    vi.doMock('./projects', () => ({
      currentProjectPath: vi.fn(async () => '/Users/dev/code/my-project'),
    }))
    vi.doMock('./watch', () => ({
      isWatching: vi.fn(() => true),
    }))
    const { diagnostics } = await import('./diagnostics')

    const result = await diagnostics()

    expect(result.watching).toBe(true)
    expect(result.canReveal).toBe(true)
    expect(result.configPath).toBe('/Users/dev/Library/Application Support/specrun-app/config.json')
    expect(result.projectPath).toBe('/Users/dev/code/my-project')
    expect(result.appVersion).toBe(version)
  })

  it('watching 未接上時為 false，且目前無目標專案時 projectPath 明確為 null；canReveal 仍固定為 true，不受影響', async () => {
    vi.resetModules()
    vi.doMock('./config-store', () => ({
      configFilePath: vi.fn(async () => '/config.json'),
    }))
    vi.doMock('./projects', () => ({
      currentProjectPath: vi.fn(async () => null),
    }))
    vi.doMock('./watch', () => ({
      isWatching: vi.fn(() => false),
    }))
    const { diagnostics } = await import('./diagnostics')

    const result = await diagnostics()

    expect(result.projectPath).toBeNull()
    expect(result.watching).toBe(false)
    // 開啟所在位置固定為 true，不因其他項而變，且不回未知
    expect(result.canReveal).toBe(true)
    expect(result.canReveal).not.toBeNull()
  })
})
