<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useDetailStore } from '../stores/detail'
import ArtifactSkeleton from './ArtifactSkeleton.vue'
import MarkdownView from './MarkdownView.vue'
import StateNotice from './StateNotice.vue'

/** 詳情內容面板：頭部＋artifact tabs＋Markdown 唯讀渲染 */

const detail = useDetailStore()

const scroller = ref<HTMLElement>()

/**
 * 勾選只在單檔 tasks tab 開放（design D6）：其他 artifact、多檔 tasks（非預設 schema）
 * 與 custom schema 的任何 tab 一律維持唯讀。
 */
const interactiveTasks = computed(() =>
  detail.currentArtifact?.id === 'tasks' && detail.currentArtifact.files.length === 1,
)

// 換 change 或換 tab 都是新內容，捲動位置從頭開始（沿用上一份的位置只會讀到半途）
watch(() => [detail.changeName, detail.currentTab], () => {
  if (scroller.value)
    scroller.value.scrollTop = 0
})
</script>

<template>
  <section class="min-w-0 flex flex-col overflow-hidden">
    <header class="shrink-0 border-b border-line px-8">
      <div class="h-14 flex items-center gap-3">
        <h2 class="truncate text-mono-base text-text font-mono" :title="detail.changeName ?? ''">
          {{ detail.changeName }}
        </h2>

        <!-- 背景重取失敗但畫面有內容：不換錯誤畫面，只在頭部留一個小記號（spec 詳情錯誤呈現） -->
        <span
          v-if="detail.staleWarning"
          class="shrink-0 flex items-center gap-1.5 text-ui-xs text-text-3"
          title="The last refresh did not complete. Showing the content loaded earlier."
        >
          <span class="i-lucide-cloud-off h-3 w-3" aria-hidden="true" />
          Not refreshed
        </span>

        <!-- ml-auto 之後是動作區：Open in editor 等按鈕 M3 才填，先只有關閉控制 -->
        <div class="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            class="icon-btn"
            aria-label="Close detail (Esc)"
            title="Close (Esc)"
            @click="detail.close()"
          >
            <span class="i-lucide-x h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <!-- tabs 完全依 CLI 回傳的 artifact 清單，名稱不寫死（custom schema 必須可用） -->
      <div v-if="detail.artifacts.length" role="tablist" class="-mb-px flex gap-1">
        <button
          v-for="artifact in detail.artifacts"
          :id="`tab-${artifact.id}`"
          :key="artifact.id"
          type="button"
          role="tab"
          class="tab-item"
          :class="artifact.id === detail.currentTab
            ? 'border-accent-bright text-text'
            : 'text-text-3'"
          :aria-selected="artifact.id === detail.currentTab"
          :aria-controls="`panel-${artifact.id}`"
          @click="detail.selectTab(artifact.id)"
        >
          {{ artifact.id }}
        </button>
      </div>
      <!-- 沒有 tabs（載入中／失敗）時撐住同高度，頭部不會先塌一截再彈回來 -->
      <div v-else class="h-10" aria-hidden="true" />
    </header>

    <div ref="scroller" class="min-h-0 flex-1 overflow-y-auto px-8 py-7">
      <!-- 主動刷新是「我要等新資料」的明示：清空面板、大膽用 skeleton 回饋 -->
      <ArtifactSkeleton v-if="detail.refreshing" />

      <!-- 冷路徑：不用 skeleton（design D8），只留一行安靜的提示，資料回來就換上 -->
      <p v-else-if="detail.loading" class="text-ui-sm text-text-3">
        Loading…
      </p>

      <StateNotice
        v-else-if="detail.error"
        icon="i-lucide-file-warning"
        tone="error"
        title="Could not load this change"
        body="Reading this change did not complete. It may have been archived or removed while open."
        :detail="detail.error.detail"
      >
        <button type="button" class="btn-quiet" @click="detail.load()">
          Try again
        </button>
      </StateNotice>

      <!-- 缺件不灰化、不當錯誤：文案與上面的失敗提示刻意分開 -->
      <StateNotice
        v-else-if="detail.currentArtifact?.missing"
        icon="i-lucide-file-plus-2"
        title="Not created yet"
        :body="`This change has no ${detail.currentArtifact.id} file yet. It shows up here once the openspec CLI writes it.`"
      />

      <div
        v-else-if="detail.currentArtifact"
        :id="`panel-${detail.currentArtifact.id}`"
        role="tabpanel"
        :aria-labelledby="`tab-${detail.currentArtifact.id}`"
        tabindex="0"
        class="kbd-focus"
      >
        <!-- 多檔 artifact（specs）串成一頁往下捲，各檔前掛檔名標頭 -->
        <article
          v-for="(file, index) in detail.currentArtifact.files"
          :key="file.path"
          :class="index > 0 ? 'mt-10 border-t border-line pt-8' : ''"
        >
          <h3
            v-if="detail.currentArtifact.files.length > 1"
            class="mb-4 truncate text-mono-sm text-text-3 font-mono"
            :title="file.path"
          >
            {{ file.path }}
          </h3>
          <MarkdownView
            :source="file.content"
            :interactive="interactiveTasks"
            :pending-lines="detail.pendingTaskLines"
            @toggle="detail.toggleTask($event)"
          />
        </article>
      </div>
    </div>
  </section>
</template>
