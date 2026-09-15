<script setup lang="ts">
import { computed } from 'vue'
import { useArchivedStore } from '../stores/archived'
import ArtifactSkeleton from './ArtifactSkeleton.vue'
import ArtifactTabs from './ArtifactTabs.vue'
import MarkdownView from './MarkdownView.vue'
import PanelShell from './PanelShell.vue'
import StateNotice from './StateNotice.vue'

/**
 * archived change 的唯讀詳情：外殼走共用的 PanelShell，內容是現場列舉的 tabs
 * （頂層 artifact ＋ delta spec）。
 *
 * 唯讀是雙防線：這裡的 MarkdownView 一律不開 interactive，
 * 加上 archived store 根本沒有寫入面——checkbox 點了不會有任何事發生。
 */

const archived = useArchivedStore()

/** 詳情讀成功卻一個檔案都沒有：目錄空了不是錯誤，但也不能靜默留白 */
const noFiles = computed(() =>
  !archived.loading && !archived.contentError && archived.artifacts.length === 0,
)
</script>

<template>
  <PanelShell
    collapse-label="archived change"
    :identity-key="archived.openDir ?? ''"
    :content-key="archived.currentTab ?? ''"
    @collapse="archived.close()"
  >
    <template #actions>
      <button
        type="button"
        class="icon-btn"
        :disabled="archived.contentRefreshing"
        :aria-busy="archived.contentRefreshing"
        aria-label="Refresh archived change"
        title="Refresh archived change"
        @click="archived.refreshContent()"
      >
        <span
          class="i-lucide-refresh-cw h-4 w-4"
          :class="{ 'animate-spin': archived.contentRefreshing }"
          aria-hidden="true"
        />
      </button>
    </template>

    <template #header>
      <!-- 上下留白與 ArtifactPanel 的頭部同構，pb 必須同值（抵消 h-12 tabs 自帶的 ~10.6px 上方空白） -->
      <div class="flex items-center gap-3 pb-[2px] pt-4.5">
        <h2 class="truncate text-ui-lg text-text font-mono font-medium" :title="archived.openDir ?? ''">
          {{ archived.openName }}
        </h2>

        <!-- 唯讀不是壞掉：講清楚「這是歸檔後的樣貌」比讓人納悶 checkbox 為何點不動好 -->
        <span
          class="shrink-0 flex items-center gap-1.5 rounded-full bg-surface-hover px-2 py-0.5 text-ui-xs text-text-2"
        >
          <span class="i-lucide-archive h-3 w-3" aria-hidden="true" />
          Archived · read-only
        </span>
      </div>

      <!-- tabs 是現場列舉的結果（proposal → design → delta specs → tasks → 其他）。
           標記與選中指示與 change 詳情面板共用同一份 ArtifactTabs，行為不會兩處分歧 -->
      <ArtifactTabs
        v-if="archived.artifacts.length"
        :items="archived.artifacts"
        :current="archived.currentTab"
        :identity="archived.openDir"
        id-prefix="archived-"
        @select="archived.selectTab($event)"
      />
      <!-- 沒有 tabs（載入中／失敗）時撐住同高度，頭部不會先塌一截再彈回來 -->
      <div v-else class="h-12" aria-hidden="true" />
    </template>

    <!-- 主動刷新是「我要等新資料」的明示：清空面板、大膽用 skeleton 回饋 -->
    <ArtifactSkeleton v-if="archived.contentRefreshing" />

    <!-- 冷路徑：不用 skeleton，只留一行安靜的提示，資料回來就換上 -->
    <p v-else-if="archived.loading" class="text-ui-sm text-text-3">
      Loading…
    </p>

    <StateNotice
      v-else-if="archived.contentError"
      icon="i-lucide-file-warning"
      tone="error"
      title="Could not load this archived change"
      body="Reading this archived change did not complete. It may have been renamed or removed while open."
      :detail="archived.contentError.detail"
    >
      <button type="button" class="btn" @click="archived.loadContent()">
        Try again
      </button>
    </StateNotice>

    <StateNotice
      v-else-if="noFiles"
      icon="i-lucide-file-plus-2"
      title="No files here"
      body="This archived change has no Markdown files left in its folder."
    />

    <div
      v-else-if="archived.currentArtifact"
      :id="`archived-panel-${archived.currentArtifact.id}`"
      role="tabpanel"
      :aria-labelledby="`archived-tab-${archived.currentArtifact.id}`"
      tabindex="0"
      class="kbd-focus"
    >
      <!-- 唯讀渲染：同一個 MarkdownView，不開 interactive -->
      <MarkdownView
        v-for="file in archived.currentArtifact.files"
        :key="file.path"
        :source="file.content"
      />
    </div>
  </PanelShell>
</template>
