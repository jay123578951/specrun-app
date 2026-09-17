import type { ChangeListProbe } from '../types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 桌面形態四條讀取路的接線層。不連真的 Tauri，改注入假的外殼通道
 * （vi.mock('./shell')）、假的指令執行（vi.mock('./cli')）與假的目標專案解析
 * （vi.mock('./projects')）——驗的是這一層自己的規則：組什麼參數、讀哪些檔案、
 * 讀不到怎麼降級。輸出的分類與組裝由真的 normalize 負責，這裡刻意不替換它，
 * 斷言才看得到「造出來的 probe 餵給 normalize 後畫面拿到什麼」。
 *
 * 每個測試都 resetModules 後重新 import，與同目錄其他測試同一個節奏。
 */

const TARGET = '/repo'

/** 假外殼的 join：比照 Tauri path plugin——串起來後把 `.`／`..` 收掉 */
function joinParts(parts: string[]): string {
  const segments: string[] = []
  for (const segment of parts.join('/').split('/')) {
    if (!segment || segment === '.')
      continue
    if (segment === '..') {
      segments.pop()
      continue
    }
    segments.push(segment)
  }
  return `/${segments.join('/')}`
}

function makeShell(files: Record<string, string> = {}, birthtimes: Record<string, number | null> = {}) {
  return {
    joinPath: vi.fn(async (...parts: string[]) => joinParts(parts)),
    readTextFile: vi.fn(async (path: string) => {
      if (!(path in files))
        throw new Error(`ENOENT: ${path}`)
      return files[path]!
    }),
    statPath: vi.fn(async (path: string) => {
      if (!(path in birthtimes))
        throw new Error(`ENOENT: ${path}`)
      return { isDirectory: true, birthtime: birthtimes[path]! }
    }),
  }
}

type CliOutcome
  = { ok: true, exitCode: number | null, stdout: string, stderr: string }
    | { ok: false, failure: { kind: string, message: string } }

function ran(stdout: string, exitCode = 0, stderr = ''): CliOutcome {
  return { ok: true, exitCode, stdout, stderr }
}

function makeCli(outcome: CliOutcome) {
  return { runCli: vi.fn(async () => outcome) }
}

function targetOk() {
  return { resolveTarget: vi.fn(async () => ({ ok: true as const, targetPath: TARGET })) }
}

function targetMissing(message: string) {
  const probe: ChangeListProbe = {
    targetPath: TARGET,
    exitCode: null,
    stdout: '',
    stderr: '',
    failure: { kind: 'target-missing', message },
  }
  return { resolveTarget: vi.fn(async () => ({ ok: false as const, probe })) }
}

function listStdout(names: string[]): string {
  return JSON.stringify({
    root: { path: TARGET, source: 'explicit' },
    changes: names.map(name => ({
      name,
      completedTasks: 1,
      totalTasks: 3,
      status: 'in-progress',
      lastModified: '2026-09-01T00:00:00.000Z',
    })),
  })
}

function proposal(why: string): string {
  return `# Title\n\n## Why\n\n${why}\n\n## What\n\nsomething\n`
}

async function load(
  cli: ReturnType<typeof makeCli>,
  projects: ReturnType<typeof targetOk> | ReturnType<typeof targetMissing>,
  shell: ReturnType<typeof makeShell>,
) {
  vi.doMock('./cli', () => cli)
  vi.doMock('./projects', () => projects)
  vi.doMock('./shell', () => shell)
  return import('./reads')
}

beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
})

describe('api/desktop/reads: change 清單', () => {
  it('跑 list --json，並行補齊各 change 的摘錄與建立時刻', async () => {
    const cli = makeCli(ran(listStdout(['alpha', 'beta'])))
    const shell = makeShell(
      {
        '/repo/openspec/changes/alpha/proposal.md': proposal('Alpha 的理由。'),
        '/repo/openspec/changes/beta/proposal.md': proposal('Beta 的理由。'),
      },
      {
        '/repo/openspec/changes/alpha': 1_700_000_000_000,
        '/repo/openspec/changes/beta': 1_700_000_001_000,
      },
    )
    const { listChanges } = await load(cli, targetOk(), shell)

    const result = await listChanges()

    expect(cli.runCli).toHaveBeenCalledWith(['list', '--json'], TARGET)
    expect(result.ok).toBe(true)
    if (!result.ok)
      return
    expect(result.targetPath).toBe(TARGET)
    expect(result.changes.map(each => each.name)).toEqual(['alpha', 'beta'])
    expect(result.changes[0]!.summary).toBe('Alpha 的理由。')
    expect(result.changes[0]!.createdAt).toBe(1_700_000_000_000)
    expect(result.changes[1]!.summary).toBe('Beta 的理由。')
    expect(result.changes[1]!.createdAt).toBe(1_700_000_001_000)
  })

  it('單筆檔案讀不到或建立時刻取不到，其餘照常列出', async () => {
    const cli = makeCli(ran(listStdout(['alpha', 'beta'])))
    // beta 沒有 proposal，alpha 的建立時刻是 0（檔案系統給不出的表示法之一）
    const shell = makeShell(
      { '/repo/openspec/changes/alpha/proposal.md': proposal('Alpha 的理由。') },
      {
        '/repo/openspec/changes/alpha': 0,
        '/repo/openspec/changes/beta': 1_700_000_001_000,
      },
    )
    const { listChanges } = await load(cli, targetOk(), shell)

    const result = await listChanges()

    expect(result.ok).toBe(true)
    if (!result.ok)
      return
    expect(result.changes[0]!.summary).toBe('Alpha 的理由。')
    expect(result.changes[0]!.createdAt).toBeNull()
    expect(result.changes[1]!.summary).toBe('')
    expect(result.changes[1]!.createdAt).toBe(1_700_000_001_000)
  })

  it('建立時刻回 null（檔案系統未提供）視同取不到', async () => {
    const cli = makeCli(ran(listStdout(['alpha'])))
    const shell = makeShell(
      { '/repo/openspec/changes/alpha/proposal.md': proposal('理由。') },
      { '/repo/openspec/changes/alpha': null },
    )
    const { listChanges } = await load(cli, targetOk(), shell)

    const result = await listChanges()

    expect(result.ok).toBe(true)
    if (!result.ok)
      return
    expect(result.changes[0]!.createdAt).toBeNull()
  })

  it('名字逸出 changes 目錄時一個檔案都不讀', async () => {
    const cli = makeCli(ran(listStdout(['../../../etc'])))
    const shell = makeShell()
    const { listChanges } = await load(cli, targetOk(), shell)

    const result = await listChanges()

    expect(result.ok).toBe(true)
    expect(shell.readTextFile).not.toHaveBeenCalled()
    expect(shell.statPath).not.toHaveBeenCalled()
  })

  it('逸出的名字只擋下它自己，同一份清單裡的合法 change 照常讀', async () => {
    const cli = makeCli(ran(listStdout(['alpha', '../../../etc'])))
    const shell = makeShell(
      { '/repo/openspec/changes/alpha/proposal.md': proposal('Alpha 的理由。') },
      { '/repo/openspec/changes/alpha': 1_700_000_000_000 },
    )
    const { listChanges } = await load(cli, targetOk(), shell)

    const result = await listChanges()

    expect(result.ok).toBe(true)
    if (!result.ok)
      return
    expect(result.changes[0]!.summary).toBe('Alpha 的理由。')
    expect(result.changes[0]!.createdAt).toBe(1_700_000_000_000)
    expect(shell.readTextFile.mock.calls.flat()).toEqual(['/repo/openspec/changes/alpha/proposal.md'])
    expect(shell.statPath.mock.calls.flat()).toEqual(['/repo/openspec/changes/alpha'])
  })

  it('目標專案不可用時不跑指令，直接回非 openspec 專案', async () => {
    const cli = makeCli(ran(listStdout([])))
    const shell = makeShell()
    const { listChanges } = await load(cli, targetMissing('/repo is not an existing folder.'), shell)

    const result = await listChanges()

    expect(cli.runCli).not.toHaveBeenCalled()
    expect(result.ok).toBe(false)
    if (result.ok)
      return
    expect(result.error.kind).toBe('not-openspec-project')
    expect(result.error.detail).toBe('/repo is not an existing folder.')
  })

  it('指令沒跑成時把已分類的失敗原樣帶給 normalize', async () => {
    const cli = makeCli({ ok: false, failure: { kind: 'cli-unavailable', message: 'Could not find "openspec".' } })
    const { listChanges } = await load(cli, targetOk(), makeShell())

    const result = await listChanges()

    expect(result.ok).toBe(false)
    if (result.ok)
      return
    expect(result.error.kind).toBe('cli-unavailable')
    expect(result.error.detail).toBe('Could not find "openspec".')
  })
})

describe('api/desktop/reads: change 詳情', () => {
  const statusStdout = JSON.stringify({
    changeName: 'alpha',
    changeRoot: '/repo/openspec/changes/alpha',
    artifacts: [{ id: 'proposal' }, { id: 'design' }],
    artifactPaths: {
      proposal: { existingOutputPaths: ['/repo/openspec/changes/alpha/proposal.md'] },
      design: { existingOutputPaths: ['/repo/openspec/changes/alpha/design.md'] },
    },
  })

  it('依引擎列出的路徑讀齊多個 artifact', async () => {
    const cli = makeCli(ran(statusStdout))
    const shell = makeShell({
      '/repo/openspec/changes/alpha/proposal.md': '# Proposal',
      '/repo/openspec/changes/alpha/design.md': '# Design',
    })
    const { getChangeDetail } = await load(cli, targetOk(), shell)

    const result = await getChangeDetail('alpha')

    expect(cli.runCli).toHaveBeenCalledWith(['status', '--change', 'alpha', '--json'], TARGET)
    expect(result.ok).toBe(true)
    if (!result.ok)
      return
    expect(result.detail.artifacts.map(each => each.id)).toEqual(['proposal', 'design'])
    expect(result.detail.artifacts[0]!.files[0]).toEqual({ path: 'proposal.md', content: '# Proposal' })
    expect(result.detail.artifacts[1]!.files[0]).toEqual({ path: 'design.md', content: '# Design' })
  })

  it('白名單內的檔案讀不到時整份詳情失敗並帶出系統訊息', async () => {
    const cli = makeCli(ran(statusStdout))
    const shell = makeShell({ '/repo/openspec/changes/alpha/proposal.md': '# Proposal' })
    const { getChangeDetail } = await load(cli, targetOk(), shell)

    const result = await getChangeDetail('alpha')

    expect(result.ok).toBe(false)
    if (result.ok)
      return
    expect(result.error.kind).toBe('call-failed')
    expect(result.error.detail).toContain('/repo/openspec/changes/alpha/design.md')
    expect(result.error.detail).toContain('ENOENT')
  })

  it('引擎未列出的路徑一律不讀', async () => {
    const cli = makeCli(ran(JSON.stringify({
      changeName: 'alpha',
      changeRoot: '/repo/openspec/changes/alpha',
      artifacts: [{ id: 'proposal' }],
      artifactPaths: { proposal: { existingOutputPaths: ['/repo/openspec/changes/alpha/proposal.md'] } },
    })))
    const shell = makeShell({
      '/repo/openspec/changes/alpha/proposal.md': '# Proposal',
      '/repo/openspec/changes/alpha/tasks.md': '# Tasks',
    })
    const { getChangeDetail } = await load(cli, targetOk(), shell)

    await getChangeDetail('alpha')

    expect(shell.readTextFile.mock.calls.flat()).toEqual(['/repo/openspec/changes/alpha/proposal.md'])
  })

  it('目標專案不可用時不跑指令，失敗結果仍帶出請求的 change 名稱', async () => {
    const cli = makeCli(ran(''))
    const { getChangeDetail } = await load(cli, targetMissing('/repo is not an existing folder.'), makeShell())

    const result = await getChangeDetail('alpha')

    expect(cli.runCli).not.toHaveBeenCalled()
    expect(result.ok).toBe(false)
    if (result.ok)
      return
    expect(result.error.kind).toBe('not-openspec-project')
    expect(result.error.detail).toBe('/repo is not an existing folder.')
  })

  it('change 不存在時（非零結束＋診斷 payload）不讀任何檔案並回呼叫失敗', async () => {
    const cli = makeCli(ran(
      JSON.stringify({ status: [{ code: 'change_error', message: 'Change "ghost" was not found.' }] }),
      1,
    ))
    const shell = makeShell()
    const { getChangeDetail } = await load(cli, targetOk(), shell)

    const result = await getChangeDetail('ghost')

    expect(shell.readTextFile).not.toHaveBeenCalled()
    expect(result.ok).toBe(false)
    if (result.ok)
      return
    expect(result.error.kind).toBe('call-failed')
    expect(result.error.detail).toBe('Change "ghost" was not found.')
  })
})

describe('api/desktop/reads: spec 清單與全文', () => {
  it('spec 清單跑 list --specs --json 並原樣轉送輸出', async () => {
    const cli = makeCli(ran(JSON.stringify({
      root: { path: TARGET, source: 'explicit' },
      specs: [{ id: 'openspec-gateway', requirementCount: 7 }],
    })))
    const { listSpecs } = await load(cli, targetOk(), makeShell())

    const result = await listSpecs()

    expect(cli.runCli).toHaveBeenCalledWith(['list', '--specs', '--json'], TARGET)
    expect(result.ok).toBe(true)
    if (!result.ok)
      return
    expect(result.specs).toEqual([{ id: 'openspec-gateway', requirementCount: 7 }])
  })

  it('spec 全文跑 show <id> --type spec，stdout 一個字都不動', async () => {
    const markdown = '# openspec-gateway\n\n## Requirement: 目標專案路徑解析\n'
    const cli = makeCli(ran(markdown))
    const { getSpecContent } = await load(cli, targetOk(), makeShell())

    const result = await getSpecContent('openspec-gateway')

    expect(cli.runCli).toHaveBeenCalledWith(['show', 'openspec-gateway', '--type', 'spec'], TARGET)
    expect(result.ok).toBe(true)
    if (!result.ok)
      return
    expect(result.id).toBe('openspec-gateway')
    expect(result.content).toBe(markdown)
  })

  it('spec 不存在時（非零結束＋空 stdout）回呼叫失敗並帶 stderr 首行', async () => {
    const cli = makeCli(ran('', 1, 'Spec "ghost" not found\n'))
    const { getSpecContent } = await load(cli, targetOk(), makeShell())

    const result = await getSpecContent('ghost')

    expect(result.ok).toBe(false)
    if (result.ok)
      return
    expect(result.error.kind).toBe('call-failed')
    expect(result.error.detail).toBe('Spec "ghost" not found')
  })

  it('目標專案不可用時 spec 全文也不跑指令，不把上一份內容留在畫面上', async () => {
    const cli = makeCli(ran(''))
    const { getSpecContent } = await load(cli, targetMissing('No project is selected.'), makeShell())

    const result = await getSpecContent('openspec-gateway')

    expect(cli.runCli).not.toHaveBeenCalled()
    expect(result.ok).toBe(false)
    if (result.ok)
      return
    expect(result.error.kind).toBe('not-openspec-project')
  })

  it('目標專案不可用時 spec 清單也不跑指令', async () => {
    const cli = makeCli(ran(''))
    const { listSpecs } = await load(cli, targetMissing('No project is selected.'), makeShell())

    const result = await listSpecs()

    expect(cli.runCli).not.toHaveBeenCalled()
    expect(result.ok).toBe(false)
    if (result.ok)
      return
    expect(result.error.kind).toBe('not-openspec-project')
  })
})

describe('api/desktop/reads: 通道本身出事的兜底（例外不逸出，改以失敗結果表達）', () => {
  /**
   * 真實逸出來源是 cli.ts 的 cliSettings() 解析鏈 reject（見 cli.ts:41-45）；
   * 這裡的 runCli 是被 mock 掉的那一層，直接讓它 reject 就等於模擬那條鏈冒出例外
   * 一路往上炸穿 cliProbe——四條讀取路都走同一個 cliProbe，因此一個 mock 就能
   * 同時驗到四個匯出方法各自的殼層。
   */
  function makeThrowingCli(reason: unknown) {
    return {
      runCli: vi.fn(async () => {
        throw reason
      }),
    }
  }

  it('listChanges: 通道 reject 時仍 resolve 成 call-failed，不讓例外逸出', async () => {
    const cli = makeThrowingCli(new Error('spawn exploded'))
    const { listChanges } = await load(cli, targetOk(), makeShell())

    const result = await listChanges()

    expect(result.ok).toBe(false)
    if (result.ok)
      return
    expect(result.targetPath).toBe('')
    expect(result.error.kind).toBe('call-failed')
    expect(result.error.message).toBe('Could not read the change list.')
    expect(result.error.detail).toBe('spawn exploded')
  })

  it('getChangeDetail: 通道 reject 時仍 resolve 成 call-failed，不讓例外逸出', async () => {
    const cli = makeThrowingCli(new Error('spawn exploded'))
    const { getChangeDetail } = await load(cli, targetOk(), makeShell())

    const result = await getChangeDetail('alpha')

    expect(result.ok).toBe(false)
    if (result.ok)
      return
    expect(result.error.kind).toBe('call-failed')
    expect(result.error.message).toBe('Could not load this change.')
    expect(result.error.detail).toBe('spawn exploded')
  })

  it('listSpecs: 通道 reject 時仍 resolve 成 call-failed，不讓例外逸出', async () => {
    const cli = makeThrowingCli(new Error('spawn exploded'))
    const { listSpecs } = await load(cli, targetOk(), makeShell())

    const result = await listSpecs()

    expect(result.ok).toBe(false)
    if (result.ok)
      return
    expect(result.targetPath).toBe('')
    expect(result.error.kind).toBe('call-failed')
    expect(result.error.message).toBe('Could not read the spec list.')
    expect(result.error.detail).toBe('spawn exploded')
  })

  it('getSpecContent: 通道 reject 時仍 resolve 成 call-failed，不讓例外逸出', async () => {
    const cli = makeThrowingCli(new Error('spawn exploded'))
    const { getSpecContent } = await load(cli, targetOk(), makeShell())

    const result = await getSpecContent('openspec-gateway')

    expect(result.ok).toBe(false)
    if (result.ok)
      return
    expect(result.error.kind).toBe('call-failed')
    expect(result.error.message).toBe('Could not load this spec.')
    expect(result.error.detail).toBe('spawn exploded')
  })

  it('逸出的不是 Error 物件（例如字串）時，detail 改用 String() 轉換', async () => {
    const cli = makeThrowingCli('raw string failure')
    const { listChanges } = await load(cli, targetOk(), makeShell())

    const result = await listChanges()

    expect(result.ok).toBe(false)
    if (result.ok)
      return
    expect(result.error.detail).toBe('raw string failure')
  })
})
