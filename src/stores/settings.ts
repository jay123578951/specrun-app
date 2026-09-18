import type { CliMode, CliSettings, EnvironmentDiagnostics } from '../api'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { gateway } from '../api'
import { useChangesStore } from './changes'
import { useProjectsStore } from './projects'
import { useSpecsStore } from './specs'
import { useViewStore } from './view'

/**
 * Settings 覆蓋層的狀態源。Settings 是疊在任何頁之上的 modal，
 * 不進 `AppView` 聯集、不佔 App.vue 的面板槽——因此這裡只管自己，
 * 開關與主區的導覽狀態零耦合。
 */

/**
 * 狀態列的三態：尚未驗證／成功含版本／
 * 失敗含訊息。就地呈現、不走 toast——設定盒裡有專屬位置可貼（依 projects.ts 慣例）。
 */
export type CliStatus
  = { kind: 'unverified' }
    | { kind: 'ok', bin: string, version: string }
    | { kind: 'failed', message: string }

export const useSettingsStore = defineStore('settings', () => {
  const isOpen = ref(false)
  /** 目前生效的解析結果；null＝尚未取得（modal 首次開啟前） */
  const settings = ref<CliSettings | null>(null)
  /** UI 上選中的模式：切到手動時先於伺服端狀態改變（套用前伺服端仍是自動） */
  const mode = ref<CliMode>('auto')
  /** 手動模式的路徑草稿 */
  const draft = ref('')
  /**
   * 套用失敗的訊息。與 `settings` 分開存，是「驗證與套用是同一個動作」推出來的結果：
   * 驗證失敗時不寫入 config，目前生效的解析結果原封不動，只有狀態列改口。
   */
  const applyError = ref<string | null>(null)
  const applying = ref(false)
  const detecting = ref(false)
  const diagnostics = ref<EnvironmentDiagnostics | null>(null)

  const busy = computed(() => applying.value || detecting.value)
  const canReveal = computed(() => diagnostics.value?.canReveal === true)

  const status = computed<CliStatus>(() => {
    if (applyError.value)
      return { kind: 'failed', message: applyError.value }

    const current = settings.value
    if (!current)
      return { kind: 'unverified' }
    // 草稿與生效中的執行檔不同＝這個路徑還沒被驗證過，不能借用上一次的成功態
    if (mode.value === 'override' && draft.value.trim() !== (current.bin ?? ''))
      return { kind: 'unverified' }
    if (current.bin && current.version)
      return { kind: 'ok', bin: current.bin, version: current.version }
    return { kind: 'failed', message: current.message ?? 'The openspec CLI is not available.' }
  })

  /**
   * 載入序號：每個會寫回狀態的動作各拿一號，只有最後發出的那次能寫回
   * （沿用 changes／detail 的 seq 防護——換 CLI 期間晚到的舊回應不得覆蓋新狀態）。
   */
  let seq = 0

  async function open(): Promise<void> {
    isOpen.value = true
    await refresh()
  }

  function close(): void {
    isOpen.value = false
  }

  /** 取回目前的解析結果與診斷；兩者互不等待 */
  async function refresh(): Promise<void> {
    const mine = ++seq
    const [cli, env] = await Promise.all([gateway.getCliSettings(), gateway.getDiagnostics()])
    if (mine !== seq)
      return

    adopt(cli)
    diagnostics.value = env
  }

  /** 收下新的解析結果：模式與草稿都跟著它走，前一次的失敗訊息就此作廢 */
  function adopt(next: CliSettings): void {
    settings.value = next
    mode.value = next.mode
    // 第一段命中時 bin 是命令名 `openspec` 而非路徑，填進草稿會誤導；只有帶目錄的值才預填
    draft.value = next.bin?.includes('/') ? next.bin : ''
    applyError.value = null
  }

  /** 切到手動指定：只揭露輸入欄，不動伺服端——套用才是生效的那一刻 */
  function useManual(): void {
    mode.value = 'override'
  }

  /**
   * 切回自動偵測：撤掉持久化的覆寫並重跑三段降級。兩種模式互斥，
   * 所以這個切換本身就是動作，沒有「選了但沒套用」的中間態。
   */
  async function useAuto(): Promise<void> {
    if (busy.value)
      return

    detecting.value = true
    const mine = ++seq
    try {
      const result = await gateway.redetectCli()
      if (mine !== seq)
        return
      adopt(result)
      await reloadAfterCliChange()
    }
    finally {
      detecting.value = false
    }
  }

  /**
   * 驗證與套用合成單一動作，不另設儲存鈕——這樣就沒有「已驗證但忘記存」的中間態。
   * 成功才持久化並立即生效；失敗不寫入、原先生效的執行檔不受影響，訊息就地貼在狀態列。
   */
  async function apply(): Promise<void> {
    if (busy.value)
      return

    const path = draft.value.trim()
    if (!path) {
      applyError.value = 'Enter the path to the openspec executable.'
      return
    }

    applying.value = true
    const mine = ++seq
    try {
      const result = await gateway.applyCliPath(path)
      if (mine !== seq)
        return

      if (!result.ok) {
        applyError.value = result.message
        return
      }

      adopt(result.settings)
      // modal 不自動關：狀態列留著成功態，使用者關掉就看到資料已經回來
      await reloadAfterCliChange()
    }
    finally {
      applying.value = false
    }
  }

  /**
   * 換 CLI 執行檔後的重載範圍，比照 `projects.ts` 的 `adopt()`：
   * change 清單、目前所在頁的引擎資料、各專案徽章。
   * archived 走檔案層直讀、CLI 零參與；watcher 監看檔案系統、與 CLI 無關——兩者都不動。
   */
  async function reloadAfterCliChange(): Promise<void> {
    const changes = useChangesStore()
    changes.invalidate()
    await changes.load()

    if (useViewStore().currentView === 'specs')
      await useSpecsStore().load()

    // 徽章每項一趟 CLI，不擋這次套用的關鍵路徑
    void useProjectsStore().refreshBadges()
  }

  /** 編輯草稿即撤下上一次的失敗訊息——狀態退回「尚未驗證」，不留過期的紅字 */
  function setDraft(value: string): void {
    draft.value = value
    applyError.value = null
  }

  /**
   * 在檔案管理器中開啟某路徑的所在位置。按鈕在不支援的平台上已是禁用，
   * 這裡的 unsupported 只是兜底；失敗沒有專屬位置可貼，走全 App 共用的 toast。
   */
  async function reveal(path: string | null): Promise<void> {
    if (!path)
      return

    const outcome = await gateway.revealPath(path)
    if (outcome.status === 'revealed')
      return

    useChangesStore().notify(
      outcome.status === 'unsupported'
        ? 'Opening that location is not available on this platform.'
        : 'Could not open that location.',
    )
  }

  return {
    isOpen,
    settings,
    mode,
    draft,
    applying,
    detecting,
    diagnostics,
    busy,
    canReveal,
    status,
    open,
    close,
    refresh,
    useManual,
    useAuto,
    apply,
    setDraft,
    reveal,
  }
})
