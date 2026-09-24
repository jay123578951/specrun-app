<script setup lang="ts">
import { computed } from 'vue'
import { splitRoadmapSections, stripInlineMarkup } from '../api/normalize-roadmap'
import { useRoadmapStore } from '../stores/roadmap'
import { splitInlineCode } from '../utils/inline-code'
import { formatCreatedAt, formatCreatedAtFull } from '../utils/time'
import CopyNameButton from './CopyNameButton.vue'
import MarkdownView from './MarkdownView.vue'
import PanelShell from './PanelShell.vue'

/**
 * 規劃檔的唯讀詳情：外殼走共用的 PanelShell，內容依序為導言、關係欄、拆分與進度、
 * 其餘段落（Requirement 開頭段重排、拆分與進度提前）。全文已在清單裡（design D1），
 * 這裡只做顯示時的切段與渲染，不另發請求。
 */

const roadmap = useRoadmapStore()

const sections = computed(() => splitRoadmapSections(roadmap.openItem?.body ?? ''))
const plainTitle = computed(() => stripInlineMarkup(roadmap.openItem?.title ?? ''))
const titleSegments = computed(() => splitInlineCode(roadmap.openItem?.title ?? ''))

/** `resolveRef` 是 store 固定的函式參照，這兩個選項物件只會算一次，不會每次重渲染都換新身分 */
const refOptions = computed(() => ({ resolveRef: roadmap.resolveRef }))
const splitOptions = computed(() => ({ resolveRef: roadmap.resolveRef, splitTable: true }))
</script>

<template>
  <PanelShell
    collapse-label="roadmap item"
    :identity-key="roadmap.openFileName ?? ''"
    content-key=""
    @collapse="roadmap.close()"
  >
    <template #actions>
      <!-- 不可互動：取不到（mtime 為 null）整個不渲染、不留佔位（Requirement 詳情 header） -->
      <time
        v-if="roadmap.openItem?.mtime !== null && roadmap.openItem?.mtime !== undefined"
        class="shrink-0 font-mono text-ui-xs tabular-nums text-text-3"
        :datetime="new Date(roadmap.openItem.mtime).toISOString()"
        :title="formatCreatedAtFull(roadmap.openItem.mtime)"
      >
        Updated {{ formatCreatedAt(roadmap.openItem.mtime) }}
      </time>
      <div class="flex shrink-0 items-center gap-2">
        <CopyNameButton v-if="roadmap.openItem" :name="plainTitle" label="title" />
        <button
          type="button"
          class="icon-btn"
          :disabled="roadmap.busy"
          :aria-busy="roadmap.busy"
          aria-label="Refresh roadmap"
          title="Refresh roadmap"
          @click="roadmap.load()"
        >
          <span
            class="i-lucide-refresh-cw h-4 w-4"
            :class="{ 'animate-spin': roadmap.busy }"
            aria-hidden="true"
          />
        </button>
      </div>
    </template>

    <template #header>
      <!-- 沒有 tabs，標題獨佔一列，字級與 SpecPanel 同構 -->
      <div class="flex items-center gap-3 pb-5 pt-4.5">
        <h2 class="min-w-0 truncate text-ui-lg text-text font-tc font-medium" :title="plainTitle">
          <template v-for="(seg, i) in titleSegments" :key="i">
            <code v-if="seg.code" class="rounded bg-code-bg px-[0.3em] text-[0.85em] text-code-text font-mono">{{ seg.text }}</code>
            <template v-else>
              {{ seg.text }}
            </template>
          </template>
        </h2>

        <!-- 依組別顯示狀態（Requirement 詳情 header）：Available 不顯示任何標記 -->
        <span
          v-if="roadmap.openItem?.group === 'in-progress' && roadmap.openItem.progress"
          class="shrink-0 inline-flex items-center gap-2 text-ui-sm text-text-3 tabular-nums"
        >
          <span class="h-1.5 w-24 overflow-hidden rounded-full bg-line">
            <span
              class="block h-full origin-left rounded-full bg-accent transition-transform duration-300 ease-[var(--sr-ease-out)]"
              :style="{ transform: `scaleX(${Math.min(1, Math.max(0, roadmap.openItem.progress.completed / roadmap.openItem.progress.total))})` }"
            />
          </span>
          {{ roadmap.openItem.progress.completed }}/{{ roadmap.openItem.progress.total }}
        </span>
        <span
          v-else-if="roadmap.openItem?.group === 'blocked'"
          class="shrink-0 whitespace-nowrap border border-parked/45 rounded-full px-2 py-0.5 text-ui-xs text-parked"
        >
          Blocked
        </span>
        <span
          v-else-if="roadmap.openItem?.group === 'other'"
          class="shrink-0 whitespace-nowrap border border-line rounded-full px-2 py-0.5 text-ui-xs text-text-3"
        >
          Other
        </span>
      </div>
    </template>

    <template v-if="roadmap.openItem">
      <MarkdownView v-if="sections.lead" class="md-lead" :source="sections.lead" :roadmap="refOptions" @ref="roadmap.handleRef($event)" />

      <div v-if="sections.relations.length" class="md-relations">
        <div v-for="(row, i) in sections.relations" :key="i" class="md-relation-row">
          <div class="md-relation-key">
            {{ row.label }}
          </div>
          <MarkdownView class="md-relation-value" :source="row.value" :roadmap="refOptions" @ref="roadmap.handleRef($event)" />
        </div>
      </div>

      <MarkdownView v-if="sections.split" :source="sections.split" :roadmap="splitOptions" @ref="roadmap.handleRef($event)" />
      <MarkdownView v-if="sections.rest" :source="sections.rest" :roadmap="refOptions" @ref="roadmap.handleRef($event)" />
    </template>
  </PanelShell>
</template>
