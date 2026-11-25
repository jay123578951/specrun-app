import type { FSWatcher } from 'node:fs'
import { watch } from 'node:fs'
import path from 'node:path'
import { currentProjectPath } from './project-state'

/**
 * 目標專案 `openspec/changes/**`、`openspec/roadmap/**` 與 `openspec/roadmap.off` 的變動來源：
 * 整個 server 共用一個 watcher，事件經 debounce 合併後廣播給所有訂閱者（design D3／D4）。
 *
 * 一律監看整個 `openspec/`，再過濾出上述三處：`changes/` 與 `roadmap/` 不一定已經存在，
 * 直接監看 `openspec/` 才收得到它們之後被建出來的第一個檔案。範圍外的事件在進入
 * debounce 之前就濾掉。
 *
 * 通知刻意粗粒度——只喊「有變動」、不帶 change 名或路徑（design D1），
 * 訂閱者自行重取；漏報由下一次任何變動補上，重複報則被 debounce 吃掉。
 *
 * C5 起 watcher 跟著「目前專案」走：切換時 teardown 再 re-mount，
 * 永遠只有一個 watcher（design D1 選 A 案的直接後果）。
 */

/** trailing debounce：git 操作／AI agent 批次改檔的連環寫入合併成一則通知 */
const DEBOUNCE_MS = 400

type Listener = () => void

const listeners = new Set<Listener>()
let watcher: FSWatcher | null = null
/**
 * 同一個目標只嘗試掛載一次：掛不起來就是失去通知能力，不重試
 * （自動發現 openspec 專案是 non-goal）。換目標才由 remountWatcher 重置。
 */
let mounted = false
/** 每次重掛 +1；掛載途中若被換掉，那一輪的結果直接丟棄 */
let generation = 0
let timer: ReturnType<typeof setTimeout> | null = null

/**
 * watcher 目前是否真的掛著（環境診斷用）。掛不起來、無目標專案、監看中斷都是 false
 * ——三者對使用者是同一件事：即時刷新現在不運作。
 */
export function isWatching(): boolean {
  return watcher !== null
}

/** 訂閱變動通知；回傳取消訂閱。第一個訂閱者到來時才掛 watcher */
export function subscribeToChanges(listener: Listener): () => void {
  void ensureWatching()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * 切換目標專案後重掛（spec 檔案變動通知「切換後通知跟隨」）。
 * 掛載失敗沿既有語意：失去通知能力，其餘功能照常、手動刷新仍可用。
 */
export async function remountWatcher(): Promise<void> {
  generation++
  stopWatching()
  mounted = false
  if (listeners.size)
    await ensureWatching()
}

async function ensureWatching(): Promise<void> {
  if (mounted)
    return
  mounted = true

  const mine = generation
  const target = await currentProjectPath()
  // 無目標專案就不掛；期間已被重掛過的話這一輪作廢
  if (!target || mine !== generation)
    return

  const created = tryWatch(path.join(target, 'openspec'), (filename) => {
    if (isInScope(filename))
      notify()
  })

  if (mine !== generation) {
    created?.close()
    return
  }
  watcher = created
}

function tryWatch(dir: string, onEvent: (filename: string) => void): FSWatcher | null {
  try {
    const created = watch(
      dir,
      { recursive: true, persistent: false },
      (_event, filename) => onEvent(filename ?? ''),
    )
    // 監看中斷（目錄被刪等）＝失去通知能力，其餘 route 照常運作（spec 韌性）
    created.on('error', stopWatching)
    return created
  }
  catch {
    return null
  }
}

function stopWatching(): void {
  watcher?.close()
  watcher = null
}

function isInScope(filename: string): boolean {
  const relative = filename.split(path.sep).join('/')
  return relative === 'roadmap.off'
    || ['changes', 'roadmap'].some(dir => relative === dir || relative.startsWith(`${dir}/`))
}

function notify(): void {
  if (timer)
    clearTimeout(timer)

  timer = setTimeout(() => {
    timer = null
    for (const listener of [...listeners]) {
      try {
        listener()
      }
      catch {
        // 單一訂閱者（已斷線的 SSE 連線等）失敗不能影響其他人
      }
    }
  }, DEBOUNCE_MS)
}
