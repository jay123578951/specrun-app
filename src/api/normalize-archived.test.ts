import type { ArchivedDetailProbe, ArchivedListProbe } from './types'
import { describe, expect, it } from 'vitest'
import { normalizeArchivedDetail, normalizeArchivedList } from './normalize-archived'

const TARGET = '/repo'

function listProbe(overrides: Partial<ArchivedListProbe> = {}): ArchivedListProbe {
  return { targetPath: TARGET, entries: [], ...overrides }
}

function detailProbe(overrides: Partial<ArchivedDetailProbe> = {}): ArchivedDetailProbe {
  return { changeName: '2026-08-14-add-change-list', tabs: [], ...overrides }
}

describe('normalizeArchivedList: 卡片欄位', () => {
  it('目錄名拆成日期與名稱，進度現場解析', () => {
    const result = normalizeArchivedList(listProbe({
      entries: [{
        dir: '2026-08-14-add-change-list',
        tasks: '## 1. 段落\n\n- [x] 1.1 做完的\n- [ ] 1.2 還沒的\n',
      }],
    }))

    expect(result).toEqual({
      ok: true,
      targetPath: TARGET,
      items: [{
        dir: '2026-08-14-add-change-list',
        name: 'add-change-list',
        archivedAt: '2026-08-14',
        completedTasks: 1,
        totalTasks: 2,
        status: 'in-progress',
      }],
    })
  })

  it('全勾完是 complete（卡片據此淡化進度）', () => {
    const result = normalizeArchivedList(listProbe({
      entries: [{ dir: '2026-08-14-done', tasks: '- [x] 1.1 做完的\n- [x] 1.2 也做完了\n' }],
    }))

    expect(result).toMatchObject({ items: [{ completedTasks: 2, totalTasks: 2, status: 'complete' }] })
  })

  it('讀不到 tasks 的那筆仍列出，只是沒有進度（單筆降級不拖垮清單）', () => {
    const result = normalizeArchivedList(listProbe({
      entries: [
        { dir: '2026-08-14-broken' },
        { dir: '2026-08-14-fine', tasks: '- [ ] 1.1 還沒的\n' },
      ],
    }))

    expect(result).toMatchObject({
      ok: true,
      items: [
        { name: 'broken', totalTasks: 0, status: 'no-tasks' },
        { name: 'fine', totalTasks: 1, status: 'in-progress' },
      ],
    })
  })

  it('目錄名無日期前綴：整名照列、無日期', () => {
    const result = normalizeArchivedList(listProbe({ entries: [{ dir: 'moved-by-hand' }] }))

    expect(result).toMatchObject({ items: [{ dir: 'moved-by-hand', name: 'moved-by-hand', archivedAt: null }] })
  })

  it('日期形狀對但不存在（2026-02-31）也走無日期 fallback', () => {
    const result = normalizeArchivedList(listProbe({ entries: [{ dir: '2026-02-31-add-thing' }] }))

    expect(result).toMatchObject({ items: [{ name: '2026-02-31-add-thing', archivedAt: null }] })
  })
})

describe('normalizeArchivedList: 排序', () => {
  it('日期新→舊、同日名稱序、無日期墊底', () => {
    const result = normalizeArchivedList(listProbe({
      entries: [
        { dir: 'no-date-change' },
        { dir: '2026-08-14-add-beta' },
        { dir: '2026-08-15-add-newer' },
        { dir: '2026-08-14-add-alpha' },
      ],
    }))

    expect(result.ok && result.items.map(item => item.dir)).toEqual([
      '2026-08-15-add-newer',
      '2026-08-14-add-alpha',
      '2026-08-14-add-beta',
      'no-date-change',
    ])
  })

  it('全無日期時仍以名稱序穩定排列', () => {
    const result = normalizeArchivedList(listProbe({
      entries: [{ dir: 'zeta' }, { dir: 'alpha' }],
    }))

    expect(result.ok && result.items.map(item => item.name)).toEqual(['alpha', 'zeta'])
  })
})

describe('normalizeArchivedList: 錯誤分類', () => {
  it('非 openspec 專案與讀取失敗分開（前者沒得重試）', () => {
    const notProject = normalizeArchivedList(listProbe({
      failure: { kind: 'not-openspec-project', message: 'No openspec/ directory at /repo.' },
    }))
    const readFailed = normalizeArchivedList(listProbe({
      failure: { kind: 'read-failed', message: 'EACCES: permission denied' },
    }))

    expect(notProject).toMatchObject({
      ok: false,
      targetPath: TARGET,
      error: { kind: 'not-openspec-project', detail: 'No openspec/ directory at /repo.' },
    })
    expect(readFailed).toMatchObject({
      ok: false,
      error: { kind: 'call-failed', detail: 'EACCES: permission denied' },
    })
  })
})

describe('normalizeArchivedDetail', () => {
  it('tabs 原樣成為 artifacts（順序由 route 決定），每個 tab 一個檔案', () => {
    const result = normalizeArchivedDetail(detailProbe({
      tabs: [
        { id: 'proposal', path: 'proposal.md', content: '# Why\n' },
        { id: 'specs/change-list', path: 'specs/change-list/spec.md', content: '## ADDED\n' },
        { id: 'tasks', path: 'tasks.md', content: '- [x] 1.1\n' },
      ],
    }))

    expect(result).toEqual({
      ok: true,
      detail: {
        name: '2026-08-14-add-change-list',
        artifacts: [
          { id: 'proposal', files: [{ path: 'proposal.md', content: '# Why\n' }], missing: false },
          { id: 'specs/change-list', files: [{ path: 'specs/change-list/spec.md', content: '## ADDED\n' }], missing: false },
          { id: 'tasks', files: [{ path: 'tasks.md', content: '- [x] 1.1\n' }], missing: false },
        ],
      },
    })
  })

  it('列進來卻讀不到＝真失敗，帶上系統訊息', () => {
    const result = normalizeArchivedDetail(detailProbe({
      tabs: [{ id: 'design', path: 'design.md', error: 'EACCES: permission denied' }],
    }))

    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'call-failed', detail: 'Could not read design.md. EACCES: permission denied' },
    })
  })

  it('目錄取不到時整份失敗，訊息可直接顯示', () => {
    const result = normalizeArchivedDetail(detailProbe({
      failure: 'That archived change is no longer there.',
    }))

    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'call-failed', detail: 'That archived change is no longer there.' },
    })
  })
})
