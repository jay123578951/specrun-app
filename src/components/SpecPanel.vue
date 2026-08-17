<script setup lang="ts">
import { ref, watch } from 'vue'
import { useSpecsStore } from '../stores/specs'
import ArtifactSkeleton from './ArtifactSkeleton.vue'
import MarkdownView from './MarkdownView.vue'
import StateNotice from './StateNotice.vue'

/**
 * spec 詳情面板：與 ArtifactPanel 同一副外殼（定位、底色、進出場動畫由 App.vue 給），
 * 但內容是單一 Markdown 全文——沒有 tabs、沒有可勾選的 tasks，所以刻意不去參數化
 * ArtifactPanel（design：rule of three，等 archive 頁落地再抽共用外殼）。
 */

const specs = useSpecsStore()

const scroller = ref<HTMLElement>()

// 換 spec 就是新內容，捲動位置從頭開始（沿用上一份的位置只會讀到半途）
watch(() => specs.openId, () => {
  if (scroller.value)
    scroller.value.scrollTop = 0
})
</script>

<template>
  <!-- 底色抬一階＋左緣一條線就是全部的層次：無陰影、無 backdrop，
       露出區的清單不變暗也不被攔截（沿用 artifact-view 的無遮罩語意） -->
  <section class="min-w-0 flex flex-col overflow-hidden border-l border-line bg-surface">
    <header class="shrink-0 border-b border-line px-8 pb-5 pt-4">
      <div class="flex items-center">
        <!-- 收合不是關閉：面板是滑回右邊，圖示用箭頭而非 ✕ -->
        <button
          type="button"
          class="icon-btn"
          aria-label="Collapse spec (Esc)"
          title="Collapse (Esc)"
          @click="specs.close()"
        >
          <span class="i-lucide-chevrons-right h-3.5 w-3.5" aria-hidden="true" />
        </button>

        <div class="ml-auto flex shrink-0 items-center gap-2">
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
              class="i-lucide-refresh-cw h-3.5 w-3.5"
              :class="{ 'animate-spin': specs.contentRefreshing }"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      <!-- 標題獨佔一列，與 ArtifactPanel 同字級；沒有 tabs 就不留 tabs 那一段高度 -->
      <div class="pt-4.5">
        <h2 class="truncate text-mono-lg text-text font-mono font-medium" :title="specs.openId ?? ''">
          {{ specs.openId }}
        </h2>
      </div>
    </header>

    <div ref="scroller" class="min-h-0 flex-1 overflow-y-auto px-8 py-7">
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
        <button type="button" class="btn-quiet" @click="specs.loadContent()">
          Try again
        </button>
      </StateNotice>

      <!-- 唯讀渲染規範沿用 artifact-view：同一個 MarkdownView，不開 interactive -->
      <MarkdownView v-else :source="specs.content" />
    </div>
  </section>
</template>
