import type { ChangeSummary, GatewayError, ParkActionResult, ParkedSummary, ParkUnavailableReason } from '../api'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { gateway } from '../api'

export interface Toast {
  id: number
  message: string
  detail?: string
}

const TOAST_TTL_MS = 6000

/**
 * 清單畫面的單一狀態源。刷新策略：掛載抓一次＋手動 refresh＋watcher 通知的靜默重載，
 * 沒有其他自動重抓。刷新期間保留舊資料，只有控制項顯示進行中。
 */
export const useChangesStore = defineStore('changes', () => {
  const changes = shallowRef<ChangeSummary[]>([])
  const targetPath = ref('')
  const firstLoadPending = ref(true)
  const refreshing = ref(false)
  /** 佔住卡片區的錯誤：CLI 不可用、非 openspec 專案，或首次載入就失敗（沒有舊資料可留） */
  const blockingError = ref<GatewayError | null>(null)
  const toasts = ref<Toast[]>([])
  /**
   * 專案世代：切換專案時 +1，讓切換前發出的請求認得出自己已過期。
   * 舊專案的 in-flight 回應晚到會蓋掉新專案資料（design 風險欄的競態）。
   */
  const generation = ref(0)

  /**
   * parked 群組併在這裡（design D6）：同頁、同刷新節奏、同 invalidate 時機，
   * 清單畫面仍只有一個狀態源。資料來源與 active 完全不同（現場解析檔案，不經 CLI）。
   */
  const parked = shallowRef<ParkedSummary[]>([])
  const parkAvailable = ref(false)
  const parkReason = ref<ParkUnavailableReason | null>(null)
  /** 進行中的 park／unpark 對象；同時只允許一個，按鈕據此進入 pending */
  const parkPending = ref<string | null>(null)

  const activeCount = computed(() => changes.value.length)
  const parkedCount = computed(() => parked.value.length)
  const cliUnavailable = computed(() => blockingError.value?.kind === 'cli-unavailable')
  const busy = computed(() => firstLoadPending.value || refreshing.value)

  let toastSeq = 0

  /**
   * 載入序號防護（對照 detail.ts 的 seq）：loadSilently／load 共用同一顆計數器，
   * 只有最後發出的那次請求能寫回 changes／targetPath／blockingError——兩次通知各自
   * 觸發一次重載時，若回應順序顛倒，舊的那次到達也不會蓋掉新資料。
   */
  let loadSeq = 0

  /**
   * 旗標序號：只有 load() 自己遞增，loadSilently() 不參一腳。firstLoadPending／refreshing
   * 是 load() 專屬的「進行中」旗標，只該被更晚一次的 load() 呼叫接手清除；若沿用 loadSeq，
   * 飛在半路的 load() 會被中途插隊的 loadSilently() 搶走 seq，永遠清不掉 refreshing（卡死轉圈）。
   */
  let flagSeq = 0

  /**
   * watcher 通知觸發的重載：資料照換，但失敗完全靜默（design D5 的來源分流）。
   * 進行中狀態也不打旗標——旁邊每存一次檔就轉一圈 refresh 圖示只是噪音。
   */
  async function loadSilently(): Promise<void> {
    const gen = generation.value
    const mine = ++loadSeq
    const result = await gateway.listChanges()
    if (!result.ok || gen !== generation.value || mine !== loadSeq)
      return

    changes.value = result.changes
    targetPath.value = result.targetPath
    blockingError.value = null
  }

  /**
   * 切換專案時清場：舊資料立刻消失（不讓別的專案的卡片留在畫面上），
   * 並讓所有在飛的請求作廢。回到首載狀態＝切換期間顯示 skeleton。
   */
  function invalidate(): void {
    generation.value++
    changes.value = []
    targetPath.value = ''
    blockingError.value = null
    firstLoadPending.value = true
    refreshing.value = false
    parked.value = []
    parkAvailable.value = false
    parkReason.value = null
  }

  /**
   * parked 清單：與 active 同時發，兩邊互不等待。失敗保留既有內容——parked 是次要群組，
   * 為了一次讀不到就把卡片清空、或彈一則 toast，都比安靜留著舊清單吵。
   */
  async function loadParked(): Promise<void> {
    const mine = generation.value
    const result = await gateway.listParked()
    if (!result.ok || mine !== generation.value)
      return

    parked.value = result.items
    parkAvailable.value = result.parkAvailable
    parkReason.value = result.reason ?? null
  }

  async function load(): Promise<void> {
    const mine = generation.value
    const mySeq = ++loadSeq
    const myFlag = ++flagSeq
    if (!firstLoadPending.value)
      refreshing.value = true

    try {
      const [result] = await Promise.all([gateway.listChanges(), loadParked()])
      if (mine !== generation.value || mySeq !== loadSeq)
        return

      if (result.ok) {
        changes.value = result.changes
        targetPath.value = result.targetPath
        blockingError.value = null
        return
      }

      if (result.error.kind === 'call-failed') {
        // 暫時性失敗：既有卡片留著，只丟 toast；首載沒有舊資料可留才佔住卡片區
        pushToast(result.error)
        if (!changes.value.length)
          blockingError.value = result.error
        return
      }

      changes.value = []
      targetPath.value = result.targetPath || targetPath.value
      blockingError.value = result.error
    }
    finally {
      // 過期的那一輪不准動旗標——新世代可能正在自己的首載中，或已有更晚一次 load() 接手；
      // 用 flagSeq 而非 loadSeq 判斷，才不會被中途插隊的 loadSilently() 卡死 refreshing
      if (mine === generation.value && myFlag === flagSeq) {
        firstLoadPending.value = false
        refreshing.value = false
      }
    }
  }

  /**
   * park／unpark：兩者都是「搬移目錄 → 兩個群組都變了」，所以成功後主動重載兩群組
   * （不等 watcher——它只看得到 `openspec/changes/` 那一半，且要等 debounce）。
   * 失敗只丟 toast，畫面維持操作前的樣子：實際狀態以重新列舉的結果為準（spec 操作失敗呈現）。
   */
  function park(name: string): Promise<void> {
    return runParkAction(name, () => gateway.parkChange(name))
  }

  function unpark(name: string): Promise<void> {
    return runParkAction(name, () => gateway.unparkChange(name))
  }

  async function runParkAction(name: string, call: () => Promise<ParkActionResult>): Promise<void> {
    if (parkPending.value)
      return

    parkPending.value = name
    try {
      const result = await call()
      if (result.ok)
        await load()
      else
        notify(result.message, result.detail)
    }
    finally {
      parkPending.value = null
    }
  }

  /** 全 App 共用的非阻斷提示；detail store 的寫入失敗也走這裡 */
  function notify(message: string, detail?: string): void {
    const toast: Toast = { id: ++toastSeq, message, ...(detail ? { detail } : {}) }
    toasts.value = [...toasts.value, toast]
    setTimeout(dismissToast, TOAST_TTL_MS, toast.id)
  }

  function pushToast(error: GatewayError): void {
    notify('Refresh failed.', error.detail)
  }

  function dismissToast(id: number): void {
    toasts.value = toasts.value.filter(toast => toast.id !== id)
  }

  return {
    changes,
    targetPath,
    firstLoadPending,
    refreshing,
    blockingError,
    toasts,
    parked,
    parkAvailable,
    parkReason,
    parkPending,
    activeCount,
    parkedCount,
    cliUnavailable,
    busy,
    load,
    loadSilently,
    loadParked,
    invalidate,
    park,
    unpark,
    notify,
    dismissToast,
  }
})
