<script setup lang="ts">
import ProjectSwitcher from './ProjectSwitcher.vue'
</script>

<template>
  <!-- 四段結構依 docs/ui-structure-decisions.md；專案清單段自 C5 起是可互動的多專案清單，
       Specs／Archive／Settings 仍是靜態殼 -->
  <aside class="flex flex-col overflow-hidden border-r border-line bg-surface">
    <div class="flex items-center gap-2.5 px-5 py-5">
      <span class="h-2 w-2 rotate-45 bg-accent-bright" aria-hidden="true" />
      <span class="text-read-h1 text-text font-serif font-600">specrun</span>
    </div>

    <ProjectSwitcher />

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
