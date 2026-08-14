<script setup lang="ts">
import { onMounted } from 'vue'
import AppSidebar from './components/AppSidebar.vue'
import ChangeList from './components/ChangeList.vue'
import ToastStack from './components/ToastStack.vue'
import { useChangesStore } from './stores/changes'

const store = useChangesStore()

// design D5：掛載時載入一次，之後只有手動 refresh（watcher 是 C3）
onMounted(() => store.load())
</script>

<template>
  <div class="grid grid-cols-[224px_1fr] h-screen">
    <AppSidebar />
    <ChangeList />
  </div>
  <ToastStack />
</template>
