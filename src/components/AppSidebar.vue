<script setup lang="ts">
import { useViewStore } from '../stores/view'
import ProjectSwitcher from './ProjectSwitcher.vue'

const view = useViewStore()
</script>

<template>
  <!-- 四段結構依 docs/ui-structure-decisions.md；專案清單段自 C5 起是可互動的多專案清單，
       Specs 自本 change 起是換頁入口，Archive／Settings 仍是靜態殼 -->
  <aside class="flex flex-col overflow-hidden border-r border-line bg-surface">
    <div class="flex items-center gap-2.5 px-5 py-5">
      <span class="h-2 w-2 rotate-45 bg-accent-bright" aria-hidden="true" />
      <span class="text-read-h1 text-text font-serif font-600">specrun</span>
    </div>

    <ProjectSwitcher />

    <nav class="border-t border-line px-3 py-4 space-y-0.5">
      <!-- Changes 頁不在 nav 段（spec change-list）：位置指示由專案清單的 ● 標記兼任，
           所以這裡只有 Specs 有高亮態，而且僅在主區真的停在 Specs 時才亮 -->
      <button
        type="button"
        class="side-action"
        :class="view.currentView === 'specs'
          ? 'bg-accent/15 text-accent-bright hover:bg-accent/15 hover:text-accent-bright'
          : ''"
        :aria-current="view.currentView === 'specs' ? 'page' : undefined"
        @click="view.show('specs')"
      >
        <span class="i-lucide-file-text h-4 w-4" aria-hidden="true" />
        Specs
      </button>

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
