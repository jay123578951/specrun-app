// @vitest-environment jsdom
import type { ChangeSummary, ParkedSummary } from '../api'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import ChangeCard from './ChangeCard.vue'

enableAutoUnmount(afterEach)

const DAY = 24 * 60 * 60_000

function activeChange(lastModified: number): ChangeSummary {
  return { name: 'a', completedTasks: 1, totalTasks: 2, status: 'in-progress', lastModified, createdAt: null, summary: '' }
}

function parkedChange(parkedAt: number): ParkedSummary {
  return { name: 'p', completedTasks: 0, totalTasks: 0, status: 'no-tasks', parkedAt, createdAt: null, summary: '' }
}

describe('changeCard 時間欄位隨時間更新', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('active 卡昨日 18:38 的時刻，跨過午夜後一分鐘內改為相對寫法', async () => {
    vi.setSystemTime(new Date(2026, 5, 10, 23, 59, 30))
    const wrapper = mount(ChangeCard, { props: { change: activeChange(new Date(2026, 5, 10, 18, 38).getTime()) } })
    await nextTick()
    expect(wrapper.find('time').text()).toBe('18:38')

    vi.setSystemTime(new Date(2026, 5, 11, 0, 1, 0))
    await vi.advanceTimersByTimeAsync(60_000)
    expect(wrapper.find('time').text()).toBe('5h ago')
  })

  it('parked 卡 11 天前，滿 12 天後一分鐘內改為 parked 12d ago', async () => {
    const parkedAt = new Date(2026, 5, 1, 12, 0).getTime()
    vi.setSystemTime(parkedAt + 11 * DAY + 60_000)
    const wrapper = mount(ChangeCard, { props: { change: parkedChange(parkedAt) } })
    await nextTick()
    expect(wrapper.find('time').text()).toBe('parked 11d ago')

    vi.setSystemTime(parkedAt + 12 * DAY + 1000)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(wrapper.find('time').text()).toBe('parked 12d ago')
  })
  it('跨日後的分鐘數每過一分鐘遞增，title 的完整時刻不變', async () => {
    const t = new Date(2026, 5, 10, 23, 58).getTime()
    vi.setSystemTime(new Date(2026, 5, 11, 0, 1, 0))
    const wrapper = mount(ChangeCard, { props: { change: activeChange(t) } })
    await nextTick()
    const title = wrapper.find('time').attributes('title')
    expect(wrapper.find('time').text()).toBe('3m ago')

    // 推進假時鐘本身就會讓 Date.now() 前進，不需再 setSystemTime
    await vi.advanceTimersByTimeAsync(60_000)
    expect(wrapper.find('time').text()).toBe('4m ago')

    await vi.advanceTimersByTimeAsync(60_000)
    expect(wrapper.find('time').text()).toBe('5m ago')
    expect(wrapper.find('time').attributes('title')).toBe(title)
  })

  it('視窗切回可見時立即重算，且每張卡片都更新（不等例行計時）', async () => {
    vi.setSystemTime(new Date(2026, 5, 10, 23, 59, 30))
    const a = mount(ChangeCard, { props: { change: activeChange(new Date(2026, 5, 10, 18, 38).getTime()) } })
    const b = mount(ChangeCard, { props: { change: activeChange(new Date(2026, 5, 10, 19, 38).getTime()) } })
    await nextTick()
    expect(a.find('time').text()).toBe('18:38')
    expect(b.find('time').text()).toBe('19:38')

    vi.setSystemTime(new Date(2026, 5, 11, 0, 1, 0))
    await vi.advanceTimersByTimeAsync(1000)
    expect(a.find('time').text()).toBe('18:38')
    document.dispatchEvent(new Event('visibilitychange'))
    await nextTick()
    expect(a.find('time').text()).toBe('5h ago')
    expect(b.find('time').text()).toBe('4h ago')
  })
})
