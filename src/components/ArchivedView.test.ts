// @vitest-environment jsdom
import type { ArchivedListResult } from '../api'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useProjectsStore } from '../stores/projects'
import { useSettingsStore } from '../stores/settings'
import { useViewStore } from '../stores/view'
import ArchivedView from './ArchivedView.vue'

const gateway = vi.hoisted(() => ({
  listArchived: vi.fn(),
}))

vi.mock('../api', () => ({ gateway }))

function fail(kind: 'cli-unavailable' | 'cli-outdated' | 'call-failed'): ArchivedListResult {
  return { ok: false, targetPath: '/p', error: { kind, message: 'x', detail: 'some detail' } } as ArchivedListResult
}

async function mountWith(result: ArchivedListResult) {
  gateway.listArchived.mockResolvedValue(result)
  const projects = useProjectsStore()
  projects.loaded = true
  projects.currentPath = '/p'
  projects.projects = [{ path: '/p', name: 'specrun-app', current: true, temporary: false, badge: null }]
  useViewStore().currentView = 'archived'
  const settings = useSettingsStore()
  const open = vi.spyOn(settings, 'open').mockResolvedValue()
  const wrapper = mount(ArchivedView)
  await flushPromises()
  return { wrapper, open }
}

function buttonTexts(wrapper: ReturnType<typeof mount>): string[] {
  return wrapper.findAll('button').map(b => b.text())
}

describe('archivedView CLI 錯誤呈現', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    gateway.listArchived.mockReset()
  })

  it('cli 不可用：顯示不可用說明與 Open settings，沒有 Try again，按下會開 Settings', async () => {
    const { wrapper, open } = await mountWith(fail('cli-unavailable'))

    expect(wrapper.text()).toContain('openspec CLI not available')
    expect(wrapper.text()).not.toContain('too old')
    expect(buttonTexts(wrapper)).toContain('Open settings')
    expect(buttonTexts(wrapper)).not.toContain('Try again')

    await wrapper.findAll('button').find(b => b.text() === 'Open settings')!.trigger('click')
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('版本過舊：說明需要 openspec 1.14 以上並附 Open settings，沒有 Try again，不出現卡片，按下會開 Settings', async () => {
    const { wrapper, open } = await mountWith(fail('cli-outdated'))

    expect(wrapper.text()).toContain('1.14')
    expect(wrapper.text()).toContain('openspec CLI is too old')
    expect(wrapper.text()).not.toContain('not available')
    expect(buttonTexts(wrapper)).toContain('Open settings')
    expect(buttonTexts(wrapper)).not.toContain('Try again')
    expect(wrapper.findAll('button[aria-label^="Open "]').filter(b => b.text() !== 'Open settings')).toHaveLength(0)

    await wrapper.findAll('button').find(b => b.text() === 'Open settings')!.trigger('click')
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('呼叫或解析失敗仍是可重試的一般錯誤：有 Try again，沒有 Open settings', async () => {
    const { wrapper } = await mountWith(fail('call-failed'))

    expect(buttonTexts(wrapper)).toContain('Try again')
    expect(buttonTexts(wrapper)).not.toContain('Open settings')
  })

  it('升級後重新載入：版本過舊的說明消失，清單卡片出現', async () => {
    const { wrapper } = await mountWith(fail('cli-outdated'))
    expect(wrapper.text()).toContain('too old')

    gateway.listArchived.mockResolvedValue({
      ok: true,
      targetPath: '/p',
      items: [{ dir: '2026-08-14-add-x', name: 'add-x', archivedAt: '2026-08-14', completedTasks: 2, totalTasks: 2, status: 'complete' }],
    })
    await wrapper.findAll('button').find(b => b.text() === 'Refresh')!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).not.toContain('too old')
    expect(wrapper.text()).toContain('add-x')
  })
})
