<script setup lang="ts">
import { onMounted } from 'vue'
import AppSidebar from './components/AppSidebar.vue'
import ArtifactPanel from './components/ArtifactPanel.vue'
import ChangeList from './components/ChangeList.vue'
import ChangeRail from './components/ChangeRail.vue'
import ToastStack from './components/ToastStack.vue'
import { useChangesStore } from './stores/changes'
import { useDetailStore } from './stores/detail'

const store = useChangesStore()
const detail = useDetailStore()

// design D5：掛載時載入一次，之後只有手動 refresh（watcher 是 C3）
onMounted(async () => {
  await store.load()
  // 清單抓齊後把各 change 的詳情依序預載進快取，之後點開零等待（design D4）
  detail.prefetch(store.changes.map(change => change.name))
})
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
