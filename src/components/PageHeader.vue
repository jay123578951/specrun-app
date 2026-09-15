<script setup lang="ts">
import type { AppView } from '../stores/view'
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useProjectsStore } from '../stores/projects'
import { useViewStore } from '../stores/view'

/**
 * 三頁共用的頁首：左側麵包屑「<專案名> / <當前頁 ▾>」，
 * 右側以 slot 收各頁自己的 Refresh。整行由這裡承擔而不只抽麵包屑本身——
 * 三頁的頁首結構必須一致，任一頁漏改就會出現兩種頁首。
 */

defineProps<{
  /** 掛在當前頁名後的項目數量；Changes 頁不傳（其數量由 Active／Parked 群組標題各自承擔） */
  count?: number
}>()

const projects = useProjectsStore()
const view = useViewStore()

/**
 * 下拉開合沿用既有的 overlay 配方（250／175ms、--sr-ease-out、scale 0.96→1），
 * 不新增曲線或時值。錨定在觸發項的左上角——它不是置中的 modal，origin 不留在 center。
 * `.sr-motion` 讓 reduced motion 降級成純淡入淡出（機制見 interactions.css）。
 */
const MENU_MOTION = {
  'enter-active-class': 'transition-[opacity,transform] duration-250 ease-[var(--sr-ease-out)] sr-motion',
  'enter-from-class': 'opacity-0 scale-96',
  'leave-active-class': 'transition-[opacity,transform] duration-175 ease-[var(--sr-ease-out)] sr-motion',
  'leave-to-class': 'opacity-0 scale-96',
} as const

/** 三頁齊列且順序固定：下拉回答的是「現在在哪」，不是「可以去哪」 */
const PAGES: { value: AppView, label: string }[] = [
  { value: 'changes', label: 'Changes' },
  { value: 'specs', label: 'Specs' },
  { value: 'archived', label: 'Archived' },
]

const root = ref<HTMLElement>()
const trigger = ref<HTMLButtonElement>()
const menu = ref<HTMLElement>()

/** 與三頁的 noProject 同一條判斷：專案清單取回來之前不算數，否則首幀會閃一下 */
const noProject = computed(() => projects.loaded && !projects.hasProject)
const currentLabel = computed(() =>
  PAGES.find(page => page.value === view.currentView)?.label ?? PAGES[0]!.label)

onMounted(async () => {
  // 上一頁的下拉把焦點交棒過來（見 select）：觸發項隨頁面元件重建，接力點只能在這裡
  if (!view.focusPageMenu)
    return
  view.focusPageMenu = false
  await nextTick()
  trigger.value?.focus()
})

onUnmounted(() => {
  detach()
  view.menuOpen = false
})

function toggle(): void {
  if (view.menuOpen)
    close()
  else
    void open()
}

async function open(): Promise<void> {
  view.menuOpen = true
  window.addEventListener('keydown', onKeydown)
  document.addEventListener('pointerdown', onPointerDown)
  await nextTick()
  // 初始焦點落在當前頁那一項：↑↓ 有起點，順帶再說一次「現在在哪」
  items()[PAGES.findIndex(page => page.value === view.currentView)]?.focus()
}

function close(): void {
  if (!view.menuOpen)
    return
  view.menuOpen = false
  detach()
  trigger.value?.focus()
}

function detach(): void {
  window.removeEventListener('keydown', onKeydown)
  document.removeEventListener('pointerdown', onPointerDown)
}

/** 選定當前頁只關下拉、不重新載入；`view.show()` 自己也會早退，這裡不重複判斷切頁效果 */
function select(target: AppView): void {
  const moving = target !== view.currentView
  // 換頁會把觸發項連同這個元件一起換掉，焦點交棒給新頁的那一顆（選定後 focus 交回觸發項）
  view.focusPageMenu = moving
  close()
  if (moving)
    view.show(target)
}

function items(): HTMLElement[] {
  return [...menu.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []]
}

/**
 * 下拉展開期間鍵盤歸它（清單與面板的方向鍵、Esc 讓位）——讓位本身由
 * `App.vue` 依 `view.menuOpen` 早退，形狀與 Settings 那一層相同。
 */
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')
    return

  event.preventDefault()
  const targets = items()
  if (!targets.length)
    return

  // 不環繞：與清單的 ↑↓ 同一種形狀（App.vue 的 move 也是夾在兩端）
  const at = targets.indexOf(document.activeElement as HTMLElement)
  const step = event.key === 'ArrowDown' ? 1 : -1
  targets[at === -1 ? 0 : Math.min(targets.length - 1, Math.max(0, at + step))]?.focus()
}

function onPointerDown(event: PointerEvent): void {
  if (!root.value?.contains(event.target as Node))
    close()
}
</script>

<template>
  <!-- 無目標專案時整條不呈現：該狀態下頁首其他控制項也都不在 -->
  <header v-if="!noProject" class="flex items-center justify-between gap-4">
    <div class="min-w-0 flex items-center gap-2">
      <!-- 專案段是純標籤：專案切換的唯一入口是側欄的專案清單 -->
      <template v-if="projects.currentProject">
        <span
          class="truncate text-ui-sm text-text-3 font-mono"
          :title="projects.currentProject.path"
        >{{ projects.currentProject.name }}</span>
        <span class="shrink-0 text-ui-sm text-text-3" aria-hidden="true">/</span>
      </template>

      <div ref="root" class="relative shrink-0">
        <button
          ref="trigger"
          type="button"
          class="crumb-page"
          aria-haspopup="menu"
          :aria-expanded="view.menuOpen"
          @click="toggle()"
        >
          {{ currentLabel }}<span v-if="count !== undefined" class="text-text-3"> ({{ count }})</span>
          <span class="i-lucide-chevron-down h-3.5 w-3.5 text-text-3" aria-hidden="true" />
        </button>

        <Transition v-bind="MENU_MOTION">
          <div
            v-if="view.menuOpen"
            ref="menu"
            role="menu"
            class="absolute left-0 top-full mt-1 min-w-36 origin-top-left border border-line rounded bg-surface p-1 shadow-[var(--sr-shadow-overlay)] z-menu"
          >
            <!-- 當前項的 accent 底沿用側欄 nav 段原本的高亮，語意直接延續過來 -->
            <button
              v-for="page in PAGES"
              :key="page.value"
              type="button"
              role="menuitem"
              class="menu-item"
              :class="page.value === view.currentView
                ? 'bg-accent/15 text-accent-bright hover:bg-accent/15 hover:text-accent-bright'
                : ''"
              :aria-current="page.value === view.currentView ? 'page' : undefined"
              @click="select(page.value)"
            >
              {{ page.label }}
            </button>
          </div>
        </Transition>
      </div>
    </div>

    <slot />
  </header>
</template>
