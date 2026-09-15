import type { ArtifactFile, ChangeDetail, ChangeDetailResult, GatewayError } from '../api'
import type { TaskLineEdit } from '../utils/task-line'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { gateway } from '../api'
import { isCheckedLine, isTaskLine, lineTextAt, lineTexts, toggleTaskLines } from '../utils/task-line'
import { useChangesStore } from './changes'

/**
 * 詳情檢視的狀態。詳情開合只是同一個畫面的變形，沒有 URL 需求，所以不引入 router。
 *
 * 新鮮度策略（stale-while-revalidate）：看過的 change（跨 session 也留著）立即
 * 顯示上次內容、零等待，但每次進入／切換仍照樣重取——快取只墊底、不取代重取，
 * 內容有變才靜默換上。旁邊跑 Claude Code 改檔案的場景下保鮮語意不丟。
 */
export const useDetailStore = defineStore('detail', () => {
  /** 目前開啟的 change 名；null＝詳情未開 */
  const changeName = ref<string | null>(null)
  /**
   * 開著的是 parked change，資料路徑就此分流：parked change 已從專案的 changes 目錄
   * 搬進 `<repo>/.git/` 底下，CLI 問不到它，只能讀 park 當下留的快照 bundle。
   * 詳情也整份唯讀（tasks 不可勾）——全 App 的寫入點只開給 active change 的 tasks。
   */
  const isParked = ref(false)
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
  const isOpen = computed(() => changeName.value !== null)
  const artifacts = computed(() => detail.value?.artifacts ?? [])
  const currentArtifact = computed(
    () => artifacts.value.find(artifact => artifact.id === currentTab.value) ?? null,
  )

  /** 看過的 change → 上次取得的內容；跨 session 存 localStorage */
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
   * 清單載入完成後依序把各 active change 的詳情抓進快取：啟動花幾秒，
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

  async function show(name: string, parked = false): Promise<void> {
    changeName.value = name
    isParked.value = parked

    // parked 詳情不進快取：鍵是 change 名，與 active 撞名就會互相餵錯內容，
    // 而預載的清理邏輯（不在 active 清單中就淘汰）也會把它們掃掉。冷、小、少，重取即可。
    const cached = parked ? undefined : cache.get(name)
    if (cached) {
      // 暖路徑：先把上次的內容擺上去，重取在背景進行
      detail.value = cached
      currentTab.value = resolveTab(cached, currentTab.value)
    }
    else {
      // 冷路徑：面板先空著，但不留前一個 change 的內容
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

    const result = isParked.value ? await gateway.getParkedDetail(name) : await fetchDetail(name)
    if (mine !== seq)
      return

    if (result.ok) {
      if (!isParked.value)
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
   * watcher 通知觸發：先看重載後的清單還有沒有這個 change——不在＝被 archive／刪除，
   * 那是正常消失不是錯誤，走 Esc 同一條返回路徑；還在才靜默重取內容。
   */
  async function syncWithChanges(names: string[]): Promise<void> {
    const name = changeName.value
    if (!name)
      return

    // parked 是冷凍狀態：watcher 只看 `openspec/changes/`，那裡本來就不會有它——
    // 拿 active 清單來判斷「還在不在」會立刻把畫面關掉
    if (isParked.value)
      return

    if (!names.includes(name)) {
      close()
      return
    }

    await loadSilently()
  }

  /**
   * 背景重取當前 change：內容有變才靜默換上，失敗什麼都不做——不設 staleWarning、
   * 不進錯誤畫面，留著舊內容等下一次通知。
   */
  async function loadSilently(): Promise<void> {
    const name = changeName.value
    if (!name || isParked.value)
      return

    const mine = ++seq
    const result = await fetchDetail(name)
    if (mine !== seq || !result.ok)
      return

    remember(name, result.detail)
    if (!isSameDetail(detail.value, result.detail)) {
      detail.value = result.detail
      currentTab.value = resolveTab(result.detail, currentTab.value)
    }
  }

  /**
   * 手動刷新：清空面板＋skeleton。刷新是「我要等新資料」的明示，
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
    isParked.value = false
    detail.value = null
    error.value = null
    staleWarning.value = false
    loading.value = false
  }

  function selectTab(id: string): void {
    currentTab.value = id
  }

  /**
   * 切換專案：關掉詳情、清空快取與預載隊伍。
   * 快取以 change 名為鍵，跨專案可能撞名——留著就會拿 A 專案的內容墊 B 專案的底。
   * 代價是切回來時快取要重建，比餵錯內容划算得多。
   */
  function resetForProject(): void {
    close()
    prefetchQueue.length = 0
    cache.clear()
    writePersistedCache(cache)
  }

  /** 寫入進行中的來源行號：同顆連點忽略，UI 也據此呈現 pending */
  const pendingTaskLines = ref<number[]>([])

  /**
   * 當前 tasks 是否還有未勾行——批次入口的可用性來源。
   * 非 tasks tab、parked、多檔或無 tasks 檔案時一律 false：入口的出現／停用
   * 與 checkbox 可互動的判定同源，前端不另立一套規則。
   */
  const hasUncheckedTasks = computed(() => {
    if (isParked.value || currentTab.value !== 'tasks')
      return false

    const file = tasksFile(detail.value)
    return file !== null && uncheckedEdits(file.content).length > 0
  })

  /**
   * tasks checkbox 的翻轉：對快取的來源字串就地翻行 → 重渲染 → 才發請求。
   * 樂觀更新後的字串與寫入成功後檔案的真實內容逐 byte 相同，watcher 重取回來與快取全等，
   * 既有的「無差異不重繪」自然吸收，畫面零閃爍。
   */
  async function toggleTask(line: number): Promise<void> {
    const file = tasksFile(detail.value)
    if (!file || pendingTaskLines.value.includes(line))
      return

    const expectedText = lineTextAt(file.content, line)
    if (expectedText === null || !isTaskLine(expectedText))
      return

    // 目標狀態取自來源字串而非 DOM——單一資料源，被忽略的點擊不會讓兩邊分岔
    await writeToggle([{ line, expectedText }], !isCheckedLine(expectedText))
  }

  /**
   * 批次勾選：把當前 tasks 檔案所有未勾行一次標記為完成。
   * 目標集合自來源字串算出，與單顆點擊共用同一條寫入通道；
   * 有任何寫入在飛時不發批次——那時快取已是樂觀翻轉後的內容，算出的 expectedText
   * 必然與磁碟不符，整批會被判衝突。
   */
  async function checkAllTasks(): Promise<void> {
    const file = tasksFile(detail.value)
    if (!file || pendingTaskLines.value.length)
      return

    await writeToggle(uncheckedEdits(file.content), true)
  }

  /**
   * 單顆與批次共用的寫入路徑：樂觀更新 → 鎖住涉及的行 → 送出 → 失敗整片彈回。
   * 彈回不依賴變動通知（衝突時檔案可能根本沒變）；但只在畫面仍是我們寫上去的那份時才彈，
   * 期間若已被通知換成更新的內容就不覆蓋。
   */
  async function writeToggle(edits: TaskLineEdit[], checked: boolean): Promise<void> {
    const name = changeName.value
    const file = tasksFile(detail.value)
    // parked 是唯讀：UI 已把 checkbox 停用，這裡是第二道
    if (!name || !file || isParked.value || !edits.length)
      return

    const optimistic = toggleTaskLines(file.content, edits, checked)
    if (!optimistic.ok)
      return

    const before = file.content
    const lines = edits.map(edit => edit.line)
    setTasksContent(name, optimistic.content)
    pendingTaskLines.value = [...pendingTaskLines.value, ...lines]

    try {
      const result = await gateway.toggleTask(name, { edits, checked })
      if (result.ok)
        return // 成功路徑靜默：畫面已是目標狀態，後續刷新交給變動通知

      setTasksContent(name, before, optimistic.content)
      const toast = result.kind === 'conflict'
        ? { message: conflictMessage(edits.length) }
        : { message: result.message, detail: result.detail }
      useChangesStore().notify(toast.message, toast.detail)
    }
    finally {
      pendingTaskLines.value = pendingTaskLines.value.filter(pending => !lines.includes(pending))
    }
  }

  /** 換上新的 tasks 內容；`onlyIf` 有值時只在目前內容與它相符才動（彈回用） */
  function setTasksContent(name: string, content: string, onlyIf?: string): void {
    if (changeName.value !== name)
      return

    const current = detail.value
    const file = tasksFile(current)
    if (!current || !file || (onlyIf !== undefined && file.content !== onlyIf))
      return

    const next: ChangeDetail = {
      ...current,
      artifacts: current.artifacts.map(artifact => artifact.id === 'tasks'
        ? { ...artifact, files: artifact.files.map(each => ({ ...each, content })) }
        : artifact),
    }
    detail.value = next
    remember(name, next) // 快取一起走，下次墊底的才是同一份
  }

  return {
    changeName,
    isParked,
    detail,
    currentTab,
    loading,
    refreshing,
    error,
    staleWarning,
    isOpen,
    artifacts,
    currentArtifact,
    pendingTaskLines,
    hasUncheckedTasks,
    toggleTask,
    checkAllTasks,
    show,
    load,
    syncWithChanges,
    prefetch,
    refresh,
    close,
    resetForProject,
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

/** 可寫入的 tasks 檔案：恰一個既存檔才算，其餘情形一律唯讀 */
function tasksFile(detail: ChangeDetail | null): ArtifactFile | null {
  const artifact = detail?.artifacts.find(each => each.id === 'tasks')
  return artifact?.files.length === 1 ? artifact.files[0]! : null
}

/**
 * 所有未勾選的 task 行：判定沿用 task-line 既有的兩個函式——
 * 與 checkbox 可勾選與否的判準同一份，前端不會多出一套自己的規則，也不必查 DOM。
 */
function uncheckedEdits(content: string): TaskLineEdit[] {
  const edits: TaskLineEdit[] = []
  lineTexts(content).forEach((expectedText, line) => {
    if (isTaskLine(expectedText) && !isCheckedLine(expectedText))
      edits.push({ line, expectedText })
  })
  return edits
}

/** 衝突文案：批次的落點是「整批沒動」，與單顆的「這一項變了」不是同一件事 */
function conflictMessage(count: number): string {
  return count > 1
    ? 'Some of these tasks changed elsewhere. Nothing was updated.'
    : 'This task changed elsewhere. Reloading the latest version.'
}

/** artifact 只有數 KB，序列化比對足夠且不會漏欄位 */
function isSameDetail(a: ChangeDetail | null, b: ChangeDetail): boolean {
  return a !== null && JSON.stringify(a) === JSON.stringify(b)
}
