<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { gateway } from './api'
import AppSidebar from './components/AppSidebar.vue'
import ArtifactPanel from './components/ArtifactPanel.vue'
import ChangeList from './components/ChangeList.vue'
import ChangeRail from './components/ChangeRail.vue'
import ToastStack from './components/ToastStack.vue'
import { useChangesStore } from './stores/changes'
import { useDetailStore } from './stores/detail'
import { useProjectsStore } from './stores/projects'

const store = useChangesStore()
const detail = useDetailStore()
const projects = useProjectsStore()

let unsubscribe: (() => void) | null = null

onMounted(async () => {
  // 檔案變動的自動重載從這裡起訂閱；通知已在 server 端 debounce 過
  unsubscribe = gateway.subscribeToChanges(syncFromWatcher)

  // 專案清單先到位：主區才知道現在是「無目標專案」還是「這個專案讀不到」
  await projects.load()
  await store.load()
  // 清單抓齊後把各 change 的詳情依序預載進快取，之後點開零等待（design D4）
  detail.prefetch(store.changes.map(change => change.name))
})

onUnmounted(() => {
  unsubscribe?.()
  unsubscribe = null
})

/**
 * 通知只說「有變動」，所以清單一律重載；詳情只重取當前開啟的那個
 * ——未開啟 change 的快取過期交給點開時的既有重取，這裡不重跑預載。
 */
async function syncFromWatcher(): Promise<void> {
  await store.loadSilently()
  await detail.syncWithChanges(store.changes.map(change => change.name))
}
</script>

<template>
  <div class="grid grid-cols-[224px_1fr] h-screen">
    <AppSidebar />

    <!-- 清單⇄窄軌＋內容面板是同一個容器的變形（非換頁、非彈窗）：欄寬直接換檔，
         位移感由兩側內容的進場動畫承擔——欄寬本身做過場等於在動 layout 屬性 -->
    <div
      class="grid min-w-0 overflow-hidden"
      :class="detail.isOpen ? 'grid-cols-[248px_1fr]' : 'grid-cols-1'"
    >
      <ChangeRail v-if="detail.isOpen" />
      <ChangeList v-else />

      <Transition
        enter-active-class="transition-[opacity,transform] duration-220 ease-[var(--sr-ease-out)] sr-motion"
        enter-from-class="opacity-0 translate-x-2"
      >
        <ArtifactPanel v-if="detail.isOpen" />
      </Transition>
    </div>
  </div>
  <ToastStack />
</template>
