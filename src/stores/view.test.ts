import type { ArchivedSummary, ChangeSummary, ParkedSummary, SpecSummary } from '../api'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useArchivedStore } from './archived'
import { useChangesStore } from './changes'
import { useDetailStore } from './detail'
import { useSpecsStore } from './specs'
import { useViewStore } from './view'

const gateway = vi.hoisted(() => ({
  getChangeDetail: vi.fn(),
  getParkedDetail: vi.fn(),
  listSpecs: vi.fn(),
  getSpecContent: vi.fn(),
  listArchived: vi.fn(),
  getArchivedDetail: vi.fn(),
}))

vi.mock('../api', () => ({ gateway }))

function spec(id: string): SpecSummary {
  return { id, requirementCount: 1 }
}

function archivedItem(dir: string): ArchivedSummary {
  return { dir, name: dir, archivedAt: null, completedTasks: 1, totalTasks: 1, status: 'in-progress' }
}

function active(name: string): ChangeSummary {
  return { name, completedTasks: 1, totalTasks: 3, status: 'in-progress', lastModified: 1, summary: '', createdAt: null }
}

function parkedItem(name: string): ParkedSummary {
  return { name, completedTasks: 1, totalTasks: 3, status: 'in-progress', parkedAt: 1, summary: '', createdAt: null }
}

describe('view store：openOn／pendingOpen', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    gateway.getChangeDetail.mockResolvedValue({ ok: true, detail: { name: 'x', artifacts: [] } })
    gateway.getParkedDetail.mockResolvedValue({ ok: true, detail: { name: 'x', artifacts: [] } })
  })

  it('openOn 依既有 show() 換頁，並掛上待開目標', () => {
    const view = useViewStore()
    view.openOn('specs', 'foo')

    expect(view.currentView).toBe('specs')
    expect(view.pendingOpen).toEqual({ view: 'specs', id: 'foo' })
  })

  it('consumePendingOpen 只在目標吻合時取出並清空，其餘頁問到的是 null', () => {
    const view = useViewStore()
    view.openOn('specs', 'foo')

    expect(view.consumePendingOpen('archived')).toBeNull()
    expect(view.pendingOpen).not.toBeNull() // 沒被問中的那一頁不能清掉別人的待開目標

    expect(view.consumePendingOpen('specs')).toBe('foo')
    expect(view.pendingOpen).toBeNull()
  })

  it('目標是 Changes 的 active change：切頁當下直接開啟，pendingOpen 不留存', () => {
    useChangesStore().changes = [active('a')]
    const view = useViewStore()
    view.show('specs') // 先離開預設的 changes 頁，換頁動作才會真的發生

    view.openOn('changes', 'a')

    expect(view.currentView).toBe('changes')
    expect(view.pendingOpen).toBeNull()
    expect(useDetailStore().changeName).toBe('a')
    expect(useDetailStore().isParked).toBe(false)
  })

  it('目標是 Changes 的 parked change：同樣切頁當下直接開啟', () => {
    useChangesStore().parked = [parkedItem('b')]
    const view = useViewStore()
    view.show('specs')

    view.openOn('changes', 'b')

    expect(useDetailStore().changeName).toBe('b')
    expect(useDetailStore().isParked).toBe(true)
  })

  it('目標在 Changes 的 active／parked 清單中都找不到：停在清單、不開詳情，並留下 toast', () => {
    const changes = useChangesStore()
    const view = useViewStore()
    view.show('specs')

    view.openOn('changes', 'ghost')

    expect(useDetailStore().isOpen).toBe(false)
    expect(changes.toasts).toHaveLength(1)
  })

  it('openOn(specs, x) 後，Specs 還沒載入完成就切到別頁：pendingOpen 作廢，之後進 Specs 即使 x 存在也不會自動開啟、不會 toast', async () => {
    gateway.listSpecs.mockResolvedValue({ ok: true, targetPath: '/p', specs: [spec('x')] })
    const view = useViewStore()
    const specsStore = useSpecsStore()
    const changes = useChangesStore()

    view.openOn('specs', 'x')
    expect(view.pendingOpen).toEqual({ view: 'specs', id: 'x' })

    // Specs 頁的 enter() 還沒跑完（載入未完成）就被切走
    view.show('changes')
    expect(view.pendingOpen).toBeNull()

    // 之後才真的進 Specs，即使清單裡有 x 也不該被自動打開
    view.show('specs')
    await specsStore.enter()

    expect(specsStore.openId).toBeNull()
    expect(changes.toasts).toHaveLength(0)
  })

  it('openOn(archived, y) 後切到 roadmap 同樣作廢：之後進 Archived 即使 y 存在也不會自動開啟、不會 toast', async () => {
    gateway.listArchived.mockResolvedValue({ ok: true, targetPath: '/p', items: [archivedItem('y')] })
    const view = useViewStore()
    const archivedStore = useArchivedStore()
    const changes = useChangesStore()

    view.openOn('archived', 'y')
    expect(view.pendingOpen).toEqual({ view: 'archived', id: 'y' })

    view.show('roadmap')
    expect(view.pendingOpen).toBeNull()

    view.show('archived')
    await archivedStore.enter()

    expect(archivedStore.openDir).toBeNull()
    expect(changes.toasts).toHaveLength(0)
  })
})
