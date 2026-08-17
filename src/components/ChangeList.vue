<script setup lang="ts">
import { computed } from 'vue'
import { useChangesStore } from '../stores/changes'
import { useProjectsStore } from '../stores/projects'
import ChangeCard from './ChangeCard.vue'
import ChangeCardSkeleton from './ChangeCardSkeleton.vue'
import StateNotice from './StateNotice.vue'

const store = useChangesStore()
const projects = useProjectsStore()

/**
 * 群組內的進出場與重排（ui-motion：偶發操作＝標準動畫，目的是空間連續性——
 * 卡片從哪裡消失、在哪裡出現要看得見）。離場 150ms＝進場的 75%，離場改 absolute
 * 讓下面的卡片同時補位；`.sr-motion` 在 reduced motion 下只留淡入淡出。
 */
const GROUP_MOTION = {
  'enter-active-class': 'transition-[opacity,transform] duration-200 ease-[var(--sr-ease-out)] sr-motion',
  'enter-from-class': 'opacity-0 translate-y-2',
  'leave-active-class': 'absolute inset-x-0 transition-[opacity,transform] duration-150 ease-[var(--sr-ease-out)] sr-motion',
  'leave-to-class': 'opacity-0 translate-y-2',
  'move-class': 'transition-transform duration-250 ease-[var(--sr-ease-in-out)]',
} as const

/**
 * 無目標專案是「還沒開始」不是錯誤——排在所有錯誤分支之前，
 * 免得使用者第一次開 App 就先讀到一則 CLI 錯誤（spec 空清單引導）。
 * 清單取回來之前不算數，否則首幀會閃一下空狀態。
 */
const noProject = computed(() => projects.loaded && !projects.hasProject)
const showSkeleton = computed(() => store.firstLoadPending && !noProject.value)
const notOpenSpecProject = computed(() => store.blockingError?.kind === 'not-openspec-project')
const loadFailed = computed(() => store.blockingError?.kind === 'call-failed')
const isEmpty = computed(() => !store.blockingError && store.changes.length === 0)
// 沒有 parked change 就整段不存在——空群組標題只是一行沒有內容的噪音（spec 群組與排序）
const showParked = computed(() => !noProject.value && store.parkedCount > 0)
</script>

<template>
  <!-- 詳情開啟時清單留在原地不卸載，捲動位置自然保留（收合回來就在原處） -->
  <main class="h-full overflow-y-auto px-8 py-7">
    <!-- 內容欄封頂 1024px：進度條是「一排掃過去」的總覽視圖，拉到 1200px+ 就讀不出比例了 -->
    <div class="mx-auto max-w-5xl">
      <!-- CLI 不可用是環境問題，不是這次載入的問題：常駐 banner，直到下次成功刷新 -->
      <div
        v-if="store.cliUnavailable && !noProject"
        class="mb-6 flex items-start gap-3 border border-error/40 rounded bg-error/10 px-4 py-3"
      >
        <span class="i-lucide-unplug mt-0.5 h-4 w-4 shrink-0 text-error" aria-hidden="true" />
        <div class="min-w-0">
          <p class="text-ui-base text-text">
            openspec CLI not available
          </p>
          <p class="mt-0.5 text-ui-sm text-text-2 text-pretty">
            specrun could not run the openspec command. Make sure it is installed and reachable on PATH, then refresh.
          </p>
          <p
            v-if="store.blockingError?.detail"
            class="mt-1.5 truncate text-mono-sm text-text-3 font-mono"
            :title="store.blockingError.detail"
          >
            {{ store.blockingError.detail }}
          </p>
        </div>
      </div>

      <header v-if="!noProject" class="flex items-center justify-between gap-4">
        <h2 class="text-ui-xs text-text-3 uppercase tracking-wider">
          Active<span v-if="!showSkeleton && !store.blockingError"> ({{ store.activeCount }})</span>
        </h2>

        <button
          type="button"
          class="btn-quiet relative before:absolute before:inset-x-0 before:content-[''] before:-inset-y-1"
          :disabled="store.busy"
          :aria-busy="store.busy"
          @click="store.load()"
        >
          <span
            class="i-lucide-refresh-cw h-3.5 w-3.5"
            :class="{ 'animate-spin': store.busy }"
            aria-hidden="true"
          />
          Refresh
        </button>
      </header>

      <section class="mt-4 space-y-3">
        <StateNotice
          v-if="noProject"
          icon="i-lucide-folder-plus"
          title="No project yet"
          body="Add a folder that contains an openspec/ directory and its changes show up here."
        >
          <button type="button" class="btn-quiet" @click="projects.addFormOpen = true">
            <span class="i-lucide-plus h-3.5 w-3.5" aria-hidden="true" />
            Add project
          </button>
        </StateNotice>

        <template v-else-if="showSkeleton">
          <ChangeCardSkeleton v-for="n in 3" :key="n" />
        </template>

        <StateNotice
          v-else-if="notOpenSpecProject"
          icon="i-lucide-folder-x"
          title="Not an OpenSpec project"
          body="specrun found no openspec/ directory at this path. The folder may have moved — switch to another project, or remove this one from the list."
          :detail="store.targetPath"
        />

        <StateNotice
          v-else-if="loadFailed"
          icon="i-lucide-file-warning"
          tone="error"
          title="Could not load changes"
          body="The request did not complete, so this list may be missing. This is usually temporary."
          :detail="store.blockingError?.detail"
        >
          <button type="button" class="btn-quiet" :disabled="store.busy" @click="store.load()">
            Try again
          </button>
        </StateNotice>

        <StateNotice
          v-else-if="isEmpty"
          icon="i-lucide-inbox"
          title="No active changes"
          body="Changes you create with the openspec CLI show up here."
        />

        <!-- 順序即 CLI 回傳順序（lastModified 新→舊），前端不重排 -->
        <TransitionGroup v-bind="GROUP_MOTION" tag="div" class="relative space-y-3">
          <ChangeCard v-for="change in store.changes" :key="change.name" :change="change" />
        </TransitionGroup>
      </section>

      <!-- Parked 與 Active 同頁分群（docs/ui-structure-decisions.md）：park／unpark
           就是卡片在兩個群組之間搬家，兩邊用同一組進出場動畫才讀得出「它去了那裡」 -->
      <section v-if="showParked" class="mt-8">
        <header class="flex items-center">
          <h2 class="text-ui-xs text-text-3 uppercase tracking-wider">
            Parked ({{ store.parkedCount }})
          </h2>
        </header>

        <!-- 順序為 park 時間新→舊，資料層已排好（normalize-parked） -->
        <TransitionGroup v-bind="GROUP_MOTION" tag="div" class="relative mt-4 space-y-3">
          <ChangeCard v-for="change in store.parked" :key="change.name" :change="change" />
        </TransitionGroup>
      </section>
    </div>
  </main>
</template>
