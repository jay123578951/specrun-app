import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useDetailStore } from './detail'

/**
 * 主區目前顯示的頁。Settings 永遠不在這個聯集裡——它是疊在任何頁之上的覆蓋層
 * （design D2），開關不改變當前頁，因此沒有「切到 Settings」這回事。
 */
export type AppView = 'changes' | 'specs' | 'archived'

/**
 * 換頁狀態（design：不引入 vue-router）。桌面 App 無 URL／歷史需求，這個規模
 * 引入 router 是為不存在的規模設計；跨元件（側欄、ProjectSwitcher、主區）共享，
 * 所以放 store 而非 App 內的 ref。
 */
export const useViewStore = defineStore('view', () => {
  const currentView = ref<AppView>('changes')

  /**
   * 切頁即關詳情、不記憶（design：切頁即關）。specs／archived 那兩側的面板狀態隨
   * 頁面元件卸載一起清掉（見各自 store 的 enter／reset），這裡只需要處理常駐的 change 詳情。
   */
  function show(view: AppView): void {
    if (currentView.value === view)
      return

    currentView.value = view
    useDetailStore().close()
  }

  return { currentView, show }
})
