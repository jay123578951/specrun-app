import type { GatewayError, SpecSummary } from '../api'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { gateway } from '../api'

/**
 * Specs 頁的狀態源。與 changes 那一側刻意不同的兩點（design）：
 * 沒有 watcher（進頁重載即可，弱一致），也沒有內容快取（切頁即關、不記憶——
 * spec 全文小、重取一趟就好，留著只會多一份跨專案撞名的風險）。
 */
export const useSpecsStore = defineStore('specs', () => {
  const specs = shallowRef<SpecSummary[]>([])
  const targetPath = ref('')
  const firstLoadPending = ref(true)
  const refreshing = ref(false)
  /** 佔住清單區的錯誤；CLI 不可用另由 `cliUnavailable` 抬成常駐提示 */
  const listError = ref<GatewayError | null>(null)

  /** 目前開啟的 spec 識別名；null＝面板未開 */
  const openId = ref<string | null>(null)
  const content = ref('')
  const loading = ref(false)
  /** 使用者主動刷新中：面板清空並改用 skeleton 回饋（與 change 詳情同語意） */
  const contentRefreshing = ref(false)
  const contentError = ref<GatewayError | null>(null)

  const isOpen = computed(() => openId.value !== null)
  const cliUnavailable = computed(() => listError.value?.kind === 'cli-unavailable')
  const busy = computed(() => firstLoadPending.value || refreshing.value)
  const count = computed(() => specs.value.length)

  /** 清單與內容各自一組序號：兩邊的請求會同時在飛，共用會互相作廢 */
  let listSeq = 0
  let contentSeq = 0

  /** 進入 Specs 頁：不接續上次狀態，清空後重新載入（spec 切頁即關與重新載入） */
  async function enter(): Promise<void> {
    reset()
    await load()
  }

  function reset(): void {
    listSeq++
    specs.value = []
    targetPath.value = ''
    listError.value = null
    firstLoadPending.value = true
    refreshing.value = false
    close()
  }

  async function load(): Promise<void> {
    const mine = ++listSeq
    if (!firstLoadPending.value)
      refreshing.value = true

    try {
      const result = await gateway.listSpecs()
      if (mine !== listSeq)
        return

      if (result.ok) {
        specs.value = result.specs
        targetPath.value = result.targetPath
        listError.value = null
        return
      }

      // 清單是這頁的全部內容，沒有「留著舊資料只丟 toast」的餘地
      specs.value = []
      targetPath.value = result.targetPath || targetPath.value
      listError.value = result.error
    }
    finally {
      if (mine === listSeq) {
        firstLoadPending.value = false
        refreshing.value = false
      }
    }
  }

  /** 開啟／原地切換：面板不留前一個 spec 的內容（與 change 詳情的冷路徑同姿態） */
  async function open(id: string): Promise<void> {
    openId.value = id
    content.value = ''
    await loadContent()
  }

  async function loadContent(): Promise<void> {
    const id = openId.value
    if (!id)
      return

    const mine = ++contentSeq
    loading.value = true
    contentError.value = null

    const result = await gateway.getSpecContent(id)
    if (mine !== contentSeq)
      return

    if (result.ok)
      content.value = result.content
    else
      contentError.value = result.error

    loading.value = false
  }

  async function refreshContent(): Promise<void> {
    if (!openId.value)
      return

    contentRefreshing.value = true
    content.value = ''
    try {
      await loadContent()
    }
    finally {
      contentRefreshing.value = false
    }
  }

  function close(): void {
    contentSeq++ // 讓飛在路上的請求作廢，免得關掉後才回來寫狀態
    openId.value = null
    content.value = ''
    contentError.value = null
    loading.value = false
    contentRefreshing.value = false
  }

  /** ↑↓ 切換相鄰 spec；找不到當前項（清單剛換過）時從頭進入，而不是原地卡住 */
  function move(step: number): void {
    const ids = specs.value.map(spec => spec.id)
    const current = ids.indexOf(openId.value ?? '')
    const next = ids[current === -1 ? 0 : Math.min(ids.length - 1, Math.max(0, current + step))]
    if (next && next !== openId.value)
      void open(next)
  }

  return {
    specs,
    targetPath,
    firstLoadPending,
    refreshing,
    listError,
    openId,
    content,
    loading,
    contentRefreshing,
    contentError,
    isOpen,
    cliUnavailable,
    busy,
    count,
    enter,
    reset,
    load,
    open,
    loadContent,
    refreshContent,
    close,
    move,
  }
})
