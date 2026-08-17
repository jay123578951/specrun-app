import type { ChangeSummary, GatewayError, ParkActionResult, ParkedSummary, ParkUnavailableReason } from '../api'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { gateway } from '../api'

export interface Toast {
  id: number
  message: string
  detail?: string
  /** 'info' 是純告知（做成了、已經有了），不掛錯誤圖示與色；預設是失敗 */
  tone: 'error' | 'info'
}

const TOAST_TTL_MS = 6000

/** 合成卡取材用的快照：兩種卡片型別的共同欄位（不含 lastModified／parkedAt，由呈現端補時間） */
export interface MoveCard {
  name: string
  completedTasks: number
  totalTasks: number
  status: ChangeSummary['status']
  summary: string
}

/**
 * 進行中的搬移：對象 change 名稱＋方向＋拿起那一刻的卡片快照。同時只允許一個
 * （既有的單一 pending 閘門即此值）。快照是合成卡的唯一取材來源——若改成從底層陣列
 * 現場查找，unpark 期間 loadParked 先落地（parked 這側幾乎總是比 CLI 快）就會抽走取材
 * 對象，卡片在兩個群組都消失、直到慢的 listChanges 落地才出現（拖回 Active 卡頓的根因）。
 */
export interface OptimisticMove {
  name: string
  direction: 'park' | 'unpark'
  card: MoveCard
  /**
   * 行動成功那一刻的兩側落地水位（landSeq 快照）。settleMove 的「外部刪除」判定
   * 要等兩側都有比水位更新的資料落地才成立——搶號空窗期的舊資料「兩邊都查無此卡」
   * 是正常過渡，不是刪除（誤判會讓合成卡提前消失、等真資料落地才回來）。
   * 行動還在飛（尚未成功）時不存在，此時不做刪除判定。
   */
  landedFloor?: { changes: number, parked: number }
}

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
  /**
   * 進行中的 park／unpark：既是「同時只允許一個」的閘門，也是樂觀呈現的唯一真值（design D8）。
   * 兩者合併成一組狀態——並存兩個真值遲早會分岔（一個清了、另一個還在）。
   */
  const moving = ref<OptimisticMove | null>(null)
  /** 進行中的對象名稱；卡片據此顯示進行中標示 */
  const parkPending = computed(() => moving.value?.name ?? null)

  /**
   * 兩側的落地水位：每次真的把伺服端回應寫進 `changes.value`／`parked.value` 就 +1
   * （被搶號丟棄的回應不算）。只給 settleMove 的外部刪除判定當時間基準用——
   * 它需要知道「當下陣列內容是不是行動完成之後才落地的」，而不只是內容長什麼樣。
   */
  let changesLandSeq = 0
  let parkedLandSeq = 0

  /**
   * 撤除樂觀層的唯一時機：底層真實資料（`changes.value`／`parked.value`）已經反映搬移結果，
   * 而不是「觸發本次操作的那次 load() 結束」。後者會被 loadSilently()（watcher 觸發）搶走
   * loadSeq，使 load() 自己的 listChanges 結果被丟棄、changes.value 仍是搬移前的舊資料；
   * 若那時就清 moving，過期資料會直接露出（卡片在原群組短暫復活）。
   * load()／loadSilently()／loadParked() 任一次提交真實資料後都呼叫本函式，
   * 不侷限於哪一次呼叫促成——晚到的那次一樣接得住撤除，也不會永遠清不掉。
   * 呼叫是冪等的：條件不成立就是 no-op，多呼叫幾次無副作用。
   */
  function settleMove(): void {
    const move = moving.value
    if (!move)
      return

    const inChanges = changes.value.some(change => change.name === move.name)
    const inParked = parked.value.some(item => item.name === move.name)
    const reflected = move.direction === 'park'
      ? !inChanges && inParked
      : !inParked && inChanges

    if (reflected) {
      moving.value = null
      return
    }

    // 外部刪除的兜底：settleMove 的 reflected 永遠等不到那筆資料，不收掉 moving 會讓
    // 合成卡變成幽靈卡、閘門永久卡死。「兩邊都查無此卡」必須以行動完成後的新資料為據
    // ——兩側落地水位都要超過行動成功那一刻的快照（見 OptimisticMove.landedFloor）；
    // 只看當下陣列會把搶號空窗（unpark 已離開 parked、載有結果的 listChanges 被
    // loadSilently 搶號丟棄）誤判成刪除
    const floor = move.landedFloor
    if (floor && changesLandSeq > floor.changes && parkedLandSeq > floor.parked
      && !inChanges && !inParked) {
      moving.value = null
    }
  }

  /**
   * 顯示用清單＝伺服端資料 ＋ 樂觀層。`changes.value`／`parked.value` 永遠只承載真實資料，
   * 樂觀搬移不改寫它們——`loadSilently()` 隨時會整批替換那兩個陣列且不打旗標，
   * 若樂觀移動靠直接改陣列實現，旁邊存一次檔就會讓卡片閃回原群組再跳回來。
   */
  const visibleChanges = computed<ChangeSummary[]>(() => {
    const move = moving.value
    if (!move)
      return changes.value

    if (move.direction === 'park')
      return changes.value.filter(change => change.name !== move.name)

    // changes.value 可能已經先落地含這張卡（moving 撤除前的資料落地順序不定，見 settleMove）：
    // 濾掉同名真實卡再併入合成卡，避免同 key 兩張並列（Vue duplicate key）
    const rest = changes.value.filter(change => change.name !== move.name)
    // 取材自 moving 的快照而非底層陣列（見 OptimisticMove）。快照本身不含 parkedAt，
    // 卡片以該欄位的有無判別群組樣式。unpark 回來的排最前——清單依 lastModified 新→舊
    return [{ ...move.card, lastModified: Date.now() }, ...rest]
  })

  const visibleParked = computed<ParkedSummary[]>(() => {
    const move = moving.value
    if (!move)
      return parked.value

    if (move.direction === 'unpark')
      return parked.value.filter(item => item.name !== move.name)

    // parked.value 可能已經先落地含這張卡（loadParked 幾乎總是先落地，見 settleMove 的註解）：
    // 濾掉同名真實卡再併入合成卡，避免同 key 兩張並列（Vue duplicate key）
    const rest = parked.value.filter(item => item.name !== move.name)
    // parked 依 park 時間新→舊，剛停放的排最前
    return [{ ...move.card, parkedAt: Date.now() }, ...rest]
  })

  // 群組標題的數字要與實際看得到的卡片一致，因此同樣取自套過樂觀層的清單
  const activeCount = computed(() => visibleChanges.value.length)
  const parkedCount = computed(() => visibleParked.value.length)
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
    changesLandSeq++
    // 這次搶號可能正是撤走 moving 所需要的那筆落地資料：見 settleMove 註解
    settleMove()
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
    // 切專案是硬重置：新世代沒有「等資料落地反映搬移結果」這回事，樂觀層沒有對象可等，直接收掉
    moving.value = null
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
    parkedLandSeq++
    // parked 這一側幾乎總是先落地（不受 loadSeq 搶號影響）：見 settleMove 註解
    settleMove()
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
        changesLandSeq++
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
      // 佔版錯誤也算權威落地：清單確定是空的，讓刪除判定得以收掉懸著的 moving
      changesLandSeq++
    }
    finally {
      // 過期的那一輪不准動旗標——新世代可能正在自己的首載中，或已有更晚一次 load() 接手；
      // 用 flagSeq 而非 loadSeq 判斷，才不會被中途插隊的 loadSilently() 卡死 refreshing
      if (mine === generation.value && myFlag === flagSeq) {
        firstLoadPending.value = false
        refreshing.value = false
      }
      // changes.value 若剛在上面成功寫入，這裡是撤除 moving 的觸發點；若這一輪被搶號丟棄，
      // loadParked() 已經在自己落地時呼叫過一次——這裡是 no-op（見 settleMove 註解）
      settleMove()
    }
  }

  /**
   * park／unpark：兩者都是「搬移目錄 → 兩個群組都變了」，所以成功後主動重載兩群組
   * （不等 watcher——它只看得到 `openspec/changes/` 那一半，且要等 debounce）。
   * 卡片在操作期間先行呈現於目的地群組（樂觀移動），失敗即撤回並丟 toast：
   * 實際狀態仍以重新列舉的結果為準（spec 操作失敗呈現）。
   */
  function park(name: string): Promise<void> {
    return runParkAction(name, 'park', () => gateway.parkChange(name))
  }

  function unpark(name: string): Promise<void> {
    return runParkAction(name, 'unpark', () => gateway.unparkChange(name))
  }

  async function runParkAction(
    name: string,
    direction: OptimisticMove['direction'],
    call: () => Promise<ParkActionResult>,
  ): Promise<void> {
    if (moving.value)
      return

    // 快照在拿起那一刻取：來源群組此時一定還有這張卡（moving 閘門保證前面沒有別的搬移在飛）。
    // 找不到＝底層資料剛被外部重載抽走了對象，操作已無從談起，安靜放棄即可
    const origin = direction === 'park' ? changes.value : parked.value
    const source = origin.find(item => item.name === name)
    if (!source)
      return

    moving.value = {
      name,
      direction,
      card: {
        name: source.name,
        completedTasks: source.completedTasks,
        totalTasks: source.totalTasks,
        status: source.status,
        summary: source.summary,
      },
    }
    try {
      const result = await call()
      if (result.ok) {
        // 行動成功：記下此刻的兩側落地水位，settleMove 的外部刪除判定以此為時間基準
        // （行動在飛時 moving 可能已被提早反映結果的落地資料收掉，故需判空）
        if (moving.value?.name === name) {
          moving.value = {
            ...moving.value,
            landedFloor: { changes: changesLandSeq, parked: parkedLandSeq },
          }
        }
        // 不在這裡清樂觀層：這次 load() 的 listChanges 可能被 watcher 觸發的 loadSilently()
        // 搶走 loadSeq 而被丟棄，此時 changes.value 仍是搬移前的舊資料——若這裡就撤 moving，
        // 過期資料會直接露出（卡片在原群組短暫復活）。moving 改由 settleMove() 在底層資料
        // 真正反映搬移結果時才撤除（見該函式），不限於這次 load()。visibleChanges／
        // visibleParked 的去重邏輯墊底，moving 多留一會兒也不會露出重複卡，因此不必急著
        // 在這次 load() 本身撤除
        await load()
      }
      else {
        // 失敗立即撤回：不必等任何資料落地，維持既有行為
        notify(result.message, result.detail)
        moving.value = null
      }
    }
    catch (error) {
      // call() 理論上把錯誤包進 result、不應該拋，這裡兜底避免例外讓 moving 卡死轉圈
      moving.value = null
      throw error
    }
  }

  /** 全 App 共用的非阻斷失敗提示；detail store 的寫入失敗也走這裡 */
  function notify(message: string, detail?: string): void {
    push({ message, tone: 'error', ...(detail ? { detail } : {}) })
  }

  /** 沒出錯、只是要讓使用者知道發生了什麼（如專案已在清單中）——同一個 stack，不同語氣 */
  function notifyInfo(message: string): void {
    push({ message, tone: 'info' })
  }

  function push(toast: Omit<Toast, 'id'>): void {
    const entry: Toast = { id: ++toastSeq, ...toast }
    toasts.value = [...toasts.value, entry]
    setTimeout(dismissToast, TOAST_TTL_MS, entry.id)
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
    moving,
    visibleChanges,
    visibleParked,
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
    notifyInfo,
    dismissToast,
  }
})
