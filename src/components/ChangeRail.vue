<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useChangesStore } from '../stores/changes'
import { useDetailStore } from '../stores/detail'

/** 詳情模式下清單收合成的窄軌：只留名稱與進度，點擊或 ↑↓ 原地切換 change */

const changes = useChangesStore()
const detail = useDetailStore()

const nav = ref<HTMLElement>()

function ratio(completed: number, total: number): number {
  return total > 0 ? Math.min(1, Math.max(0, completed / total)) : 0
}

// 詳情模式下這是唯一的刷新入口，清單與開著的詳情一起重取（spec 允許的手動刷新路徑）
function refresh(): void {
  changes.load()
  detail.refresh()
}

const busy = computed(() => changes.busy || detail.refreshing)

function move(step: number): void {
  const names = changes.changes.map(change => change.name)
  const current = names.indexOf(detail.changeName ?? '')
  // 找不到當前項（剛被 archive）時從頭進入，而不是原地卡住
  const next = names[current === -1 ? 0 : Math.min(names.length - 1, Math.max(0, current + step))]
  if (next && next !== detail.changeName)
    detail.show(next)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.metaKey || event.ctrlKey || event.altKey)
    return
  const target = event.target as HTMLElement | null
  if (target?.isContentEditable || /^(?:INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? ''))
    return

  if (event.key === 'Escape') {
    event.preventDefault()
    detail.close()
    return
  }
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')
    return

  event.preventDefault()
  move(event.key === 'ArrowDown' ? 1 : -1)
}

// 鍵盤切到捲動範圍外的項目時把它帶進視野；點擊切換不需要（本來就看得到）
watch(() => detail.changeName, async () => {
  await nextTick()
  nav.value?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' })
})

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <aside class="min-w-0 flex flex-col overflow-hidden border-r border-line">
    <header class="h-14 flex shrink-0 items-center gap-2 px-3">
      <h2 class="truncate text-ui-xs text-text-3 tracking-wider uppercase">
        Active ({{ changes.activeCount }})
      </h2>

      <!-- 詳情模式下窄軌頂部是唯一還放得下 refresh 的位置（design 刻意留白處） -->
      <button
        type="button"
        class="icon-btn ml-auto"
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
    </header>

    <nav ref="nav" class="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5" aria-label="Changes">
      <button
        v-for="change in changes.changes"
        :key="change.name"
        type="button"
        class="rail-item"
        :class="change.name === detail.changeName ? 'bg-accent/25 hover:bg-accent/35' : ''"
        :aria-current="change.name === detail.changeName ? 'true' : undefined"
        @click="detail.show(change.name)"
      >
        <span
          class="w-full truncate text-mono-sm font-mono"
          :class="change.name === detail.changeName ? 'text-text' : 'text-text-2'"
          :title="change.name"
        >
          {{ change.name }}
        </span>

        <span class="w-full flex items-center gap-2">
          <span class="h-1 flex-1 overflow-hidden rounded-full bg-bg">
            <span
              class="block h-full origin-left rounded-full transition-transform duration-300 ease-[var(--sr-ease-out)]"
              :class="change.status === 'complete' ? 'bg-done' : 'bg-accent-bright'"
              :style="{ transform: `scaleX(${ratio(change.completedTasks, change.totalTasks)})` }"
            />
          </span>
          <span v-if="change.totalTasks > 0" class="shrink-0 text-mono-sm text-text-3 font-mono tabular-nums">
            {{ change.completedTasks }}/{{ change.totalTasks }}
          </span>
        </span>
      </button>
    </nav>
  </aside>
</template>
