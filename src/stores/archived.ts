import type { ArchivedSummary, ArtifactView, ChangeDetail, GatewayError } from '../api'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { gateway } from '../api'
import { useChangesStore } from './changes'
import { useViewStore } from './view'

/**
 * Archived 頁的狀態源：生命週期比照 specs store——進頁載入、離頁清空、
 * 不裝 watcher（archived 目錄只增不改，弱一致就夠）、不留內容快取（切頁即關）。
 *
 * 刻意不併進 detail store：那裡綁著 watcher 同步、prefetch 快取與 parked 分流，
 * archived 全都不需要，硬塞只會讓兩邊的失效語意互相污染。
 * 唯讀的第二道防線也在這裡——這個 store 根本沒有寫入面。
 */
export const useArchivedStore = defineStore('archived', () => {
  const items = shallowRef<ArchivedSummary[]>([])
  const targetPath = ref('')
  const firstLoadPending = ref(true)
  const refreshing = ref(false)
  /** 佔住清單區的錯誤；分層呈現由 ArchivedView 依 kind 決定 */
  const listError = ref<GatewayError | null>(null)

  /** 目前開啟的 archived change 目錄名（含日期前綴）；null＝面板未開 */
  const openDir = ref<string | null>(null)
  const detail = shallowRef<ChangeDetail | null>(null)
  const currentTab = ref<string | null>(null)
  const loading = ref(false)
  /** 使用者主動刷新中：面板清空並改用 skeleton 回饋（與 change 詳情同語意） */
  const contentRefreshing = ref(false)
  const contentError = ref<GatewayError | null>(null)

  const isOpen = computed(() => openDir.value !== null)
  const busy = computed(() => firstLoadPending.value || refreshing.value)
  const count = computed(() => items.value.length)
  const artifacts = computed<ArtifactView[]>(() => detail.value?.artifacts ?? [])
  const currentArtifact = computed(
    () => artifacts.value.find(artifact => artifact.id === currentTab.value) ?? null,
  )
  /** 面板標題用去前綴的顯示名，與卡片同一個字（清單還沒回來時退回目錄名） */
  const openName = computed(() =>
    items.value.find(item => item.dir === openDir.value)?.name ?? openDir.value ?? '',
  )

  /** 清單與內容各自一組序號：兩邊的請求會同時在飛，共用會互相作廢 */
  let listSeq = 0
  let contentSeq = 0

  /** 進入 Archived 頁：不接續上次狀態，清空後重新載入 */
  async function enter(): Promise<void> {
    reset()
    if (await load())
      consumePendingOpen()
  }

  /**
   * Roadmap 引用連結跳轉到 Archived 頁的待開目標（design D5）：載入完成後才問
   * `view.pendingOpen`，不是輪到自己就 no-op；找到就開，找不到停在清單並 toast
   * （同 specs.ts 的 consumePendingOpen，兩邊各自持有一份、不抽共用——單一 if
   * 分支抽象化只會多一層跳轉）。
   */
  function consumePendingOpen(): void {
    const dir = useViewStore().consumePendingOpen('archived')
    if (dir === null || listError.value)
      return

    if (items.value.some(item => item.dir === dir))
      void open(dir)
    else
      useChangesStore().notify(`Could not find "${dir}". It may have been moved or removed.`)
  }

  function reset(): void {
    listSeq++
    items.value = []
    targetPath.value = ''
    listError.value = null
    firstLoadPending.value = true
    refreshing.value = false
    close()
  }

  /** 回傳本輪是否仍有效（沒被後發的請求作廢）；只有有效的那輪才算資料落地 */
  async function load(): Promise<boolean> {
    const mine = ++listSeq
    if (!firstLoadPending.value)
      refreshing.value = true

    try {
      const result = await gateway.listArchived()
      if (mine !== listSeq)
        return false

      if (result.ok) {
        items.value = result.items
        targetPath.value = result.targetPath
        listError.value = null
        return true
      }

      // 清單是這頁的全部內容，沒有「留著舊資料只丟 toast」的餘地
      items.value = []
      targetPath.value = result.targetPath || targetPath.value
      listError.value = result.error
      return true
    }
    finally {
      if (mine === listSeq) {
        firstLoadPending.value = false
        refreshing.value = false
      }
    }
  }

  /** 開啟／原地切換：面板不留前一個 change 的內容（與 spec 詳情的冷路徑同姿態） */
  async function open(dir: string): Promise<void> {
    openDir.value = dir
    detail.value = null
    await loadContent()
  }

  async function loadContent(): Promise<void> {
    const dir = openDir.value
    if (!dir)
      return

    const mine = ++contentSeq
    loading.value = true
    contentError.value = null

    const result = await gateway.getArchivedDetail(dir)
    if (mine !== contentSeq)
      return

    if (result.ok) {
      detail.value = result.detail
      currentTab.value = resolveTab(result.detail, currentTab.value)
    }
    else {
      contentError.value = result.error
    }

    loading.value = false
  }

  async function refreshContent(): Promise<void> {
    if (!openDir.value)
      return

    contentRefreshing.value = true
    detail.value = null
    try {
      await loadContent()
    }
    finally {
      contentRefreshing.value = false
    }
  }

  function selectTab(id: string): void {
    currentTab.value = id
  }

  function close(): void {
    contentSeq++ // 讓飛在路上的請求作廢，免得關掉後才回來寫狀態
    openDir.value = null
    detail.value = null
    contentError.value = null
    loading.value = false
    contentRefreshing.value = false
  }

  /** ↑↓ 切換相鄰 change；找不到當前項（清單剛換過）時從頭進入，而不是原地卡住 */
  function move(step: number): void {
    const dirs = items.value.map(item => item.dir)
    const current = dirs.indexOf(openDir.value ?? '')
    const next = dirs[current === -1 ? 0 : Math.min(dirs.length - 1, Math.max(0, current + step))]
    if (next && next !== openDir.value)
      void open(next)
  }

  return {
    items,
    targetPath,
    firstLoadPending,
    refreshing,
    listError,
    openDir,
    currentTab,
    loading,
    contentRefreshing,
    contentError,
    isOpen,
    busy,
    count,
    artifacts,
    currentArtifact,
    openName,
    enter,
    reset,
    load,
    open,
    loadContent,
    refreshContent,
    selectTab,
    close,
    move,
  }
})

/** 換 change 時沿用同名 tab（回顧常是「連著看好幾份 proposal」），沒有就回到第一個 */
function resolveTab(detail: ChangeDetail, preferred: string | null): string | null {
  const ids = detail.artifacts.map(artifact => artifact.id)
  if (preferred && ids.includes(preferred))
    return preferred
  if (ids.includes('proposal'))
    return 'proposal'
  return ids[0] ?? null
}
