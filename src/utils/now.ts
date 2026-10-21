import type { Ref } from 'vue'
import { onBeforeUnmount, onMounted, readonly, ref } from 'vue'

const TICK_MS = 60_000

const now = ref(Date.now())
const readonlyNow = readonly(now)
let users = 0
let timerId: ReturnType<typeof setInterval> | undefined

function refresh(): void {
  now.value = Date.now()
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'visible')
    refresh()
}

function acquire(): void {
  users++
  if (users > 1)
    return
  refresh()
  timerId = setInterval(refresh, TICK_MS)
  document.addEventListener('visibilitychange', onVisibilityChange)
}

function release(): void {
  users--
  if (users > 0)
    return
  clearInterval(timerId)
  timerId = undefined
  document.removeEventListener('visibilitychange', onVisibilityChange)
}

export function useNow(): Readonly<Ref<number>> {
  onMounted(acquire)
  onBeforeUnmount(release)
  return readonlyNow
}
