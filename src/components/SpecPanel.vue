<script setup lang="ts">
import { useSpecsStore } from '../stores/specs'
import ArtifactSkeleton from './ArtifactSkeleton.vue'
import MarkdownView from './MarkdownView.vue'
import PanelShell from './PanelShell.vue'
import StateNotice from './StateNotice.vue'

/**
 * spec 詳情面板：外殼走共用的 PanelShell，內容是單一 Markdown 全文
 * ——沒有 tabs、沒有可勾選的 tasks，那些差異留在這裡而不是塞進外殼參數。
 */

const specs = useSpecsStore()
</script>

<template>
  <PanelShell
    collapse-label="spec"
    :scroll-key="specs.openId ?? ''"
    @collapse="specs.close()"
  >
    <template #actions>
      <button
        type="button"
        class="icon-btn"
        :disabled="specs.contentRefreshing"
        :aria-busy="specs.contentRefreshing"
        aria-label="Refresh spec"
        title="Refresh spec"
        @click="specs.refreshContent()"
      >
        <span
          class="i-lucide-refresh-cw h-4 w-4"
          :class="{ 'animate-spin': specs.contentRefreshing }"
          aria-hidden="true"
        />
      </button>
    </template>

    <!-- 標題獨佔一列，與 ArtifactPanel 同字級；沒有 tabs 就不留 tabs 那一段高度 -->
    <template #header>
      <div class="pb-5 pt-4.5">
        <h2 class="truncate text-ui-lg text-text font-mono font-medium" :title="specs.openId ?? ''">
          {{ specs.openId }}
        </h2>
      </div>
    </template>

    <!-- 主動刷新是「我要等新資料」的明示：清空面板、大膽用 skeleton 回饋 -->
    <ArtifactSkeleton v-if="specs.contentRefreshing" />

    <!-- 冷路徑：不用 skeleton，只留一行安靜的提示，資料回來就換上 -->
    <p v-else-if="specs.loading" class="text-ui-sm text-text-3">
      Loading…
    </p>

    <StateNotice
      v-else-if="specs.contentError"
      icon="i-lucide-file-warning"
      tone="error"
      title="Could not load this spec"
      body="Reading this spec did not complete. It may have been renamed or removed while open."
      :detail="specs.contentError.detail"
    >
      <button type="button" class="btn" @click="specs.loadContent()">
        Try again
      </button>
    </StateNotice>

    <!-- 唯讀渲染規範沿用 artifact-view：同一個 MarkdownView，不開 interactive -->
    <MarkdownView v-else :source="specs.content" />
  </PanelShell>
</template>
