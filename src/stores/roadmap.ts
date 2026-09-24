import type { GatewayError, RoadmapRefKind, RoadmapRefResolution, RoadmapRefsProbe, RoadmapSummary } from '../api'
import type { PendingOpenView } from './view'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { gateway } from '../api'
import { buildRoadmapRefContext, resolveRoadmapRef } from '../api/normalize-roadmap'
import { useViewStore } from './view'

/** `refs` 尚未取得（首次載入完成前、或上一輪失敗）時，引用一律解析不到，不是錯誤 */
const EMPTY_REFS: RoadmapRefsProbe = { specs: [], changes: [], archived: [], parked: [] }

/** 引用連結 kind → 別頁跳轉目標（Requirement 引用連結的跳轉、design D5）；roadmap 不在這裡，面板內原地切換 */
const REF_KIND_VIEW: Record<Exclude<RoadmapRefKind, 'roadmap'>, PendingOpenView> = {
  spec: 'specs',
  change: 'changes',
  archived: 'archived',
}

/**
 * Roadmap 頁的狀態源。生命週期比照 archived store（design D6）：進頁載入、離頁清空、
 * 不留快取、沒有寫入面。與 archived／specs 不同的一點：清單本身就是詳情的資料來源
 * （design D1），`items` 的每一筆已含全文 `body`，開啟面板不必另發一趟請求。
 */
export const useRoadmapStore = defineStore('roadmap', () => {
  const items = shallowRef<RoadmapSummary[]>([])
  const targetPath = ref('')
  const dirExists = ref(false)
  const offExists = ref(false)
  const refs = ref<RoadmapRefsProbe>(EMPTY_REFS)
  const firstLoadPending = ref(true)
  const refreshing = ref(false)
  /** 佔住清單區的錯誤；空狀態（停用／尚無 roadmap）不算錯誤，由 dirExists／offExists 分層 */
  const listError = ref<GatewayError | null>(null)

  /** 目前開啟的規劃檔檔名（含 `.md`，即 `RoadmapSummary.file`）；null＝面板未開 */
  const openFileName = ref<string | null>(null)

  const isOpen = computed(() => openFileName.value !== null)
  const busy = computed(() => firstLoadPending.value || refreshing.value)
  const count = computed(() => items.value.length)
  /** 面板的資料來源；找不到（例如剛好被外部刪除又還沒刷新掉）時為 null，面板自行決定怎麼呈現 */
  const openItem = computed(() => items.value.find(item => item.file === openFileName.value) ?? null)

  /** 供 `resolveRef` 使用；引用連結解析規則本身在 normalize-roadmap.ts，這裡只負責組 ctx（design D2、D4） */
  const refContext = computed(() => buildRoadmapRefContext(items.value, refs.value))

  /** 綁好 ctx 的引用解析函式，簽章對齊 `RenderOptions.roadmap.resolveRef`，面板直接把它交給 `renderMarkdown` */
  function resolveRef(code: string): RoadmapRefResolution | null {
    return resolveRoadmapRef(code, refContext.value)
  }

  let listSeq = 0

  /** 進入 Roadmap 頁：不接續上次狀態，清空後重新載入（Requirement 切頁即關與重新載入） */
  async function enter(): Promise<void> {
    reset()
    await load()
  }

  function reset(): void {
    listSeq++
    items.value = []
    targetPath.value = ''
    dirExists.value = false
    offExists.value = false
    refs.value = EMPTY_REFS
    listError.value = null
    firstLoadPending.value = true
    refreshing.value = false
    close()
  }

  /**
   * 清單與面板共用同一趟請求（design D1）：重跑這支就是「刷新」，不論是頁首的
   * 手動刷新還是面板 header 的刷新控制。開著的規劃檔若不在新清單裡（被刪除／改名），
   * 面板隨之關閉（Requirement 詳情 header「刷新後檔案已刪除」）。
   */
  async function load(): Promise<void> {
    const mine = ++listSeq
    if (!firstLoadPending.value)
      refreshing.value = true

    try {
      const result = await gateway.listRoadmap()
      if (mine !== listSeq)
        return

      if (result.ok) {
        items.value = result.items
        targetPath.value = result.targetPath
        dirExists.value = result.dirExists
        offExists.value = result.offExists
        refs.value = result.refs
        listError.value = null
      }
      else {
        // 清單是這頁的全部內容，沒有「留著舊資料只丟 toast」的餘地（同 specs／archived）
        items.value = []
        targetPath.value = result.targetPath || targetPath.value
        dirExists.value = false
        offExists.value = false
        listError.value = result.error
      }

      if (openFileName.value !== null && !items.value.some(item => item.file === openFileName.value))
        close()
    }
    finally {
      if (mine === listSeq) {
        firstLoadPending.value = false
        refreshing.value = false
      }
    }
  }

  /** 開啟／原地切換：清單裡已有全文，不必等待即可切換（Requirement 詳情 slideover、引用連結的跳轉） */
  function openFile(file: string): void {
    openFileName.value = file
  }

  function close(): void {
    openFileName.value = null
  }

  /** ↑↓ 跨組切換相鄰規劃檔；`items` 已是分組＋排序完成的最終順序，直接依它移動（design D6） */
  function move(step: number): void {
    const files = items.value.map(item => item.file)
    const current = files.indexOf(openFileName.value ?? '')
    const next = files[current === -1 ? 0 : Math.min(files.length - 1, Math.max(0, current + step))]
    if (next && next !== openFileName.value)
      openFile(next)
  }

  /**
   * MarkdownView 的 `ref` 事件轉進來的唯一入口（design D4／D5）：kind 為 roadmap
   * 時是同頁的規劃檔互跳，面板內原地切換；其餘 kind 交給 view store 的 `openOn`
   * 換頁（Roadmap 自己的面板隨換頁關閉，不提供返回捷徑，見 design D5、Requirement 引用連結的跳轉）。
   */
  function handleRef(payload: { kind: RoadmapRefKind, target: string }): void {
    if (payload.kind === 'roadmap') {
      openFile(payload.target)
      return
    }
    useViewStore().openOn(REF_KIND_VIEW[payload.kind], payload.target)
  }

  return {
    items,
    targetPath,
    dirExists,
    offExists,
    firstLoadPending,
    refreshing,
    listError,
    openFileName,
    isOpen,
    busy,
    count,
    openItem,
    enter,
    reset,
    load,
    openFile,
    close,
    move,
    resolveRef,
    handleRef,
  }
})
