import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useChangesStore } from './changes'
import { useDetailStore } from './detail'

/**
 * 主區目前顯示的頁。Settings 永遠不在這個聯集裡——它是疊在任何頁之上的覆蓋層，
 * 開關不改變當前頁，因此沒有「切到 Settings」這回事。
 */
export type AppView = 'changes' | 'specs' | 'archived' | 'roadmap'

/**
 * Roadmap 引用連結跳轉的目標只會是這三頁（design D5）：view 是目標頁、id 是該頁
 * 要開的識別鍵（spec id／change 名／archived 目錄名，含日期前綴）。
 */
export type PendingOpenView = 'specs' | 'archived' | 'changes'

export interface PendingOpen {
  view: PendingOpenView
  id: string
}

/**
 * 換頁狀態（不引入 vue-router）。桌面 App 無 URL／歷史需求，這個規模
 * 引入 router 是為不存在的規模設計；跨元件（側欄、ProjectSwitcher、主區）共享，
 * 所以放 store 而非 App 內的 ref。
 */
export const useViewStore = defineStore('view', () => {
  const currentView = ref<AppView>('changes')

  /**
   * 頁切換下拉是否展開。狀態放這裡而不是元件內：App.vue 的全域鍵盤要據此整段讓位——
   * 下拉展開期間，清單與面板的 ↑↓、Esc 不得同時作用，否則一個 Esc 會連下拉帶詳情一起關掉。
   * 與 Settings 的 isOpen 是同一種形狀。
   */
  const menuOpen = ref(false)

  /**
   * 自下拉切頁後，把焦點交棒給新頁的觸發項（選定後 focus 交回觸發項）。
   * 麵包屑隨頁面元件重建，切頁那一刻舊的觸發項已不存在，接力點只能在新元件的掛載處。
   */
  const focusPageMenu = ref(false)

  /**
   * Roadmap 引用連結跳轉的待開目標（Requirement 引用連結的跳轉、design D5）。
   * `openOn()` 設定後交由目標頁自行消化：Specs／Archived 在各自 store 的 `enter()`
   * 載入完成後取用（見兩者的 `consumePendingOpen`），Changes 沒有進頁重載這回事，
   * 清單常駐、資料在切頁當下已經是最新的，所以直接在這裡（`show()` 切到 'changes' 的
   * 當下）就地消化，不留在這個 ref 上等別人來問。
   */
  const pendingOpen = ref<PendingOpen | null>(null)

  /**
   * 切頁即關詳情、不記憶。specs／archived 那兩側的面板狀態隨
   * 頁面元件卸載一起清掉（見各自 store 的 enter／reset），這裡只需要處理常駐的 change 詳情。
   */
  function show(view: AppView): void {
    if (currentView.value === view)
      return

    currentView.value = view
    // 待開目標只給它指名的那一頁：換到別頁（含目標頁載入未完成就離開、切換專案回 changes）即作廢
    if (pendingOpen.value && pendingOpen.value.view !== view)
      pendingOpen.value = null
    useDetailStore().close()
    if (view === 'changes')
      consumeForChanges()
  }

  /** Roadmap 面板的引用連結跳轉到別頁（design D5）：先掛上待開目標，再照既有規則換頁 */
  function openOn(view: PendingOpenView, id: string): void {
    pendingOpen.value = { view, id }
    show(view)
  }

  /**
   * 供 Specs／Archived store 在 `enter()` 載入完成後呼叫：目標是自己就取出 id 並清空，
   * 不是就回傳 null（維持待開狀態給真正的目標頁）。消化後找不到該項是各自 store 的事
   * （spec：停在清單並 toast），這裡只負責「這一個是不是輪到我」。
   */
  function consumePendingOpen(forView: 'specs' | 'archived'): string | null {
    if (pendingOpen.value?.view !== forView)
      return null

    const id = pendingOpen.value.id
    pendingOpen.value = null
    return id
  }

  /**
   * Changes 沒有 `enter()` 可以等——清單是 App 掛載時就載入、跨頁常駐的（design D5）。
   * 目標是 changes 時直接在切頁當下查目前的 active＋parked 清單，找到就開詳情、
   * 找不到就沿用既有的全域 toast（照 Requirement 引用連結的跳轉：停在清單、非阻斷提示）。
   */
  function consumeForChanges(): void {
    if (pendingOpen.value?.view !== 'changes')
      return

    const id = pendingOpen.value.id
    pendingOpen.value = null

    const store = useChangesStore()
    if (store.visibleChanges.some(change => change.name === id)) {
      void useDetailStore().show(id, false)
      return
    }
    if (store.visibleParked.some(item => item.name === id)) {
      void useDetailStore().show(id, true)
      return
    }
    store.notify(`Could not find "${id}". It may have been moved or removed.`)
  }

  return { currentView, menuOpen, focusPageMenu, pendingOpen, show, openOn, consumePendingOpen }
})
