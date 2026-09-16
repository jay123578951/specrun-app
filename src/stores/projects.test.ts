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
