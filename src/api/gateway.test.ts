import { describe, expect, it, vi } from 'vitest'

/**
 * `gateway.ts` 是整個分流的收斂點：`isTauri()` 為真走桌面實作、為假走 web 實作，
 * 呼叫端只認 `OpenSpecGateway`。這裡不連真的 Tauri 也不連真的本地 API server，
 * 改用 sentinel 物件取代兩邊實作，只驗證「選中哪一個」這件事本身。
 *
 * `gateway` 是模組載入時就決定的頂層常數，每個案例都要 resetModules 後
 * 重新 import，否則會沿用前一個案例載入時的分流結果。
 */
describe('api/gateway: 依執行形態分流', () => {
  it('isTauri() 為 true 時，gateway 指向桌面實作', async () => {
    vi.resetModules()
    const desktopSentinel = { marker: 'desktop' }
    const webSentinel = { marker: 'web' }
    vi.doMock('../utils/is-tauri', () => ({ isTauri: () => true }))
    vi.doMock('./desktop-gateway', () => ({ desktopGateway: desktopSentinel }))
    vi.doMock('./web-gateway', () => ({ webGateway: webSentinel }))

    const { gateway } = await import('./gateway')
    expect(gateway).toBe(desktopSentinel)
  })

  it('isTauri() 為 false 時，gateway 指向 web 實作', async () => {
    vi.resetModules()
    const desktopSentinel = { marker: 'desktop' }
    const webSentinel = { marker: 'web' }
    vi.doMock('../utils/is-tauri', () => ({ isTauri: () => false }))
    vi.doMock('./desktop-gateway', () => ({ desktopGateway: desktopSentinel }))
    vi.doMock('./web-gateway', () => ({ webGateway: webSentinel }))

    const { gateway } = await import('./gateway')
    expect(gateway).toBe(webSentinel)
  })
})
