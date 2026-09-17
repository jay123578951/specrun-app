import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 桌面形態的變動監看。不連真的 Tauri，改注入假的外殼通道（vi.mock('./shell')）
 * 與假的目標專案解析（vi.mock('./projects')）——驗的是這一層自己的規則：
 * 何時接上、監看哪個路徑、退一層時的範圍過濾、尾端合併、換目標時的重接。
 *
 * 每個測試都 resetModules 後重新 import，因為監看是模組層級的執行期單例。
 * 時鐘全程是假的：接上是非同步的，`advanceTimersByTimeAsync(0)` 順便把那條
 * await 鏈跑完。
 */

function makeShell(watchable: (dir: string) => boolean = () => true) {
  const handlers = new Map<number, (paths: string[]) => void>()
  let lastRid = 0
  return {
    handlers,
    emit(rid: number, paths: string[]) {
      handlers.get(rid)?.(paths)
    },
    watchPaths: vi.fn(async (paths: string[], _options: unknown, onEvent: (paths: string[]) => void) => {
      if (!watchable(paths[0]!))
        throw new Error('ENOENT')
      handlers.set(++lastRid, onEvent)
      return lastRid
    }),
    unwatchPaths: vi.fn(async (rid: number) => {
      handlers.delete(rid)
    }),
  }
}

/** 目標專案只需要「解得出來的實際路徑」與「換了」兩件事，其餘欄位監看模組用不到 */
function makeProjects(initial: string | null) {
  let target = initial
  const changed = new Set<() => void>()
  return {
    setTarget(next: string | null) {
      target = next
    },
    fireProjectChange() {
      for (const listener of [...changed])
        listener()
    },
    resolveTarget: vi.fn(async () => {
      if (target === null)
        return { ok: false, probe: { targetPath: '', exitCode: null, stdout: '', stderr: '', failure: { kind: 'target-missing', message: 'No project is selected.' } } }
      return { ok: true, targetPath: target }
    }),
    subscribeToCurrentProjectChange: vi.fn((onChange: () => void) => {
      changed.add(onChange)
      return () => changed.delete(onChange)
    }),
  }
}

/** 接上監看是非同步的，而訂閱同步回傳——讓那一輪的 await 鏈跑完再斷言 */
async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0)
}

describe('desktop/watch', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  it('第一個訂閱者到來時才接上監看，訂閱者全部離開也不強制斷開', async () => {
    const shell = makeShell()
    vi.doMock('./shell', () => shell)
    vi.doMock('./projects', () => makeProjects('/real/a'))
    const { isWatching, subscribeToChanges } = await import('./watch')

    expect(shell.watchPaths).not.toHaveBeenCalled()
    expect(isWatching()).toBe(false)

    const first = subscribeToChanges(vi.fn())
    const second = subscribeToChanges(vi.fn())
    await settle()

    expect(shell.watchPaths).toHaveBeenCalledTimes(1)
    expect(isWatching()).toBe(true)

    first()
    second()
    expect(shell.unwatchPaths).not.toHaveBeenCalled()
    expect(isWatching()).toBe(true)
  })

  it('監看的是 resolveTarget() 回傳的實際路徑，不是設定裡的原字串', async () => {
    const shell = makeShell()
    vi.doMock('./shell', () => shell)
    vi.doMock('./projects', () => makeProjects('/real/proj'))
    const { subscribeToChanges } = await import('./watch')

    subscribeToChanges(vi.fn())
    await settle()

    expect(shell.watchPaths).toHaveBeenCalledWith(
      ['/real/proj/openspec/changes'],
      expect.objectContaining({ recursive: true }),
      expect.any(Function),
    )
  })

  it('無目標專案時不接上監看，記為未接上', async () => {
    const shell = makeShell()
    vi.doMock('./shell', () => shell)
    vi.doMock('./projects', () => makeProjects(null))
    const { isWatching, subscribeToChanges } = await import('./watch')

    subscribeToChanges(vi.fn())
    await settle()

    expect(shell.watchPaths).not.toHaveBeenCalled()
    expect(isWatching()).toBe(false)
  })

  it('changes/ 監看不了就退一層看 openspec/，範圍外的事件丟棄', async () => {
    const shell = makeShell(dir => dir === '/real/a/openspec')
    vi.doMock('./shell', () => shell)
    vi.doMock('./projects', () => makeProjects('/real/a'))
    const { isWatching, subscribeToChanges } = await import('./watch')

    const listener = vi.fn()
    subscribeToChanges(listener)
    await settle()

    expect(shell.watchPaths).toHaveBeenCalledTimes(2)
    expect(shell.watchPaths).toHaveBeenLastCalledWith(
      ['/real/a/openspec'],
      expect.objectContaining({ recursive: true }),
      expect.any(Function),
    )
    expect(isWatching()).toBe(true)

    shell.emit(1, ['/real/a/openspec/project.md'])
    await vi.advanceTimersByTimeAsync(400)
    expect(listener).not.toHaveBeenCalled()

    shell.emit(1, ['/real/a/openspec/changes/add-x/tasks.md'])
    await vi.advanceTimersByTimeAsync(400)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('兩層都監看不了就記為未接上，且不重試', async () => {
    const shell = makeShell(() => false)
    vi.doMock('./shell', () => shell)
    vi.doMock('./projects', () => makeProjects('/real/a'))
    const { isWatching, subscribeToChanges } = await import('./watch')

    subscribeToChanges(vi.fn())
    await settle()
    expect(isWatching()).toBe(false)

    subscribeToChanges(vi.fn())
    await settle()
    expect(shell.watchPaths).toHaveBeenCalledTimes(2)
  })

  it('底層逐則送上來的一批只產生一則通知', async () => {
    const shell = makeShell()
    vi.doMock('./shell', () => shell)
    vi.doMock('./projects', () => makeProjects('/real/a'))
    const { subscribeToChanges } = await import('./watch')

    const listener = vi.fn()
    subscribeToChanges(listener)
    await settle()

    for (let index = 0; index < 5; index++)
      shell.emit(1, [`/real/a/openspec/changes/add-x/file-${index}.md`])
    await vi.advanceTimersByTimeAsync(400)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('合併期間再收到事件就重新計時，不提前通知', async () => {
    const shell = makeShell()
    vi.doMock('./shell', () => shell)
    vi.doMock('./projects', () => makeProjects('/real/a'))
    const { subscribeToChanges } = await import('./watch')

    const listener = vi.fn()
    subscribeToChanges(listener)
    await settle()

    shell.emit(1, ['/real/a/openspec/changes/add-x/tasks.md'])
    await vi.advanceTimersByTimeAsync(300)
    expect(listener).not.toHaveBeenCalled()

    shell.emit(1, ['/real/a/openspec/changes/add-x/proposal.md'])
    await vi.advanceTimersByTimeAsync(300)
    expect(listener).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(100)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('單一訂閱者拋出例外不影響其他訂閱者', async () => {
    const shell = makeShell()
    vi.doMock('./shell', () => shell)
    vi.doMock('./projects', () => makeProjects('/real/a'))
    const { subscribeToChanges } = await import('./watch')

    const angry = vi.fn(() => {
      throw new Error('boom')
    })
    const calm = vi.fn()
    subscribeToChanges(angry)
    subscribeToChanges(calm)
    await settle()

    shell.emit(1, ['/real/a/openspec/changes/add-x/tasks.md'])
    await vi.advanceTimersByTimeAsync(400)

    expect(angry).toHaveBeenCalledTimes(1)
    expect(calm).toHaveBeenCalledTimes(1)
  })

  it('換目標後先停舊監看再接新目標，舊目標的事件不再觸發通知', async () => {
    const shell = makeShell()
    const projects = makeProjects('/real/a')
    vi.doMock('./shell', () => shell)
    vi.doMock('./projects', () => projects)
    const { subscribeToChanges } = await import('./watch')

    const listener = vi.fn()
    subscribeToChanges(listener)
    await settle()

    projects.setTarget('/real/b')
    projects.fireProjectChange()
    await settle()

    expect(shell.unwatchPaths).toHaveBeenCalledWith(1)
    expect(shell.watchPaths).toHaveBeenLastCalledWith(
      ['/real/b/openspec/changes'],
      expect.objectContaining({ recursive: true }),
      expect.any(Function),
    )
    // 重接本身不補發通知
    expect(listener).not.toHaveBeenCalled()

    shell.emit(2, ['/real/b/openspec/changes/add-x/tasks.md'])
    await vi.advanceTimersByTimeAsync(400)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('已接上之後目標變成無專案（如移除清單裡最後一個專案），舊監看被收掉且 isWatching 轉回 false', async () => {
    const shell = makeShell()
    const projects = makeProjects('/real/a')
    vi.doMock('./shell', () => shell)
    vi.doMock('./projects', () => projects)
    const { isWatching, subscribeToChanges } = await import('./watch')

    subscribeToChanges(vi.fn())
    await settle()
    expect(isWatching()).toBe(true)

    projects.setTarget(null)
    projects.fireProjectChange()
    await settle()

    expect(shell.unwatchPaths).toHaveBeenCalledWith(1)
    expect(isWatching()).toBe(false)
    // 沒有目標可監看，不會再嘗試接上
    expect(shell.watchPaths).toHaveBeenCalledTimes(1)
  })

  it('連續換兩次目標時，途中那一輪的結果被丟棄', async () => {
    const shell = makeShell()
    const projects = makeProjects('/real/a')
    vi.doMock('./shell', () => shell)
    vi.doMock('./projects', () => projects)
    const { isWatching, subscribeToChanges } = await import('./watch')

    subscribeToChanges(vi.fn())
    await settle()

    projects.setTarget('/real/b')
    projects.fireProjectChange()
    projects.setTarget('/real/c')
    projects.fireProjectChange()
    await settle()

    expect(isWatching()).toBe(true)
    expect(shell.handlers.size).toBe(1)
    const watched = shell.watchPaths.mock.calls.map(call => call[0]![0])
    expect(watched).not.toContain('/real/b/openspec/changes')
    expect(watched.at(-1)).toBe('/real/c/openspec/changes')
  })

  it('訂閱後立即取消訂閱：接上後立刻收掉，不留下沒有訂閱者的監看', async () => {
    const shell = makeShell()
    vi.doMock('./shell', () => shell)
    vi.doMock('./projects', () => makeProjects('/real/a'))
    const { isWatching, subscribeToChanges } = await import('./watch')

    const unsubscribe = subscribeToChanges(vi.fn())
    unsubscribe()
    await settle()

    expect(shell.watchPaths).toHaveBeenCalledTimes(1)
    expect(shell.unwatchPaths).toHaveBeenCalledTimes(1)
    expect(isWatching()).toBe(false)

    // 收掉之後下一個訂閱者仍接得上
    subscribeToChanges(vi.fn())
    await settle()
    expect(isWatching()).toBe(true)
  })

  it('訂閱建立後沒有任何變動就不會收到通知（同行程傳遞不補發）', async () => {
    const shell = makeShell()
    vi.doMock('./shell', () => shell)
    vi.doMock('./projects', () => makeProjects('/real/a'))
    const { subscribeToChanges } = await import('./watch')

    const listener = vi.fn()
    subscribeToChanges(listener)
    await settle()

    expect(listener).not.toHaveBeenCalled()
  })

  it('退一層監看時，changes 目錄自己的事件不算範圍內（isInside 不含根目錄，這點與 web 形態不同）', async () => {
    const shell = makeShell(dir => dir === '/real/a/openspec')
    vi.doMock('./shell', () => shell)
    vi.doMock('./projects', () => makeProjects('/real/a'))
    const { subscribeToChanges } = await import('./watch')

    const listener = vi.fn()
    subscribeToChanges(listener)
    await settle()

    shell.emit(1, ['/real/a/openspec/changes'])
    await vi.advanceTimersByTimeAsync(400)
    expect(listener).not.toHaveBeenCalled()
  })

  it('切專案時，舊專案合併等待中尚未送出的通知不會被撤回（remount 不 clearTimeout，與 web 形態一致）', async () => {
    const shell = makeShell()
    const projects = makeProjects('/real/a')
    vi.doMock('./shell', () => shell)
    vi.doMock('./projects', () => projects)
    const { subscribeToChanges } = await import('./watch')

    const listener = vi.fn()
    subscribeToChanges(listener)
    await settle()

    shell.emit(1, ['/real/a/openspec/changes/add-x/tasks.md'])
    await vi.advanceTimersByTimeAsync(100) // 尚在 400ms 合併窗口內

    projects.setTarget('/real/b')
    projects.fireProjectChange()
    await settle() // 新目標接上，但舊的 400ms 計時器沒有被取消

    await vi.advanceTimersByTimeAsync(300) // 累計滿 400ms，舊那則通知仍然送達
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('接上途中被再次換掉：那一輪的監看已經真的建立起來，回來後仍要立刻關掉，不能覆蓋掉新目標的監看', async () => {
    const shell = makeShell()
    const projects = makeProjects('/real/a')
    vi.doMock('./shell', () => shell)
    vi.doMock('./projects', () => projects)
    const { isWatching, subscribeToChanges } = await import('./watch')

    subscribeToChanges(vi.fn())
    await settle()
    expect(shell.watchPaths).toHaveBeenCalledTimes(1)

    // 讓「換到 b」那一輪的監看卡住，直到測試手動放行
    let release: (rid: number) => void = () => {}
    const stuck = new Promise<number>((resolve) => {
      release = resolve
    })
    shell.watchPaths.mockImplementationOnce(async (_paths: string[], _options: unknown, onEvent: (paths: string[]) => void) => {
      shell.handlers.set(101, onEvent)
      return stuck
    })

    projects.setTarget('/real/b')
    projects.fireProjectChange()
    // 讓「換到 b」那一輪的 resolveTarget 解出來、卡在 tryWatch 的 await 上
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    // 卡著的時候又換到 c：generation 再往前一格，b 那一輪從此是過期輪次
    projects.setTarget('/real/c')
    projects.fireProjectChange()
    await settle()

    expect(shell.watchPaths).toHaveBeenLastCalledWith(
      ['/real/c/openspec/changes'],
      expect.objectContaining({ recursive: true }),
      expect.any(Function),
    )
    expect(isWatching()).toBe(true)

    // 現在才放行 b 那一輪：接上時已經過期，得立刻關掉，不能覆蓋掉 c 的監看
    release(101)
    await settle()

    expect(shell.unwatchPaths).toHaveBeenCalledWith(101)
    expect(shell.handlers.has(101)).toBe(false)
    expect(isWatching()).toBe(true)
  })
})
