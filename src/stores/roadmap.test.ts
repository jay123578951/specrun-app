import type { RoadmapSummary } from '../api'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRoadmapStore } from './roadmap'
import { useViewStore } from './view'

const gateway = vi.hoisted(() => ({
  listRoadmap: vi.fn(),
}))

vi.mock('../api', () => ({ gateway }))

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
    body: `body of ${file}`,
    ...overrides,
  }
}

function serverSays(items: RoadmapSummary[]): void {
  gateway.listRoadmap.mockResolvedValue({
    ok: true,
    targetPath: '/p',
    dirExists: true,
    offExists: false,
    items,
    refs: { specs: [], changes: [], archived: [], parked: [] },
  })
}

describe('roadmap store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('enter() 載入清單，firstLoadPending 落地後轉 false', async () => {
    serverSays([item('a.md', 'available')])
    const store = useRoadmapStore()

    expect(store.firstLoadPending).toBe(true)
    await store.enter()

    expect(store.firstLoadPending).toBe(false)
    expect(store.count).toBe(1)
  })

  it('openFile／close：面板開關與 openItem 對得上目前清單裡的全文', async () => {
    serverSays([item('a.md', 'available')])
    const store = useRoadmapStore()
    await store.enter()

    store.openFile('a.md')
    expect(store.isOpen).toBe(true)
    expect(store.openItem?.body).toBe('body of a.md')

    store.close()
    expect(store.isOpen).toBe(false)
    expect(store.openItem).toBeNull()
  })

  it('刷新後開著的規劃檔已不在新清單：面板關閉（Requirement 詳情 header「刷新後檔案已刪除」）', async () => {
    serverSays([item('a.md', 'available')])
    const store = useRoadmapStore()
    await store.enter()
    store.openFile('a.md')

    serverSays([]) // 該檔已被刪除
    await store.load()

    expect(store.isOpen).toBe(false)
    expect(store.count).toBe(0)
  })

  it('move()：↑↓ 依 items 既有的分組排序順序跨組切換，不自己重排', async () => {
    // items 到手時已是分組＋排序完成的最終順序（design：解析層一次到位），這裡用兩組各一筆
    // 模擬「In progress 組最後一項 → Available 組第一項」
    serverSays([item('a.md', 'in-progress'), item('b.md', 'available')])
    const store = useRoadmapStore()
    await store.enter()

    store.openFile('a.md')
    store.move(1)
    expect(store.openFileName).toBe('b.md')

    store.move(-1)
    expect(store.openFileName).toBe('a.md')

    // 已在两端，↑↓ 不環繞
    store.move(-1)
    expect(store.openFileName).toBe('a.md')
  })

  it('reset()：清空清單並關閉面板，回到首載狀態', async () => {
    serverSays([item('a.md', 'available')])
    const store = useRoadmapStore()
    await store.enter()
    store.openFile('a.md')

    store.reset()

    expect(store.items).toEqual([])
    expect(store.isOpen).toBe(false)
    expect(store.firstLoadPending).toBe(true)
  })

  it('load()：過期回應（序號作廢）不得覆寫較新一次 load() 已落地的狀態', async () => {
    const store = useRoadmapStore()

    let resolveStale!: (value: Awaited<ReturnType<typeof gateway.listRoadmap>>) => void
    gateway.listRoadmap.mockImplementationOnce(() => new Promise((resolve) => {
      resolveStale = resolve
    }))
    const staleLoad = store.load() // 第一次 load()：尚未 resolve，卡在半路

    serverSays([item('fresh.md', 'available')])
    await store.load() // 第二次 load()：先落地，代表較新的一輪

    // 第一次的回應現在才姍姍來遲；它必須被序號作廢，不得蓋掉第二次已落地的狀態
    resolveStale({
      ok: true,
      targetPath: '/stale',
      dirExists: true,
      offExists: false,
      items: [item('stale.md', 'available')],
      refs: { specs: [], changes: [], archived: [], parked: [] },
    })
    await staleLoad

    expect(store.items.map(i => i.file)).toEqual(['fresh.md'])
    expect(store.targetPath).toBe('/p')
  })

  it('load()：讀取失敗清空清單並記錄錯誤，開著的面板也隨之關閉', async () => {
    serverSays([item('a.md', 'available')])
    const store = useRoadmapStore()
    await store.enter()
    store.openFile('a.md')

    const error = { kind: 'call-failed' as const, message: 'boom' }
    gateway.listRoadmap.mockResolvedValueOnce({ ok: false, targetPath: '/p', error })
    await store.load()

    expect(store.items).toEqual([])
    expect(store.listError).toEqual(error)
    expect(store.dirExists).toBe(false)
    expect(store.offExists).toBe(false)
    expect(store.isOpen).toBe(false)
  })

  it('刷新後開著的規劃檔仍在新清單：面板維持開啟，內容原地更新（Requirement 詳情 header 刷新控制）', async () => {
    serverSays([item('a.md', 'available', { body: '舊內容' })])
    const store = useRoadmapStore()
    await store.enter()
    store.openFile('a.md')

    serverSays([item('a.md', 'available', { body: '新內容' })])
    await store.load()

    expect(store.isOpen).toBe(true)
    expect(store.openFileName).toBe('a.md')
    expect(store.openItem?.body).toBe('新內容')
  })

  describe('resolveRef／handleRef', () => {
    it('resolveRef 綁著目前清單當 ctx：規劃檔引用對得到清單內的檔名', async () => {
      serverSays([item('a.md', 'available'), item('b.md', 'available')])
      const store = useRoadmapStore()
      await store.enter()

      expect(store.resolveRef('b.md')).toEqual({ kind: 'roadmap', target: 'b.md' })
      expect(store.resolveRef('不存在.md')).toBeNull()
    })

    it('resolveRef 也綁著伺服器給的 refs：別頁名稱對得到時解析為 spec，reset() 後歸零', async () => {
      gateway.listRoadmap.mockResolvedValue({
        ok: true,
        targetPath: '/p',
        dirExists: true,
        offExists: false,
        items: [item('a.md', 'available')],
        refs: { specs: ['resilient-community-lifecycle'], changes: [], archived: [], parked: [] },
      })
      const store = useRoadmapStore()
      await store.enter()

      expect(store.resolveRef('resilient-community-lifecycle')).toEqual({ kind: 'spec', target: 'resilient-community-lifecycle' })

      store.reset()
      expect(store.resolveRef('resilient-community-lifecycle')).toBeNull()
    })

    it('handleRef：kind 為 roadmap 時面板內原地切換，不呼叫 view store 換頁', async () => {
      serverSays([item('a.md', 'available'), item('b.md', 'available')])
      const store = useRoadmapStore()
      await store.enter()
      store.openFile('a.md')
      useViewStore().show('roadmap') // 模擬使用者當下就在 Roadmap 頁

      store.handleRef({ kind: 'roadmap', target: 'b.md' })

      expect(store.openFileName).toBe('b.md')
      expect(useViewStore().currentView).toBe('roadmap') // 沒被 openOn 換走
    })

    it('handleRef：其餘 kind 呼叫 view store 的 openOn 換頁', async () => {
      serverSays([item('a.md', 'available')])
      const store = useRoadmapStore()
      await store.enter()

      store.handleRef({ kind: 'spec', target: 'resilient-community-lifecycle' })
      expect(useViewStore().currentView).toBe('specs')
      expect(useViewStore().pendingOpen).toEqual({ view: 'specs', id: 'resilient-community-lifecycle' })

      store.handleRef({ kind: 'change', target: 'add-roadmap-view' })
      expect(useViewStore().currentView).toBe('changes')

      store.handleRef({ kind: 'archived', target: '2026-09-02-badge-issuance-roster' })
      expect(useViewStore().currentView).toBe('archived')
    })
  })
})
