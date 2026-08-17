<script setup lang="ts">
import type { ChangeSummary, ParkedSummary } from '../api'
import { computed } from 'vue'
import { useChangesStore } from '../stores/changes'
import { useDetailStore } from '../stores/detail'
import { formatAbsoluteTime, formatRelativeTime } from '../utils/time'

const props = defineProps<{ change: ChangeSummary | ParkedSummary }>()

const changes = useChangesStore()
const detail = useDetailStore()

/** 兩種卡片共用同一個元件：`parkedAt` 的有無就是判別式（active 卡沒有這個欄位） */
const parked = computed(() => 'parkedAt' in props.change ? props.change : null)

const hasTasks = computed(() => props.change.totalTasks > 0)
const isComplete = computed(() => props.change.status === 'complete')
// 進度只用資料層給的數字：active 來自引擎，parked 來自現場解析（design D4）
const ratio = computed(() => hasTasks.value
  ? Math.min(1, Math.max(0, props.change.completedTasks / props.change.totalTasks))
  : 0)

/** active 卡＝最後修改時間；parked 卡＝停放時點，且可能不明（spec fallback） */
const timestamp = computed(() => parked.value ? parked.value.parkedAt : (props.change as ChangeSummary).lastModified)
const timeLabel = computed(() => {
  if (!parked.value)
    return formatRelativeTime(timestamp.value as number)
  return timestamp.value === null ? 'parked · time unknown' : `parked ${formatRelativeTime(timestamp.value)}`
})

const pending = computed(() => changes.parkPending === props.change.name)
// park 只有在專案有正常 .git 目錄時才成立；restore 是既有 parked 項目，永遠可做
const disabled = computed(() => pending.value || (!parked.value && !changes.parkAvailable))
const actionTitle = computed(() => {
  if (parked.value)
    return 'Restore to openspec/changes'
  if (changes.parkAvailable)
    return 'Park this change'
  return changes.parkReason === 'git-worktree'
    ? 'Parking is not supported in a git worktree'
    : 'Parking needs a git repository — this project has no .git directory'
})

/** 面板開啟中的那張卡：露出區裡要一眼看出「現在讀的是這個」 */
const current = computed(() => detail.changeName === props.change.name)

// 點當前卡片＝收合，點其他卡片＝面板原地換內容（不收合再重開）
function open(): void {
  if (current.value)
    detail.close()
  else
    detail.show(props.change.name, parked.value !== null)
}

function runAction(): void {
  if (disabled.value)
    return
  if (parked.value)
    changes.unpark(props.change.name)
  else
    changes.park(props.change.name)
}
</script>

<template>
  <!-- 卡片是詳情的入口；hover 抬升並浮現單一動作按鈕（Park／Restore，spec change-list）。
       role=button 而非 <button>：卡片內含 progressbar 等流內容，塞進 button 不合法。
       開啟中的那張改掛 accent 底、拿掉 card-lift——它已經是當前項，不再是入口 -->
  <article
    class="group cursor-pointer border border-line rounded px-4.5 py-4 transition-[transform,background-color] duration-150 ease-[var(--sr-ease-out)] kbd-focus"
    :class="current ? 'bg-accent/25 hover:bg-accent/35' : 'card-lift bg-surface'"
    role="button"
    tabindex="0"
    :aria-current="current ? 'true' : undefined"
    :aria-label="current ? `Collapse ${change.name}` : `Open ${change.name}`"
    @click="open()"
    @keydown.enter.prevent="open()"
    @keydown.space.prevent="open()"
  >
    <div class="h-7 flex items-center gap-3">
      <h3 class="truncate text-ui-title text-text font-mono" :title="change.name">
        {{ change.name }}
      </h3>

      <div class="ml-auto flex shrink-0 items-center gap-2">
        <span
          v-if="hasTasks"
          class="inline-flex items-center gap-1 text-ui-sm font-mono tabular-nums"
          :class="isComplete ? 'text-done' : 'text-text-2'"
        >
          <span v-if="isComplete" class="i-lucide-check h-3 w-3" />
          {{ change.completedTasks }}/{{ change.totalTasks }}
        </span>
        <span v-else class="text-ui-sm text-text-3">No tasks</span>

        <span class="text-text-3" aria-hidden="true">·</span>

        <time
          class="text-ui-sm"
          :class="parked ? 'text-parked' : 'text-text-2'"
          :datetime="typeof timestamp === 'number' ? new Date(timestamp).toISOString() : undefined"
          :title="typeof timestamp === 'number' ? formatAbsoluteTime(timestamp) : undefined"
        >
          {{ timeLabel }}
        </time>
      </div>

      <!-- 動作按鈕常駐佔位、只切透明度：hover 時整排數字不會被推著跑。
           .stop 是 spec 要求——按這顆不能順便把詳情打開 -->
      <button
        type="button"
        class="icon-btn ml-1 transition-opacity duration-150"
        :class="[
          // 透明度只由一個分支決定：與 opacity-0 對打的 utility 會依 CSS 順序勝出，
          // 導致「不能 park 的專案反而每張卡都常駐一顆按鈕」
          pending ? 'opacity-100' : 'opacity-0 focus-visible:opacity-100 group-hover:opacity-100',
          // 禁用走 aria-disabled 而非 disabled 屬性：原生 disabled 收不到 hover，
          // 「為什麼不能 park」的 tooltip 就永遠沒機會出現
          disabled ? 'cursor-not-allowed text-text-3 hover:bg-transparent hover:text-text-3' : '',
        ]"
        :aria-disabled="disabled"
        :aria-label="actionTitle"
        :title="actionTitle"
        @click.stop="runAction()"
        @keydown.stop
      >
        <span
          class="h-4 w-4"
          :class="pending
            ? 'i-lucide-loader-circle animate-spin'
            : (parked ? 'i-lucide-play' : 'i-lucide-pause')"
          aria-hidden="true"
        />
      </button>
    </div>

    <!-- Why 摘錄：抽不到就整塊不渲染、不留佔位——卡片高度因此不一致是規格接受的行為
         （spec change-list）。active 與 parked 共用這一段，兩側摘錄同源同規則 -->
    <p v-if="change.summary" class="mt-3 line-clamp-2 text-ui-sm text-text-3">
      {{ change.summary }}
    </p>

    <div
      class="mt-3 h-1.5 overflow-hidden rounded-full bg-bg"
      :role="hasTasks ? 'progressbar' : undefined"
      :aria-valuemin="hasTasks ? 0 : undefined"
      :aria-valuemax="hasTasks ? change.totalTasks : undefined"
      :aria-valuenow="hasTasks ? change.completedTasks : undefined"
      :aria-label="hasTasks ? `${change.completedTasks} of ${change.totalTasks} tasks complete` : undefined"
    >
      <!-- scaleX 而非 width：C3 watcher 進度補間時才有便宜的 GPU 動畫可用 -->
      <div
        class="h-full origin-left rounded-full transition-transform duration-300 ease-[var(--sr-ease-out)]"
        :class="isComplete ? 'bg-done' : 'bg-accent'"
        :style="{ transform: `scaleX(${ratio})` }"
      />
    </div>
  </article>
</template>
