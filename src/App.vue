<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { gateway } from './api'
import AppSidebar from './components/AppSidebar.vue'
import ArchivedPanel from './components/ArchivedPanel.vue'
import ArchivedView from './components/ArchivedView.vue'
import ArtifactPanel from './components/ArtifactPanel.vue'
import ChangeList from './components/ChangeList.vue'
import SpecPanel from './components/SpecPanel.vue'
import SpecsView from './components/SpecsView.vue'
import ToastStack from './components/ToastStack.vue'
import { useArchivedStore } from './stores/archived'
import { useChangesStore } from './stores/changes'
import { useDetailStore } from './stores/detail'
import { useProjectsStore } from './stores/projects'
import { useSpecsStore } from './stores/specs'
import { useViewStore } from './stores/view'

const store = useChangesStore()
const detail = useDetailStore()
const projects = useProjectsStore()
const specs = useSpecsStore()
const archived = useArchivedStore()
const view = useViewStore()

/**
 * 面板左側露出的清單寬度：足夠讀出卡片名稱左段（mono 字體、靠左），
 * 右半的數字與時間被蓋住是接受的取捨——露出區的角色是「辨識＋切換」。
 */
const REVEAL_WIDTH = 320

/** 極窄視窗的防線：面板窄到這裡就換露出區讓位（桌面 App 形態，不做響應式斷點） */
const PANEL_MIN_WIDTH = 420

/**
 * 三頁的 slideover 共用同一組進出場值，換頁時面板的動作看起來才是同一個東西。
 *
 * 全幅純位移的 drawer 式滑入滑出：fade 曾以「短位移＋淡入淡出」兩種配方（同拍、解耦）
 * 進過場，兩輪驗收都是 fade 的存在感蓋過移動，整組移除（design D3）。也不回舊版
 * 220ms／--sr-ease-out——那是高速掃過的元兇；時長放慢到 300／220ms、曲線換
 * --sr-ease-drawer 壓低初速（design D4／D5）。opacity-0 是幽靈值：正常模式 1ms 內
 * 結束、不可感知，只為 reduced motion 的淡入淡出降級存在（design D6）。
 * 時值與曲線住在 interactions.css 的 .panel-reveal-*（per-property 時值 utility 組不出）。
 */
const PANEL_MOTION = {
  'enter-active-class': 'panel-reveal-enter sr-motion',
  'enter-from-class': 'translate-x-full opacity-0',
  'leave-active-class': 'panel-reveal-leave sr-motion',
  'leave-to-class': 'translate-x-full opacity-0',
} as const

const main = ref<HTMLElement>()

const onChanges = computed(() => view.currentView === 'changes')
const onSpecs = computed(() => view.currentView === 'specs')
const onArchived = computed(() => view.currentView === 'archived')

/** 目前頁的面板是否開著；鍵盤只在這個條件下接管 ↑↓ 與 Esc */
const panelOpen = computed(() => {
  if (onChanges.value)
    return detail.isOpen
  return onSpecs.value ? specs.isOpen : archived.isOpen
})

let unsubscribe: (() => void) | null = null

onMounted(async () => {
  // 檔案變動的自動重載從這裡起訂閱；通知已在 server 端 debounce 過。
  // watcher 只服務 changes 那一側——Specs 頁刻意不擴充監看（design：進頁重載即可）
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
  if (onSpecs.value) {
    specs.move(step)
    return
  }
  if (onArchived.value) {
    archived.move(step)
    return
  }

  const names = store.changes.map(change => change.name)
  const current = names.indexOf(detail.changeName ?? '')
  // 找不到當前項（剛被 archive）時從頭進入，而不是原地卡住
  const next = names[current === -1 ? 0 : Math.min(names.length - 1, Math.max(0, current + step))]
  if (next && next !== detail.changeName)
    detail.show(next)
}

/** ↑↓ 切換與 Esc 收合只在面板開啟期間成立；清單狀態下鍵盤不搶任何行為 */
function onKeydown(event: KeyboardEvent): void {
  if (!panelOpen.value || event.metaKey || event.ctrlKey || event.altKey)
    return
  const target = event.target as HTMLElement | null
  if (target?.isContentEditable || /^(?:INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? ''))
    return

  if (event.key === 'Escape') {
    event.preventDefault()
    if (onChanges.value)
      detail.close()
    else if (onSpecs.value)
      specs.close()
    else
      archived.close()
    return
  }
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')
    return

  event.preventDefault()
  move(event.key === 'ArrowDown' ? 1 : -1)
}

// 鍵盤切到捲動範圍外的項目時把它帶進視野；點擊切換不需要（本來就看得到）
watch(() => [detail.changeName, specs.openId, archived.openDir], async () => {
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
      <ChangeList v-if="onChanges" />
      <SpecsView v-else-if="onSpecs" />
      <ArchivedView v-else />

      <Transition v-bind="PANEL_MOTION">
        <!-- 寬度三個值綁在一起走 style：面板自己的 min-w-0 會跟 utility 版打架 -->
        <ArtifactPanel
          v-if="onChanges && detail.isOpen"
          class="absolute inset-y-0 right-0"
          :style="{
            width: `calc(100% - ${REVEAL_WIDTH}px)`,
            minWidth: `${PANEL_MIN_WIDTH}px`,
            maxWidth: '100%',
          }"
        />
        <SpecPanel
          v-else-if="onSpecs && specs.isOpen"
          class="absolute inset-y-0 right-0"
          :style="{
            width: `calc(100% - ${REVEAL_WIDTH}px)`,
            minWidth: `${PANEL_MIN_WIDTH}px`,
            maxWidth: '100%',
          }"
        />
        <ArchivedPanel
          v-else-if="onArchived && archived.isOpen"
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
