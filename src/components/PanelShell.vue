<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

/**
 * slideover 三處（Artifact／Spec／Archived）共用的外殼（design D5：rule of three 到齊）。
 *
 * 這裡只放三頁都相同的骨架——定位／底色／左緣線、header 的收合鈕與動作槽、
 * 捲動容器與換內容時的捲動歸零；標題、tabs、內容各自從 slot 填。
 * 進出場動畫仍留在 App.vue 的 PANEL_MOTION（三頁共用同一組值）。
 */

const props = defineProps<{
  /** 收合鈕 aria-label 的主體（`spec`／`detail`／`archived change`） */
  collapseLabel: string
  /** 身分鍵（change／spec 名）：值一變＝換了一份東西 */
  identityKey: string
  /** 內容鍵（tab 名）：值一變＝同一份東西換頁；無 tabs 的面板給空值 */
  contentKey: string
}>()

defineEmits<{ collapse: [] }>()

const scroller = ref<HTMLElement>()

/**
 * 快速連按閘門：距上次切換小於這個間隔就只換內容、不播淡入。
 * 擋的是鍵盤 ↑↓ 連按（重複間隔 ~30–50ms）——不設閘，內容區會一直被壓回
 * opacity 0，讀起來是閃爍；單次點擊或單次按鍵照樣有淡入（design D7）。
 * 值只需大於鍵盤重複間隔、小於刻意的兩次操作，不必精確。
 */
const FADE_SUPPRESS_MS = 200

/**
 * 淡入時長兩檔（design D5）：換 change 是身分變更、換 tab 是同一份 change 換頁，
 * 幅度差一階。兩檔都寫成完整字面值，class 才進得了 UnoCSS 的靜態掃描。
 */
const FADE_IDENTITY = 'transition-opacity duration-180 ease-[var(--sr-ease-out)]'
const FADE_CONTENT = 'transition-opacity duration-160 ease-[var(--sr-ease-out)]'

/** true = 淡入起點：內容區壓在 opacity 0 且無過場；false 才掛回 transition（兩分支互斥） */
const fadeStart = ref(false)
/** 這一輪淡入要用的時長檔，由觸發來源決定 */
const fadeClass = ref(FADE_CONTENT)

let lastSwitchAt = 0
let rafId = 0
let disposed = false

watch(
  () => [props.identityKey, props.contentKey] as const,
  async ([identityKey], [prevIdentityKey]) => {
    if (scroller.value)
      scroller.value.scrollTop = 0

    fadeClass.value = identityKey === prevIdentityKey ? FADE_CONTENT : FADE_IDENTITY

    const now = performance.now()
    const suppressed = now - lastSwitchAt < FADE_SUPPRESS_MS
    lastSwitchAt = now
    if (suppressed) {
      // 連按中把上一輪排程一併取消，免得它在壓 0 之後才把 opacity 放回、播出半截淡入
      cancelAnimationFrame(rafId)
      fadeStart.value = false
      return
    }

    // watcher 是 pre-flush，壓 0 先於新內容 patch；等 patch 完再過雙 rAF，
    // 讓 opacity: 0 先被瀏覽器算過一次，放回 1 的過場才會真的播
    fadeStart.value = true
    await nextTick()
    if (disposed)
      return
    cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(() => {
      rafId = requestAnimationFrame(() => {
        fadeStart.value = false
      })
    })
  },
)

// 面板收合瞬間若剛好在切換，別讓在飛的回呼落在已卸載的元件上
onBeforeUnmount(() => {
  disposed = true
  cancelAnimationFrame(rafId)
})
</script>

<template>
  <!-- 底色抬一階＋左緣一條線就是全部的層次：無陰影、無 backdrop，
       露出區的清單不變暗也不被攔截（spec artifact-view 無遮罩） -->
  <section class="min-w-0 flex flex-col overflow-hidden border-l border-line bg-surface">
    <header class="shrink-0 border-b border-line px-8 pt-4">
      <!-- 控制列自成一條：標題放大後與 28px 的 icon-btn 並排會比例打架，
           所以按鈕收在上方兩端，標題獨佔下一列 -->
      <div class="flex items-center">
        <!-- 收合不是關閉：面板是滑回右邊，圖示用箭頭而非 ✕ -->
        <button
          type="button"
          class="icon-btn"
          :aria-label="`Collapse ${collapseLabel} (Esc)`"
          title="Collapse (Esc)"
          @click="$emit('collapse')"
        >
          <span class="i-lucide-chevrons-right h-4 w-4" aria-hidden="true" />
        </button>

        <!-- ml-auto 之後是動作槽：refresh 等按鈕由各面板自己填 -->
        <div class="ml-auto flex shrink-0 items-center gap-2">
          <slot name="actions" />
        </div>
      </div>

      <slot name="header" />
    </header>

    <!-- 換內容時只淡這塊：header 與卡片高亮是身分回饋、必須即時（design D8）。
         兩個 class 分支互斥，避免 transition-none 與 transition-opacity 同時在場互打 -->
    <div
      ref="scroller"
      class="min-h-0 flex-1 overflow-y-auto px-8 py-7"
      :class="fadeStart ? 'opacity-0 transition-none' : fadeClass"
    >
      <slot />
    </div>
  </section>
</template>
