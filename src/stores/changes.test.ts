import type { ChangeSummary, ParkActionResult, ParkedSummary } from '../api'
import type { MoveCard } from './changes'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChangesStore } from './changes'

const gateway = vi.hoisted(() => ({
  listChanges: vi.fn(),
  listParked: vi.fn(),
  parkChange: vi.fn(),
  unparkChange: vi.fn(),
}))

vi.mock('../api', () => ({ gateway }))

function active(name: string): ChangeSummary {
  return { name, completedTasks: 1, totalTasks: 3, status: 'in-progress', lastModified: 1, summary: '' }
}

function parkedItem(name: string): ParkedSummary {
  return { name, completedTasks: 1, totalTasks: 3, status: 'in-progress', parkedAt: 1, summary: '' }
}

/** 直接組 moving 用的快照，欄位對齊 active()／parkedItem() 的假資料 */
function card(name: string): MoveCard {
  return { name, completedTasks: 1, totalTasks: 3, status: 'in-progress', summary: '' }
}

function serverSays(changes: ChangeSummary[], items: ParkedSummary[] = []): void {
  gateway.listChanges.mockResolvedValue({ ok: true, targetPath: '/p', changes })
  gateway.listParked.mockResolvedValue({ ok: true, parkAvailable: true, items })
}

function names(list: { name: string }[]): string[] {
  return list.map(item => item.name)
}

/** 停在半路的 gateway 呼叫：讓測試在「操作進行中」的那一刻檢查畫面 */
function deferred(): { promise: Promise<ParkActionResult>, settle: (result: ParkActionResult) => void } {
  let settle!: (result: ParkActionResult) => void
  const promise = new Promise<ParkActionResult>((resolve) => {
    settle = resolve
  })
  return { promise, settle }
}

/** 泛型版的 deferred：控制 listChanges／listParked 的落地時機，重現兩個競態的時序 */
function makeDeferred<T>(): { promise: Promise<T>, resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('樂觀搬移', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('操作進行中：卡片先行呈現於目的地群組', async () => {
    serverSays([active('a'), active('b')])
    const store = useChangesStore()
    await store.load()

    const call = deferred()
    gateway.parkChange.mockReturnValue(call.promise)
    const running = store.park('a')

    expect(names(store.visibleChanges)).toEqual(['b'])
    expect(names(store.visibleParked)).toEqual(['a'])
    // 進行中標示的依據
    expect(store.parkPending).toBe('a')

    serverSays([active('b')], [parkedItem('a')])
    call.settle({ ok: true })
    await running
  })

  it('樂觀期間 loadSilently 整批替換底層資料，顯示清單仍套著樂觀層', async () => {
    serverSays([active('a'), active('b')])
    const store = useChangesStore()
    await store.load()

    const call = deferred()
    gateway.parkChange.mockReturnValue(call.promise)
    const running = store.park('a')

    // 旁邊存了一次檔，watcher 通知重載：a 尚未真的搬走，仍在伺服端清單裡
    gateway.listChanges.mockResolvedValue({
      ok: true,
      targetPath: '/p',
      changes: [active('a'), active('b'), active('c')],
    })
    await store.loadSilently()

    expect(names(store.changes)).toEqual(['a', 'b', 'c'])
    expect(names(store.visibleChanges)).toEqual(['b', 'c'])
    expect(names(store.visibleParked)).toEqual(['a'])

    serverSays([active('b'), active('c')], [parkedItem('a')])
    call.settle({ ok: true })
    await running
  })

  it('成功後以重新列舉的結果為準，樂觀狀態不殘留', async () => {
    serverSays([active('a'), active('b')])
    const store = useChangesStore()
    await store.load()

    gateway.parkChange.mockImplementation(async () => {
      serverSays([active('b')], [parkedItem('a')])
      return { ok: true }
    })
    await store.park('a')

    expect(store.moving).toBeNull()
    expect(store.parkPending).toBeNull()
    expect(names(store.visibleChanges)).toEqual(['b'])
    expect(names(store.visibleParked)).toEqual(['a'])
  })

  it('失敗後卡片回到原群組，並留下 toast', async () => {
    serverSays([active('a'), active('b')])
    const store = useChangesStore()
    await store.load()

    gateway.parkChange.mockResolvedValue({ ok: false, message: 'A change with this name is already parked.' })
    await store.park('a')

    expect(store.moving).toBeNull()
    expect(names(store.visibleChanges)).toEqual(['a', 'b'])
    expect(names(store.visibleParked)).toEqual([])
    expect(store.toasts).toHaveLength(1)
  })

  it('unpark 的樂觀層把卡片放回 Active 之首，且不再帶 parked 欄位', async () => {
    serverSays([active('b')], [parkedItem('a')])
    const store = useChangesStore()
    await store.load()

    const call = deferred()
    gateway.unparkChange.mockReturnValue(call.promise)
    const running = store.unpark('a')

    expect(names(store.visibleChanges)).toEqual(['a', 'b'])
    expect(names(store.visibleParked)).toEqual([])
    // 卡片以 parkedAt 的有無判別群組樣式，帶著它過去會被畫成 parked 卡
    expect(store.visibleChanges[0]).not.toHaveProperty('parkedAt')

    serverSays([active('a'), active('b')])
    call.settle({ ok: true })
    await running
  })

  it('對象已被外部刪除：操作完成後靜默收掉樂觀層，不留幽靈卡也不報錯', async () => {
    serverSays([active('a'), active('b')])
    const store = useChangesStore()
    await store.load()

    const call = deferred()
    gateway.parkChange.mockReturnValue(call.promise)
    const running = store.park('a')

    // 外部工具剛好刪掉了那個 change：操作仍在飛，合成卡（快照取材）留在目的地
    gateway.listChanges.mockResolvedValue({ ok: true, targetPath: '/p', changes: [active('b')] })
    await store.loadSilently()
    expect(names(store.visibleParked)).toEqual(['a'])

    // 操作落定、重載後兩個群組都沒有它：settleMove 永遠等不到，靠兜底收掉 moving
    serverSays([active('b')])
    call.settle({ ok: true })
    await running

    expect(store.moving).toBeNull()
    expect(names(store.visibleChanges)).toEqual(['b'])
    expect(names(store.visibleParked)).toEqual([])
    expect(store.toasts).toHaveLength(0)
  })

  it('拿起前對象已被外部重載抽走：操作安靜放棄，不發出 gateway 呼叫', async () => {
    serverSays([active('b')])
    const store = useChangesStore()
    await store.load()

    await store.park('a')

    expect(store.moving).toBeNull()
    expect(gateway.parkChange).not.toHaveBeenCalled()
  })

  it('unpark 期間 loadParked 先落地：合成卡取材自快照，卡片不會兩邊都消失（拖回 Active 卡頓的根因）', async () => {
    serverSays([active('b')], [parkedItem('a')])
    const store = useChangesStore()
    await store.load()

    gateway.unparkChange.mockResolvedValue({ ok: true })
    // unpark 成功後的重載：loadParked（解析檔案，快）先落地，listChanges（跑 CLI，慢）卡住
    gateway.listParked.mockResolvedValue({ ok: true, parkAvailable: true, items: [] })
    const stuck = makeDeferred<Awaited<ReturnType<typeof gateway.listChanges>>>()
    gateway.listChanges.mockReturnValue(stuck.promise)

    const running = store.unpark('a')
    // 等 loadParked 落地（parked.value 已不含 a）；listChanges 仍卡著
    await vi.waitFor(() => expect(names(store.parked)).toEqual([]))

    // 空窗期：parked 這側已經沒有 a、changes 這側 CLI 還沒回——卡片必須仍在 Active 之首
    expect(names(store.visibleChanges)).toEqual(['a', 'b'])
    expect(names(store.visibleParked)).toEqual([])

    stuck.resolve({ ok: true, targetPath: '/p', changes: [active('a'), active('b')] })
    await running

    expect(store.moving).toBeNull()
    expect(names(store.visibleChanges)).toEqual(['a', 'b'])
  })

  it('unpark 遇 loadSilently 搶號：兩邊短暫都查無此卡是搬運空窗，不得誤判為外部刪除（卡片閃爍的根因）', async () => {
    serverSays([active('b')], [parkedItem('a')])
    const store = useChangesStore()
    await store.load()

    gateway.unparkChange.mockResolvedValue({ ok: true })
    // unpark 成功後 loadParked 先落地：parked 這側已不含 a
    gateway.listParked.mockResolvedValue({ ok: true, parkAvailable: true, items: [] })

    const stuck = makeDeferred<Awaited<ReturnType<typeof gateway.listChanges>>>()
    gateway.listChanges
      // call A：load() 自己發出的那次，稍後因搶號被丟棄
      .mockResolvedValueOnce({ ok: true, targetPath: '/p', changes: [active('a'), active('b')] })
      // call B：unpark 搬目錄必然驚動 watcher，loadSilently 搶號後發出的那次，卡住
      .mockReturnValueOnce(stuck.promise)

    const running = store.unpark('a')
    await Promise.resolve() // 讓 unpark 內部的 load() 起跑，同步發出 call A 與 loadParked
    const silentRun = store.loadSilently() // 搶號，發出 call B（卡住）

    await running

    // call A 被丟棄、call B 還卡著：changes 是搬移前舊資料（沒有 a）、parked 是新資料（也沒有 a）。
    // 「兩邊都查無此卡」在這裡是正常過渡——moving 必須留著，合成卡持續掛在 Active 之首
    expect(names(store.changes)).toEqual(['b'])
    expect(names(store.parked)).toEqual([])
    expect(store.moving).not.toBeNull()
    expect(names(store.visibleChanges)).toEqual(['a', 'b'])
    expect(names(store.visibleParked)).toEqual([])

    stuck.resolve({ ok: true, targetPath: '/p', changes: [active('a'), active('b')] })
    await silentRun

    expect(store.moving).toBeNull()
    expect(names(store.visibleChanges)).toEqual(['a', 'b'])
  })

  it('底層真實資料先落地含剛停放的卡片時，visibleParked 不與合成卡重複', async () => {
    serverSays([active('a'), active('b')])
    const store = useChangesStore()
    await store.load()

    // 模擬 load() 的 Promise.all 中 loadParked 先落地、listChanges 還沒落地的空窗：
    // parked.value 已經是含 a 的真實資料，但 moving 尚未撤除
    store.moving = { name: 'a', direction: 'park', card: card('a') }
    store.parked = [parkedItem('a')]

    expect(names(store.visibleParked)).toEqual(['a'])
  })

  it('unpark 方向對稱：changes.value 先落地含剛取消停放的卡片時，visibleChanges 不重複', async () => {
    serverSays([active('a')], [parkedItem('b')])
    const store = useChangesStore()
    await store.load()

    // 模擬 changes.value 先落地含 b（真實 unpark 結果），但 moving 尚未撤除
    store.moving = { name: 'b', direction: 'unpark', card: card('b') }
    store.changes = [active('a'), active('b')]

    expect(names(store.visibleChanges)).toEqual(['b', 'a'])
  })

  it('loadSilently 搶號使 load() 的 listChanges 結果被丟棄時，moving 要等底層資料真的落地才撤除', async () => {
    serverSays([active('a'), active('b')])
    const store = useChangesStore()
    await store.load()

    gateway.parkChange.mockResolvedValue({ ok: true })
    // parked 這一側幾乎總是先落地（loadParked 用 generation 守門，不受 loadSeq 搶號影響）
    gateway.listParked.mockResolvedValue({ ok: true, parkAvailable: true, items: [parkedItem('a')] })

    const stuck = makeDeferred<Awaited<ReturnType<typeof gateway.listChanges>>>()
    gateway.listChanges
      // call A：load() 自己發出的那次，稍後因搶號被丟棄，內容其實不重要
      .mockResolvedValueOnce({ ok: true, targetPath: '/p', changes: [active('a'), active('b')] })
      // call B：loadSilently 搶號後發出的那次，卡住不落地，方便觀察空窗期
      .mockReturnValueOnce(stuck.promise)

    const running = store.park('a')
    await Promise.resolve() // 讓 park 內部的 load() 起跑，同步發出 call A 與 loadParked
    const silentRun = store.loadSilently() // 搶號，發出 call B（卡住）

    await running

    // call A 被丟棄、call B 還卡著：changes.value 仍是搬移前的舊資料，
    // 但 moving 不能提前撤除——撤了就會讓過期的舊資料露出（卡片在 Active 復活）
    expect(names(store.changes)).toEqual(['a', 'b'])
    expect(store.moving).toMatchObject({ name: 'a', direction: 'park', card: card('a') })
    expect(names(store.visibleChanges)).toEqual(['b'])

    // 底層真實資料落地：loadSilently 的回應反映搬移結果，moving 這時才可以撤除
    stuck.resolve({ ok: true, targetPath: '/p', changes: [active('b')] })
    await silentRun

    expect(store.moving).toBeNull()
    expect(names(store.visibleChanges)).toEqual(['b'])
    expect(names(store.visibleParked)).toEqual(['a'])
  })
})
