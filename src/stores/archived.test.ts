import type { ArchivedSummary } from '../api'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useArchivedStore } from './archived'
import { useChangesStore } from './changes'
import { useViewStore } from './view'

const gateway = vi.hoisted(() => ({
  listArchived: vi.fn(),
  getArchivedDetail: vi.fn(),
}))

vi.mock('../api', () => ({ gateway }))

function archivedItem(dir: string): ArchivedSummary {
  return { dir, name: dir, archivedAt: null, completedTasks: 1, totalTasks: 1, status: 'in-progress' }
}

describe('archived store：enter() 消化 Roadmap 跳轉來的 pendingOpen', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    gateway.getArchivedDetail.mockResolvedValue({ ok: true, detail: { name: 'x', artifacts: [] } })
  })

  it('找到目標：載入完成後自動開啟', async () => {
    gateway.listArchived.mockResolvedValue({
      ok: true,
      targetPath: '/p',
      items: [archivedItem('2026-09-02-badge-issuance-roster')],
    })
    useViewStore().openOn('archived', '2026-09-02-badge-issuance-roster')

    await useArchivedStore().enter()

    expect(useArchivedStore().openDir).toBe('2026-09-02-badge-issuance-roster')
    expect(useViewStore().pendingOpen).toBeNull()
  })

  it('找不到目標：停在清單、不開面板，並留下非阻斷 toast', async () => {
    gateway.listArchived.mockResolvedValue({ ok: true, targetPath: '/p', items: [] })
    useViewStore().openOn('archived', '2026-09-02-已刪除')

    await useArchivedStore().enter()

    expect(useArchivedStore().isOpen).toBe(false)
    expect(useChangesStore().toasts).toHaveLength(1)
  })

  it('過期的 enter() 回應搶先落地時，不得用還沒更新的舊清單消化 pendingOpen（序號作廢也要擋住 consumePendingOpen，不只擋 load() 寫資料）', async () => {
    const store = useArchivedStore()
    const changes = useChangesStore()
    const dir = '2026-09-02-badge-issuance-roster'

    let resolveStale!: (value: Awaited<ReturnType<typeof gateway.listArchived>>) => void
    gateway.listArchived.mockImplementationOnce(() => new Promise((resolve) => {
      resolveStale = resolve
    }))
    const staleEnter = store.enter()

    let resolveFresh!: (value: Awaited<ReturnType<typeof gateway.listArchived>>) => void
    gateway.listArchived.mockImplementationOnce(() => new Promise((resolve) => {
      resolveFresh = resolve
    }))
    const freshEnter = store.enter()
    useViewStore().openOn('archived', dir)

    resolveStale({ ok: true, targetPath: '/p', items: [] })
    await staleEnter

    resolveFresh({ ok: true, targetPath: '/p', items: [archivedItem(dir)] })
    await freshEnter

    expect(store.openDir).toBe(dir)
    expect(changes.toasts).toHaveLength(0)
  })
})
