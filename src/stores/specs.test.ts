import type { SpecSummary } from '../api'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChangesStore } from './changes'
import { useSpecsStore } from './specs'
import { useViewStore } from './view'

const gateway = vi.hoisted(() => ({
  listSpecs: vi.fn(),
  getSpecContent: vi.fn(),
}))

vi.mock('../api', () => ({ gateway }))

function spec(id: string): SpecSummary {
  return { id, requirementCount: 1 }
}

describe('specs store：enter() 消化 Roadmap 跳轉來的 pendingOpen', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    gateway.getSpecContent.mockResolvedValue({ ok: true, id: 'x', content: '' })
  })

  it('找到目標：載入完成後自動開啟', async () => {
    gateway.listSpecs.mockResolvedValue({ ok: true, targetPath: '/p', specs: [spec('a'), spec('b')] })
    useViewStore().openOn('specs', 'b')

    await useSpecsStore().enter()

    expect(useSpecsStore().openId).toBe('b')
    expect(useViewStore().pendingOpen).toBeNull()
  })

  it('找不到目標：停在清單、不開面板，並留下非阻斷 toast', async () => {
    gateway.listSpecs.mockResolvedValue({ ok: true, targetPath: '/p', specs: [spec('a')] })
    useViewStore().openOn('specs', 'ghost')

    await useSpecsStore().enter()

    expect(useSpecsStore().isOpen).toBe(false)
    expect(useChangesStore().toasts).toHaveLength(1)
  })

  it('pendingOpen 目標不是自己時不消化，留給真正的目標頁', async () => {
    gateway.listSpecs.mockResolvedValue({ ok: true, targetPath: '/p', specs: [spec('a')] })
    useViewStore().openOn('archived', 'a')

    await useSpecsStore().enter()

    expect(useSpecsStore().isOpen).toBe(false)
    expect(useViewStore().pendingOpen).toEqual({ view: 'archived', id: 'a' })
  })

  it('過期的 enter() 回應搶先落地時，不得用還沒更新的舊清單消化 pendingOpen（序號作廢也要擋住 consumePendingOpen，不只擋 load() 寫資料）', async () => {
    const store = useSpecsStore()
    const changes = useChangesStore()

    // 第一輪 enter()：gateway 回應卡住不放（較舊、較慢的那一輪，例如使用者連續切了兩次頁）
    let resolveStale!: (value: Awaited<ReturnType<typeof gateway.listSpecs>>) => void
    gateway.listSpecs.mockImplementationOnce(() => new Promise((resolve) => {
      resolveStale = resolve
    }))
    const staleEnter = store.enter()

    // 第一輪還沒落地時，第二輪 enter() 接著開始（也還沒落地）；此時才掛上待開目標
    let resolveFresh!: (value: Awaited<ReturnType<typeof gateway.listSpecs>>) => void
    gateway.listSpecs.mockImplementationOnce(() => new Promise((resolve) => {
      resolveFresh = resolve
    }))
    const freshEnter = store.enter()
    useViewStore().openOn('specs', 'b')

    // 過期的第一輪這時候先回來：它的清單被序號作廢，但緊接著的 consumePendingOpen()
    // 仍會用「目前」的 specs.value（此刻還是空的）去問 b 找不找得到
    resolveStale({ ok: true, targetPath: '/p', specs: [spec('a')] })
    await staleEnter

    // 較新的第二輪才真正落地，清單裡其實有 b
    resolveFresh({ ok: true, targetPath: '/p', specs: [spec('a'), spec('b')] })
    await freshEnter

    // b 確實存在於正確落地的清單中，理應被開啟、不該出現「找不到」的 toast
    expect(store.openId).toBe('b')
    expect(changes.toasts).toHaveLength(0)
  })
})
