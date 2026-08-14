import type { FSWatcher } from 'node:fs'
import { watch } from 'node:fs'
import path from 'node:path'
import { resolveTargetPath } from './openspec-cli'

/**
 * 目標專案 `openspec/changes/**` 的變動來源：整個 server 共用一個 watcher，
 * 事件經 debounce 合併後廣播給所有訂閱者（design D3／D4）。
 *
 * 通知刻意粗粒度——只喊「有變動」、不帶 change 名或路徑（design D1），
 * 訂閱者自行重取；漏報由下一次任何變動補上，重複報則被 debounce 吃掉。
 */

/** trailing debounce：git 操作／AI agent 批次改檔的連環寫入合併成一則通知 */
const DEBOUNCE_MS = 400

type Listener = () => void

const listeners = new Set<Listener>()
let watcher: FSWatcher | null = null
/** 只嘗試掛載一次：掛不起來就是失去通知能力，不重試（自動發現 openspec 專案是 non-goal） */
let mounted = false
let timer: ReturnType<typeof setTimeout> | null = null

/** 訂閱變動通知；回傳取消訂閱。第一個訂閱者到來時才掛 watcher */
export function subscribeToChanges(listener: Listener): () => void {
  ensureWatching()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function ensureWatching(): void {
  if (mounted)
    return
  mounted = true

  const changesDir = path.join(resolveTargetPath(), 'openspec', 'changes')
  watcher
    // changes/ 還不存在就退一層看 openspec/，等它被建出來；範圍外的事件在這裡濾掉
    = tryWatch(changesDir, notify)
      ?? tryWatch(path.dirname(changesDir), (filename) => {
        if (isInChangesDir(filename))
          notify()
      })
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

/** 退一層監看時，filename 相對 `openspec/`——只有 changes/ 底下的算數 */
function isInChangesDir(filename: string): boolean {
  const relative = filename.split(path.sep).join('/')
  return relative === 'changes' || relative.startsWith('changes/')
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
