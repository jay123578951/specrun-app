import type { ChangeSummary, ProjectEntry } from '../api'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChangesStore } from './changes'
import { useProjectsStore } from './projects'

const gateway = vi.hoisted(() => ({
  listProjects: vi.fn(),
  listChanges: vi.fn(),
  listParked: vi.fn(),
  parkChange: vi.fn(),
  unparkChange: vi.fn(),
  pickFolder: vi.fn(),
  reorderProjects: vi.fn(),
  switchProject: vi.fn(),
}))

vi.mock('../api', () => ({ gateway }))

function active(name: string): ChangeSummary {
  return { name, completedTasks: 1, totalTasks: 3, status: 'in-progress', lastModified: 1, summary: '', createdAt: null }
}

function project(path: string, overrides: Partial<ProjectEntry> = {}): ProjectEntry {
  return { path, name: path, current: false, temporary: false, badge: null, ...overrides }
}

/** 兩個專案的清單，第一項是目前專案；徽章由呼叫端指定，模擬 refreshBadges 之外的既有數字 */
function twoProjects(currentBadge: number | null, otherBadge: number | null): ProjectEntry[] {
  return [
    project('/current', { current: true, badge: currentBadge }),
    project('/other', { current: false, badge: otherBadge }),
  ]
}

describe('projects store：目前專案徽章的即時更新', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    gateway.listParked.mockResolvedValue({ ok: true, parkAvailable: true, items: [] })
  })

  async function seeded(currentBadge: number | null, otherBadge: number | null) {
    gateway.listProjects.mockResolvedValue({
      ok: true,
      snapshot: { projects: twoProjects(currentBadge, otherBadge), currentPath: '/current', badgesIncluded: true },
    })
    const projects = useProjectsStore()
    await projects.load()
    const changes = useChangesStore()
    return { projects, changes }
  }

  it('新增 change 後（loadSilently 落地）目前專案的徽章跟著增加', async () => {
    const { projects, changes } = await seeded(1, 5)

    gateway.listChanges.mockResolvedValue({ ok: true, targetPath: '/current', changes: [active('a'), active('b')] })
    await changes.loadSilently()

    expect(projects.projects.find(each => each.path === '/current')?.badge).toBe(2)
  })

  it('移除 change 後（手動 Refresh／load 落地）目前專案的徽章跟著減少', async () => {
    const { projects, changes } = await seeded(3, 5)

    gateway.listChanges.mockResolvedValue({ ok: true, targetPath: '/current', changes: [active('a')] })
    await changes.load()

    expect(projects.projects.find(each => each.path === '/current')?.badge).toBe(1)
  })

  it('park 之後（runParkAction 內部的 load 落地）目前專案的徽章跟著減少', async () => {
    const { projects, changes } = await seeded(2, 5)

    gateway.listChanges.mockResolvedValue({ ok: true, targetPath: '/current', changes: [active('a'), active('b')] })
    await changes.load()
    expect(projects.projects.find(each => each.path === '/current')?.badge).toBe(2)

    gateway.parkChange.mockImplementation(async () => {
      gateway.listChanges.mockResolvedValue({ ok: true, targetPath: '/current', changes: [active('b')] })
      return { ok: true }
    })
    await changes.park('a')

    expect(projects.projects.find(each => each.path === '/current')?.badge).toBe(1)
  })

  it('取數失敗（CLI 失敗、非 openspec 專案）落地時徽章寫回 null，不編造成 0', async () => {
    const { projects, changes } = await seeded(4, 5)

    gateway.listChanges.mockResolvedValue({
      ok: false,
      targetPath: '/current',
      error: { kind: 'not-openspec-project', message: 'Not an openspec project.' },
    })
    await changes.load()

    expect(projects.projects.find(each => each.path === '/current')?.badge).toBeNull()
  })

  it('暫時性呼叫失敗（call-failed，既有卡片留著）不落地，徽章維持原值不變成 0', async () => {
    const { projects, changes } = await seeded(4, 5)

    // 先有一筆真實資料，讓 changes.value 非空——這樣 call-failed 分支才會走「既有卡片留著」
    gateway.listChanges.mockResolvedValue({ ok: true, targetPath: '/current', changes: [active('a')] })
    await changes.load()
    expect(projects.projects.find(each => each.path === '/current')?.badge).toBe(1)

    gateway.listChanges.mockResolvedValue({
      ok: false,
      targetPath: '/current',
      error: { kind: 'call-failed', message: 'Command failed.' },
    })
    await changes.load()

    // call-failed 不算真實落地：changesLandSeq 不動，徽章沿用上一次的真實數字，不被編成 0
    expect(projects.projects.find(each => each.path === '/current')?.badge).toBe(1)
  })

  it('非目前專案的徽章不受本次改動影響', async () => {
    const { projects, changes } = await seeded(1, 5)

    gateway.listChanges.mockResolvedValue({ ok: true, targetPath: '/current', changes: [active('a'), active('b'), active('c')] })
    await changes.loadSilently()

    expect(projects.projects.find(each => each.path === '/other')?.badge).toBe(5)
  })
})

describe('projects store：startAdd 的「選擇進行中」狀態', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('等待 gateway.pickFolder 期間 picking 為真，選擇流程結束後恢復為假', async () => {
    let resolvePick: (outcome: { status: 'canceled' }) => void = () => {}
    const pending = new Promise<{ status: 'canceled' }>((resolve) => {
      resolvePick = resolve
    })
    gateway.pickFolder.mockReturnValue(pending)

    const projects = useProjectsStore()
    expect(projects.picking).toBe(false)

    const started = projects.startAdd()
    expect(projects.picking).toBe(true)

    resolvePick({ status: 'canceled' })
    await started

    expect(projects.picking).toBe(false)
  })

  it('重疊呼叫 startAdd 兩次，picking 不擋下任何一次——各自真的呼叫 gateway.pickFolder', async () => {
    gateway.pickFolder.mockResolvedValue({ status: 'canceled' })
    const projects = useProjectsStore()

    await Promise.all([projects.startAdd(), projects.startAdd()])

    expect(gateway.pickFolder).toHaveBeenCalledTimes(2)
  })
})

describe('projects store：reorder', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    gateway.listParked.mockResolvedValue({ ok: true, parkAvailable: true, items: [] })
  })

  async function seeded() {
    gateway.listProjects.mockResolvedValue({
      ok: true,
      snapshot: {
        projects: [project('/a', { current: true }), project('/b'), project('/c')],
        currentPath: '/a',
        badgesIncluded: true,
      },
    })
    const store = useProjectsStore()
    await store.load()
    return store
  }

  const paths = (store: ReturnType<typeof useProjectsStore>) => store.projects.map(each => each.path)

  it('成功後順序維持，且不經過 busy', async () => {
    const store = await seeded()
    gateway.reorderProjects.mockResolvedValue({ ok: true })

    const done = store.reorder(['/c', '/a', '/b'])
    expect(paths(store)).toEqual(['/c', '/a', '/b'])
    expect(store.busy).toBe(false)
    await done

    expect(paths(store)).toEqual(['/c', '/a', '/b'])
  })

  it('失敗時彈回並發出 toast', async () => {
    const store = await seeded()
    gateway.reorderProjects.mockResolvedValue({ ok: false, message: 'Could not save the project order.' })

    await store.reorder(['/c', '/a', '/b'])

    expect(paths(store)).toEqual(['/a', '/b', '/c'])
    expect(useChangesStore().toasts[0]?.message).toBe('Could not save the project order.')
  })

  it('連續兩次排序只在第一次存完後再送最後一份', async () => {
    const store = await seeded()
    let release!: () => void
    gateway.reorderProjects.mockImplementationOnce(() => new Promise((resolve) => {
      release = () => resolve({ ok: true })
    }))
    gateway.reorderProjects.mockResolvedValue({ ok: true })

    const first = store.reorder(['/b', '/a', '/c'])
    void store.reorder(['/b', '/c', '/a'])
    void store.reorder(['/c', '/b', '/a'])
    expect(gateway.reorderProjects).toHaveBeenCalledTimes(1)
    release()
    await first

    expect(gateway.reorderProjects).toHaveBeenCalledTimes(2)
    expect(gateway.reorderProjects).toHaveBeenLastCalledWith(['/c', '/b', '/a'])
    expect(paths(store)).toEqual(['/c', '/b', '/a'])
  })

  it('排序存檔途中呼叫 switchTo 會等存完才開始', async () => {
    const store = await seeded()
    let release!: () => void
    gateway.reorderProjects.mockImplementation(() => new Promise((resolve) => {
      release = () => resolve({ ok: true })
    }))
    gateway.switchProject.mockResolvedValue({
      ok: true,
      snapshot: { projects: [project('/a'), project('/b', { current: true }), project('/c')], currentPath: '/b', badgesIncluded: false },
    })
    gateway.listChanges.mockResolvedValue({ ok: true, targetPath: '/b', changes: [] })

    const saved = store.reorder(['/b', '/a', '/c'])
    const switched = store.switchTo('/b')
    await Promise.resolve()
    expect(gateway.switchProject).not.toHaveBeenCalled()
    release()
    await saved
    await switched

    expect(gateway.switchProject).toHaveBeenCalledTimes(1)
  })
  it('成功時不收回傳的清單快照，保留畫面上較新的狀態', async () => {
    const store = await seeded()
    // 回傳的是存檔當下的舊快照：順序、current、徽章都與畫面不同
    gateway.reorderProjects.mockResolvedValue({
      ok: true,
      snapshot: { projects: [project('/a'), project('/b', { current: true, badge: 9 }), project('/c')], currentPath: '/b', badgesIncluded: false },
    })

    await store.reorder(['/c', '/a', '/b'])

    expect(paths(store)).toEqual(['/c', '/a', '/b'])
    expect(store.currentPath).toBe('/a')
    expect(store.projects.find(each => each.path === '/a')?.current).toBe(true)
    expect(store.projects.find(each => each.path === '/b')?.badge).toBeNull()
  })

  it('失敗彈回時保留各項目當下的 current 與徽章', async () => {
    const store = await seeded()
    gateway.reorderProjects.mockImplementation(async () => {
      // 存檔途中目前專案的徽章被背景刷新
      store.projects = store.projects.map(each => (each.path === '/a' ? { ...each, badge: 4 } : each))
      return { ok: false, message: 'The project list has changed. Try again.' }
    })

    await store.reorder(['/c', '/a', '/b'])

    expect(paths(store)).toEqual(['/a', '/b', '/c'])
    const a = store.projects.find(each => each.path === '/a')
    expect(a?.current).toBe(true)
    expect(a?.badge).toBe(4)
    expect(useChangesStore().toasts[0]?.message).toBe('The project list has changed. Try again.')
  })

  it('gateway 丟出例外時同樣彈回並發出 toast', async () => {
    const store = await seeded()
    gateway.reorderProjects.mockRejectedValue(new Error('boom'))

    await store.reorder(['/c', '/a', '/b'])

    expect(paths(store)).toEqual(['/a', '/b', '/c'])
    expect(useChangesStore().toasts[0]?.message).toBe('Could not save the project order.')
  })

  it('排隊的那一份失敗時，回到第一份（最後一次存成功）而不是最初的順序', async () => {
    const store = await seeded()
    let release!: () => void
    gateway.reorderProjects.mockImplementationOnce(() => new Promise((resolve) => {
      release = () => resolve({ ok: true })
    }))
    gateway.reorderProjects.mockResolvedValueOnce({ ok: false, message: 'Could not save the project order.' })

    const first = store.reorder(['/b', '/a', '/c'])
    void store.reorder(['/c', '/b', '/a'])
    expect(paths(store)).toEqual(['/c', '/b', '/a'])
    release()
    await first

    expect(gateway.reorderProjects).toHaveBeenCalledTimes(2)
    expect(paths(store)).toEqual(['/b', '/a', '/c'])
    expect(useChangesStore().toasts).toHaveLength(1)
  })

  it('第一份失敗時，排隊的那一份不再送出，回到最初的順序', async () => {
    const store = await seeded()
    let release!: () => void
    gateway.reorderProjects.mockImplementationOnce(() => new Promise((resolve) => {
      release = () => resolve({ ok: false, message: 'Could not save the project order.' })
    }))

    const first = store.reorder(['/b', '/a', '/c'])
    void store.reorder(['/c', '/b', '/a'])
    release()
    await first

    expect(gateway.reorderProjects).toHaveBeenCalledTimes(1)
    expect(paths(store)).toEqual(['/a', '/b', '/c'])
  })

  it('一次存成功後，下一次失敗回到這次存成功的順序', async () => {
    const store = await seeded()
    gateway.reorderProjects.mockResolvedValueOnce({ ok: true })
    await store.reorder(['/c', '/a', '/b'])

    gateway.reorderProjects.mockResolvedValueOnce({ ok: false, message: 'Could not save the project order.' })
    await store.reorder(['/b', '/c', '/a'])

    expect(paths(store)).toEqual(['/c', '/a', '/b'])
  })

  it('失敗之後可以再排序（存檔狀態有重置）', async () => {
    const store = await seeded()
    gateway.reorderProjects.mockResolvedValueOnce({ ok: false, message: 'Could not save the project order.' })
    await store.reorder(['/c', '/a', '/b'])

    gateway.reorderProjects.mockResolvedValueOnce({ ok: true })
    await store.reorder(['/b', '/a', '/c'])

    expect(gateway.reorderProjects).toHaveBeenCalledTimes(2)
    expect(gateway.reorderProjects).toHaveBeenLastCalledWith(['/b', '/a', '/c'])
    expect(paths(store)).toEqual(['/b', '/a', '/c'])
  })

  it('暫時項留在最前面，送給 gateway 的順序不含暫時項', async () => {
    gateway.listProjects.mockResolvedValue({
      ok: true,
      snapshot: {
        projects: [project('/t', { temporary: true }), project('/a', { current: true }), project('/b'), project('/c')],
        currentPath: '/a',
        badgesIncluded: true,
      },
    })
    const store = useProjectsStore()
    await store.load()
    gateway.reorderProjects.mockResolvedValue({ ok: true })

    const done = store.reorder(['/c', '/a', '/b'])
    expect(paths(store)).toEqual(['/t', '/c', '/a', '/b'])
    await done

    expect(gateway.reorderProjects).toHaveBeenCalledWith(['/c', '/a', '/b'])
  })

  it('排序存檔途中呼叫 switchTo，存完之後才送出 switchProject', async () => {
    const store = await seeded()
    let release!: () => void
    const order: string[] = []
    gateway.reorderProjects.mockImplementation(() => new Promise((resolve) => {
      release = () => {
        order.push('saved')
        resolve({ ok: true })
      }
    }))
    gateway.switchProject.mockImplementation(async () => {
      order.push('switch')
      return {
        ok: true,
        snapshot: { projects: [project('/b'), project('/a'), project('/c', { current: true })], currentPath: '/c', badgesIncluded: false },
      }
    })
    gateway.listChanges.mockResolvedValue({ ok: true, targetPath: '/c', changes: [] })

    const saved = store.reorder(['/b', '/a', '/c'])
    const switched = store.switchTo('/c')
    await Promise.resolve()
    await Promise.resolve()
    expect(store.busy).toBe(false)
    release()
    await saved
    await switched

    expect(order).toEqual(['saved', 'switch'])
  })
})
