import type { ArchivedDetailProbe, ArchivedListProbe } from './types'
import { describe, expect, it } from 'vitest'
import { normalizeArchivedDetail, normalizeArchivedList } from './normalize-archived'

const TARGET = '/repo'

interface CliChange { name: string, completedTasks?: number, totalTasks?: number, lastModified?: string }

function cliChange(change: CliChange) {
  return {
    completedTasks: 0,
    totalTasks: 0,
    lastModified: '2026-08-14T00:00:00.000Z',
    status: 'no-tasks',
    archived: true,
    ...change,
  }
}

function listProbe(changes: CliChange[] | null, overrides: Partial<ArchivedListProbe> = {}): ArchivedListProbe {
  const stdout = changes
    ? JSON.stringify({ changes: changes.map(cliChange), root: { path: TARGET, source: 'explicit' } })
    : ''
  return { targetPath: TARGET, exitCode: 0, stdout, stderr: '', ...overrides }
}

function detailProbe(overrides: Partial<ArchivedDetailProbe> = {}): ArchivedDetailProbe {
  return { changeName: '2026-08-14-add-change-list', tabs: [], ...overrides }
}

describe('normalizeArchivedList: 卡片欄位', () => {
  it('目錄名拆成日期與名稱，進度取 CLI 的完成數與總數', () => {
    const result = normalizeArchivedList(listProbe([
      { name: '2026-08-14-add-change-list', completedTasks: 1, totalTasks: 2 },
    ]))

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
    const result = normalizeArchivedList(listProbe([
      { name: '2026-08-14-done', completedTasks: 2, totalTasks: 2 },
    ]))

    expect(result).toMatchObject({ items: [{ completedTasks: 2, totalTasks: 2, status: 'complete' }] })
  })

  it('lastModified 晚於目錄日期時，日期與排序仍依目錄名', () => {
    const result = normalizeArchivedList(listProbe([
      { name: '2026-08-14-old', lastModified: '2026-10-01T00:00:00.000Z' },
      { name: '2026-09-01-newer', lastModified: '2026-09-01T00:00:00.000Z' },
    ]))

    expect(result).toMatchObject({ items: [{ name: 'newer', archivedAt: '2026-09-01' }, { name: 'old', archivedAt: '2026-08-14' }] })
  })

  it('totalTasks 為 0：no-tasks，卡片不顯示進度', () => {
    const result = normalizeArchivedList(listProbe([{ name: '2026-08-14-broken' }]))

    expect(result).toMatchObject({ items: [{ name: 'broken', totalTasks: 0, status: 'no-tasks' }] })
  })

  it('目錄名無日期前綴：整名照列、無日期', () => {
    const result = normalizeArchivedList(listProbe([{ name: 'moved-by-hand' }]))

    expect(result).toMatchObject({ items: [{ dir: 'moved-by-hand', name: 'moved-by-hand', archivedAt: null }] })
  })

  it('日期形狀對但不存在（2026-02-31）也走無日期 fallback', () => {
    const result = normalizeArchivedList(listProbe([{ name: '2026-02-31-add-thing' }]))

    expect(result).toMatchObject({ items: [{ name: '2026-02-31-add-thing', archivedAt: null }] })
  })

  it('changes 為空陣列：空清單', () => {
    expect(normalizeArchivedList(listProbe([]))).toEqual({ ok: true, targetPath: TARGET, items: [] })
  })
})

describe('normalizeArchivedList: 排序', () => {
  it('日期新→舊、同日名稱序、無日期墊底', () => {
    const result = normalizeArchivedList(listProbe([
      { name: 'no-date-change' },
      { name: '2026-08-14-add-beta' },
      { name: '2026-08-15-add-newer' },
      { name: '2026-08-14-add-alpha' },
    ]))

    expect(result.ok && result.items.map(item => item.dir)).toEqual([
      '2026-08-15-add-newer',
      '2026-08-14-add-alpha',
      '2026-08-14-add-beta',
      'no-date-change',
    ])
  })

  it('全無日期時仍以名稱序穩定排列', () => {
    const result = normalizeArchivedList(listProbe([{ name: 'zeta' }, { name: 'alpha' }]))

    expect(result.ok && result.items.map(item => item.name)).toEqual(['alpha', 'zeta'])
  })
})

describe('normalizeArchivedList: 錯誤分類', () => {
  it('no_openspec_root 診斷歸非 openspec 專案', () => {
    const stdout = JSON.stringify({
      changes: [],
      root: null,
      status: [{ code: 'no_openspec_root', message: 'No openspec root found.' }],
    })

    expect(normalizeArchivedList(listProbe(null, { exitCode: 1, stdout }))).toMatchObject({
      ok: false,
      targetPath: TARGET,
      error: { kind: 'not-openspec-project' },
    })
  })

  it('找不到執行檔歸 CLI 不可用', () => {
    const result = normalizeArchivedList(listProbe(null, {
      exitCode: null,
      failure: { kind: 'cli-unavailable', message: 'spawn openspec ENOENT' },
    }))

    expect(result).toMatchObject({ ok: false, error: { kind: 'cli-unavailable', detail: 'spawn openspec ENOENT' } })
  })

  it('openspec 1.13.2 的實際輸出歸版本過舊', () => {
    const result = normalizeArchivedList(listProbe(null, {
      exitCode: 1,
      stderr: 'error: unknown option \'--archived\'\n',
    }))

    expect(result).toMatchObject({ ok: false, error: { kind: 'cli-outdated' } })
  })

  it('亂碼輸出歸呼叫或解析失敗', () => {
    const result = normalizeArchivedList(listProbe(null, { stdout: 'not json at all' }))

    expect(result).toMatchObject({ ok: false, error: { kind: 'call-failed' } })
  })

  it('輸出 JSON 形狀不符歸呼叫或解析失敗', () => {
    const stdout = JSON.stringify({ changes: [{ name: 5 }], root: { path: TARGET, source: 'explicit' } })

    expect(normalizeArchivedList(listProbe(null, { stdout }))).toMatchObject({ ok: false, error: { kind: 'call-failed' } })
  })

  it('非 0 結束但不是舊版訊息，仍歸呼叫或解析失敗', () => {
    const result = normalizeArchivedList(listProbe(null, { exitCode: 2, stderr: 'boom', stdout: '{}' }))

    expect(result).toMatchObject({ ok: false, error: { kind: 'call-failed' } })
  })
})

describe('normalizeArchivedList: 其他輸出形狀', () => {
  it('版本過舊的錯誤說明寫明 1.14，不帶顏色碼', () => {
    const result = normalizeArchivedList(listProbe(null, {
      exitCode: 1,
      stderr: '\u001B[31merror: unknown option \'--archived\'\u001B[0m\n',
    }))

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toContain('1.14')
      expect(result.error.detail).toBe('error: unknown option \'--archived\'')
    }
  })

  it('root 指向別的路徑歸非 openspec 專案', () => {
    const stdout = JSON.stringify({ changes: [], root: { path: '/elsewhere', source: 'explicit' } })

    expect(normalizeArchivedList(listProbe(null, { stdout }))).toMatchObject({ ok: false, error: { kind: 'not-openspec-project' } })
  })

  it('changes 不是陣列歸呼叫或解析失敗', () => {
    const stdout = JSON.stringify({ root: { path: TARGET, source: 'explicit' } })

    expect(normalizeArchivedList(listProbe(null, { stdout }))).toMatchObject({ ok: false, error: { kind: 'call-failed' } })
  })

  it('完成數或總數不是數字：整份歸呼叫或解析失敗，不靜默顯示錯的進度', () => {
    const stdout = JSON.stringify({
      changes: [{ name: '2026-08-14-a', completedTasks: '1', totalTasks: 2 }],
      root: { path: TARGET, source: 'explicit' },
    })

    expect(normalizeArchivedList(listProbe(null, { stdout }))).toMatchObject({ ok: false, error: { kind: 'call-failed' } })
  })

  it('多筆時每一筆各自帶 CLI 的完成數與總數（不混用 lastModified）', () => {
    const result = normalizeArchivedList(listProbe([
      { name: '2026-08-14-a', completedTasks: 7, totalTasks: 9, lastModified: 'garbage' },
      { name: '2026-08-13-b', completedTasks: 3, totalTasks: 3 },
      { name: '2026-08-12-c', completedTasks: 0, totalTasks: 4 },
    ]))

    expect(result.ok && result.items.map(i => [i.dir, i.completedTasks, i.totalTasks, i.status])).toEqual([
      ['2026-08-14-a', 7, 9, 'in-progress'],
      ['2026-08-13-b', 3, 3, 'complete'],
      ['2026-08-12-c', 0, 4, 'in-progress'],
    ])
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
