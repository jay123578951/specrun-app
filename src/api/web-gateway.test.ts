import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { webGateway } from './web-gateway'

/**
 * 最小可控的 EventSource stub：只模擬 subscribeToChanges 用得到的三個 hook
 * （onmessage／onerror／onopen）與 close，讓測試能手動觸發「斷線」「重連成功」。
 */
class FakeEventSource {
  static instances: FakeEventSource[] = []
  onmessage: (() => void) | null = null
  onerror: (() => void) | null = null
  onopen: (() => void) | null = null
  closed = false

  constructor(public url: string) {
    FakeEventSource.instances.push(this)
  }

  close(): void {
    this.closed = true
  }
}

describe('webGateway.subscribeToChanges: 重連補償', () => {
  beforeEach(() => {
    FakeEventSource.instances = []
    vi.stubGlobal('EventSource', FakeEventSource)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('首次建連 open 不觸發補償（掛載載入已涵蓋）', () => {
    const onChange = vi.fn()
    webGateway.subscribeToChanges(onChange)

    const source = FakeEventSource.instances[0]!
    source.onopen?.()

    expect(onChange).not.toHaveBeenCalled()
  })

  it('斷線後再次 open 視同一次變動通知，補一次重載', () => {
    const onChange = vi.fn()
    webGateway.subscribeToChanges(onChange)

    const source = FakeEventSource.instances[0]!
    source.onopen?.() // 首次建連
    source.onerror?.() // 斷線
    source.onopen?.() // 重連成功

    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('連續多次斷線重連，各自補一次，不會漏也不會多補', () => {
    const onChange = vi.fn()
    webGateway.subscribeToChanges(onChange)

    const source = FakeEventSource.instances[0]!
    source.onopen?.()
    source.onerror?.()
    source.onopen?.()
    source.onerror?.()
    source.onopen?.()

    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('onmessage 收到訊息時照常觸發 onChange，不受重連旗標影響', () => {
    const onChange = vi.fn()
    webGateway.subscribeToChanges(onChange)

    const source = FakeEventSource.instances[0]!
    source.onmessage?.()

    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('unsubscribe 會關閉底層連線', () => {
    const unsubscribe = webGateway.subscribeToChanges(() => {})
    const source = FakeEventSource.instances[0]!

    unsubscribe()

    expect(source.closed).toBe(true)
  })
})

describe('webGateway.openUrl: 開新分頁的時序與失敗收束', () => {
  // 測試環境為 node，沒有真的 `window`（見 vitest.config.ts 的說明：元件測試
  // 進來才談 jsdom）——比照上面 EventSource 的做法，以 vi.stubGlobal 整個換掉。
  const openMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('window', { open: openMock })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    openMock.mockReset()
  })

  it('開新分頁是同步呼叫，發生在回傳的 promise 尚未 settle 之前', () => {
    const fakeWindow = {} as Window
    openMock.mockReturnValue(fakeWindow)

    const pending = webGateway.openUrl('https://example.com')

    // 斷言發生在 await 之前、與 openUrl() 呼叫同一個同步區段內——
    // 若 window.open 被排到任何等待之後，這裡讀到的會是尚未呼叫。
    expect(openMock).toHaveBeenCalledTimes(1)
    expect(openMock).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer')

    return expect(pending).resolves.toEqual({ status: 'opened' })
  })

  it('window.open 回傳 null（例如被瀏覽器擋下）時回報失敗，不拋出例外', async () => {
    openMock.mockReturnValue(null)

    await expect(webGateway.openUrl('https://example.com')).resolves.toEqual({ status: 'failed' })
  })

  it('window.open 拋出例外時同樣收束成失敗，不外洩例外', async () => {
    openMock.mockImplementation(() => {
      throw new Error('blocked')
    })

    await expect(webGateway.openUrl('https://example.com')).resolves.toEqual({ status: 'failed' })
  })
})

describe('webGateway.listRoadmap: 回應形狀', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('把 /api/roadmap 的 probe 交給 normalizeRoadmapList，回傳分組後的清單', async () => {
    const probe = {
      targetPath: '/project',
      dirExists: true,
      offExists: false,
      files: [{ name: 'a.md', content: '# 培訓機構管理        1/4\n', mtime: 1_700_000_000_000 }],
      // 非空 refs：確保斷言驗的是「原樣傳遞」而不是「兩邊都剛好是空陣列」
      refs: { specs: ['spec-a'], changes: ['add-x'], archived: ['2026-01-02-add-y'], parked: ['parked-z'] },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(probe) }))

    const result = await webGateway.listRoadmap()

    expect(fetch).toHaveBeenCalledWith('/api/roadmap')
    expect(result.ok).toBe(true)
    if (!result.ok)
      return
    expect(result.dirExists).toBe(true)
    expect(result.offExists).toBe(false)
    expect(result.refs).toEqual(probe.refs)
    expect(result.items).toEqual([expect.objectContaining({
      name: 'a',
      title: '培訓機構管理',
      statusText: '1/4',
      group: 'in-progress',
      progress: { completed: 1, total: 4 },
    })])
  })

  it('連本地 route 都到不了時收束成 call-failed，不外洩例外', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    const result = await webGateway.listRoadmap()

    expect(result).toEqual({
      ok: false,
      targetPath: '',
      error: {
        kind: 'call-failed',
        message: 'Could not read the roadmap list.',
        detail: 'network down',
      },
    })
  })
})

describe('webGateway.listArchived: 回應形狀', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('把 /api/archived 的 CLI probe 交給 normalizeArchivedList', async () => {
    const stdout = JSON.stringify({
      changes: [{ name: '2026-01-02-add-x', completedTasks: 1, totalTasks: 2, lastModified: '2026-09-01T00:00:00Z', status: 'in-progress' }],
      root: { path: '/project', source: 'explicit' },
    })
    const probe = { targetPath: '/project', exitCode: 0, stdout, stderr: '' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(probe) }))

    const result = await webGateway.listArchived()

    expect(fetch).toHaveBeenCalledWith('/api/archived')
    expect(result.ok && result.items).toEqual([
      { dir: '2026-01-02-add-x', name: 'add-x', archivedAt: '2026-01-02', completedTasks: 1, totalTasks: 2, status: 'in-progress' },
    ])
  })

  it('1.13.2 的輸出（exit 1、unknown option）：cli-outdated，不是 call-failed', async () => {
    const probe = { targetPath: '/project', exitCode: 1, stdout: '', stderr: 'error: unknown option \'--archived\'\n' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(probe) }))

    const result = await webGateway.listArchived()
    expect(result.ok === false && result.error.kind).toBe('cli-outdated')
  })

  it('changes 為空：空清單，不是錯誤', async () => {
    const probe = { targetPath: '/project', exitCode: 0, stdout: '{"changes":[],"root":{"path":"/project","source":"explicit"}}', stderr: '' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(probe) }))

    expect(await webGateway.listArchived()).toEqual({ ok: true, targetPath: '/project', items: [] })
  })

  it('連不到 route：call-failed，不外洩例外', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    const result = await webGateway.listArchived()
    expect(result.ok === false && result.error.kind).toBe('call-failed')
  })
})

describe('webGateway.checkCliUpdate: 回應形狀', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('原樣回傳 /api/cli/update-check 的結果', async () => {
    const body = { status: 'available', latest: '1.15.0', command: 'pnpm add -g x' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) }))

    expect(await webGateway.checkCliUpdate()).toEqual(body)
    expect(fetch).toHaveBeenCalledWith('/api/cli/update-check')
  })

  it.each([
    { status: 'available', latest: '1.15.0' },
    { status: 'current' },
    { status: 'unavailable' },
    { status: 'too-old' },
  ])('四種結果之一原樣轉出：$status', async (body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) }))
    expect(await webGateway.checkCliUpdate()).toEqual(body)
  })

  it('回應不是合法 JSON：unavailable，不外洩例外', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.reject(new SyntaxError('bad json')) }))
    expect(await webGateway.checkCliUpdate()).toEqual({ status: 'unavailable' })
  })

  it('連不到 route 或回應非 2xx：unavailable，不外洩例外', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    expect(await webGateway.checkCliUpdate()).toEqual({ status: 'unavailable' })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }))
    expect(await webGateway.checkCliUpdate()).toEqual({ status: 'unavailable' })
  })
})

describe('webGateway.listWorkflowFiles／updateWorkflowFiles: 回應形狀', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('list：原樣回傳 /api/workflow-files 的結果', async () => {
    const body = { ok: true, entries: [{ path: '/a', version: '1.13.1', status: 'behind' }] }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) }))

    expect(await webGateway.listWorkflowFiles()).toEqual(body)
    expect(fetch).toHaveBeenCalledWith('/api/workflow-files')
  })

  it('list：連不到或回應形狀不對，回 ok:false 不外洩例外', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    expect(await webGateway.listWorkflowFiles()).toMatchObject({ ok: false })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }))
    expect(await webGateway.listWorkflowFiles()).toMatchObject({ ok: false })
  })

  it('update：POST 路徑，原樣回傳結果（含非 2xx 的拒絕 body）', async () => {
    const rejected = { ok: false, message: 'This project is not in the project list.' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400, json: () => Promise.resolve(rejected) }))

    expect(await webGateway.updateWorkflowFiles('/x')).toEqual(rejected)
    expect(fetch).toHaveBeenCalledWith('/api/workflow-files/update', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: '/x' }),
    })

    const done = { ok: true, warning: '⚠ skipped' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(done) }))
    expect(await webGateway.updateWorkflowFiles('/a')).toEqual(done)
  })

  it('update：連不到時回 ok:false 不外洩例外', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    expect(await webGateway.updateWorkflowFiles('/a')).toMatchObject({ ok: false })
  })
})
