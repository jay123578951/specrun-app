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
