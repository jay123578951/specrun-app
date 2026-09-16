import { describe, expect, it, vi } from 'vitest'
import { version } from '../../../package.json'

/**
 * 桌面形態的環境診斷。檔案變動通知與「開啟所在位置」兩項的通道還沒搬到這個
 * 形態——這兩項要回未知（null），不能借用 web 形態的 false 充數（false 會被讀成
 * 「明確知道沒在跑」）。設定檔路徑與目前專案路徑則照常轉發底層通道的值，不受
 * 這兩項未知影響。
 */
describe('desktop/diagnostics', () => {
  it('watching 與 canReveal 回 null，其餘三項照常回傳', async () => {
    vi.resetModules()
    vi.doMock('./config-store', () => ({
      configFilePath: vi.fn(async () => '/Users/dev/Library/Application Support/specrun-app/config.json'),
    }))
    vi.doMock('./projects', () => ({
      currentProjectPath: vi.fn(async () => '/Users/dev/code/my-project'),
    }))
    const { diagnostics } = await import('./diagnostics')

    const result = await diagnostics()

    expect(result.watching).toBeNull()
    expect(result.canReveal).toBeNull()
    expect(result.configPath).toBe('/Users/dev/Library/Application Support/specrun-app/config.json')
    expect(result.projectPath).toBe('/Users/dev/code/my-project')
    expect(result.appVersion).toBe(version)
  })

  it('目前無目標專案時 projectPath 明確為 null，不是「未知」——兩者成因不同', async () => {
    vi.resetModules()
    vi.doMock('./config-store', () => ({
      configFilePath: vi.fn(async () => '/config.json'),
    }))
    vi.doMock('./projects', () => ({
      currentProjectPath: vi.fn(async () => null),
    }))
    const { diagnostics } = await import('./diagnostics')

    const result = await diagnostics()

    expect(result.projectPath).toBeNull()
    // 未知的兩項不受「無目標專案」影響，仍是它們自己的 null
    expect(result.watching).toBeNull()
    expect(result.canReveal).toBeNull()
  })
})
