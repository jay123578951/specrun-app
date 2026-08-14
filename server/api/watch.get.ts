import { subscribeToChanges } from '../utils/change-watcher'

/**
 * `GET /api/watch`：以 SSE 推播「有變動」事件（design D2）。
 *
 * 事件不帶 payload——訂閱者收到就重取，watcher 端已經 debounce 過。
 * M4 的 Tauri 版沒有這個 route，換成 fs plugin 的 watch 事件餵同一個 gateway 介面。
 */

export default defineEventHandler(async (event) => {
  const stream = createEventStream(event)

  // 開場先發一則具名事件把 header 沖出去——SSE 在第一次寫入前 header 不會送出，
  // 連線就一直懸著。具名事件不進 EventSource 的 onmessage，不會被誤當成變動通知
  void stream.push({ event: 'ready', data: '' })

  const unsubscribe = subscribeToChanges(() => {
    void stream.push('changed')
  })

  stream.onClosed(async () => {
    unsubscribe()
    await stream.close()
  })

  return stream.send()
})
