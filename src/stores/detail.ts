import type { ChangeDetail, ChangeDetailResult, GatewayError } from '../api'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { gateway } from '../api'

/**
 * 詳情檢視的狀態（design D7：同畫面變形無 URL 需求，不引入 router）。
 *
 * 新鮮度策略 design D4（stale-while-revalidate）：session 內看過的 change 立即
 * 顯示上次內容、零等待，但每次進入／切換仍照樣重取——快取只墊底、不取代重取，
 * 內容有變才靜默換上。旁邊跑 Claude Code 改檔案的場景下保鮮語意不丟。
 */
export const useDetailStore = defineStore('detail', () => {
  /** 目前開啟的 change 名；null＝詳情未開 */
  const changeName = ref<string | null>(null)
  const detail = shallowRef<ChangeDetail | null>(null)
  /** 跨 change 記住的 tab 選取，fallback 後會被覆寫成實際落點 */
  const currentTab = ref<string | null>(null)
  /** 冷路徑載入中（無內容可顯示）；暖路徑的背景重取不打開這個旗標 */
  const loading = ref(false)
  /** 使用者主動刷新中：面板清空並改用 skeleton 回饋（與導航動作的無動畫載入刻意對比） */
  const refreshing = ref(false)
  /** 冷路徑失敗才進這裡；畫面上已有內容時的失敗走 staleWarning */
  const error = ref<GatewayError | null>(null)
  /** 背景重取失敗但畫面已有快取內容：不打斷閱讀，只留一個小提示 */
  const staleWarning = ref(false)
  /** 進入詳情前的清單捲動位置，Esc 回去時原位還原 */
  const listScrollTop = ref(0)

  const isOpen = computed(() => changeName.value !== null)
  const artifacts = computed(() => detail.value?.artifacts ?? [])
  const currentArtifact = computed(
    () => artifacts.value.find(artifact => artifact.id === currentTab.value) ?? null,
  )

  /** 看過的 change → 上次取得的內容；跨 session 存 localStorage（design D4） */
  const cache = new Map<string, ChangeDetail>(readPersistedCache())

  function remember(name: string, value: ChangeDetail): void {
    cache.set(name, value)
    writePersistedCache(cache)
  }

  /** 每次載入拿一個序號；只有最後發出的那次能寫回狀態（快速連按 ↑↓ 會有多個請求在飛） */
  let seq = 0

  /** 同一個 change 同時只發一次請求：預載與使用者點開撞在一起時共用同一趟 CLI */
  const inflight = new Map<string, Promise<ChangeDetailResult>>()

  function fetchDetail(name: string): Promise<ChangeDetailResult> {
    const running = inflight.get(name)
    if (running)
      return running

    const request = gateway.getChangeDetail(name).finally(() => inflight.delete(name))
    inflight.set(name, request)
    return request
  }

  /** 還沒輪到的預載對象；使用者點開時從這裡拿掉（該項改由 load() 立刻插隊取得） */
  const prefetchQueue: string[] = []
  let draining = false

  /**
   * 清單載入完成後依序把各 active change 的詳情抓進快取（design D4）：啟動花幾秒，
   * 換來之後點開零等待。依序發、不並發轟 CLI；失敗就算了，點開時還會重取。
   */
  async function prefetch(names: string[]): Promise<void> {
    // 沒快取的排前面——只有這些會讓使用者踩到「點開沒東西可顯示」的墊底路徑
    const ordered = [...names].sort((a, b) => Number(cache.has(a)) - Number(cache.has(b)))
    for (const name of ordered) {
      if (!prefetchQueue.includes(name))
        prefetchQueue.push(name)
    }

    // archive／刪掉的 change 不會再被看到，留著只會讓持久化的快取無限長大
    if (names.length) {
      for (const name of [...cache.keys()]) {
        if (!names.includes(name))
          cache.delete(name)
      }
      writePersistedCache(cache)
    }

    if (draining)
      return
    draining = true

    try {
      while (prefetchQueue.length) {
        const name = prefetchQueue.shift()!
        const result = await fetchDetail(name)
        if (result.ok)
          remember(name, result.detail)
      }
    }
    finally {
      draining = false
    }
  }

  async function show(name: string): Promise<void> {
    changeName.value = name

    const cached = cache.get(name)
    if (cached) {
      // 暖路徑：先把上次的內容擺上去，重取在背景進行
      detail.value = cached
      currentTab.value = resolveTab(cached, currentTab.value)
    }
    else {
      // 冷路徑：面板先空著，但不留前一個 change 的內容（spec artifact-view）
      detail.value = null
    }

    await load()
  }

  async function load(): Promise<void> {
    const name = changeName.value
    if (!name)
      return

    const mine = ++seq
    // 有內容在畫面上＝暖路徑：不開載入態、失敗也不換錯誤畫面
    const warm = detail.value !== null
    loading.value = !warm
    error.value = null
    staleWarning.value = false

    // 使用者要看的這一項插隊：現在就發，不排在預載隊伍後面等
    const queued = prefetchQueue.indexOf(name)
    if (queued !== -1)
      prefetchQueue.splice(queued, 1)

    const result = await fetchDetail(name)
    if (mine !== seq)
      return

    if (result.ok) {
      remember(name, result.detail)
      // 內容一模一樣就不動 detail：重賦值會整片重繪 markdown、白費一次高亮與捲動
      if (!warm || !isSameDetail(detail.value, result.detail)) {
        detail.value = result.detail
        currentTab.value = resolveTab(result.detail, currentTab.value)
      }
    }
    else if (warm) {
      staleWarning.value = true
    }
    else {
      error.value = result.error
    }
    loading.value = false
  }

  /**
   * 手動刷新：清空面板＋skeleton（spec 詳情手動刷新）。刷新是「我要等新資料」的明示，
   * 這裡刻意不吃快取墊底——留著舊內容就看不出資料到底換過沒有。
   */
  async function refresh(): Promise<void> {
    if (!changeName.value)
      return

    refreshing.value = true
    detail.value = null
    try {
      await load()
    }
    finally {
      refreshing.value = false
    }
  }

  function close(): void {
    seq++ // 讓飛在路上的請求作廢，免得關掉後才回來寫狀態
    changeName.value = null
    detail.value = null
    error.value = null
    staleWarning.value = false
    loading.value = false
  }

  function selectTab(id: string): void {
    currentTab.value = id
  }

  return {
    changeName,
    detail,
    currentTab,
    loading,
    refreshing,
    error,
    staleWarning,
    listScrollTop,
    isOpen,
    artifacts,
    currentArtifact,
    show,
    load,
    prefetch,
    refresh,
    close,
    selectTab,
  }
})

const CACHE_KEY = 'specrun.detail-cache.v1'

/** localStorage 不可用（隱私模式、配額滿）就整段降級為記憶體快取：不重試、不打擾使用者 */
let persistable = true

function readPersistedCache(): Array<[string, ChangeDetail]> {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw)
      return []

    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object')
      return []

    return Object.entries(parsed as Record<string, unknown>)
      .filter((entry): entry is [string, ChangeDetail] => isDetailShape(entry[1]))
  }
  catch {
    persistable = false
    return []
  }
}

function writePersistedCache(cache: Map<string, ChangeDetail>): void {
  if (!persistable)
    return

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(cache)))
  }
  catch {
    persistable = false
  }
}

/** 前一版格式或被外部寫壞的資料不能直接餵進畫面，最低限度驗形狀後才收 */
function isDetailShape(value: unknown): value is ChangeDetail {
  const detail = value as ChangeDetail | null
  return !!detail && typeof detail === 'object'
    && typeof detail.name === 'string' && Array.isArray(detail.artifacts)
}

/**
 * 切 change 時保持當前 tab；目標沒有同名 artifact 才 fallback proposal，
 * 連 proposal 都沒有（custom schema）就取清單第一個。
 */
function resolveTab(detail: ChangeDetail, preferred: string | null): string | null {
  const ids = detail.artifacts.map(artifact => artifact.id)
  if (preferred && ids.includes(preferred))
    return preferred
  if (ids.includes('proposal'))
    return 'proposal'
  return ids[0] ?? null
}

/** artifact 只有數 KB，序列化比對足夠且不會漏欄位 */
function isSameDetail(a: ChangeDetail | null, b: ChangeDetail): boolean {
  return a !== null && JSON.stringify(a) === JSON.stringify(b)
}
