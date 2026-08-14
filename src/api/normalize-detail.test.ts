import type { ChangeDetailProbe } from './types'
import { describe, expect, it } from 'vitest'
import { normalizeChangeDetail } from './normalize'

const TARGET = '/Users/dev/projects/demo'
const CHANGE = 'add-artifact-view'
const CHANGE_ROOT = `${TARGET}/openspec/changes/${CHANGE}`

function probe(overrides: Partial<ChangeDetailProbe> = {}): ChangeDetailProbe {
  return {
    targetPath: TARGET,
    changeName: CHANGE,
    exitCode: 0,
    stdout: '',
    stderr: '',
    ...overrides,
  }
}

/** 對齊 `openspec status --change <name> --json` 的實際輸出形狀 */
function statusStdout(ids: string[], extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    changeName: CHANGE,
    schemaName: 'spec-driven',
    changeRoot: CHANGE_ROOT,
    artifacts: ids.map(id => ({ id, status: 'done', requires: [] })),
    artifactPaths: Object.fromEntries(ids.map(id => [id, { outputPath: `${id}.md` }])),
    ...extra,
  })
}

describe('normalizeChangeDetail: 正常打包', () => {
  it('artifact 順序沿用 CLI，檔案內容原樣帶出、路徑轉為 change 目錄相對路徑', () => {
    const result = normalizeChangeDetail(probe({
      stdout: statusStdout(['proposal', 'design', 'tasks']),
      files: {
        proposal: [{ path: `${CHANGE_ROOT}/proposal.md`, content: '## Why' }],
        design: [{ path: `${CHANGE_ROOT}/design.md`, content: '## Context' }],
        tasks: [{ path: `${CHANGE_ROOT}/tasks.md`, content: '- [ ] 1.1' }],
      },
    }))

    expect(result).toEqual({
      ok: true,
      detail: {
        name: CHANGE,
        artifacts: [
          { id: 'proposal', missing: false, files: [{ path: 'proposal.md', content: '## Why' }] },
          { id: 'design', missing: false, files: [{ path: 'design.md', content: '## Context' }] },
          { id: 'tasks', missing: false, files: [{ path: 'tasks.md', content: '- [ ] 1.1' }] },
        ],
      },
    })
  })

  it('glob artifact 的多個檔案依序保留，各自帶得出檔名標頭', () => {
    const result = normalizeChangeDetail(probe({
      stdout: statusStdout(['specs']),
      files: {
        specs: [
          { path: `${CHANGE_ROOT}/specs/artifact-view/spec.md`, content: 'A' },
          { path: `${CHANGE_ROOT}/specs/change-list/spec.md`, content: 'B' },
        ],
      },
    }))

    expect(result.ok && result.detail.artifacts[0]?.files).toEqual([
      { path: 'specs/artifact-view/spec.md', content: 'A' },
      { path: 'specs/change-list/spec.md', content: 'B' },
    ])
  })
})

describe('normalizeChangeDetail: 缺件', () => {
  it('無既存檔案標示為缺件，整體不回報錯誤', () => {
    const result = normalizeChangeDetail(probe({
      stdout: statusStdout(['proposal', 'design']),
      files: {
        proposal: [{ path: `${CHANGE_ROOT}/proposal.md`, content: '## Why' }],
        design: [],
      },
    }))

    expect(result.ok).toBe(true)
    expect(result.ok && result.detail.artifacts[1]).toEqual({ id: 'design', missing: true, files: [] })
  })

  it('probe 完全沒帶該 artifact 的檔案條目時同樣算缺件', () => {
    const result = normalizeChangeDetail(probe({ stdout: statusStdout(['proposal']), files: {} }))

    expect(result.ok && result.detail.artifacts).toEqual([{ id: 'proposal', missing: true, files: [] }])
  })
})

describe('normalizeChangeDetail: custom schema', () => {
  it('artifact 名稱完全來自 CLI，不出現寫死的預設名', () => {
    const ids = ['spec', 'tests', 'implementation', 'docs']
    const result = normalizeChangeDetail(probe({
      stdout: statusStdout(ids),
      files: { spec: [{ path: `${CHANGE_ROOT}/spec.md`, content: 'S' }] },
    }))

    expect(result.ok && result.detail.artifacts.map(a => a.id)).toEqual(ids)
  })

  it('沒有 artifacts 陣列時退回 artifactPaths 的鍵序', () => {
    const stdout = JSON.stringify({
      changeName: CHANGE,
      changeRoot: CHANGE_ROOT,
      artifactPaths: { spec: {}, tests: {} },
    })
    const result = normalizeChangeDetail(probe({ stdout, files: {} }))

    expect(result.ok && result.detail.artifacts.map(a => a.id)).toEqual(['spec', 'tests'])
  })
})

describe('normalizeChangeDetail: 白名單', () => {
  it('artifact 清單以外的檔案不會出現在結果中（CLI 沒列就不外流）', () => {
    const result = normalizeChangeDetail(probe({
      stdout: statusStdout(['proposal']),
      files: {
        'proposal': [{ path: `${CHANGE_ROOT}/proposal.md`, content: '## Why' }],
        // 就算 probe 夾帶了清單外的東西，normalize 也只走 CLI 給的 artifact id
        '.openspec.yaml': [{ path: `${CHANGE_ROOT}/.openspec.yaml`, content: 'schema: custom' }],
      },
    }))

    expect(result.ok && result.detail.artifacts.map(a => a.id)).toEqual(['proposal'])
    expect(JSON.stringify(result)).not.toContain('schema: custom')
  })
})

describe('normalizeChangeDetail: 錯誤分類', () => {
  it('change 不存在（CLI change_error）歸呼叫或解析失敗並附診斷', () => {
    const stdout = JSON.stringify({
      status: [{ severity: 'error', code: 'change_error', message: `Change '${CHANGE}' not found.` }],
    })
    const result = normalizeChangeDetail(probe({ exitCode: 1, stdout }))

    expect(!result.ok && result.error.kind).toBe('call-failed')
    expect(!result.ok && result.error.detail).toContain('not found')
  })

  it('root 類診斷仍歸非 openspec 專案', () => {
    const stdout = JSON.stringify({
      status: [{ code: 'no_openspec_root', message: 'No openspec directory found.' }],
    })
    const result = normalizeChangeDetail(probe({ exitCode: 1, stdout }))

    expect(!result.ok && result.error.kind).toBe('not-openspec-project')
  })

  it('cli-unavailable 沿用清單層的分類', () => {
    const result = normalizeChangeDetail(probe({
      exitCode: null,
      failure: { kind: 'cli-unavailable', message: 'spawn openspec ENOENT' },
    }))

    expect(!result.ok && result.error.kind).toBe('cli-unavailable')
  })

  it('白名單內的檔案讀取失敗算錯誤，不是缺件', () => {
    const result = normalizeChangeDetail(probe({
      stdout: statusStdout(['proposal']),
      files: { proposal: [{ path: `${CHANGE_ROOT}/proposal.md`, error: 'EACCES: permission denied' }] },
    }))

    expect(!result.ok && result.error.kind).toBe('call-failed')
    expect(!result.ok && result.error.detail).toContain('EACCES')
  })

  it('stdout 無法解析', () => {
    const result = normalizeChangeDetail(probe({ stdout: 'not json', stderr: 'boom' }))

    expect(!result.ok && result.error.kind).toBe('call-failed')
  })

  it('輸出成形但沒有 artifact 清單', () => {
    const result = normalizeChangeDetail(probe({ stdout: JSON.stringify({ changeName: CHANGE }) }))

    expect(!result.ok && result.error.kind).toBe('call-failed')
  })
})
