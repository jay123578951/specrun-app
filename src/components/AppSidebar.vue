<script setup lang="ts">
import { useSettingsStore } from '../stores/settings'
import BrandMark from './BrandMark.vue'
import ProjectSwitcher from './ProjectSwitcher.vue'

const settings = useSettingsStore()
</script>

<template>
  <!-- 三段結構；專案清單段是可互動的多專案清單。
       頁入口整段已移除：Specs／Archived 在資料層是目前
       專案的產物，放在專案清單段之外會讀成跨專案的全域入口，頁切換改由主區麵包屑承擔。
       側欄自此只管專案與全域設定，因此不會有任何當前頁高亮；底部的分隔線承載的是
       「Settings 是覆蓋層入口，行為也不一樣」。
       品牌記號（BrandMark）取代原本的旋轉方塊（add-orb-logo），50px 高於 wordmark 的
       行盒，品牌列因此加高，其下整批下移——不是這裡另外調的 padding -->
  <aside class="flex flex-col overflow-hidden border-r border-line bg-surface">
    <div class="flex items-center gap-1.5 py-5 pl-4 pr-5">
      <BrandMark />
      <span class="text-ui-lg text-text font-serif font-600">specrun</span>
    </div>

    <ProjectSwitcher />

    <div class="mt-auto border-t border-line px-3 py-4">
      <!-- 覆蓋層而非頁：MUST NOT 掛當前頁高亮，開啟它也不改變主區當前頁 -->
      <button type="button" class="side-action" @click="settings.open()">
        <span class="i-lucide-settings h-4 w-4" aria-hidden="true" />
        Settings
      </button>
    </div>
  </aside>
</template>
