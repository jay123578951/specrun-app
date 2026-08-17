<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useProjectsStore } from '../stores/projects'
import { useSpecsStore } from '../stores/specs'
import StateNotice from './StateNotice.vue'

/**
 * Specs 頁：capability 的純列表（design：不仿 ChangeCard——specs 沒有進度與時間語意）。
 * 進頁載入、離頁清空都綁在這個元件的生命週期上，所以「切頁即關、進頁重載」不需要
 * 額外的 watcher，也不會有跨專案的殘留資料。
 */

const specs = useSpecsStore()
const projects = useProjectsStore()

onMounted(() => {
  void specs.enter()
})

onUnmounted(() => {
  specs.reset()
})

/** 與 ChangeList 同一套分層：無專案是「還沒開始」，排在所有錯誤分支之前 */
const noProject = computed(() => projects.loaded && !projects.hasProject)
const showSkeleton = computed(() => specs.firstLoadPending && !noProject.value)
const notOpenSpecProject = computed(() => specs.listError?.kind === 'not-openspec-project')
const loadFailed = computed(() => specs.listError?.kind === 'call-failed')
const isEmpty = computed(() => !specs.listError && specs.count === 0)

function toggle(id: string): void {
  // 點當前列＝收合，點其他列＝面板原地換內容（沿用 ChangeCard 的語意）
  if (specs.openId === id)
    specs.close()
  else
    void specs.open(id)
}
</script>

<template>
  <!-- 面板開啟時清單留在原地不卸載，捲動位置自然保留 -->
  <main class="h-full overflow-y-auto px-8 py-7">
    <div class="mx-auto max-w-5xl">
      <!-- CLI 不可用是環境問題，不是這次載入的問題：常駐 banner，直到下次成功刷新 -->
      <div
        v-if="specs.cliUnavailable && !noProject"
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
            v-if="specs.listError?.detail"
            class="mt-1.5 truncate text-ui-sm text-text-3 font-mono"
            :title="specs.listError.detail"
          >
            {{ specs.listError.detail }}
          </p>
        </div>
      </div>

      <header v-if="!noProject" class="flex items-center justify-between gap-4">
        <h2 class="text-ui-xs text-text-3 uppercase tracking-wider">
          Specs<span v-if="!showSkeleton && !specs.listError"> ({{ specs.count }})</span>
        </h2>

        <button
          type="button"
          class="btn relative before:absolute before:inset-x-0 before:content-[''] before:-inset-y-1"
          :disabled="specs.busy"
          :aria-busy="specs.busy"
          @click="specs.load()"
        >
          <span
            class="i-lucide-refresh-cw h-4 w-4"
            :class="{ 'animate-spin': specs.busy }"
            aria-hidden="true"
          />
          Refresh
        </button>
      </header>

      <section class="mt-4 space-y-2">
        <StateNotice
          v-if="noProject"
          icon="i-lucide-folder-plus"
          title="No project yet"
          body="Add a folder that contains an openspec/ directory and its specs show up here."
        >
          <button type="button" class="btn" @click="projects.startAdd()">
            <span class="i-lucide-plus h-4 w-4" aria-hidden="true" />
            Add project
          </button>
        </StateNotice>

        <!-- 幾何與真實列逐項對齊（內距、1.6em 行盒），換成內容時零位移 -->
        <template v-else-if="showSkeleton">
          <div
            v-for="n in 4"
            :key="n"
            class="border border-line rounded bg-surface px-4.5 py-3"
            aria-hidden="true"
          >
            <div class="h-7 flex items-center gap-3">
              <div class="h-3.5 w-44 animate-pulse rounded-full bg-surface-hover" />
              <div class="ml-auto h-3 w-24 animate-pulse rounded-full bg-surface-hover" />
            </div>
          </div>
        </template>

        <StateNotice
          v-else-if="notOpenSpecProject"
          icon="i-lucide-folder-x"
          title="Not an OpenSpec project"
          body="specrun found no openspec/ directory at this path. The folder may have moved — switch to another project, or remove this one from the list."
          :detail="specs.targetPath"
        />

        <StateNotice
          v-else-if="loadFailed"
          icon="i-lucide-file-warning"
          tone="error"
          title="Could not load specs"
          body="The request did not complete, so this list may be missing. This is usually temporary."
          :detail="specs.listError?.detail"
        >
          <button type="button" class="btn" :disabled="specs.busy" @click="specs.load()">
            Try again
          </button>
        </StateNotice>

        <StateNotice
          v-else-if="isEmpty"
          icon="i-lucide-file-text"
          title="No specs yet"
          body="Capability specs live in openspec/specs/. Archive a change with the openspec CLI and they show up here."
        />

        <!-- 順序即 CLI 回傳順序，前端不重排（spec specs-view） -->
        <button
          v-for="spec in specs.specs"
          :key="spec.id"
          type="button"
          class="list-row"
          :class="specs.openId === spec.id ? 'bg-accent/25 hover:bg-accent/35' : 'card-lift bg-surface'"
          :aria-current="specs.openId === spec.id ? 'true' : undefined"
          :aria-label="specs.openId === spec.id ? `Collapse ${spec.id}` : `Open ${spec.id}`"
          @click="toggle(spec.id)"
        >
          <span class="h-7 min-w-0 flex flex-1 items-center truncate text-ui-title text-text font-mono" :title="spec.id">
            {{ spec.id }}
          </span>
          <span class="shrink-0 text-ui-sm text-text-3 tabular-nums">
            {{ spec.requirementCount }} {{ spec.requirementCount === 1 ? 'requirement' : 'requirements' }}
          </span>
        </button>
      </section>
    </div>
  </main>
</template>
