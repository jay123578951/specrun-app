<script setup lang="ts">
import type { RoadmapGroup, RoadmapSummary } from '../api'
import { computed, onMounted, onUnmounted } from 'vue'
import { stripInlineMarkup } from '../api/normalize-roadmap'
import { useProjectsStore } from '../stores/projects'
import { useRoadmapStore } from '../stores/roadmap'
import { splitInlineCode } from '../utils/inline-code'
import { formatAbsoluteTime, formatRelativeTime } from '../utils/time'
import CopyNameButton from './CopyNameButton.vue'
import PageHeader from './PageHeader.vue'
import StateNotice from './StateNotice.vue'

/**
 * Roadmap 頁：規劃檔的分組清單。進頁載入、離頁清空都綁在這個元件的生命週期上，
 * 沿用 Archived／Specs 頁的既有形狀（design D6）。
 */

const roadmap = useRoadmapStore()
const projects = useProjectsStore()

onMounted(() => {
  void roadmap.enter()
})

onUnmounted(() => {
  roadmap.reset()
})

/** 與 Archived／Specs 同一套分層：無專案排在所有錯誤分支之前 */
const noProject = computed(() => projects.loaded && !projects.hasProject)
const showSkeleton = computed(() => roadmap.firstLoadPending && !noProject.value)
const notOpenSpecProject = computed(() => roadmap.listError?.kind === 'not-openspec-project')
const loadFailed = computed(() => roadmap.listError?.kind === 'call-failed')
/** 專案停用 roadmap：目錄不存在但 roadmap.off 存在；目錄存在時以目錄為準，不看這個分支（Requirement 空與錯誤狀態） */
const offOnly = computed(() => !roadmap.listError && !roadmap.dirExists && roadmap.offExists)
/** 沒有 roadmap：不含 offOnly 的另一種「數量為零」——沒有目錄也沒有 off，或目錄存在但沒有 .md 檔，兩者文案相同 */
const isEmpty = computed(() => !roadmap.listError && roadmap.count === 0 && !offOnly.value)
/** 數量掛在麵包屑上，出現條件沿用原頁標：載入中與錯誤時不報數字 */
const showCount = computed(() => !showSkeleton.value && !roadmap.listError)

const GROUPS: { key: RoadmapGroup, label: string }[] = [
  { key: 'in-progress', label: 'In progress' },
  { key: 'available', label: 'Available' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'other', label: 'Other' },
]

/** items 已是分組＋組內排序完成的最終順序（design D2），這裡只依固定組序切段落，不重排 */
const visibleGroups = computed(() => GROUPS
  .map(g => ({ ...g, items: roadmap.items.filter(item => item.group === g.key) }))
  .filter(g => g.items.length > 0))

function toggle(file: string): void {
  // 點當前卡＝收合，點其他卡＝面板原地換內容（沿用 ChangeCard／ArchivedView 的語意）
  if (roadmap.openFileName === file)
    roadmap.close()
  else
    roadmap.openFile(file)
}

/** 卡片標題與複製內容共用同一份去反引號純文字（Requirement 卡片的複製標題） */
function plainTitle(item: RoadmapSummary): string {
  return stripInlineMarkup(item.title)
}
</script>

<template>
  <!-- 面板開啟時清單留在原地不卸載，捲動位置自然保留 -->
  <main class="h-full overflow-y-auto px-8 py-7">
    <div class="mx-auto max-w-5xl">
      <PageHeader :count="showCount ? roadmap.count : undefined">
        <button
          type="button"
          class="btn relative before:absolute before:inset-x-0 before:content-[''] before:-inset-y-1"
          :disabled="roadmap.busy"
          :aria-busy="roadmap.busy"
          @click="roadmap.load()"
        >
          <span
            class="i-lucide-refresh-cw h-4 w-4"
            :class="{ 'animate-spin': roadmap.busy }"
            aria-hidden="true"
          />
          Refresh
        </button>
      </PageHeader>

      <section class="mt-4 space-y-2">
        <StateNotice
          v-if="noProject"
          icon="i-lucide-folder-plus"
          title="No project yet"
          body="Add a folder that contains an openspec/ directory and its roadmap shows up here."
        >
          <button type="button" class="btn" :disabled="projects.picking" @click="projects.startAdd()">
            <span class="i-lucide-plus h-4 w-4" aria-hidden="true" />
            Add project
          </button>
        </StateNotice>

        <!-- 幾何與真實卡片逐項對齊，換成內容時零位移 -->
        <template v-else-if="showSkeleton">
          <div
            v-for="n in 4"
            :key="n"
            class="border border-line rounded bg-surface px-4.5 py-3"
            aria-hidden="true"
          >
            <div class="h-7 flex items-center gap-3">
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
          :detail="roadmap.targetPath"
        />

        <StateNotice
          v-else-if="loadFailed"
          icon="i-lucide-file-warning"
          tone="error"
          title="Could not load the roadmap"
          body="Reading openspec/roadmap/ did not complete, so this list may be missing. This is usually temporary."
          :detail="roadmap.listError?.detail"
        >
          <button type="button" class="btn" :disabled="roadmap.busy" @click="roadmap.load()">
            Try again
          </button>
        </StateNotice>

        <StateNotice
          v-else-if="offOnly"
          icon="i-lucide-route-off"
          title="Roadmap is turned off for this project"
          body="This project has openspec/roadmap.off, so planning notes are not kept here."
        />

        <StateNotice
          v-else-if="isEmpty"
          icon="i-lucide-route"
          title="No roadmap yet"
          body="Planning notes live in openspec/roadmap/. They show up here once the folder has files."
        />
      </section>

      <!-- 其餘狀態分支成立時 roadmap.items 恆為空，visibleGroups 自然不產生內容，不必再疊一層條件 -->
      <div class="mt-4 space-y-6">
        <section v-for="group in visibleGroups" :key="group.key">
          <header class="flex items-center">
            <h2 class="text-ui-xs text-text-3 uppercase tracking-wider">
              {{ group.label }} ({{ group.items.length }})
            </h2>
          </header>

          <div class="mt-4 space-y-2">
            <article
              v-for="item in group.items"
              :key="item.file"
              class="group relative border border-line rounded px-4.5 py-3 transition-[transform,background-color] duration-150 ease-[var(--sr-ease-out)] kbd-focus"
              :class="roadmap.openFileName === item.file ? 'bg-accent/25 hover:bg-accent/35' : 'card-lift bg-surface'"
              role="button"
              tabindex="0"
              :aria-current="roadmap.openFileName === item.file ? 'true' : undefined"
              :aria-label="roadmap.openFileName === item.file ? `Collapse ${plainTitle(item)}` : `Open ${plainTitle(item)}`"
              @click="toggle(item.file)"
              @keydown.enter.prevent="toggle(item.file)"
              @keydown.space.prevent="toggle(item.file)"
            >
              <div class="h-7 flex items-center gap-3">
                <h3 class="min-w-0 flex-1 truncate text-ui-title text-text font-tc" :title="plainTitle(item)">
                  <template v-for="(seg, i) in splitInlineCode(item.title)" :key="i">
                    <code v-if="seg.code" class="rounded bg-code-bg px-[0.3em] text-[0.85em] text-code-text font-mono">{{ seg.text }}</code>
                    <template v-else>
                      {{ seg.text }}
                    </template>
                  </template>
                </h3>

                <!-- hover 才浮現，語意與 ChangeCard 的 CopyNameButton 同構（Requirement 卡片的複製標題） -->
                <CopyNameButton
                  :name="plainTitle(item)"
                  label="title"
                  class="ml-0.5 shrink-0 opacity-0 transition-[opacity,background-color,color] duration-150 ease-[var(--sr-ease-out)] hover:bg-line/70 active:bg-line focus-visible:opacity-100 group-hover:opacity-100"
                  @keydown.stop
                />

                <div class="ml-auto flex shrink-0 items-center gap-3">
                  <span
                    v-if="item.partOf"
                    class="whitespace-nowrap border border-line rounded-full px-2 py-0.5 text-ui-xs text-text-2"
                  >
                    part of <template v-for="(seg, i) in splitInlineCode(item.partOf)" :key="i">
                      <code v-if="seg.code" class="font-mono">{{ seg.text }}</code>
                      <template v-else>
                        {{ seg.text }}
                      </template>
                    </template>
                  </span>

                  <span
                    v-if="group.key === 'in-progress' && item.progress"
                    class="inline-flex items-center gap-2 text-ui-sm text-text-3 tabular-nums"
                  >
                    <span class="h-1.5 w-24 overflow-hidden rounded-full bg-line">
                      <span
                        class="block h-full origin-left rounded-full bg-accent transition-transform duration-300 ease-[var(--sr-ease-out)]"
                        :style="{ transform: `scaleX(${Math.min(1, Math.max(0, item.progress.completed / item.progress.total))})` }"
                      />
                    </span>
                    {{ item.progress.completed }}/{{ item.progress.total }}
                  </span>
                  <span
                    v-else-if="group.key === 'blocked'"
                    class="whitespace-nowrap border border-parked/45 rounded-full px-2 py-0.5 text-ui-xs text-parked"
                  >
                    Blocked
                  </span>

                  <time
                    v-if="item.mtime !== null"
                    class="whitespace-nowrap text-ui-sm text-text-2 tabular-nums"
                    :datetime="new Date(item.mtime).toISOString()"
                    :title="formatAbsoluteTime(item.mtime)"
                  >
                    {{ formatRelativeTime(item.mtime) }}
                  </time>
                </div>
              </div>

              <p v-if="group.key === 'in-progress' && item.next" class="mt-0.5 truncate text-ui-sm text-text-3">
                Next: <span class="text-text-2">{{ item.next }}</span>
              </p>
              <p v-else-if="group.key === 'blocked' && item.needs" class="mt-0.5 truncate text-ui-sm text-text-3">
                Needs: <span class="text-text-2">{{ item.needs }}</span>
              </p>
            </article>
          </div>
        </section>
      </div>
    </div>
  </main>
</template>
