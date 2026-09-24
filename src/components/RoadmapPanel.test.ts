// @vitest-environment jsdom
import type { RoadmapSummary } from '../api'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderMarkdown } from '../markdown/render'
import { useRoadmapStore } from '../stores/roadmap'
import RoadmapPanel from './RoadmapPanel.vue'

/**
 * 詳情 slideover（Requirement 詳情 header、開頭段重排、拆分與進度提前與狀態圖示、引用連結）。
 * 直接掛載真實元件＋真實 pinia store／真實 MarkdownView，只在邊界 mock `gateway.listRoadmap`
 * （刷新控制才會用到）。
 */

const gateway = vi.hoisted(() => ({
  listRoadmap: vi.fn(),
}))

vi.mock('../api', () => ({ gateway }))

/** 暖機：MarkdownView 首次 render 要動態載入 shiki，先暖機一次避免各案例各等各的 */
beforeAll(async () => {
  await renderMarkdown('warmup', { interactive: false })
})

async function waitForRender(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve))
  await flushPromises()
}

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
    body: '',
    ...overrides,
  }
}

/**
 * 面板不自己 enter()，直接把 store 灌成「已載完」的狀態，比照 SettingsModal.test.ts 的作法。
 * `refs`（spec／change／archived 名稱清單）不在 store 對外的回傳面上，本檔的引用連結測試
 * 只驗 kind roadmap（靠 `items` 本身，見 buildRoadmapRefContext），不需要也設不到它。
 */
function openPanel(items: RoadmapSummary[], openFileName: string) {
  const store = useRoadmapStore()
  store.items = items
  store.firstLoadPending = false
  store.openFile(openFileName)
  const wrapper = mount(RoadmapPanel)
  return { store, wrapper }
}

describe('roadmapPanel header', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    gateway.listRoadmap.mockReset()
  })

  it('標題含行內 code 時以 <code> 呈現，其餘為純文字', () => {
    const { wrapper } = openPanel([item('a.md', 'other', { title: '`00-執行順序.md`' })], 'a.md')

    const code = wrapper.get('h2 code')
    expect(code.text()).toBe('00-執行順序.md')
  })

  it('進行中（In progress）：header 顯示進度條與 N/M', () => {
    const { wrapper } = openPanel([
      item('a.md', 'in-progress', { progress: { completed: 1, total: 4 } }),
    ], 'a.md')

    expect(wrapper.get('header').text()).toContain('1/4')
  })

  it('卡著（Blocked）：header 顯示 Blocked 標記', () => {
    const { wrapper } = openPanel([item('a.md', 'blocked')], 'a.md')

    expect(wrapper.get('header').text()).toContain('Blocked')
  })

  it('其他（Other）：header 顯示 Other 標記', () => {
    const { wrapper } = openPanel([item('a.md', 'other')], 'a.md')

    expect(wrapper.get('header').text()).toContain('Other')
  })

  it('可挑（Available）：header 不顯示任何狀態標記', () => {
    const { wrapper } = openPanel([item('a.md', 'available', { statusText: '0/5', progress: { completed: 0, total: 5 } })], 'a.md')

    const headerText = wrapper.get('header').text()
    expect(headerText).not.toContain('Blocked')
    expect(headerText).not.toContain('Other')
    expect(headerText).not.toMatch(/\d\/\d/)
  })

  it('顯示 Updated 加不含年份的月日時分，title 為含年份的完整時刻', () => {
    const mtime = new Date('2026-09-21T14:52:00').getTime()
    const { wrapper } = openPanel([item('a.md', 'other', { mtime })], 'a.md')

    const time = wrapper.get('time')
    expect(time.text()).toBe('Updated 09-21 14:52')
    expect(time.attributes('title')).toBe('2026-09-21 14:52')
  })

  it('沒有 mtime 時不顯示 Updated，整欄不留佔位', () => {
    const { wrapper } = openPanel([item('a.md', 'other', { mtime: null })], 'a.md')

    expect(wrapper.find('time').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Updated')
  })

  it('複製控制的 aria-label 為 Copy title，複製內容為去反引號純文字', () => {
    const { wrapper } = openPanel([item('a.md', 'other', { title: '色彩透明度寫法失效（`/N`）' })], 'a.md')

    // get() 找不到就直接丟出，本身即是存在性斷言
    wrapper.get('button[aria-label="Copy title"]')
  })

  it('刷新控制點擊呼叫 roadmap.load()，重新讀取清單', async () => {
    gateway.listRoadmap.mockResolvedValue({
      ok: true,
      targetPath: '/p',
      dirExists: true,
      offExists: false,
      items: [item('a.md', 'other')],
      refs: { specs: [], changes: [], archived: [], parked: [] },
    })
    const { wrapper } = openPanel([item('a.md', 'other')], 'a.md')

    await wrapper.get('button[aria-label="Refresh roadmap"]').trigger('click')
    await flushPromises()

    expect(gateway.listRoadmap).toHaveBeenCalledTimes(1)
  })

  it('不顯示檔案路徑，也沒有 tabs', () => {
    // 標題刻意與檔名不同——確認消失的是檔名本身，不是碰巧與標題撞字
    const { wrapper } = openPanel([item('roadmap-item-file.md', 'other', { title: '培訓機構管理' })], 'roadmap-item-file.md')

    expect(wrapper.text()).not.toContain('roadmap-item-file.md')
    expect(wrapper.find('[role="tab"]').exists()).toBe(false)
  })

  it('點擊收合控制呼叫 roadmap.close()', async () => {
    const { store, wrapper } = openPanel([item('a.md', 'other')], 'a.md')
    const closeSpy = vi.spyOn(store, 'close')

    await wrapper.get('button[aria-label="Collapse roadmap item (Esc)"]').trigger('click')

    expect(closeSpy).toHaveBeenCalledTimes(1)
  })
})

describe('roadmapPanel 內容區切段', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    gateway.listRoadmap.mockReset()
  })

  it('沒有開頭段時，不出現空的關係欄框，也不出現導言區塊', async () => {
    const { wrapper } = openPanel([item('a.md', 'other', { body: '## 只有一段\n內容' })], 'a.md')
    await waitForRender()

    expect(wrapper.find('.md-relations').exists()).toBe(false)
    expect(wrapper.find('.md-lead').exists()).toBe(false)
  })

  it('開頭段含關係欄行時，收進關係欄框，導言在其上；沒有這類行時導言仍顯示', async () => {
    const body = '說明文字\n\n- **規格**：`no-restricted-imports`\n\n## 動工前必知\n內容'
    const { wrapper } = openPanel([item('a.md', 'available', { body })], 'a.md')
    await waitForRender()

    expect(wrapper.get('.md-lead').text()).toContain('說明文字')
    const relationRow = wrapper.get('.md-relation-row')
    expect(relationRow.get('.md-relation-key').text()).toBe('規格')
    expect(relationRow.text()).toContain('no-restricted-imports')
  })

  it('含「## 拆分與進度」段落時提前呈現於其他段落之前', async () => {
    const body = [
      '## 開始的條件',
      '前置說明',
      '',
      '## 拆分與進度',
      '| 範圍 | 狀態 |',
      '|------|------|',
      '| 第一項 | ⬅ 接下來 |',
      '',
      '## 動工前必知',
      '後段內容',
    ].join('\n')
    const { wrapper } = openPanel([item('a.md', 'in-progress', { body, progress: { completed: 0, total: 2 } })], 'a.md')
    await waitForRender()

    const text = wrapper.get('.min-h-0').text()
    const splitAt = text.indexOf('第一項')
    const beforeAt = text.indexOf('開始的條件')
    const afterAt = text.indexOf('動工前必知')
    expect(splitAt).toBeGreaterThan(-1)
    expect(splitAt).toBeLessThan(beforeAt)
    expect(splitAt).toBeLessThan(afterAt)
  })

  it('沒有拆分段時，內容區不出現拆分表區塊，其餘段落仍照原順序呈現', async () => {
    const body = '## 開始的條件\n第一段\n\n## 動工前必知\n第二段'
    const { wrapper } = openPanel([item('a.md', 'available', { body })], 'a.md')
    await waitForRender()

    const text = wrapper.get('.min-h-0').text()
    expect(text.indexOf('第一段')).toBeLessThan(text.indexOf('第二段'))
  })

  it('開頭段兩行同欄名時，關係欄框出現兩列且順序照原檔；切換規劃檔觸發重繪也不觸發 Vue duplicate key 警告', async () => {
    // 先開一份「有關係欄框、但只有一列且欄名不同」的檔，再切到兩行同欄名那份——
    // 關係欄名兩邊不同時，Vue 的前綴比對第一格就不吻合，才會真的走進逐項比對
    // （用同欄名銜接會被「第一格 key 剛好吻合」的前綴優化蓋過去，測不到 duplicate key 這條路）；
    // 框本身（v-if）維持存在，不是從無到有（那會是整塊重新掛載，同樣測不到既有列表的 patch 路徑）
    const bodyA = '- **規格**：初始內容\n\n## 動工前必知\n內容'
    const bodyB = [
      '- **相關**：第一筆內容',
      '- **相關**：第二筆內容',
      '',
      '## 動工前必知',
      '內容',
    ].join('\n')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { store, wrapper } = openPanel([
      item('a.md', 'other', { body: bodyA }),
      item('b.md', 'other', { body: bodyB }),
    ], 'a.md')
    await waitForRender()
    expect(wrapper.findAll('.md-relation-row')).toHaveLength(1)

    store.openFile('b.md')
    await waitForRender()

    const rows = wrapper.findAll('.md-relation-row')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('第一筆內容')
    expect(rows[1]!.text()).toContain('第二筆內容')

    const duplicateKeyWarning = warnSpy.mock.calls.some(call =>
      call.some(arg => typeof arg === 'string' && arg.includes('Duplicate keys')))
    expect(duplicateKeyWarning).toBe(false)

    warnSpy.mockRestore()
  })
})

describe('roadmapPanel 引用連結跳轉', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    gateway.listRoadmap.mockReset()
  })

  it('點擊內容中對到另一份規劃檔的引用，呼叫 roadmap.handleRef 帶 kind roadmap 與目標檔名', async () => {
    const items = [
      item('a.md', 'other', { body: '參見 `b.md` 的說明' }),
      item('b.md', 'available'),
    ]
    const { store, wrapper } = openPanel(items, 'a.md')
    const handleRefSpy = vi.spyOn(store, 'handleRef')
    await waitForRender()

    const ref = wrapper.get('.md-ref')
    expect(ref.attributes('data-ref-kind')).toBe('roadmap')
    expect(ref.attributes('data-ref-target')).toBe('b.md')

    await ref.trigger('click')

    expect(handleRefSpy).toHaveBeenCalledWith({ kind: 'roadmap', target: 'b.md' })
  })

  it('對不到目標的行內 code 維持一般樣式，不是 .md-ref', async () => {
    const { wrapper } = openPanel([item('a.md', 'other', { body: '參見 `no-such-file.md` 的說明' })], 'a.md')
    await waitForRender()

    expect(wrapper.find('.md-ref').exists()).toBe(false)
    expect(wrapper.get('code').text()).toBe('no-such-file.md')
  })
})
