<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useChangesStore } from '../stores/changes'
import { useDetailStore } from '../stores/detail'
import ArtifactSkeleton from './ArtifactSkeleton.vue'
import MarkdownView from './MarkdownView.vue'
import StateNotice from './StateNotice.vue'

/** 詳情內容面板：自右側滑入覆蓋清單，頭部＋artifact tabs＋Markdown 唯讀渲染 */

const changes = useChangesStore()
const detail = useDetailStore()

const scroller = ref<HTMLElement>()

// 面板覆蓋著清單自己的 Refresh，所以這顆把兩邊一起重取（沿用窄軌時代的語意）
function refresh(): void {
  changes.load()
  detail.refresh()
}

const busy = computed(() => changes.busy || detail.refreshing)

/**
 * 勾選只在單檔 tasks tab 開放（design D6）：其他 artifact、多檔 tasks（非預設 schema）
 * 與 custom schema 的任何 tab 一律維持唯讀。parked change 整份唯讀——渲染端把
 * checkbox 交回 markdown-it 的 disabled 預設（視覺與行為一次到位）。
 */
const interactiveTasks = computed(() =>
  !detail.isParked && detail.currentArtifact?.id === 'tasks' && detail.currentArtifact.files.length === 1,
)

// 換 change 或換 tab 都是新內容，捲動位置從頭開始（沿用上一份的位置只會讀到半途）
watch(() => [detail.changeName, detail.currentTab], () => {
  if (scroller.value)
    scroller.value.scrollTop = 0
})
</script>

<template>
  <!-- 底色抬一階＋左緣一條線就是全部的層次：無陰影、無 backdrop，
       露出區的清單不變暗也不被攔截（spec artifact-view 無遮罩） -->
  <section class="min-w-0 flex flex-col overflow-hidden border-l border-line bg-surface">
    <header class="shrink-0 border-b border-line px-8 pt-4">
      <!-- 控制列自成一條：標題放大後與 24.5px 的 icon-btn 並排會比例打架，
           所以按鈕收在上方兩端，標題獨佔下一列 -->
      <div class="flex items-center">
        <!-- 收合不是關閉：面板是滑回右邊，圖示用箭頭而非 ✕ -->
        <button
          type="button"
          class="icon-btn"
          aria-label="Collapse detail (Esc)"
          title="Collapse (Esc)"
          @click="detail.close()"
        >
          <span class="i-lucide-chevrons-right h-3.5 w-3.5" aria-hidden="true" />
        </button>

        <!-- ml-auto 之後是動作區：Open in editor 等按鈕 M3 才填，先只有 refresh -->
        <div class="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            class="icon-btn"
            :disabled="busy"
            :aria-busy="busy"
            aria-label="Refresh changes"
            title="Refresh changes"
            @click="refresh()"
          >
            <span
              class="i-lucide-refresh-cw h-3.5 w-3.5"
              :class="{ 'animate-spin': busy }"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      <!-- 上下留白刻意不對稱：tabs 自帶 h-10 的垂直置中（文字上方還有 ~7.5px），
           padding 抵掉那一段，標題到按鈕與標題到 tabs 的「看起來」才等距 -->
      <div class="flex items-center gap-3 pb-1.5 pt-4.5">
        <!-- font-medium 是 Plex Mono 目前載入的最重字重（400／500 兩檔，見 main.ts） -->
        <h2 class="truncate text-mono-lg text-text font-mono font-medium" :title="detail.changeName ?? ''">
          {{ detail.changeName }}
        </h2>

        <!-- 唯讀不是壞掉：講清楚「這是 parked 的樣貌」比讓人納悶 checkbox 為何點不動好 -->
        <span
          v-if="detail.isParked"
          class="shrink-0 flex items-center gap-1.5 rounded-full bg-parked/12 px-2 py-0.5 text-ui-xs text-parked"
        >
          <span class="i-lucide-pause h-3 w-3" aria-hidden="true" />
          Parked · read-only
        </span>

        <!-- 背景重取失敗但畫面有內容：不換錯誤畫面，只在頭部留一個小記號（spec 詳情錯誤呈現） -->
        <span
          v-if="detail.staleWarning"
          class="shrink-0 flex items-center gap-1.5 text-ui-xs text-text-3"
          title="The last refresh did not complete. Showing the content loaded earlier."
        >
          <span class="i-lucide-cloud-off h-3 w-3" aria-hidden="true" />
          Not refreshed
        </span>
      </div>

      <!-- tabs 完全依 CLI 回傳的 artifact 清單，名稱不寫死（custom schema 必須可用）。
           首個 tab 去掉左內距：文字與底線都對齊標題的左緣，不讓 px-3 把整排推歪 -->
      <div v-if="detail.artifacts.length" role="tablist" class="-mb-px flex gap-1">
        <button
          v-for="artifact in detail.artifacts"
          :id="`tab-${artifact.id}`"
          :key="artifact.id"
          type="button"
          role="tab"
          class="tab-item first:pl-0"
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
