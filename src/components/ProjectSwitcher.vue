<script setup lang="ts">
import type { ProjectEntry } from '../api'
import { computed, nextTick, ref } from 'vue'
import { useProjectsStore } from '../stores/projects'
import { useViewStore } from '../stores/view'

/**
 * 側欄的專案清單：全展開直接點擊切換、hover ✕ 移除、
 * 貼在側欄底部的「＋ Add project」。清單超過門檻才折疊，current 永遠可見。
 */

/** 超過這個數量才折疊；side bar 高度容得下的量，數字純憑手感 */
const COLLAPSE_THRESHOLD = 12

const projects = useProjectsStore()
const view = useViewStore()

const showAll = ref(false)
/** 正在確認移除的專案路徑；同時只會有一個 */
const confirming = ref<string | null>(null)

const visible = computed<ProjectEntry[]>(() => {
  const all = projects.projects
  if (showAll.value || all.length <= COLLAPSE_THRESHOLD)
    return all

  const head = all.slice(0, COLLAPSE_THRESHOLD)
  if (head.some(each => each.current))
    return head

  // current 被折在門檻外時擠掉最後一項——切換入口不能是「先展開才找得到」
  const current = all.find(each => each.current)
  return current ? [...head.slice(0, COLLAPSE_THRESHOLD - 1), current] : head
})

const collapsible = computed(() => projects.projects.length > COLLAPSE_THRESHOLD)

const DRAG_THRESHOLD_PX = 5

const listRef = ref<HTMLElement | null>(null)

const sortablePaths = computed(() => projects.projects.filter(each => !each.temporary).map(each => each.path))

const canReorder = computed(() => !projects.busy && (showAll.value || !collapsible.value))

function reorderHint(project: ProjectEntry): string {
  return canReorder.value && !project.temporary
    ? `${project.path}\nAlt+↑ / Alt+↓ to reorder`
    : project.path
}

function moveTo(path: string, toIndex: number): void {
  const next = sortablePaths.value.filter(each => each !== path)
  next.splice(toIndex, 0, path)
  if (next.every((each, index) => each === sortablePaths.value[index]))
    return
  void projects.reorder(next)
}

function onProjectKeydown(event: KeyboardEvent, project: ProjectEntry): void {
  if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown'))
    return

  event.preventDefault()
  const from = sortablePaths.value.indexOf(project.path)
  if (!canReorder.value || from === -1)
    return

  const to = from + (event.key === 'ArrowUp' ? -1 : 1)
  if (to < 0 || to >= sortablePaths.value.length)
    return

  moveTo(project.path, to)
  // Vue 搬移有 key 的 DOM 節點時，瀏覽器可能讓 focus 掉到 body
  void nextTick(() => {
    const buttons = listRef.value?.querySelectorAll<HTMLElement>('button[data-project-path]') ?? []
    Array.from(buttons).find(each => each.dataset.projectPath === project.path)?.focus()
  })
}

interface DragRow { path: string, top: number, height: number }
interface DragState {
  pointerId: number
  startY: number
  active: boolean
  path: string
  rows: DragRow[]
  from: number
  offset: number
  to: number
  step: number
}

const drag = ref<DragState | null>(null)
const dragging = computed(() => drag.value?.active === true)
let swallowClick = false

function onItemPointerDown(event: PointerEvent, project: ProjectEntry): void {
  swallowClick = false
  if (event.button !== 0 || !canReorder.value || project.temporary || confirming.value === project.path)
    return
  if ((event.target as HTMLElement).closest('[data-remove]'))
    return

  drag.value = { pointerId: event.pointerId, startY: event.clientY, active: false, path: project.path, rows: [], from: -1, offset: 0, to: -1, step: 0 }
}

function measureRows(state: DragState): void {
  const items = Array.from(listRef.value?.querySelectorAll<HTMLElement>('li[data-project-path]') ?? [])
  state.rows = items
    .filter(each => sortablePaths.value.includes(each.dataset.projectPath ?? ''))
    .map((each) => {
      const rect = each.getBoundingClientRect()
      return { path: each.dataset.projectPath!, top: rect.top, height: rect.height }
    })
  state.from = state.rows.findIndex(each => each.path === state.path)
  const gap = state.rows.length > 1 ? state.rows[1].top - (state.rows[0].top + state.rows[0].height) : 0
  state.step = (state.rows[state.from]?.height ?? 0) + gap
  state.to = state.from
}

function rowOf(path: string): HTMLElement | undefined {
  const items = listRef.value?.querySelectorAll<HTMLElement>('li[data-project-path]') ?? []
  return Array.from(items).find(each => each.dataset.projectPath === path)
}

function onListPointerMove(event: PointerEvent): void {
  const state = drag.value
  if (!state || state.pointerId !== event.pointerId)
    return

  const dy = event.clientY - state.startY
  if (!state.active) {
    if (Math.abs(dy) < DRAG_THRESHOLD_PX)
      return
    measureRows(state)
    if (state.from === -1) {
      drag.value = null
      return
    }
    state.active = true
    // capture 讓指標移出列之後事件仍送到這裡；門檻內不 capture，click 才會送到按鈕
    rowOf(state.path)?.setPointerCapture?.(event.pointerId)
  }

  const self = state.rows[state.from]
  const first = state.rows[0]
  const last = state.rows[state.rows.length - 1]
  state.offset = Math.min(Math.max(dy, first.top - self.top), last.top + last.height - self.top - self.height)

  const center = self.top + self.height / 2 + state.offset
  state.to = state.rows.filter((each, index) => {
    const mid = each.top + each.height / 2
    return index < state.from ? mid < center : index > state.from && mid <= center
  }).length
}

function onListPointerUp(event: PointerEvent): void {
  const state = drag.value
  if (!state || state.pointerId !== event.pointerId)
    return

  drag.value = null
  rowOf(state.path)?.releasePointerCapture?.(event.pointerId)
  if (!state.active)
    return

  swallowClick = true
  moveTo(state.path, state.to)
}

function onListPointerCancel(event: PointerEvent): void {
  if (drag.value?.pointerId !== event.pointerId)
    return

  if (drag.value.active)
    swallowClick = true
  drag.value = null
}

function onListPointerLeave(): void {
  if (drag.value && !drag.value.active)
    drag.value = null
}

function onItemClickCapture(event: MouseEvent): void {
  if (!swallowClick)
    return
  swallowClick = false
  event.stopPropagation()
}

function rowStyle(path: string): { transform: string } | undefined {
  const state = drag.value
  if (!state?.active)
    return undefined

  const index = state.rows.findIndex(each => each.path === path)
  if (index === -1)
    return undefined
  if (index === state.from)
    return { transform: `translateY(${state.offset}px)` }
  if (index > state.from && index <= state.to)
    return { transform: `translateY(${-state.step}px)` }
  if (index < state.from && index >= state.to)
    return { transform: `translateY(${state.step}px)` }
  return undefined
}

/** 開 dialog 前先收掉開著的移除確認；分流與提示全在 store */
function startAdd(): void {
  confirming.value = null
  void projects.startAdd()
}

/**
 * 點專案項＝進入該專案的 Changes 主頁。換頁與換專案是
 * 兩件獨立的事：點目前專案時 `switchTo` 會早退，但頁還是要回主頁；已在主頁時兩者
 * 都不作用，所以「已在主頁點目前專案」自然是無反應。
 */
function openProject(path: string): void {
  view.show('changes')
  void projects.switchTo(path)
}

async function confirmRemove(path: string): Promise<void> {
  confirming.value = null
  await projects.remove(path)
}
</script>

<template>
  <!-- 佔滿品牌列與 Settings 之間：清單段自己捲，Add project 留在捲動範圍外、貼底 -->
  <div class="min-h-0 flex flex-1 flex-col border-t border-line">
    <!-- 清單長到擠壓側欄其他段時自己捲，不把 Add project／Settings 推出畫面 -->
    <nav class="min-h-0 overflow-y-auto px-3 pt-4" aria-label="Projects">
      <p class="px-2.5 text-ui-xs text-text-3 uppercase tracking-wider">
        Projects
      </p>

      <!-- 空清單：側欄只留一句與底下的 Add 入口，主區負責完整引導 -->
      <p v-if="projects.loaded && !projects.projects.length" class="mt-2 px-2.5 text-ui-sm text-text-3">
        No projects yet.
      </p>

      <ul
        ref="listRef"
        class="mt-2 space-y-1"
        :class="dragging ? 'cursor-grabbing select-none' : ''"
        @pointermove="onListPointerMove"
        @pointerup="onListPointerUp"
        @pointercancel="onListPointerCancel"
        @pointerleave="onListPointerLeave"
      >
        <li
          v-for="project in visible"
          :key="project.path"
          class="group relative"
          :class="dragging ? (drag?.path === project.path ? 'z-1' : 'reorder-shift') : ''"
          :style="rowStyle(project.path)"
          :data-project-path="project.path"
          @click.capture="onItemClickCapture"
          @pointerdown="onItemPointerDown($event, project)"
        >
          <!-- 移除確認就地取代該列：側欄 224px 放不下對話框，而且確認的對象就在這一行 -->
          <div
            v-if="confirming === project.path"
            class="border border-line rounded bg-surface-hover px-2.5 py-2"
          >
            <p class="text-ui-sm text-text-2 text-pretty">
              Remove <span class="text-text font-mono">{{ project.name }}</span> from this list? Nothing on disk is deleted.
            </p>
            <div class="mt-2 flex gap-1.5">
              <button type="button" class="btn-sm btn-danger flex-1" @click="confirmRemove(project.path)">
                Remove
              </button>
              <button type="button" class="btn-sm flex-1" @click="confirming = null">
                Cancel
              </button>
            </div>
          </div>

          <template v-else>
            <button
              type="button"
              class="project-item"
              :class="project.current
                ? 'bg-accent/15 text-accent-bright hover:bg-accent/15'
                : 'text-text-2 hover:text-text'"
              :aria-current="project.current ? 'true' : undefined"
              :disabled="projects.busy && !project.current"
              :title="reorderHint(project)"
              :data-project-path="project.path"
              @click="openProject(project.path)"
              @keydown="onProjectKeydown($event, project)"
            >
              <!-- 與 Specs／Archived 同尺寸的 icon，整排側欄文字才對得齊；current 換成
                 開著的資料夾，位置指示不必再靠一個獨立的小圓點 -->
              <span
                class="h-4 w-4 shrink-0"
                :class="project.current ? 'i-lucide-folder-open' : 'i-lucide-folder'"
                aria-hidden="true"
              />
              <span class="min-w-0 flex-1 truncate text-ui-base font-mono">{{ project.name }}</span>

              <!-- 暫時項（env／cwd 決定、未寫入設定）要看得出來，否則使用者會以為它已被記住。
                 與 badge 一起在 hover 時淡出，把右側讓給 ✕ -->
              <span
                v-if="project.temporary"
                class="shrink-0 text-ui-xs text-text-3 transition-opacity duration-150 ease-[var(--sr-ease-out)] group-hover:opacity-0"
                title="Not saved to your project list"
              >temp</span>

              <span
                v-if="project.badge !== null"
                class="shrink-0 rounded-full px-1.5 text-ui-xs font-mono tabular-nums transition-opacity duration-150 ease-[var(--sr-ease-out)] group-hover:opacity-0"
                :class="project.current ? 'bg-accent/25' : 'bg-line/60 text-text-3'"
              >{{ project.badge }}</span>

              <!-- 右側空無一物的專案照樣要預留 ✕ 的位置，否則只有它的名稱會被 ✕ 蓋掉尾巴——
                 遮擋只該發生在本來就被 badge 佔走的那一格 -->
              <span v-if="project.badge === null && !project.temporary" class="h-5 w-5 shrink-0" aria-hidden="true" />
            </button>

            <!-- 移除入口：hover 時就地取代右側的 temp／badge。不外擴點擊面積、也不撐寬，整顆
               落在 badge 原本佔的那一格內，長專案名不會因此被多遮一個字。right-2.5 是對齊
               project-item 的水平 padding——badge 走 flex 流、✕ 走絕對定位，右緣要自己對上。
               底色不透明是為了鍵盤 focus 這條路——那時列沒有 hover、下層 badge 還在，半透明
               會疊字。中性起手、滑上去才轉 error，銜接確認態的 btn-danger -->
            <button
              v-if="!dragging"
              type="button"
              data-remove
              class="absolute right-2.5 top-1/2 h-5 w-5 flex cursor-pointer items-center justify-center rounded bg-line text-text-2 opacity-0 transition-[opacity,color,background-color] duration-150 ease-[var(--sr-ease-out)] -translate-y-1/2 hover:bg-error/20 hover:text-error active:bg-error/30 group-hover:opacity-100 disabled:cursor-not-allowed focus-visible:opacity-100 kbd-focus"
              :disabled="projects.busy"
              :aria-label="`Remove ${project.name} from the list`"
              :title="`Remove ${project.name} from the list`"
              @click="confirming = project.path"
            >
              <span class="i-lucide-x h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </template>
        </li>
      </ul>

      <!-- 讀成清單的尾巴而不是另一個專案：小字、淡色、無 icon，pl-9 對齊專案名
         （project-item 的 px-2.5 ＋ icon 4 ＋ gap 2.5） -->
      <button
        v-if="collapsible"
        type="button"
        class="mt-0.5 cursor-pointer rounded py-1 pl-9 pr-2.5 text-ui-sm text-text-3 transition-colors duration-150 ease-[var(--sr-ease-out)] hover:text-text active:text-text-2 kbd-focus"
        @click="showAll = !showAll"
      >
        {{ showAll ? 'Show less' : `Show ${projects.projects.length - visible.length} more` }}
      </button>
    </nav>

    <!-- 虛線框標出「這是動作，不是清單裡的一項」；mt-auto 讓它不論清單長短都貼在 Settings 上方 -->
    <div class="mt-auto px-3 pb-3 pt-2">
      <button
        type="button"
        class="side-action border border-line border-dashed"
        :disabled="projects.busy || projects.picking"
        @click="startAdd()"
      >
        <span class="i-lucide-plus h-4 w-4" aria-hidden="true" />
        Add project
      </button>
    </div>
  </div>
</template>

<style scoped>
.reorder-shift {
  transition: transform 150ms var(--sr-ease-in-out);
}

@media (prefers-reduced-motion: reduce) {
  .reorder-shift {
    transition: none;
  }
}
</style>
