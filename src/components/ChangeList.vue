<script setup lang="ts">
import { computed, ref } from 'vue'
import { useChangesStore } from '../stores/changes'
import { useProjectsStore } from '../stores/projects'
import ChangeCard from './ChangeCard.vue'
import ChangeCardSkeleton from './ChangeCardSkeleton.vue'
import ParkedDropZone from './ParkedDropZone.vue'
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
const isEmpty = computed(() => !store.blockingError && store.activeCount === 0)

/**
 * 只要清單裡還有任何一張卡片，兩群組就都在——拖曳切換狀態需要恆常存在的落點，
 * 隱藏空群組會讓「第一次以拖曳 park」永無可能成立（spec 群組、排序與恆常呈現）。
 * 兩群組皆空是例外：沒有卡片可拖、落點無作用，滿版功能性 UI 只是新專案首屏的噪音（design D5）。
 * 載入中與錯誤分支不參與判斷——active 與 parked 兩路請求先後到齊，
 * 依半份資料決定群組是否顯示會讓 Parked 群組閃現一下。
 */
const showParked = computed(() =>
  !noProject.value && !showSkeleton.value && !store.blockingError
  && (store.parkedCount > 0 || store.activeCount > 0))

// 沒有 parked change 時提「從 Parked 拖回」是無效指引——那個群組當下根本不存在（design D5 連帶後果）
const emptyActiveBody = computed(() => store.parkedCount > 0
  ? 'Changes you create with the openspec CLI show up here. You can also drag one back from Parked.'
  : 'Changes you create with the openspec CLI show up here.')

/**
 * 拖曳工作階段：卡片負責跟隨指標，清單負責「這一趟要去哪裡」。
 * 群組只有兩個且群組內不重排，目的地在拿起的那一刻就唯一確定，不必等指標移入（design D2）。
 */
const dragging = ref<{ name: string, from: 'active' | 'parked' } | null>(null)
const dropTarget = computed(() => {
  if (!dragging.value)
    return null
  return dragging.value.from === 'active' ? 'parked' : 'active'
})
/** 有卡片的群組才掛群組標示；群組為空時改由它的空內容區塊自己表達，兩者互斥（design D4） */
const markActiveGroup = computed(() => dropTarget.value === 'active' && store.activeCount > 0)
const markParkedGroup = computed(() => dropTarget.value === 'parked' && store.parkedCount > 0)

/**
 * 群組標示用 outline 不用 border／padding：outline 不參與佈局，標示出現與消失都不推動任何卡片
 * （spec：標示不造成版面位移）。框線用 line 而非 accent——accent/25 已經是「詳情開啟中的那張卡」
 * 的既有語意，同時出現兩種 accent 底就分不清哪個是什麼（design D3）。
 */
const GROUP_MARK = 'rounded bg-accent/5 outline-1 outline-dashed outline-line outline-offset-8'

const activeZone = ref<HTMLElement | null>(null)
const parkedZone = ref<HTMLElement | null>(null)

function onDragStart(payload: { name: string, from: 'active' | 'parked' }): void {
  dragging.value = payload
}

/** 放手：只認目的地群組的範圍，其餘一律取消——不觸發操作、也不是錯誤（spec 拖曳取消與禁用） */
function onDragEnd(payload: { x: number, y: number } | null): void {
  const session = dragging.value
  dragging.value = null
  if (!session || !payload)
    return

  const target = session.from === 'active' ? 'parked' : 'active'
  const zone = target === 'active' ? activeZone.value : parkedZone.value
  if (!zone)
    return

  const rect = zone.getBoundingClientRect()
  const inside = payload.x >= rect.left && payload.x <= rect.right
    && payload.y >= rect.top && payload.y <= rect.bottom
  if (!inside)
    return

  // 搬移即既有的 park／unpark（含撞名、殘留等全部前置條件），拖曳只是另一個觸發途徑
  if (target === 'parked')
    store.park(session.name)
  else
    store.unpark(session.name)
}
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
            class="mt-1.5 truncate text-ui-sm text-text-3 font-mono"
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
          class="btn relative before:absolute before:inset-x-0 before:content-[''] before:-inset-y-1"
          :disabled="store.busy"
          :aria-busy="store.busy"
          @click="store.load()"
        >
          <span
            class="i-lucide-refresh-cw h-4 w-4"
            :class="{ 'animate-spin': store.busy }"
            aria-hidden="true"
          />
          Refresh
        </button>
      </header>

      <section
        ref="activeZone"
        class="mt-4 space-y-3 transition-[background-color] duration-150 ease-[var(--sr-ease-out)]"
        :class="markActiveGroup ? GROUP_MARK : ''"
      >
        <StateNotice
          v-if="noProject"
          icon="i-lucide-folder-plus"
          title="No project yet"
          body="Add a folder that contains an openspec/ directory and its changes show up here."
        >
          <button type="button" class="btn" @click="projects.startAdd()">
            <span class="i-lucide-plus h-4 w-4" aria-hidden="true" />
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
          <button type="button" class="btn" :disabled="store.busy" @click="store.load()">
            Try again
          </button>
        </StateNotice>

        <!-- 空群組作為落點時，標示由這個區塊自己的邊框與底色表達；外層不另加 outline（design D4） -->
        <StateNotice
          v-else-if="isEmpty"
          icon="i-lucide-inbox"
          title="No active changes"
          :body="emptyActiveBody"
          :target="dropTarget === 'active'"
        />

        <!-- 順序即 CLI 回傳順序（lastModified 新→舊），前端不重排 -->
        <TransitionGroup v-bind="GROUP_MOTION" tag="div" class="relative space-y-3">
          <ChangeCard
            v-for="change in store.visibleChanges"
            :key="change.name"
            :change="change"
            @drag-start="onDragStart"
            @drag-end="onDragEnd"
          />
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

        <div
          ref="parkedZone"
          class="mt-4 transition-[background-color] duration-150 ease-[var(--sr-ease-out)]"
          :class="markParkedGroup ? GROUP_MARK : ''"
        >
          <!-- 順序為 park 時間新→舊，資料層已排好（normalize-parked） -->
          <TransitionGroup v-bind="GROUP_MOTION" tag="div" class="relative space-y-3">
            <ChangeCard
              v-for="change in store.visibleParked"
              :key="change.name"
              :change="change"
              @drag-start="onDragStart"
              @drag-end="onDragEnd"
            />
          </TransitionGroup>

          <!-- 空群組的落點區塊：常駐低強度，成為目的地才提對比並改成放手語意（spec 空狀態） -->
          <ParkedDropZone v-if="store.parkedCount === 0" :target="dropTarget === 'parked'" />
        </div>
      </section>
    </div>
  </main>
</template>
