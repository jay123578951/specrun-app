import type { ParkedDetailProbe, ParkedListProbe } from './types'
import { describe, expect, it } from 'vitest'
import { countTasks, extractWhy, normalizeParkedDetail, normalizeParkedList } from './normalize-parked'

const PARKED_ROOT = '/repo/.git/specrun-app/parked/add-old-idea'

function listProbe(overrides: Partial<ParkedListProbe> = {}): ParkedListProbe {
  return { parkAvailable: true, entries: [], ...overrides }
}

describe('normalizeParkedList: 清單', () => {
  it('現場解析進度與摘錄，parkedAt 轉 epoch', () => {
    const result = normalizeParkedList(listProbe({
      entries: [{
        name: 'add-old-idea',
        parkedAt: '2026-07-20T10:00:00.000Z',
        tasks: '## 1. 段落\n\n- [x] 1.1 做完的\n- [ ] 1.2 還沒的\n',
        proposal: '## Why\n\nChange 一多就有擱置需求。第二句同段一併帶回。\n',
      }],
    }))

    expect(result).toEqual({
      ok: true,
      parkAvailable: true,
      items: [{
        name: 'add-old-idea',
        completedTasks: 1,
        totalTasks: 2,
        status: 'in-progress',
        parkedAt: Date.parse('2026-07-20T10:00:00.000Z'),
        summary: 'Change 一多就有擱置需求。第二句同段一併帶回。',
      }],
    })
  })

  it('metadata 缺項：仍列出，parkedAt 為 null（顯示未知，不是錯誤）', () => {
    const result = normalizeParkedList(listProbe({
      entries: [{ name: 'orphan-dir' }],
    }))

    expect(result).toEqual({
      ok: true,
      parkAvailable: true,
      items: [{
        name: 'orphan-dir',
        completedTasks: 0,
        totalTasks: 0,
        status: 'no-tasks',
        parkedAt: null,
        summary: '',
      }],
    })
  })

  it('壞掉的 parkedAt 與缺 tasks 檔一樣走 fallback，不讓整份清單失敗', () => {
    const result = normalizeParkedList(listProbe({
      entries: [{ name: 'broken', parkedAt: 'not-a-date' }],
    }))

    expect(result).toMatchObject({ ok: true, items: [{ parkedAt: null, status: 'no-tasks' }] })
  })

  it('依 park 時間新→舊排序，時間未知的殿後', () => {
    const result = normalizeParkedList(listProbe({
      entries: [
        { name: 'older', parkedAt: '2026-06-01T00:00:00.000Z' },
        { name: 'unknown' },
        { name: 'newer', parkedAt: '2026-08-01T00:00:00.000Z' },
      ],
    }))

    expect(result.ok && result.items.map(item => item.name)).toEqual(['newer', 'older', 'unknown'])
  })

  it('park 不可用時帶回原因，清單為空', () => {
    const result = normalizeParkedList(listProbe({ parkAvailable: false, reason: 'git-worktree' }))

    expect(result).toEqual({ ok: true, parkAvailable: false, reason: 'git-worktree', items: [] })
  })

  it('列舉失敗歸「呼叫或解析失敗」', () => {
    const result = normalizeParkedList(listProbe({ failure: 'EACCES: permission denied' }))

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'call-failed',
        message: 'Could not read the parked list.',
        detail: 'EACCES: permission denied',
      },
    })
  })
})

describe('countTasks: 進度現場解析', () => {
  it('全勾完＝complete，數字與 CLI 同語意', () => {
    const source = '- [x] a\n- [X] b\n'
    expect(countTasks(source)).toEqual({ completedTasks: 2, totalTasks: 2 })
    expect(normalizeParkedList(listProbe({ entries: [{ name: 'done', tasks: source }] })))
      .toMatchObject({ items: [{ status: 'complete' }] })
  })

  it('非 task 行（一般清單、標題、程式碼）不計入', () => {
    expect(countTasks('# 標題\n- 一般清單\n- [ ] 真的 task\n文字 [x] 不在行首\n'))
      .toEqual({ completedTasks: 0, totalTasks: 1 })
  })

  it('縮排子項與有序清單都算', () => {
    expect(countTasks('- [ ] 父\n  - [x] 子\n1. [x] 有序\n')).toEqual({ completedTasks: 2, totalTasks: 3 })
  })
})

// extractWhy 自身的案例在 why-summary.test.ts（抽取邏輯已搬家）；
// 這裡只確認續出的入口仍可用，parked 側接得上同一份抽取
describe('extractWhy: 續出入口', () => {
  it('自 normalize-parked 續出，行為與原處一致', () => {
    expect(extractWhy('## Why\n\n第一句。第二句。')).toBe('第一句。第二句。')
  })
})

describe('normalizeParkedDetail: 詳情', () => {
  function detailProbe(overrides: Partial<ParkedDetailProbe> = {}): ParkedDetailProbe {
    return { changeName: 'add-old-idea', changeRoot: PARKED_ROOT, artifacts: [], ...overrides }
  }

  it('artifact 順序沿用快照，路徑轉成 change 目錄內的相對路徑', () => {
    const result = normalizeParkedDetail(detailProbe({
      artifacts: [
        { id: 'proposal', files: [{ path: `${PARKED_ROOT}/proposal.md`, content: '# Why' }] },
        { id: 'specs', files: [{ path: `${PARKED_ROOT}/specs/park/spec.md`, content: '# Spec' }] },
      ],
    }))

    expect(result).toEqual({
      ok: true,
      detail: {
        name: 'add-old-idea',
        artifacts: [
          { id: 'proposal', files: [{ path: 'proposal.md', content: '# Why' }], missing: false },
          { id: 'specs', files: [{ path: 'specs/park/spec.md', content: '# Spec' }], missing: false },
        ],
      },
    })
  })

  it('快照中沒有既存檔案的 artifact 是缺件不是錯誤', () => {
    const result = normalizeParkedDetail(detailProbe({ artifacts: [{ id: 'design', files: [] }] }))

    expect(result).toMatchObject({ ok: true, detail: { artifacts: [{ id: 'design', missing: true }] } })
  })

  it('列進來卻讀不到的檔案＝真失敗', () => {
    const result = normalizeParkedDetail(detailProbe({
      artifacts: [{ id: 'tasks', files: [{ path: `${PARKED_ROOT}/tasks.md`, error: 'EACCES' }] }],
    }))

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'call-failed',
        message: 'Could not load this parked change.',
        detail: `Could not read ${PARKED_ROOT}/tasks.md. EACCES`,
      },
    })
  })

  it('目錄取不到時帶回原因', () => {
    const result = normalizeParkedDetail(detailProbe({ failure: 'That parked change is no longer there.' }))

    expect(result).toMatchObject({ ok: false, error: { detail: 'That parked change is no longer there.' } })
  })
})
