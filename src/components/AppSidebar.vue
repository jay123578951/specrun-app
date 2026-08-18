<script setup lang="ts">
import { useSettingsStore } from '../stores/settings'
import { useViewStore } from '../stores/view'
import ProjectSwitcher from './ProjectSwitcher.vue'

const view = useViewStore()
const settings = useSettingsStore()
</script>

<template>
  <!-- 四段結構依 docs/ui-structure-decisions.md；專案清單段自 C5 起是可互動的多專案清單。
       Specs 與 Archived 是換頁入口，Settings 則是覆蓋層入口——底部段的分隔線正好承載
       「它的行為也不一樣」（design D2） -->
  <aside class="flex flex-col overflow-hidden border-r border-line bg-surface">
    <div class="flex items-center gap-2.5 px-5 py-5">
      <span class="h-2 w-2 rotate-45 bg-accent-bright" aria-hidden="true" />
      <span class="text-ui-lg text-text font-serif font-600">specrun</span>
    </div>

    <ProjectSwitcher />

    <nav class="border-t border-line px-3 py-4 space-y-1">
      <!-- Changes 頁不在 nav 段（spec change-list）：位置指示由專案清單的資料夾 icon 兼任，
           所以高亮只可能落在 Specs／Archived，而且僅在主區真的停在該頁時才亮 -->
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

      <!-- 「Archived」而非「Archive」：這裡是一份已歸檔 change 的清單，不是一個動作 -->
      <button
        type="button"
        class="side-action"
        :class="view.currentView === 'archived'
          ? 'bg-accent/15 text-accent-bright hover:bg-accent/15 hover:text-accent-bright'
          : ''"
        :aria-current="view.currentView === 'archived' ? 'page' : undefined"
        @click="view.show('archived')"
      >
        <span class="i-lucide-archive h-4 w-4" aria-hidden="true" />
        Archived
      </button>
    </nav>

    <div class="mt-auto border-t border-line px-3 py-4">
      <!-- 覆蓋層而非頁：MUST NOT 掛當前頁高亮，開啟它也不動 nav 段既有的高亮（spec change-list） -->
      <button type="button" class="side-action" @click="settings.open()">
        <span class="i-lucide-settings h-4 w-4" aria-hidden="true" />
        Settings
      </button>
    </div>
  </aside>
</template>
