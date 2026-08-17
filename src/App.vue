<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { gateway } from './api'
import AppSidebar from './components/AppSidebar.vue'
import ArtifactPanel from './components/ArtifactPanel.vue'
import ChangeList from './components/ChangeList.vue'
import ToastStack from './components/ToastStack.vue'
import { useChangesStore } from './stores/changes'
import { useDetailStore } from './stores/detail'
import { useProjectsStore } from './stores/projects'

const store = useChangesStore()
const detail = useDetailStore()
const projects = useProjectsStore()

/**
 * 面板左側露出的清單寬度：足夠讀出卡片名稱左段（mono 字體、靠左），
 * 右半的數字與時間被蓋住是接受的取捨——露出區的角色是「辨識＋切換」。
 */
const REVEAL_WIDTH = 320

/** 極窄視窗的防線：面板窄到這裡就換露出區讓位（桌面 App 形態，不做響應式斷點） */
const PANEL_MIN_WIDTH = 420

const main = ref<HTMLElement>()

let unsubscribe: (() => void) | null = null

onMounted(async () => {
  // 檔案變動的自動重載從這裡起訂閱；通知已在 server 端 debounce 過
  unsubscribe = gateway.subscribeToChanges(syncFromWatcher)

  window.addEventListener('keydown', onKeydown)

  // 專案清單先到位：主區才知道現在是「無目標專案」還是「這個專案讀不到」
  await projects.load()
  await store.load()
  // 清單抓齊後把各 change 的詳情依序預載進快取，之後點開零等待（design D4）
  detail.prefetch(store.changes.map(change => change.name))
})

onUnmounted(() => {
  unsubscribe?.()
  unsubscribe = null
  window.removeEventListener('keydown', onKeydown)
})

/**
 * 通知只說「有變動」，所以清單一律重載；詳情只重取當前開啟的那個
 * ——未開啟 change 的快取過期交給點開時的既有重取，這裡不重跑預載。
 */
async function syncFromWatcher(): Promise<void> {
  await store.loadSilently()
  await detail.syncWithChanges(store.changes.map(change => change.name))
}

function move(step: number): void {
  const names = store.changes.map(change => change.name)
  const current = names.indexOf(detail.changeName ?? '')
  // 找不到當前項（剛被 archive）時從頭進入，而不是原地卡住
  const next = names[current === -1 ? 0 : Math.min(names.length - 1, Math.max(0, current + step))]
  if (next && next !== detail.changeName)
    detail.show(next)
}

/** ↑↓ 切換與 Esc 收合只在面板開啟期間成立；清單狀態下鍵盤不搶任何行為 */
function onKeydown(event: KeyboardEvent): void {
  if (!detail.isOpen || event.metaKey || event.ctrlKey || event.altKey)
    return
  const target = event.target as HTMLElement | null
  if (target?.isContentEditable || /^(?:INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? ''))
    return

  if (event.key === 'Escape') {
    event.preventDefault()
    detail.close()
    return
  }
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')
    return

  event.preventDefault()
  move(event.key === 'ArrowDown' ? 1 : -1)
}

// 鍵盤切到捲動範圍外的卡片時把它帶進視野；點擊切換不需要（本來就看得到）
watch(() => detail.changeName, async () => {
  await nextTick()
  main.value?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' })
})
</script>

<template>
  <div class="grid grid-cols-[224px_1fr] h-screen">
    <AppSidebar />

    <!-- 清單是常駐層、詳情是覆蓋層：面板以容器內絕對定位蓋上來（不蓋 sidebar），
         清單本身不變形也不移位，所以只有面板需要進出場動畫 -->
    <div ref="main" class="relative min-w-0 overflow-hidden">
      <ChangeList />

      <Transition
        enter-active-class="transition-transform duration-220 ease-[var(--sr-ease-out)] sr-motion"
        enter-from-class="translate-x-full"
        leave-active-class="transition-transform duration-150 ease-[var(--sr-ease-out)] sr-motion"
        leave-to-class="translate-x-full"
      >
        <!-- 寬度三個值綁在一起走 style：面板自己的 min-w-0 會跟 utility 版打架 -->
        <ArtifactPanel
          v-if="detail.isOpen"
          class="absolute inset-y-0 right-0"
          :style="{
            width: `calc(100% - ${REVEAL_WIDTH}px)`,
            minWidth: `${PANEL_MIN_WIDTH}px`,
            maxWidth: '100%',
          }"
        />
      </Transition>
    </div>
  </div>
  <ToastStack />
</template>
