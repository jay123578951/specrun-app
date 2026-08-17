import type { SpecContentProbe, SpecListProbe } from './types'
import { describe, expect, it } from 'vitest'
import { normalizeSpecContent, normalizeSpecList } from './normalize'

const TARGET = '/Users/dev/projects/demo'

function listProbe(overrides: Partial<SpecListProbe> = {}): SpecListProbe {
  return {
    targetPath: TARGET,
    exitCode: 0,
    stdout: '',
    stderr: '',
    ...overrides,
  }
}

function listStdout(specs: unknown[], root: Record<string, unknown> = { path: TARGET, source: 'nearest' }) {
  return JSON.stringify({ specs, root })
}

function contentProbe(overrides: Partial<SpecContentProbe> = {}): SpecContentProbe {
  return {
    targetPath: TARGET,
    specId: 'change-list',
    exitCode: 0,
    stdout: '',
    stderr: '',
    ...overrides,
  }
}

describe('normalizeSpecList: 正常清單', () => {
  it('照 CLI 回傳順序輸出，欄位一對一對應', () => {
    const stdout = listStdout([
      { id: 'artifact-view', requirementCount: 14 },
      { id: 'change-list', requirementCount: 9 },
    ])

    expect(normalizeSpecList(listProbe({ stdout }))).toEqual({
      ok: true,
      targetPath: TARGET,
      specs: [
        { id: 'artifact-view', requirementCount: 14 },
        { id: 'change-list', requirementCount: 9 },
      ],
    })
  })

  it('引擎未提供的欄位不補、額外欄位不帶進來', () => {
    const stdout = listStdout([{ id: 'change-list', requirementCount: 9, extra: 'ignored' }])
    const result = normalizeSpecList(listProbe({ stdout }))

    expect(result.ok && result.specs[0]).toEqual({ id: 'change-list', requirementCount: 9 })
  })

  it('requirementCount 為 0 是合法值', () => {
    const result = normalizeSpecList(listProbe({ stdout: listStdout([{ id: 'draft', requirementCount: 0 }]) }))

    expect(result.ok && result.specs).toEqual([{ id: 'draft', requirementCount: 0 }])
  })

  it('空清單是成功，不是錯誤', () => {
    expect(normalizeSpecList(listProbe({ stdout: listStdout([]) }))).toEqual({
      ok: true,
      targetPath: TARGET,
      specs: [],
    })
  })
})

describe('normalizeSpecList: 非 openspec 專案', () => {
  it('root.path 與目標路徑不一致', () => {
    const stdout = listStdout([], { path: '/Users/dev/projects/other', source: 'nearest' })
    const result = normalizeSpecList(listProbe({ stdout }))

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error.kind).toBe('not-openspec-project')
  })

  // CLI 找不到任何 openspec root 時會以 cwd 造一個 implicit root：路徑相符但專案不存在
  it('implicit root 即使路徑相符也不算專案', () => {
    const stdout = listStdout([], { path: TARGET, source: 'implicit' })
    const result = normalizeSpecList(listProbe({ stdout }))

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error.kind).toBe('not-openspec-project')
  })

  it('目標資料夾不存在（spawn 前就擋下）', () => {
    const result = normalizeSpecList(listProbe({
      exitCode: null,
      failure: { kind: 'target-missing', message: `${TARGET} is not an existing folder.` },
    }))

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error.kind).toBe('not-openspec-project')
  })
})

describe('normalizeSpecList: 呼叫與解析失敗', () => {
  it('spawn 找不到執行檔，自成一類', () => {
    const result = normalizeSpecList(listProbe({
      exitCode: null,
      failure: { kind: 'cli-unavailable', message: 'Could not run "openspec": ENOENT' },
    }))

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error.kind).toBe('cli-unavailable')
  })

  it('stdout 不是 JSON', () => {
    const result = normalizeSpecList(listProbe({ stdout: 'not json', stderr: 'boom' }))

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toMatchObject({ kind: 'call-failed', detail: 'boom' })
  })

  it('exit 非 0 且診斷非 root 類＝呼叫失敗', () => {
    const stdout = JSON.stringify({
      specs: [],
      root: null,
      status: [{ code: 'list_error', message: 'Something broke.' }],
    })
    const result = normalizeSpecList(listProbe({ exitCode: 1, stdout }))

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toMatchObject({ kind: 'call-failed', detail: 'Something broke.' })
  })

  it('缺 specs 陣列', () => {
    const result = normalizeSpecList(listProbe({ stdout: JSON.stringify({ root: { path: TARGET, source: 'nearest' } }) }))

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error.kind).toBe('call-failed')
  })

  it('逐筆欄位形狀不符', () => {
    const result = normalizeSpecList(listProbe({ stdout: listStdout([{ id: 'change-list' }]) }))

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error.kind).toBe('call-failed')
  })
})

describe('normalizeSpecContent', () => {
  it('stdout 原樣轉交，一個字都不改', () => {
    const markdown = '# change-list Specification\n\n## Purpose\n\n主畫面。\n'

    expect(normalizeSpecContent(contentProbe({ stdout: markdown }))).toEqual({
      ok: true,
      id: 'change-list',
      content: markdown,
    })
  })

  it('spec 不存在（非 0 exit）回錯誤，且訊息去掉 CLI 的顏色碼', () => {
    const result = normalizeSpecContent(contentProbe({
      specId: 'no-such-spec',
      exitCode: 1,
      stderr: '\u001B[31m✖\u001B[39m Error: Spec \'no-such-spec\' not found at openspec/specs/no-such-spec/spec.md',
    }))

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toEqual({
      kind: 'call-failed',
      message: 'Could not load this spec.',
      detail: '✖ Error: Spec \'no-such-spec\' not found at openspec/specs/no-such-spec/spec.md',
    })
  })

  // 空輸出不能偽裝成一份空 spec（spec openspec-gateway）
  it('exit 0 但輸出空白＝失敗', () => {
    const result = normalizeSpecContent(contentProbe({ stdout: '   \n' }))

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error.kind).toBe('call-failed')
  })

  it('spawn 找不到執行檔，自成一類', () => {
    const result = normalizeSpecContent(contentProbe({
      exitCode: null,
      failure: { kind: 'cli-unavailable', message: 'Could not run "openspec": ENOENT' },
    }))

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error.kind).toBe('cli-unavailable')
  })

  it('spawn 層其他失敗歸呼叫失敗', () => {
    const result = normalizeSpecContent(contentProbe({
      exitCode: null,
      failure: { kind: 'spawn-failed', message: 'timed out' },
    }))

    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toMatchObject({ kind: 'call-failed', detail: 'timed out' })
  })
})
