import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { webGateway } from './web-gateway'

/**
 * 最小可控的 EventSource stub：只模擬 subscribeToChanges 用得到的三個 hook
 * （onmessage／onerror／onopen）與 close，讓測試能手動觸發「斷線」「重連成功」。
 */
class FakeEventSource {
  static instances: FakeEventSource[] = []
  onmessage: (() => void) | null = null
  onerror: (() => void) | null = null
  onopen: (() => void) | null = null
  closed = false

  constructor(public url: string) {
    FakeEventSource.instances.push(this)
  }

  close(): void {
    this.closed = true
  }
}

describe('webGateway.subscribeToChanges: 重連補償', () => {
  beforeEach(() => {
    FakeEventSource.instances = []
    vi.stubGlobal('EventSource', FakeEventSource)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('首次建連 open 不觸發補償（掛載載入已涵蓋）', () => {
    const onChange = vi.fn()
    webGateway.subscribeToChanges(onChange)

    const source = FakeEventSource.instances[0]!
    source.onopen?.()

    expect(onChange).not.toHaveBeenCalled()
  })

  it('斷線後再次 open 視同一次變動通知，補一次重載', () => {
    const onChange = vi.fn()
    webGateway.subscribeToChanges(onChange)

    const source = FakeEventSource.instances[0]!
    source.onopen?.() // 首次建連
    source.onerror?.() // 斷線
    source.onopen?.() // 重連成功

    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('連續多次斷線重連，各自補一次，不會漏也不會多補', () => {
    const onChange = vi.fn()
    webGateway.subscribeToChanges(onChange)

    const source = FakeEventSource.instances[0]!
    source.onopen?.()
    source.onerror?.()
    source.onopen?.()
    source.onerror?.()
    source.onopen?.()

    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('onmessage 收到訊息時照常觸發 onChange，不受重連旗標影響', () => {
    const onChange = vi.fn()
    webGateway.subscribeToChanges(onChange)

    const source = FakeEventSource.instances[0]!
    source.onmessage?.()

    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('unsubscribe 會關閉底層連線', () => {
    const unsubscribe = webGateway.subscribeToChanges(() => {})
    const source = FakeEventSource.instances[0]!

    unsubscribe()

    expect(source.closed).toBe(true)
  })
})

describe('webGateway.openUrl: 開新分頁的時序與失敗收束', () => {
  // 測試環境為 node，沒有真的 `window`（見 vitest.config.ts 的說明：元件測試
  // 進來才談 jsdom）——比照上面 EventSource 的做法，以 vi.stubGlobal 整個換掉。
  const openMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('window', { open: openMock })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    openMock.mockReset()
  })

  it('開新分頁是同步呼叫，發生在回傳的 promise 尚未 settle 之前', () => {
    const fakeWindow = {} as Window
    openMock.mockReturnValue(fakeWindow)

    const pending = webGateway.openUrl('https://example.com')

    // 斷言發生在 await 之前、與 openUrl() 呼叫同一個同步區段內——
    // 若 window.open 被排到任何等待之後，這裡讀到的會是尚未呼叫。
    expect(openMock).toHaveBeenCalledTimes(1)
    expect(openMock).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer')

    return expect(pending).resolves.toEqual({ status: 'opened' })
  })

  it('window.open 回傳 null（例如被瀏覽器擋下）時回報失敗，不拋出例外', async () => {
    openMock.mockReturnValue(null)

    await expect(webGateway.openUrl('https://example.com')).resolves.toEqual({ status: 'failed' })
  })

  it('window.open 拋出例外時同樣收束成失敗，不外洩例外', async () => {
    openMock.mockImplementation(() => {
      throw new Error('blocked')
    })

    await expect(webGateway.openUrl('https://example.com')).resolves.toEqual({ status: 'failed' })
  })
})
