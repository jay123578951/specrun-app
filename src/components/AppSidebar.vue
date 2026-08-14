<script setup lang="ts">
import { computed } from 'vue'
import { useChangesStore } from '../stores/changes'

const store = useChangesStore()

const projectName = computed(() => store.targetPath.split('/').filter(Boolean).pop() ?? '')
// 徽章＝真實的進行中 change 數；載入中或錯誤時不編數字出來
const badge = computed(() => store.firstLoadPending || store.blockingError ? null : store.activeCount)
</script>

<template>
  <!-- 四段結構依 docs/ui-structure-decisions.md；除徽章外皆為靜態殼（C1 範圍） -->
  <aside class="flex flex-col overflow-hidden border-r border-line bg-surface">
    <div class="flex items-center gap-2.5 px-5 py-5">
      <span class="h-2 w-2 rotate-45 bg-accent-bright" aria-hidden="true" />
      <span class="text-read-h1 text-text font-serif font-600">specrun</span>
    </div>

    <nav class="border-t border-line px-3 py-4">
      <p class="px-2.5 text-ui-xs text-text-3 uppercase tracking-wider">
        Projects
      </p>
      <div class="mt-2 flex items-center gap-2.5 rounded bg-accent/15 px-2.5 py-1.5 text-accent-bright">
        <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-bright" aria-hidden="true" />
        <span v-if="projectName" class="truncate text-mono-base font-mono" :title="store.targetPath">
          {{ projectName }}
        </span>
        <!-- 首載還沒回來才給骨架；載完仍不知道路徑（連本地 route 都沒通）就要老實說 -->
        <span v-else-if="store.firstLoadPending" class="h-3 w-24 animate-pulse rounded-full bg-accent/30" aria-hidden="true" />
        <span v-else class="truncate text-ui-sm text-text-3">Unknown path</span>
        <span
          v-if="badge !== null"
          class="ml-auto shrink-0 rounded-full bg-accent/25 px-1.5 text-mono-sm font-mono tabular-nums"
        >
          {{ badge }}
        </span>
      </div>
    </nav>

    <nav class="border-t border-line px-3 py-4 space-y-0.5">
      <div class="side-item">
        <span class="i-lucide-file-text h-4 w-4" aria-hidden="true" />
        Specs
      </div>
      <div class="side-item">
        <span class="i-lucide-archive h-4 w-4" aria-hidden="true" />
        Archive
      </div>
    </nav>

    <div class="mt-auto border-t border-line px-3 py-4">
      <div class="side-item">
        <span class="i-lucide-settings h-4 w-4" aria-hidden="true" />
        Settings
      </div>
    </div>
  </aside>
</template>
