import type { ChangeSummary, GatewayError } from '../api'
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

  const activeCount = computed(() => changes.value.length)
  const cliUnavailable = computed(() => blockingError.value?.kind === 'cli-unavailable')
  const busy = computed(() => firstLoadPending.value || refreshing.value)

  let toastSeq = 0

  /**
   * watcher 通知觸發的重載：資料照換，但失敗完全靜默（design D5 的來源分流）。
   * 進行中狀態也不打旗標——旁邊每存一次檔就轉一圈 refresh 圖示只是噪音。
   */
  async function loadSilently(): Promise<void> {
    const result = await gateway.listChanges()
    if (!result.ok)
      return

    changes.value = result.changes
    targetPath.value = result.targetPath
    blockingError.value = null
  }

  async function load(): Promise<void> {
    if (!firstLoadPending.value)
      refreshing.value = true

    try {
      const result = await gateway.listChanges()

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
      firstLoadPending.value = false
      refreshing.value = false
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
    activeCount,
    cliUnavailable,
    busy,
    load,
    loadSilently,
    notify,
    dismissToast,
  }
})
