<script setup lang="ts">
import { computed } from 'vue'
import { useChangesStore } from '../stores/changes'
import ChangeCard from './ChangeCard.vue'
import ChangeCardSkeleton from './ChangeCardSkeleton.vue'
import StateNotice from './StateNotice.vue'

const store = useChangesStore()

const showSkeleton = computed(() => store.firstLoadPending)
const notOpenSpecProject = computed(() => store.blockingError?.kind === 'not-openspec-project')
const loadFailed = computed(() => store.blockingError?.kind === 'call-failed')
const isEmpty = computed(() => !store.blockingError && store.changes.length === 0)
</script>

<template>
  <main class="overflow-y-auto px-8 py-7">
    <!-- 內容欄封頂 1024px：進度條是「一排掃過去」的總覽視圖，拉到 1200px+ 就讀不出比例了 -->
    <div class="mx-auto max-w-5xl">
      <!-- CLI 不可用是環境問題，不是這次載入的問題：常駐 banner，直到下次成功刷新 -->
      <div
        v-if="store.cliUnavailable"
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

      <header class="flex items-center justify-between gap-4">
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
        <template v-if="showSkeleton">
          <ChangeCardSkeleton v-for="n in 3" :key="n" />
        </template>

        <StateNotice
          v-else-if="notOpenSpecProject"
          icon="i-lucide-folder-x"
          title="Not an OpenSpec project"
          body="specrun found no openspec/ directory at this path. Point SPECRUN_PROJECT_PATH at a project root, then refresh."
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
        <ChangeCard v-for="change in store.changes" :key="change.name" :change="change" />
      </section>
    </div>
  </main>
</template>
