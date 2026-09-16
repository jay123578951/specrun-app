import type { ChangeListProbe } from './types'
import { describe, expect, it } from 'vitest'
import { normalizeChangeList } from './normalize'

const TARGET = '/Users/dev/projects/demo'

function probe(overrides: Partial<ChangeListProbe> = {}): ChangeListProbe {
  return {
    targetPath: TARGET,
    exitCode: 0,
    stdout: '',
    stderr: '',
    ...overrides,
  }
}

function listStdout(changes: unknown[], root: Record<string, unknown> = { path: TARGET, source: 'nearest' }) {
  return JSON.stringify({ changes, root })
}

const IN_PROGRESS = {
  name: 'add-change-list',
  completedTasks: 2,
  totalTasks: 4,
  status: 'in-progress',
  lastModified: '2026-08-14T07:07:32.915Z',
}

describe('normalizeChangeList: 正常清單', () => {
  it('照 CLI 回傳順序輸出，欄位一對一對應', () => {
    const second = { ...IN_PROGRESS, name: 'fix-watcher', completedTasks: 1, totalTasks: 3 }
    const result = normalizeChangeList(probe({ stdout: listStdout([IN_PROGRESS, second]) }))

    expect(result).toEqual({
      ok: true,
      targetPath: TARGET,
      changes: [
        {
          name: 'add-change-list',
          completedTasks: 2,
          totalTasks: 4,
          status: 'in-progress',
          lastModified: Date.parse('2026-08-14T07:07:32.915Z'),
          summary: '',
          createdAt: null,
        },
        {
          name: 'fix-watcher',
          completedTasks: 1,
          totalTasks: 3,
          status: 'in-progress',
          lastModified: Date.parse('2026-08-14T07:07:32.915Z'),
          summary: '',
          createdAt: null,
        },
      ],
    })
  })

  it('三個 status 值都原樣帶過', () => {
    const changes = [
      { ...IN_PROGRESS, name: 'a', status: 'no-tasks', completedTasks: 0, totalTasks: 0 },
      { ...IN_PROGRESS, name: 'b', status: 'in-progress' },
      { ...IN_PROGRESS, name: 'c', status: 'complete', completedTasks: 4 },
    ]
    const result = normalizeChangeList(probe({ stdout: listStdout(changes) }))

    expect(result.ok).toBe(true)
    expect(result.ok && result.changes.map(c => c.status)).toEqual(['no-tasks', 'in-progress', 'complete'])
  })

  it('空清單是成功，不是錯誤', () => {
    const result = normalizeChangeList(probe({ stdout: listStdout([]) }))

    expect(result).toEqual({ ok: true, targetPath: TARGET, changes: [] })
  })
})

describe('normalizeChangeList: Why 摘錄', () => {
  const second = { ...IN_PROGRESS, name: 'fix-watcher' }

  it('有 proposal 的那筆抽出 `## Why` 第一段', () => {
    const result = normalizeChangeList(probe({
      stdout: listStdout([IN_PROGRESS]),
      proposals: { 'add-change-list': '## Why\n\n清單只有名稱時看不出用途。第二句同段一併帶回。\n' },
    }))

    expect(result.ok && result.changes[0]?.summary).toBe('清單只有名稱時看不出用途。第二句同段一併帶回。')
  })

  it('表中沒有該筆 proposal 時摘錄為空，其餘項目照常', () => {
    const result = normalizeChangeList(probe({
      stdout: listStdout([IN_PROGRESS, second]),
      proposals: { 'fix-watcher': '## Why\n\nWatcher 漏掉刪除事件。\n' },
    }))

    expect(result.ok && result.changes.map(c => c.summary)).toEqual(['', 'Watcher 漏掉刪除事件。'])
  })

  it('`proposals` 欄位整體缺席時全筆為空，清單仍成功', () => {
    const result = normalizeChangeList(probe({ stdout: listStdout([IN_PROGRESS, second]) }))

    expect(result.ok).toBe(true)
    expect(result.ok && result.changes.map(c => c.summary)).toEqual(['', ''])
  })

  it('proposal 存在但無 `## Why` 段落時摘錄為空，不回報錯誤', () => {
    const result = normalizeChangeList(probe({
      stdout: listStdout([IN_PROGRESS]),
      proposals: { 'add-change-list': '## Context\n\n沒有 Why 段落。\n' },
    }))

    expect(result.ok).toBe(true)
    expect(result.ok && result.changes[0]?.summary).toBe('')
  })
})

describe('normalizeChangeList: 建立時刻', () => {
  it('取得成功：`createdAt` 表中有該筆時轉為 epoch ms', () => {
    const result = normalizeChangeList(probe({
      stdout: listStdout([IN_PROGRESS]),
      createdAt: { 'add-change-list': 1_757_954_280_000 },
    }))

    expect(result.ok && result.changes[0]?.createdAt).toBe(1_757_954_280_000)
  })

  it('取不到回 null：表中缺席該筆，其餘欄位照常，不回報錯誤', () => {
    const result = normalizeChangeList(probe({
      stdout: listStdout([IN_PROGRESS]),
      createdAt: {},
    }))

    expect(result.ok).toBe(true)
    expect(result.ok && result.changes[0]?.createdAt).toBeNull()
  })

  it('`createdAt` 欄位整體缺席時同樣回 null，不影響清單成功', () => {
    const result = normalizeChangeList(probe({ stdout: listStdout([IN_PROGRESS]) }))

    expect(result.ok).toBe(true)
    expect(result.ok && result.changes[0]?.createdAt).toBeNull()
  })

  it('多筆之中僅部分取得：各自獨立為對應值或 null，單筆缺席不拖垮其餘筆', () => {
    const second = { ...IN_PROGRESS, name: 'fix-watcher' }
    const result = normalizeChangeList(probe({
      stdout: listStdout([IN_PROGRESS, second]),
      createdAt: { 'add-change-list': 1_757_954_280_000 },
    }))

    expect(result.ok).toBe(true)
    expect(result.ok && result.changes.map(c => c.createdAt)).toEqual([1_757_954_280_000, null])
  })
})

describe('normalizeChangeList: 非 openspec 專案', () => {
  it('root.path 與目標路徑不一致', () => {
    const stdout = listStdout([IN_PROGRESS], { path: '/Users/dev/projects/other', source: 'nearest' })
    const result = normalizeChangeList(probe({ stdout }))

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error.kind).toBe('not-openspec-project')
    expect(!result.ok && result.error.detail).toContain('/Users/dev/projects/other')
  })

  it('尾斜線差異不算不一致', () => {
    const stdout = listStdout([], { path: `${TARGET}/`, source: 'nearest' })

    expect(normalizeChangeList(probe({ stdout })).ok).toBe(true)
  })

  it('路徑相符但 root 是 implicit（CLI 找不到 root、退回 cwd）', () => {
    const stdout = listStdout([], { path: TARGET, source: 'implicit' })
    const result = normalizeChangeList(probe({ stdout }))

    expect(!result.ok && result.error.kind).toBe('not-openspec-project')
  })

  it('exit 1＋root 解析診斷 payload', () => {
    const stdout = JSON.stringify({
      changes: [],
      root: null,
      status: [{
        severity: 'error',
        code: 'no_root_with_registered_stores',
        message: 'No OpenSpec root found in the current directory or its ancestors.',
        fix: 'Rerun with --store <id> or run openspec init.',
        target: 'openspec.root',
      }],
    })
    const result = normalizeChangeList(probe({ exitCode: 1, stdout }))

    expect(!result.ok && result.error.kind).toBe('not-openspec-project')
    expect(!result.ok && result.error.detail).toContain('openspec init')
  })

  it('目標資料夾不存在', () => {
    const result = normalizeChangeList(probe({
      exitCode: null,
      failure: { kind: 'target-missing', message: 'No such directory: /Users/dev/gone' },
    }))

    expect(!result.ok && result.error.kind).toBe('not-openspec-project')
  })
})

describe('normalizeChangeList: CLI 不可用', () => {
  it('spawn 找不到執行檔', () => {
    const result = normalizeChangeList(probe({
      exitCode: null,
      failure: { kind: 'cli-unavailable', message: 'spawn openspec ENOENT' },
    }))

    expect(!result.ok && result.error.kind).toBe('cli-unavailable')
    expect(!result.ok && result.error.detail).toBe('spawn openspec ENOENT')
  })
})

describe('normalizeChangeList: 呼叫或解析失敗', () => {
  it('stdout 不是 JSON', () => {
    const result = normalizeChangeList(probe({ stdout: 'openspec: command not found', stderr: '' }))

    expect(!result.ok && result.error.kind).toBe('call-failed')
  })

  it('exit 1 但診斷與 root 無關（引擎自身出錯）', () => {
    const stdout = JSON.stringify({
      changes: [],
      root: null,
      status: [{ severity: 'error', code: 'list_error', message: 'Unexpected token in tasks.md' }],
    })
    const result = normalizeChangeList(probe({ exitCode: 1, stdout }))

    expect(!result.ok && result.error.kind).toBe('call-failed')
    expect(!result.ok && result.error.detail).toContain('Unexpected token')
  })

  it('exit 1 且輸出無診斷條目', () => {
    const result = normalizeChangeList(probe({ exitCode: 1, stdout: '{}', stderr: 'boom' }))

    expect(!result.ok && result.error.kind).toBe('call-failed')
  })

  it('change 欄位型別不如預期', () => {
    const stdout = listStdout([{ ...IN_PROGRESS, totalTasks: 'four' }])
    const result = normalizeChangeList(probe({ stdout }))

    expect(!result.ok && result.error.kind).toBe('call-failed')
  })

  it('未知的 status 值', () => {
    const stdout = listStdout([{ ...IN_PROGRESS, status: 'parked' }])
    const result = normalizeChangeList(probe({ stdout }))

    expect(!result.ok && result.error.kind).toBe('call-failed')
  })

  it('缺少 root', () => {
    const result = normalizeChangeList(probe({ stdout: JSON.stringify({ changes: [] }) }))

    expect(!result.ok && result.error.kind).toBe('call-failed')
  })

  it('spawn 逾時或其他 spawn 層錯誤', () => {
    const result = normalizeChangeList(probe({
      exitCode: null,
      failure: { kind: 'spawn-failed', message: 'openspec timed out after 15000ms' },
    }))

    expect(!result.ok && result.error.kind).toBe('call-failed')
  })
})
