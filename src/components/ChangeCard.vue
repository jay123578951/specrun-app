<script setup lang="ts">
import type { ChangeSummary } from '../api'
import { computed } from 'vue'
import { formatAbsoluteTime, formatRelativeTime } from '../utils/time'

const props = defineProps<{ change: ChangeSummary }>()

const hasTasks = computed(() => props.change.totalTasks > 0)
const isComplete = computed(() => props.change.status === 'complete')
// 進度只用引擎給的數字，App 不自己讀 tasks 檔（spec openspec-gateway）
const ratio = computed(() => hasTasks.value
  ? Math.min(1, Math.max(0, props.change.completedTasks / props.change.totalTasks))
  : 0)
</script>

<template>
  <!-- C1 的卡片是純展示：不可點、無 hover 動作，hover 只給視覺抬升（spec change-list） -->
  <article class="card-lift border border-line rounded bg-surface px-4.5 py-4 transition-[transform,background-color] duration-150 ease-[var(--sr-ease-out)]">
    <div class="h-[1.6em] flex items-center gap-3 text-mono-base">
      <h3 class="truncate text-text font-mono" :title="change.name">
        {{ change.name }}
      </h3>

      <div class="ml-auto flex shrink-0 items-center gap-2">
        <span
          v-if="hasTasks"
          class="inline-flex items-center gap-1 text-mono-sm font-mono tabular-nums"
          :class="isComplete ? 'text-done' : 'text-text-2'"
        >
          <span v-if="isComplete" class="i-lucide-check h-3 w-3" />
          {{ change.completedTasks }}/{{ change.totalTasks }}
        </span>
        <span v-else class="text-ui-sm text-text-3">No tasks</span>

        <span class="text-text-3" aria-hidden="true">·</span>

        <time
          class="text-ui-sm text-text-2"
          :datetime="new Date(change.lastModified).toISOString()"
          :title="formatAbsoluteTime(change.lastModified)"
        >
          {{ formatRelativeTime(change.lastModified) }}
        </time>
      </div>
    </div>

    <div
      class="mt-3 h-1.5 overflow-hidden rounded-full bg-bg"
      :role="hasTasks ? 'progressbar' : undefined"
      :aria-valuemin="hasTasks ? 0 : undefined"
      :aria-valuemax="hasTasks ? change.totalTasks : undefined"
      :aria-valuenow="hasTasks ? change.completedTasks : undefined"
      :aria-label="hasTasks ? `${change.completedTasks} of ${change.totalTasks} tasks complete` : undefined"
    >
      <!-- scaleX 而非 width：C3 watcher 進度補間時才有便宜的 GPU 動畫可用 -->
      <div
        class="h-full origin-left rounded-full transition-transform duration-300 ease-[var(--sr-ease-out)]"
        :class="isComplete ? 'bg-done' : 'bg-accent'"
        :style="{ transform: `scaleX(${ratio})` }"
      />
    </div>
  </article>
</template>
