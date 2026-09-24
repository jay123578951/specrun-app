// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useProjectsStore } from '../stores/projects'
import { useViewStore } from '../stores/view'
import PageHeader from './PageHeader.vue'

/**
 * 頁切換下拉本批加入 Roadmap 第四項（design D8、Requirement 頁切換下拉）。
 * 不掛 App.vue：PageHeader 只依賴 projects／view store 與自己的 DOM 結構，
 * 直接掛載＋灌 store 狀態即可驗證，不必連帶啟動 gateway。
 */

function currentProject(): void {
  const projects = useProjectsStore()
  projects.loaded = true
  projects.currentPath = '/p'
  projects.projects = [{ path: '/p', name: 'specrun-app', current: true, temporary: false, badge: null }]
}

describe('pageHeader 頁切換下拉', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('展開時依序列出 Changes、Specs、Archived、Roadmap 四項', async () => {
    currentProject()
    const view = useViewStore()
    view.currentView = 'specs'
    const wrapper = mount(PageHeader)

    await wrapper.get('.crumb-page').trigger('click')

    const items = wrapper.findAll('[role="menuitem"]').map(item => item.text())
    expect(items).toEqual(['Changes', 'Specs', 'Archived', 'Roadmap'])
  })

  it('當前頁項標示 aria-current="page"，其餘項不標示', async () => {
    currentProject()
    const view = useViewStore()
    view.currentView = 'specs'
    const wrapper = mount(PageHeader)

    await wrapper.get('.crumb-page').trigger('click')

    const items = wrapper.findAll('[role="menuitem"]')
    const current = items.filter(item => item.attributes('aria-current') === 'page')
    expect(current).toHaveLength(1)
    expect(current[0]!.text()).toBe('Specs')
  })

  it('選定 Roadmap 項切換主區到 Roadmap 頁，觸發項文字更新', async () => {
    currentProject()
    const view = useViewStore()
    view.currentView = 'changes'
    const wrapper = mount(PageHeader)

    await wrapper.get('.crumb-page').trigger('click')
    const roadmapItem = wrapper.findAll('[role="menuitem"]').find(item => item.text() === 'Roadmap')!
    await roadmapItem.trigger('click')

    expect(view.currentView).toBe('roadmap')
    expect(wrapper.get('.crumb-page').text()).toContain('Roadmap')
  })

  it('下拉項目不顯示任何頁的數量（只有觸發項的當前頁旁可能帶數量）', async () => {
    currentProject()
    const view = useViewStore()
    view.currentView = 'roadmap'
    const wrapper = mount(PageHeader, { props: { count: 18 } })

    await wrapper.get('.crumb-page').trigger('click')

    for (const item of wrapper.findAll('[role="menuitem"]'))
      expect(item.text()).not.toMatch(/\d/)
  })

  it('麵包屑觸發項在 Roadmap 頁顯示數量', () => {
    currentProject()
    const view = useViewStore()
    view.currentView = 'roadmap'
    const wrapper = mount(PageHeader, { props: { count: 18 } })

    expect(wrapper.get('.crumb-page').text()).toBe('Roadmap (18)')
  })
})
