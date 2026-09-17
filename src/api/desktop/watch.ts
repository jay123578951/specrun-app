import { isInside, join, parentDir } from './paths'
import { resolveTarget, subscribeToCurrentProjectChange } from './projects'
import { unwatchPaths, watchPaths } from './shell'

/**
 * 桌面形態下目標專案 `openspec/changes/**` 的變動來源：整個 App 共用一個監看，
 * 事件經尾端合併後通知所有訂閱者。語意與 web 形態那側（server/utils/change-watcher.ts）
 * 逐字相同——換的只有持有者與執行形態，不是使用者看到的結果。唯一的差異：退一層
 * 監看 `openspec/` 時，`changes/` 目錄自己被搬動或建立的事件，web 形態算數
 * （change-watcher.ts 的 `isInChangesDir` 把 `relative === 'changes'` 也算進去），
 * 這裡不算——`paths.ts` 的 `isInside` 不把根目錄自己算在「底下」。
 *
 * 通知刻意粗粒度——只喊「有變動」、不帶 change 名或路徑，訂閱者收到後自行重取；
 * 漏報由下一次任何變動補上，重複報則被尾端合併吃掉。
 *
 * 切專案的重接由這裡自己訂閱 projects.ts 的出口跟上，不推給呼叫端（design D3）。
 */

/** trailing debounce：git 操作／AI agent 批次改檔的連環寫入合併成一則通知 */
const DEBOUNCE_MS = 400

/**
 * fs plugin 的監看延遲只合併「多久收一批」，一批之內仍是逐則送上來，所以它在這裡
 * 只當作壓跨行程訊息量的節流——畫面上什麼時候真的重取由 DEBOUNCE_MS 決定（design D2）。
 */
const CHANNEL_DELAY_MS = 100

type Listener = () => void

const listeners = new Set<Listener>()
let rid: number | null = null
/**
 * 同一個目標只嘗試接一次：接不上就是失去通知能力，不重試
 * （自動發現 openspec 專案是 non-goal）。換目標才由 remount 重置。
 */
let mounted = false
/** 每次重接 +1；接上途中若被換掉，那一輪的結果直接丟棄 */
let generation = 0
let timer: ReturnType<typeof setTimeout> | null = null

/**
 * 監看目前有沒有接上（環境診斷用）。無目標專案、兩層目錄都監看不了皆為 false；
 * 接上之後恆為 true——外殼的監看通道不回報中斷，這個形態取不到失效訊號，
 * 語意因此是「有沒有接上」而不是「此刻是否仍有效」（design D6）。
 */
export function isWatching(): boolean {
  return rid !== null
}

/** 訂閱變動通知；回傳取消訂閱。第一個訂閱者到來時才接上監看 */
export function subscribeToChanges(listener: Listener): () => void {
  listeners.add(listener)
  void ensureWatching()
  return () => {
    listeners.delete(listener)
  }
}

// 加入、移除、切換三個動作換掉目前專案時，監看跟著換目標（design D3）
subscribeToCurrentProjectChange(() => {
  void remount()
})

/**
 * 換目標後重接。接不上沿既有語意：失去通知能力，其餘功能照常、手動刷新仍可用。
 * 重接本身不補發通知——切換動作已經重載了清單（design D7）。
 */
async function remount(): Promise<void> {
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
  // 監看的是解開 symlink 後的實際位置，而且監看路徑得先拿到檔案存取授權，
  // 兩件事都是 resolveTarget() 做的——設定裡的原字串兩樣都不成立（design D4）
  const target = await resolveTarget()
  // 無目標專案（或目標讀不到）就不接；期間已被重接過的話這一輪作廢
  if (!target.ok || mine !== generation)
    return

  const changesDir = join(target.targetPath, 'openspec', 'changes')
  // changes/ 還不存在就退一層看 openspec/，等它被建出來；範圍外的事件在這裡濾掉
  const created
    = await tryWatch(changesDir, notify)
      ?? await tryWatch(parentDir(changesDir), (paths) => {
        if (paths.some(each => isInside(each, changesDir)))
          notify()
      })
  if (created === null)
    return

  // 接上途中目標被換掉，或最後一個訂閱者已經離開：這一輪沒有用處，立刻收掉，
  // 不留下沒有訂閱者的監看
  if (mine !== generation || listeners.size === 0) {
    if (mine === generation)
      mounted = false
    void closeWatch(created)
    return
  }
  rid = created
}

async function tryWatch(dir: string, onEvent: (paths: string[]) => void): Promise<number | null> {
  try {
    return await watchPaths([dir], { recursive: true, delayMs: CHANNEL_DELAY_MS }, onEvent)
  }
  catch {
    return null
  }
}

function stopWatching(): void {
  const current = rid
  rid = null
  if (current !== null)
    void closeWatch(current)
}

/** 取消監看失敗＝外殼那側已經沒有這個資源，沒有第二條路可走，也沒有畫面可報 */
async function closeWatch(id: number): Promise<void> {
  try {
    await unwatchPaths(id)
  }
  catch {
    // 收不掉就算了
  }
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
        // 單一訂閱者失敗不能影響其他人
      }
    }
  }, DEBOUNCE_MS)
}
