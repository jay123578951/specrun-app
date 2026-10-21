// @vitest-environment jsdom
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { useNow } from './now'

const Probe = defineComponent({
  setup() {
    const now = useNow()
    return { now }
  },
  render() {
    return h('span', String(this.now))
  },
})

enableAutoUnmount(afterEach)

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0))
  })
  afterEach(() => {
    Reflect.deleteProperty(document, 'visibilityState')
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('推進 60 秒 ref 更新', () => {
    const w = mount(Probe)
    const before = w.vm.now
    vi.advanceTimersByTime(60_000)
    expect(w.vm.now).toBe(before + 60_000)
  })

  it('切回可見立即更新', () => {
    const w = mount(Probe)
    const before = w.vm.now
    vi.setSystemTime(Date.now() + 3 * 86_400_000)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(w.vm.now).toBe(before + 3 * 86_400_000)
  })

  it('全部卸載後計時器與監聽移除', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const a = mount(Probe)
    const b = mount(Probe)
    a.unmount()
    expect(vi.getTimerCount()).toBe(1)
    b.unmount()
    expect(vi.getTimerCount()).toBe(0)
    expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
  })

  it('兩個元件共用同一個計時器', () => {
    mount(Probe)
    mount(Probe)
    expect(vi.getTimerCount()).toBe(1)
  })
  function setVisibility(state: 'visible' | 'hidden') {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
  }

  it('未滿 60 秒不更新，之後每 60 秒再更新一次', () => {
    const w = mount(Probe)
    const t0 = w.vm.now
    vi.advanceTimersByTime(59_999)
    expect(w.vm.now).toBe(t0)
    vi.advanceTimersByTime(1)
    expect(w.vm.now).toBe(t0 + 60_000)
    vi.advanceTimersByTime(60_000)
    expect(w.vm.now).toBe(t0 + 120_000)
  })

  it('視窗變成看不見時不更新，變回看得見才更新', () => {
    const w = mount(Probe)
    const t0 = w.vm.now
    vi.setSystemTime(t0 + 5_000)
    setVisibility('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(w.vm.now).toBe(t0)
    setVisibility('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(w.vm.now).toBe(t0 + 5_000)
  })

  it('兩個元件拿到同一個 ref，一起更新', () => {
    const a = mount(Probe)
    const b = mount(Probe)
    vi.advanceTimersByTime(60_000)
    expect(a.vm.now).toBe(b.vm.now)
    expect(a.vm.now).toBe(Date.now())
  })

  it('其中一個卸載後，剩下的仍持續更新', () => {
    const a = mount(Probe)
    const b = mount(Probe)
    a.unmount()
    const t0 = b.vm.now
    vi.advanceTimersByTime(60_000)
    expect(b.vm.now).toBe(t0 + 60_000)
  })

  it('全部卸載後，時間流逝與視窗切回都不再更新', () => {
    let shared: ReturnType<typeof useNow> | undefined
    const C = defineComponent({
      setup() {
        shared = useNow()
        return () => h('i')
      },
    })
    const w = mount(C)
    const lastSeen = shared!.value
    w.unmount()
    vi.advanceTimersByTime(300_000)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(shared!.value).toBe(lastSeen)
  })

  it('全部卸載後再掛載，計時器重新啟動', () => {
    mount(Probe).unmount()
    expect(vi.getTimerCount()).toBe(0)
    const w = mount(Probe)
    expect(vi.getTimerCount()).toBe(1)
    const t0 = w.vm.now
    vi.advanceTimersByTime(60_000)
    expect(w.vm.now).toBe(t0 + 60_000)
  })

  it('回傳的 ref 不能從外部寫入', () => {
    let captured: ReturnType<typeof useNow> | undefined
    const C = defineComponent({
      setup() {
        captured = useNow()
        return () => h('i')
      },
    })
    mount(C)
    const before = captured!.value
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    ;(captured as { value: number }).value = 1
    expect(captured!.value).toBe(before)
    warn.mockRestore()
  })
})
