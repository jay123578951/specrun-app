<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useArchivedStore } from '../stores/archived'
import { useProjectsStore } from '../stores/projects'
import StateNotice from './StateNotice.vue'

/**
 * Archived 頁：已歸檔 change 的回顧清單（design D3）。
 * 進頁載入、離頁清空都綁在這個元件的生命週期上，所以「切頁即關、進頁重載」不需要
 * 額外的 watcher（archive 目錄也不進 watcher 的監看範圍）。
 */

const archived = useArchivedStore()
const projects = useProjectsStore()

onMounted(() => {
  void archived.enter()
})

onUnmounted(() => {
  archived.reset()
})

/** 與 ChangeList／SpecsView 同一套分層：無專案是「還沒開始」，排在所有錯誤分支之前 */
const noProject = computed(() => projects.loaded && !projects.hasProject)
const showSkeleton = computed(() => archived.firstLoadPending && !noProject.value)
const notOpenSpecProject = computed(() => archived.listError?.kind === 'not-openspec-project')
const loadFailed = computed(() => archived.listError?.kind === 'call-failed')
const isEmpty = computed(() => !archived.listError && archived.count === 0)

function toggle(dir: string): void {
  // 點當前列＝收合，點其他列＝面板原地換內容（沿用 ChangeCard 的語意）
  if (archived.openDir === dir)
    archived.close()
  else
    void archived.open(dir)
}

/** 歸檔時沒做完是回顧時的異常訊號，講出數字比只給顏色可靠（spec 未完成即醒目） */
function progressTitle(completed: number, total: number): string {
  return completed >= total
    ? `All ${total} tasks were complete when archived`
    : `${completed} of ${total} tasks were complete when archived`
}
</script>

<template>
  <!-- 面板開啟時清單留在原地不卸載，捲動位置自然保留 -->
  <main class="h-full overflow-y-auto px-8 py-7">
    <div class="mx-auto max-w-5xl">
      <header v-if="!noProject" class="flex items-center justify-between gap-4">
        <h2 class="text-ui-xs text-text-3 uppercase tracking-wider">
          Archived<span v-if="!showSkeleton && !archived.listError"> ({{ archived.count }})</span>
        </h2>

        <button
          type="button"
          class="btn-quiet relative before:absolute before:inset-x-0 before:content-[''] before:-inset-y-1"
          :disabled="archived.busy"
          :aria-busy="archived.busy"
          @click="archived.load()"
        >
          <span
            class="i-lucide-refresh-cw h-3.5 w-3.5"
            :class="{ 'animate-spin': archived.busy }"
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
          body="Add a folder that contains an openspec/ directory and its archived changes show up here."
        >
          <button type="button" class="btn-quiet" @click="projects.startAdd()">
            <span class="i-lucide-plus h-3.5 w-3.5" aria-hidden="true" />
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
            <div class="h-[1.6em] flex items-center gap-3 text-mono-base">
              <div class="h-3.5 w-52 animate-pulse rounded-full bg-surface-hover" />
              <div class="ml-auto h-3 w-20 animate-pulse rounded-full bg-surface-hover" />
            </div>
          </div>
        </template>

        <StateNotice
          v-else-if="notOpenSpecProject"
          icon="i-lucide-folder-x"
          title="Not an OpenSpec project"
          body="specrun found no openspec/ directory at this path. The folder may have moved — switch to another project, or remove this one from the list."
          :detail="archived.targetPath"
        />

        <StateNotice
          v-else-if="loadFailed"
          icon="i-lucide-file-warning"
          tone="error"
          title="Could not load archived changes"
          body="Reading openspec/changes/archive/ did not complete, so this list may be missing. This is usually temporary."
          :detail="archived.listError?.detail"
        >
          <button type="button" class="btn-quiet" :disabled="archived.busy" @click="archived.load()">
            Try again
          </button>
        </StateNotice>

        <StateNotice
          v-else-if="isEmpty"
          icon="i-lucide-archive"
          title="Nothing archived yet"
          body="Changes you archive with the openspec CLI move to openspec/changes/archive/ and show up here."
        />

        <!-- 順序為歸檔日期新→舊，資料層已排好（normalize-archived）；UI 不提供排序切換 -->
        <button
          v-for="item in archived.items"
          :key="item.dir"
          type="button"
          class="list-row"
          :class="archived.openDir === item.dir ? 'bg-accent/25 hover:bg-accent/35' : 'card-lift bg-surface'"
          :aria-current="archived.openDir === item.dir ? 'true' : undefined"
          :aria-label="archived.openDir === item.dir ? `Collapse ${item.name}` : `Open ${item.name}`"
          @click="toggle(item.dir)"
        >
          <span
            class="h-[1.6em] min-w-0 flex flex-1 items-center truncate text-mono-base text-text font-mono"
            :title="item.name"
          >
            {{ item.name }}
          </span>

          <div class="h-[1.6em] shrink-0 flex items-center gap-2">
            <!-- 全完成淡化、未完成醒目：歸檔時沒做完值得一眼看到，所以那一種才給暖色 chip -->
            <span
              v-if="item.totalTasks > 0"
              class="inline-flex items-center gap-1 text-mono-sm font-mono tabular-nums"
              :class="item.status === 'complete'
                ? 'text-text-3'
                : 'rounded-full bg-parked/12 px-2 py-0.5 text-parked'"
              :title="progressTitle(item.completedTasks, item.totalTasks)"
            >
              <span v-if="item.status === 'complete'" class="i-lucide-check h-3 w-3" aria-hidden="true" />
              {{ item.completedTasks }}/{{ item.totalTasks }}
            </span>

            <span
              v-if="item.totalTasks > 0 && item.archivedAt"
              class="text-text-3"
              aria-hidden="true"
            >·</span>

            <!-- 目錄名前綴解析不到就整欄不出現，不編佔位日期（spec 目錄名無日期前綴） -->
            <time
              v-if="item.archivedAt"
              class="text-ui-sm text-text-2 tabular-nums"
              :datetime="item.archivedAt"
            >
              {{ item.archivedAt }}
            </time>
          </div>
        </button>
      </section>
    </div>
  </main>
</template>
