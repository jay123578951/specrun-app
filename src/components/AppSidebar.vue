<script setup lang="ts">
import { useSettingsStore } from '../stores/settings'
import ProjectSwitcher from './ProjectSwitcher.vue'

const settings = useSettingsStore()
</script>

<template>
  <!-- 三段結構依 docs/ui-structure-decisions.md；專案清單段自 C5 起是可互動的多專案清單。
       頁入口整段已移除（spec change-list「側欄結構」）：Specs／Archived 在資料層是目前
       專案的產物，放在專案清單段之外會讀成跨專案的全域入口，頁切換改由主區麵包屑承擔。
       側欄自此只管專案與全域設定，因此不會有任何當前頁高亮；底部的分隔線承載的是
       「Settings 是覆蓋層入口，行為也不一樣」（design D2） -->
  <aside class="flex flex-col overflow-hidden border-r border-line bg-surface">
    <div class="flex items-center gap-2.5 px-5 py-5">
      <span class="h-2 w-2 rotate-45 bg-accent-bright" aria-hidden="true" />
      <span class="text-ui-lg text-text font-serif font-600">specrun</span>
    </div>

    <ProjectSwitcher />

    <div class="mt-auto border-t border-line px-3 py-4">
      <!-- 覆蓋層而非頁：MUST NOT 掛當前頁高亮，開啟它也不改變主區當前頁（spec change-list） -->
      <button type="button" class="side-action" @click="settings.open()">
        <span class="i-lucide-settings h-4 w-4" aria-hidden="true" />
        Settings
      </button>
    </div>
  </aside>
</template>
