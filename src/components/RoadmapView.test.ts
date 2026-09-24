// @vitest-environment jsdom
import type { RoadmapListResult, RoadmapSummary } from '../api'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useProjectsStore } from '../stores/projects'
import { useViewStore } from '../stores/view'
import RoadmapView from './RoadmapView.vue'

/**
 * Roadmap 清單頁（Requirement 清單分組、清單卡片內容、卡片的複製標題、空與錯誤狀態）。
 * 直接掛載真實元件＋真實 pinia store，只在邊界 mock `gateway.listRoadmap`——沿用
 * stores/roadmap.test.ts 的 fixture 慣例，不自建替代測試設施。
 */

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
    mtime: 1_700_000_000_000,
    readFailed: false,
    body: `body of ${file}`,
    ...overrides,
  }
}

function ok(items: RoadmapSummary[], overrides: Partial<Extract<RoadmapListResult, { ok: true }>> = {}): RoadmapListResult {
  return {
    ok: true,
    targetPath: '/p',
    dirExists: true,
    offExists: false,
    items,
    refs: { specs: [], changes: [], archived: [], parked: [] },
    ...overrides,
  }
}

function withCurrentProject(): void {
  const projects = useProjectsStore()
  projects.loaded = true
  projects.currentPath = '/p'
  projects.projects = [{ path: '/p', name: 'specrun-app', current: true, temporary: false, badge: null }]
  // PageHeader 的觸發項文字與麵包屑數量都讀 view.currentView；App.vue 只在這個值是
  // 'roadmap' 時才會掛載 RoadmapView，這裡獨立掛載元件時要自己補上這個前提
  useViewStore().currentView = 'roadmap'
}

async function mountReady(result: RoadmapListResult) {
  gateway.listRoadmap.mockResolvedValue(result)
  withCurrentProject()
  const wrapper = mount(RoadmapView)
  await flushPromises()
  return wrapper
}

describe('roadmapView 清單分組與卡片內容', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    gateway.listRoadmap.mockReset()
  })

  it('依 In progress／Available／Blocked／Other 順序呈現各組標題與數量，空組不出現', async () => {
    const wrapper = await mountReady(ok([
      item('a.md', 'in-progress'),
      item('b.md', 'available'),
      item('c.md', 'available'),
      item('d.md', 'other'),
    ]))

    const headings = wrapper.findAll('h2').map(h => h.text())
    expect(headings).toEqual(['In progress (1)', 'Available (2)', 'Other (1)'])
  })

  it('沒有任何 Blocked 項時，清單不呈現 Blocked 組標題', async () => {
    const wrapper = await mountReady(ok([item('a.md', 'available')]))

    expect(wrapper.text()).not.toContain('Blocked (')
  })

  it('進行中（In progress）卡片顯示進度條 N/M 與 Next 副行，不顯示 Blocked 標記', async () => {
    const wrapper = await mountReady(ok([
      item('a.md', 'in-progress', { progress: { completed: 1, total: 4 }, next: '停用機構的下游影響' }),
    ]))

    const card = wrapper.get('article')
    expect(card.text()).toContain('1/4')
    expect(card.text()).toContain('Next: 停用機構的下游影響')
    expect(card.text()).not.toContain('Blocked')
  })

  it('卡著（Blocked）卡片顯示 Blocked 標記與 Needs 副行，不顯示進度條', async () => {
    const wrapper = await mountReady(ok([
      item('a.md', 'blocked', { needs: '業主確認重新輔導的實際運作流程（見下）' }),
    ]))

    const card = wrapper.get('article')
    expect(card.text()).toContain('Blocked')
    expect(card.text()).toContain('Needs: 業主確認重新輔導的實際運作流程（見下）')
    expect(card.text()).not.toMatch(/\d\/\d/)
  })

  it('非進行中／卡著（Available／Other）卡片不顯示進度條或 Blocked 標記（僅子項標籤例外）', async () => {
    // Available 組也可能帶非 null 的 progress（狀態字 0/M 時 normalize 一樣填 progress 欄位，
    // 分組規則本身不依賴它）——用這筆資料才真的驗到「畫面依組別、不是依欄位是否有值」決定要不要畫進度條
    const wrapper = await mountReady(ok([
      item('a.md', 'available', { statusText: '0/5', progress: { completed: 0, total: 5 } }),
      item('b.md', 'other'),
    ]))

    const text = wrapper.text()
    expect(text).not.toContain('Blocked')
    expect(text).not.toMatch(/\d\/\d/)
    expect(text).not.toContain('Next:')
    expect(text).not.toContain('Needs:')
  })

  it('子項（partOf）在任何組別都顯示 part of 標籤', async () => {
    const wrapper = await mountReady(ok([
      item('a.md', 'available', { partOf: '培訓機構管理' }),
    ]))

    expect(wrapper.get('article').text()).toContain('part of 培訓機構管理')
  })

  it('part of 含行內 code 時以 <code> 呈現，不露反引號', async () => {
    const wrapper = await mountReady(ok([
      item('a.md', 'available', { partOf: '`00-執行順序.md`' }),
    ]))

    const label = wrapper.findAll('article span').find(span => span.text().startsWith('part of'))!
    const code = label.get('code')
    expect(code.text()).toBe('00-執行順序.md')
    expect(label.text()).not.toContain('`')
  })

  it('進行中（In progress）缺 Next 時不顯示副行、不留佔位；卡著（Blocked）缺 Needs 時同理', async () => {
    const wrapper = await mountReady(ok([
      item('a.md', 'in-progress', { progress: { completed: 1, total: 4 }, next: null }),
      item('b.md', 'blocked', { needs: null }),
    ]))

    expect(wrapper.text()).not.toContain('Next:')
    expect(wrapper.text()).not.toContain('Needs:')
  })

  it('標題含行內 code 時，該片段以 <code> 呈現；複製與 aria-label 用去反引號純文字', async () => {
    const wrapper = await mountReady(ok([
      item('a.md', 'other', { title: '色彩透明度寫法失效（`/N`）' }),
    ]))

    const code = wrapper.get('article code')
    expect(code.text()).toBe('/N')
    expect(wrapper.get('article').attributes('aria-label')).toBe('Open 色彩透明度寫法失效（/N）')
  })

  it('更新時間顯示相對時間，滑鼠停留提供完整時刻；沒有 mtime 時不顯示時間', async () => {
    const wrapper = await mountReady(ok([
      item('a.md', 'other', { mtime: Date.now() - 60_000 }),
      item('b.md', 'in-progress', { progress: { completed: 1, total: 2 }, mtime: null }),
    ]))

    const times = wrapper.findAll('time')
    expect(times).toHaveLength(1)
    expect(times[0]!.attributes('title')).toBeTruthy()
  })
})

describe('roadmapView 卡片互動', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    gateway.listRoadmap.mockReset()
  })

  it('點擊卡片開啟詳情（aria-current 標示當前開啟卡）；再點同一張收合', async () => {
    const wrapper = await mountReady(ok([item('a.md', 'other')]))
    const card = wrapper.get('article')

    await card.trigger('click')
    expect(wrapper.get('article').attributes('aria-current')).toBe('true')

    await card.trigger('click')
    expect(wrapper.get('article').attributes('aria-current')).toBeUndefined()
  })

  it('點擊卡片上的複製鈕不會同時開啟詳情', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true })
    const wrapper = await mountReady(ok([item('a.md', 'other')]))

    await wrapper.get('article button[aria-label^="Copy"]').trigger('click')

    expect(wrapper.get('article').attributes('aria-current')).toBeUndefined()
  })
})

describe('roadmapView 空與錯誤狀態', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    gateway.listRoadmap.mockReset()
  })

  it('無目標專案：顯示加入專案引導，不呈現清單', async () => {
    gateway.listRoadmap.mockResolvedValue(ok([]))
    const projects = useProjectsStore()
    projects.loaded = true
    projects.currentPath = null
    projects.projects = []
    const wrapper = mount(RoadmapView)
    await flushPromises()

    expect(wrapper.text()).toContain('No project yet')
    expect(wrapper.findAll('article')).toHaveLength(0)
  })

  it('非 openspec 專案：顯示對應錯誤說明與目標路徑', async () => {
    const wrapper = await mountReady({
      ok: false,
      targetPath: '/missing',
      error: { kind: 'not-openspec-project', message: 'not openspec', detail: '/missing' },
    })

    expect(wrapper.text()).toContain('Not an OpenSpec project')
    expect(wrapper.text()).toContain('/missing')
  })

  it('讀取失敗：顯示可重試的錯誤狀態，點擊 Try again 重新呼叫', async () => {
    const wrapper = await mountReady({
      ok: false,
      targetPath: '/p',
      error: { kind: 'call-failed', message: 'boom' },
    })

    expect(wrapper.text()).toContain('Could not load the roadmap')
    gateway.listRoadmap.mockClear()
    gateway.listRoadmap.mockResolvedValue(ok([item('a.md', 'other')]))

    const tryAgain = wrapper.findAll('button').find(b => b.text() === 'Try again')!
    await tryAgain.trigger('click')
    await flushPromises()

    expect(gateway.listRoadmap).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).not.toContain('Could not load the roadmap')
  })

  it('專案停用 roadmap（無目錄、有 roadmap.off）：顯示停用說明', async () => {
    const wrapper = await mountReady(ok([], { dirExists: false, offExists: true }))

    expect(wrapper.text()).toContain('turned off')
  })

  it('沒有目錄也沒有 roadmap.off：顯示尚無 roadmap 說明', async () => {
    const wrapper = await mountReady(ok([], { dirExists: false, offExists: false }))

    expect(wrapper.text()).toContain('No roadmap yet')
  })

  it('目錄與 roadmap.off 同時存在時以目錄為準：目錄存在但 0 檔案時顯示尚無 roadmap，不是停用說明', async () => {
    const wrapper = await mountReady(ok([], { dirExists: true, offExists: true }))

    expect(wrapper.text()).toContain('No roadmap yet')
    expect(wrapper.text()).not.toContain('turned off')
  })

  it('首次載入尚未取得資料時顯示 skeleton 佔位，不顯示空狀態文案', () => {
    gateway.listRoadmap.mockReturnValue(new Promise(() => {})) // 掛住不 resolve，維持 firstLoadPending
    withCurrentProject()
    const wrapper = mount(RoadmapView)

    expect(wrapper.findAll('[aria-hidden="true"]').length).toBeGreaterThan(0)
    expect(wrapper.text()).not.toContain('No roadmap yet')
    expect(wrapper.text()).not.toContain('turned off')
  })
})

describe('roadmapView 麵包屑數量', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    gateway.listRoadmap.mockReset()
  })

  it('載入完成且無錯誤時，麵包屑顯示規劃檔總數', async () => {
    const wrapper = await mountReady(ok([item('a.md', 'other'), item('b.md', 'available')]))

    expect(wrapper.get('.crumb-page').text()).toBe('Roadmap (2)')
  })

  it('讀取失敗時，麵包屑不顯示數量', async () => {
    const wrapper = await mountReady({
      ok: false,
      targetPath: '/p',
      error: { kind: 'call-failed', message: 'boom' },
    })

    expect(wrapper.get('.crumb-page').text()).toBe('Roadmap')
  })
})
