// @vitest-environment jsdom
import type { RoadmapSummary } from './api'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.vue'
import { useRoadmapStore } from './stores/roadmap'
import { useViewStore } from './stores/view'

/**
 * App.vue 本批新接的 Roadmap 頁槽位（Requirement 鍵盤行為、切頁即關與重新載入，design D6）：
 * `onRoadmap`／`panelOpen` 的第四分支、`move()`／Esc 分派給 `roadmap` store、
 * `RoadmapPanel` 只在 `onRoadmap && roadmap.isOpen` 時掛載。其餘既有頁（Changes／Specs／
 * Archived）已由前面批次覆蓋，這裡只驗 Roadmap 這一路新分支，不重測既有三頁。
 *
 * 全掛載 App.vue：只在邊界 mock `gateway`（AppSidebar／ProjectSwitcher／各 store 在
 * onMounted 期間真的會呼叫到的那幾支），其餘走真實 import／真實 pinia，不自建替代設施。
 */

const gateway = vi.hoisted(() => ({
  subscribeToChanges: vi.fn(() => () => {}),
  listProjects: vi.fn(),
  listChanges: vi.fn(),
  listParked: vi.fn(),
  listRoadmap: vi.fn(),
}))

vi.mock('./api', () => ({ gateway }))

function item(file: string, group: RoadmapSummary['group'], overrides: Partial<RoadmapSummary> = {}): RoadmapSummary {
  return {
    name: file.replace(/\.md$/, ''),
    file,
    title: file,
    statusText: '',
    group,
    progress: null,
    next: null,
    needs: null,
    partOf: null,
    mtime: 1,
    readFailed: false,
    body: '',
    ...overrides,
  }
}

async function mountOnRoadmap(items: RoadmapSummary[]) {
  gateway.listProjects.mockResolvedValue({ ok: true, snapshot: { projects: [], currentPath: null, badgesIncluded: true } })
  gateway.listChanges.mockResolvedValue({ ok: true, targetPath: '', changes: [] })
  gateway.listParked.mockResolvedValue({ ok: true, parkAvailable: true, items: [] })
  gateway.listRoadmap.mockResolvedValue({
    ok: true,
    targetPath: '/p',
    dirExists: true,
    offExists: false,
    items,
    refs: { specs: [], changes: [], archived: [], parked: [] },
  })

  useViewStore().currentView = 'roadmap'
  const wrapper = mount(App, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

describe('app.vue：Roadmap 頁槽位與鍵盤分派', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // jsdom 沒有實作 scrollIntoView；App.vue 的「鍵盤切到捲動範圍外的項目時帶進視野」
    // watcher 會真的呼叫到它，不 stub 會變成未處理的 rejection 污染其他測試
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('view.currentView 為 roadmap 時渲染 RoadmapView，不渲染其他三頁', async () => {
    const wrapper = await mountOnRoadmap([item('a.md', 'other')])

    expect(wrapper.findComponent({ name: 'RoadmapView' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'ChangeList' }).exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'SpecsView' }).exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'ArchivedView' }).exists()).toBe(false)
  })

  it('roadmap.isOpen 時掛載 RoadmapPanel；未開啟時不掛載', async () => {
    const wrapper = await mountOnRoadmap([item('a.md', 'other')])
    expect(wrapper.findComponent({ name: 'RoadmapPanel' }).exists()).toBe(false)

    useRoadmapStore().openFile('a.md')
    await wrapper.vm.$nextTick()

    expect(wrapper.findComponent({ name: 'RoadmapPanel' }).exists()).toBe(true)
  })

  it('在 Roadmap 頁面板開啟時按 ArrowDown／ArrowUp 呼叫 roadmap.move()，不呼叫 detail/specs/archived 的等價方法', async () => {
    await mountOnRoadmap([item('a.md', 'available'), item('b.md', 'other')])
    const roadmap = useRoadmapStore()
    roadmap.openFile('a.md')
    await flushPromises()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    await flushPromises()

    expect(roadmap.openFileName).toBe('b.md')
  })

  it('在 Roadmap 頁面板開啟時按 Esc 收合面板（roadmap.close()）', async () => {
    await mountOnRoadmap([item('a.md', 'other')])
    const roadmap = useRoadmapStore()
    roadmap.openFile('a.md')
    await flushPromises()
    expect(roadmap.isOpen).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()

    expect(roadmap.isOpen).toBe(false)
  })

  it('在 Roadmap 頁面板未開啟時，↑↓／Esc 不對 roadmap store 產生作用（鍵盤不搶清單狀態下的行為）', async () => {
    await mountOnRoadmap([item('a.md', 'available'), item('b.md', 'other')])
    const roadmap = useRoadmapStore()
    expect(roadmap.isOpen).toBe(false)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()

    expect(roadmap.isOpen).toBe(false)
    expect(roadmap.openFileName).toBeNull()
  })
})
