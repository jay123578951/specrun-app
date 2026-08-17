<script setup lang="ts">
import type { ChangeSummary, ParkedSummary } from '../api'
import { computed, onUnmounted, ref } from 'vue'
import { useChangesStore } from '../stores/changes'
import { useDetailStore } from '../stores/detail'
import { parkUnavailableCopy } from '../utils/park-copy'
import { formatAbsoluteTime, formatRelativeTime } from '../utils/time'
import CopyNameButton from './CopyNameButton.vue'

const props = defineProps<{ change: ChangeSummary | ParkedSummary }>()

const emit = defineEmits<{
  /** 位移超過門檻、正式進入拖曳：清單據此標示目的地群組 */
  dragStart: [payload: { name: string, from: 'active' | 'parked' }]
  /** 放手（座標）或中斷（null）；清單判定落點並決定是否觸發搬移 */
  dragEnd: [payload: { x: number, y: number } | null]
}>()

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
  return parkUnavailableCopy(changes.parkReason)
})

/** 面板開啟中的那張卡：露出區裡要一眼看出「現在讀的是這個」 */
const current = computed(() => detail.changeName === props.change.name)

/**
 * 拖曳＝狀態切換（spec change-list 拖曳卡片切換狀態）。自製 Pointer Events：
 * 目的地只有一個群組、群組內不重排，需要的只是「跟著指標走」，不值得引入拖曳庫（design D1）。
 * 5px 門檻把「點開詳情」與「拖去對面」分流——卡片是大目標，容得下略大的門檻。
 */
const DRAG_THRESHOLD_PX = 5
/** 返回原位比進場動畫長，讓「沒去成」看得見（design D10） */
const RETURN_MS = 250

const root = ref<HTMLElement | null>(null)
/** 指標按下的起點；null＝這次互動不具拖曳資格（右鍵、按在動作按鈕上、park 不可用） */
const origin = ref<{ id: number, x: number, y: number } | null>(null)
const dragging = ref(false)
const returning = ref(false)
const offset = ref({ x: 0, y: 0 })
/** 拖曳啟動當下量到的卡片高度：卡片脫離文件流後由凹槽頂著，下方卡片才不會跳（design D9） */
const frozenHeight = ref(0)
/** 拖曳過的那次互動不得開詳情——click 在 pointerup 之後才來 */
const swallowClick = ref(false)
const group = computed<'active' | 'parked'>(() => parked.value ? 'parked' : 'active')
/** 拖曳中或正在飛回去：兩種都脫離文件流、原位留凹槽 */
const floating = computed(() => dragging.value || returning.value)

let returnTimer: ReturnType<typeof setTimeout> | undefined

function onPointerDown(event: PointerEvent): void {
  // park 不可用時整個拖曳關閉（spec 拖曳取消與禁用）；動作按鈕自己就是等價操作，按著不該拖
  if (event.button !== 0 || !changes.parkAvailable)
    return
  if ((event.target as HTMLElement).closest('button'))
    return

  // 上一趟拖曳若在卡片外放手，click 不會補來；不在這裡歸零，那面旗子會吃掉下一次真正的點擊
  swallowClick.value = false
  origin.value = { id: event.pointerId, x: event.clientX, y: event.clientY }
  // capture 保證指標移出視窗後續事件仍送到這裡，省掉自行綁 window 監聽與清理
  root.value?.setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent): void {
  const start = origin.value
  if (!start || start.id !== event.pointerId)
    return

  const dx = event.clientX - start.x
  const dy = event.clientY - start.y
  if (!dragging.value) {
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX)
      return
    // 量在卡片還在文件流裡的最後一刻
    frozenHeight.value = root.value?.getBoundingClientRect().height ?? 0
    clearReturn()
    dragging.value = true
    emit('dragStart', { name: props.change.name, from: group.value })
  }
  offset.value = { x: dx, y: dy }
}

function onPointerUp(event: PointerEvent): void {
  const start = origin.value
  if (!start || start.id !== event.pointerId)
    return

  origin.value = null
  root.value?.releasePointerCapture(event.pointerId)
  if (!dragging.value)
    return // 門檻內放開＝點擊，交給既有的 open()

  swallowClick.value = true
  dragging.value = false
  emit('dragEnd', { x: event.clientX, y: event.clientY })

  // 落點被接受的唯一憑據：清單已把這張卡交給 store 的樂觀搬移。此時卡片即將重新
  // 渲染於目的地群組，飛回原位只會多出一段看不到的動畫
  if (changes.parkPending === props.change.name) {
    offset.value = { x: 0, y: 0 }
    return
  }
  playReturn()
}

/** 指標被系統收走（視窗失焦、觸控被捲動接管）＝取消，比照同群組內放手 */
function onPointerCancel(event: PointerEvent): void {
  if (!origin.value || origin.value.id !== event.pointerId)
    return

  origin.value = null
  if (!dragging.value)
    return

  swallowClick.value = true
  dragging.value = false
  emit('dragEnd', null)
  playReturn()
}

function playReturn(): void {
  returning.value = true
  offset.value = { x: 0, y: 0 }
  // 用計時器而非 transitionend：reduced motion 下沒有補間，事件永遠不會來
  returnTimer = setTimeout(clearReturn, RETURN_MS)
}

function clearReturn(): void {
  clearTimeout(returnTimer)
  returning.value = false
}

// 拖曳中的卡片被 watcher 重載移除（外部剛好刪了這個 change）：清單的目的地標示得跟著收掉
onUnmounted(() => {
  clearTimeout(returnTimer)
  if (dragging.value)
    emit('dragEnd', null)
})

function onClick(): void {
  if (swallowClick.value) {
    swallowClick.value = false
    return
  }
  open()
}

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
  <!-- 外層是卡片的版位：拖曳期間卡片脫離文件流，這層留在原地變成凹槽（bg-bg 比 surface 深，
       讀起來是挖穿卡片層），高度釘在拖起前量到的實測值，位置整段拖曳不動（spec 原位凹槽） -->
  <div
    class="relative"
    :class="floating ? 'z-10 border border-line rounded border-dashed bg-bg' : ''"
    :style="floating ? { height: `${frozenHeight}px` } : undefined"
  >
    <!-- 卡片是詳情的入口；hover 抬升並浮現單一動作按鈕（Park／Restore，spec change-list）。
         role=button 而非 <button>：卡片內含 progressbar 等流內容，塞進 button 不合法。
         開啟中的那張改掛 accent 底、拿掉 card-lift——它已經是當前項，不再是入口。
         拖曳中同樣拿掉 card-lift：它的 :active { transform: none } 會把拿起來的卡片壓回去（design D7）。
         cursor 走 grab 而非 pointer：卡片同時是入口與可拖曳物件，而拖曳是這裡唯一「指標形狀才講得出來」
         的能力——點擊入口另有整片 hover 抬升在說。拿起後由 .card-dragging 接手 grabbing -->
    <article
      ref="root"
      class="group cursor-grab border border-line rounded px-4.5 py-4 transition-[transform,background-color] duration-150 ease-[var(--sr-ease-out)] kbd-focus"
      :class="[
        current ? 'bg-accent/25 hover:bg-accent/35' : 'bg-surface',
        floating ? 'absolute inset-x-0 top-0 select-none card-dragging' : (current ? '' : 'card-lift'),
        returning ? 'card-returning' : '',
      ]"
      :style="floating ? { translate: `${offset.x}px ${offset.y}px` } : undefined"
      role="button"
      tabindex="0"
      :aria-current="current ? 'true' : undefined"
      :aria-label="current ? `Collapse ${change.name}` : `Open ${change.name}`"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
      @click="onClick()"
      @keydown.enter.prevent="open()"
      @keydown.space.prevent="open()"
    >
      <div class="h-7 flex items-center gap-3">
        <h3 class="truncate text-ui-title text-text font-mono" :title="change.name">
          {{ change.name }}
        </h3>

        <!-- 與 park 鈕同一套 hover 浮現節奏：靜置的卡片只留標題與數字。
             transition 與 hover:bg-line/70、active:bg-line 都要合併寫在同一個 class 字串裡：icon-btn
             shortcut 產在 shortcuts layer、這裡的 utility 產在 default layer（後產生），同 property 才會
             是這條蓋過 icon-btn 而非互相打斷——分開寫容易漏帶其中一顆。
             hover:bg-line/70 蓋掉 icon-btn 的 hover:bg-surface-hover：卡片 hover 時底色已經是
             surface-hover，這兩顆鈕只在那之後才浮現，同色會讓底色回饋整個消失（design 缺漏 2）。
             active:bg-line 另補：icon-btn 的 active:bg-line/50 也在 shortcuts layer，若這裡只補
             hover 不補 active，default layer 的 hover 規則會在按下時繼續生效、蓋掉 icon-btn 的
             press 態——hover／press 要用同一層的兩條規則才能維持正確的遞亮階梯 -->
        <CopyNameButton
          :name="change.name"
          class="ml-0.5 opacity-0 transition-[opacity,background-color,color] duration-150 ease-[var(--sr-ease-out)] hover:bg-line/70 active:bg-line focus-visible:opacity-100 group-hover:opacity-100"
          @keydown.stop
        />

        <!-- 統計圖示釘死 13px 而非走 h-3／h-3.5 級距（同 ::before 外擴的理由，design D4）：
             根字級 14px 下那兩階是 10.5／12.25px，dpr 2 落在半個 device px 上，stroke 圖示會糊。
             13px 讓 list-checks 的墨水（占視框 66.7%）約 8.7px，貼近 13px 數字 9.9px 的 cap height；
             clock 墨水占 91.7%、同框下自然大一階，那是兩顆圖示的固有差異，不逐顆校準 -->
        <div class="ml-auto flex shrink-0 items-center gap-4">
          <span
            v-if="hasTasks"
            class="inline-flex items-center gap-1.5 text-ui-sm font-mono tabular-nums"
            :class="isComplete ? 'text-done' : 'text-text-2'"
          >
            <span
              class="h-[13px] w-[13px]"
              :class="isComplete ? 'i-lucide-check' : 'i-lucide-list-checks'"
              aria-hidden="true"
            />
            {{ change.completedTasks }}/{{ change.totalTasks }}
          </span>
          <span v-else class="text-ui-sm text-text-3">No tasks</span>

          <span
            class="inline-flex items-center gap-1.5 text-ui-sm"
            :class="parked ? 'text-parked' : 'text-text-2'"
          >
            <span class="i-lucide-clock h-[13px] w-[13px]" aria-hidden="true" />
            <time
              :datetime="typeof timestamp === 'number' ? new Date(timestamp).toISOString() : undefined"
              :title="typeof timestamp === 'number' ? formatAbsoluteTime(timestamp) : undefined"
            >
              {{ timeLabel }}
            </time>
          </span>
        </div>

        <!-- 動作按鈕常駐佔位、只切透明度：hover 時整排數字不會被推著跑。
             .stop 是 spec 要求——按這顆不能順便把詳情打開。
             transition 合併寫 opacity/background-color/color：分開寫 transition-opacity 會產在
             default layer、蓋掉 icon-btn shortcut（shortcuts layer）的 transition-[background-color,color]，
             background-color／color 的補間整個消失，只剩 opacity 在補間（design 缺漏 1） -->
        <button
          type="button"
          class="icon-btn ml-1 transition-[opacity,background-color,color] duration-150 ease-[var(--sr-ease-out)]"
          :class="[
            // 透明度只由一個分支決定：與 opacity-0 對打的 utility 會依 CSS 順序勝出，
            // 導致「不能 park 的專案反而每張卡都常駐一顆按鈕」
            pending ? 'opacity-100' : 'opacity-0 focus-visible:opacity-100 group-hover:opacity-100',
            // 禁用走 aria-disabled 而非 disabled 屬性：原生 disabled 收不到 hover，
            // 「為什麼不能 park」的 tooltip 就永遠沒機會出現。
            // hover／press 底色同理只由一個分支決定（層順序理由同上方 CopyNameButton 註解）：
            // 同時存在會讓「禁用時不換色」與「可用時遞亮」互搶同一個 property
            disabled ? 'cursor-not-allowed text-text-3 hover:bg-transparent hover:text-text-3' : 'hover:bg-line/70 active:bg-line',
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

      <!-- 軌道用 line 而非 bg：bg-bg 在本檔已是「凹槽」的語意（見上方拖曳版位），
           比卡片暗的細條在禁用 box-shadow 的前提下會讀成卡片破洞 -->
      <div
        class="mt-3 h-1.5 overflow-hidden rounded-full bg-line"
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
  </div>
</template>
