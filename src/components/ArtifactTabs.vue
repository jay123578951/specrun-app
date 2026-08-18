<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/**
 * artifact tabs：ArtifactPanel 與 ArchivedPanel 共用一份標記與一份選中指示邏輯
 * （兩處行為同源，不靠「兩邊記得改成一樣」維持一致）。
 *
 * 選中指示是一條絕對定位的 bar：量當前 tab 的 offsetLeft／offsetWidth，
 * 以個別屬性 translate／scale 就位（design D1／D2）。bar 本體寬 1px，
 * scale 直接把量到的 px 映成係數，因此不依賴 tablist 的容器寬——tabs 換批時
 * 容器寬會變，用容器寬當基準等於多一個要同步的來源。
 * 走個別屬性而非 transform 字串的理由與 .card-dragging 同源：
 * reduced motion 才能只關掉位移（降級規則見 src/styles/interactions.css）。
 *
 * 元件只收 props／發 emit，不直接讀 store——detail 與 archived 兩個 store 的
 * tab 狀態各自管理，那份差異不該被吸進這裡。
 */

const props = defineProps<{
  /** tabs 清單，順序沿用 CLI（名稱不寫死，custom schema 必須可用） */
  items: readonly { id: string }[]
  /** 當前選中的 tab id */
  current: string | null
  /** 身分鍵（change 名）：它一變代表 tabs 整批換掉，指示直接就位、不滑行（design D3） */
  identity: string | null
  /** id／aria-controls 的前綴，兩個面板各一組（''／'archived-'） */
  idPrefix: string
}>()

defineEmits<{ select: [id: string] }>()

const tablist = ref<HTMLElement>()

/** false ＝ 無過場就位路徑進行中（transition 暫時關掉），設好位置後下一幀才掛回 */
const animated = ref(false)
/** bar 的位置：translate 給 tab 左緣，scale 的 X 就是 tab 寬（bar 基準寬 1px） */
const bar = ref({ translate: '0px 0', scale: '0 1' })

let identityKey = props.identity
let itemsKey = keyOf(props.items)
let observer: ResizeObserver | undefined
let rafId = 0
let disposed = false

function keyOf(items: readonly { id: string }[]): string {
  return items.map(item => item.id).join(' ')
}

/**
 * 底線左右各超出文字的餘裕（`--spacing` 一級 ＝ 3.5px，design D9）。
 * 相鄰底線的間隙 ＝ tab 間距 24.5px − 2 × 這個值，再放大就會連成一條。
 */
const BLEED = 3.5

/**
 * 量測並就位。instant ＝ 無過場的一次就位：關 transition → 設位置 → 下一幀掛回。
 * 雙 rAF 讓新位置先被瀏覽器算過一次，掛回 transition 時才不會補播剛剛那段位移
 * （手法與 PanelShell 的淡入同源）。
 *
 * 量的是文字而非按鈕盒：內距是點擊面積，讓底線跟著盒寬走，首顆就得靠內距特例
 * 去雕形狀，間距與點擊面積會被一起犧牲（design D9）。span 沒有定位，offsetParent
 * 就是帶 relative 的 tablist，offsetLeft 已含按鈕位置與內距。
 */
function place(instant: boolean): void {
  const label = tablist.value?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"] > span')
  if (!label)
    return

  // 量到 0 代表節點還沒排版完（面板剛掛上、tabs 換到一半）：跳過這次更新，
  // 不把 bar 縮成看不見——下一個觸發點會再量一次
  const width = label.offsetWidth
  if (width <= 0)
    return

  if (instant)
    animated.value = false

  bar.value = {
    translate: `${label.offsetLeft - BLEED}px 0`,
    scale: `${width + BLEED * 2} 1`,
  }

  if (!instant)
    return

  cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(() => {
    rafId = requestAnimationFrame(() => {
      if (!disposed)
        animated.value = true
    })
  })
}

// 量測觸發點 1：current／items 變動後等 DOM patch 完再量（design D4）
watch(
  () => [props.identity, keyOf(props.items), props.current] as const,
  async ([identity, items]) => {
    await nextTick()
    if (disposed)
      return

    // 身分變更或 tabs 集合換掉＝新舊 tab 之間沒有位置關係可表達，直接就位
    const instant = identity !== identityKey || items !== itemsKey
    identityKey = identity
    itemsKey = items
    place(instant)
  },
)

onMounted(() => {
  // 首次量測沒有「從哪來」可言，同樣走無過場路徑
  place(true)

  // 量測觸發點 2：字體走自架 @fontsource，首次繪製用 fallback，
  // 字體到位後 tab 寬度會變；不接這個，第一次開面板的 bar 會停在錯的寬度
  document.fonts?.ready.then(() => {
    if (!disposed)
      place(true)
  })

  // 量測觸發點 3：兜底前兩點漏掉的任何情形（面板寬變動等）。
  // 這是校正、不是使用者發起的切換，一律無過場就位、不演出滑行
  if (tablist.value) {
    observer = new ResizeObserver(() => place(true))
    observer.observe(tablist.value)
  }
})

onBeforeUnmount(() => {
  disposed = true
  cancelAnimationFrame(rafId)
  observer?.disconnect()
})
</script>

<template>
  <!-- 四顆 tab 的設定完全一致，沒有 first: 特例（design D9）：
       -ml-3 抵掉首顆的左內距，讓它的文字左緣落在面板標題的左緣——
       對齊是「這一列」的事，由列自己宣告，與旁邊的 -mb-px 同一手法 -->
  <div ref="tablist" role="tablist" class="relative -mb-px -ml-3 flex gap-1">
    <button
      v-for="item in items"
      :id="`${idPrefix}tab-${item.id}`"
      :key="item.id"
      type="button"
      role="tab"
      class="tab-item"
      :class="item.id === current ? 'text-text' : 'text-text-3'"
      :aria-selected="item.id === current"
      :aria-controls="`${idPrefix}panel-${item.id}`"
      @click="$emit('select', item.id)"
    >
      <!-- 這層 span 是 indicator 的量測標的（design D9），不帶任何樣式 -->
      <span>{{ item.id }}</span>
    </button>

    <!-- 選中底線：坐在 tablist 底緣，寬度是文字寬左右各加 BLEED。
         tablist 帶 -mb-px 壓進 header 的 border-b，而後代內容本就繪製在祖先邊框之上，
         再加上這個絕對定位元素排在 buttons 之後——層疊已經正確，不需具名 z 層。
         transition-transform 就是 transform／translate／scale／rotate 一整組
         （preset-wind4 不收 transition-[translate,scale] 這種寫法） -->
    <span
      class="tab-indicator absolute bottom-0 left-0 h-[2px] w-px origin-left bg-accent-bright"
      :class="animated
        ? 'transition-transform duration-180 ease-[var(--sr-ease-in-out)]'
        : 'transition-none'"
      :style="bar"
      aria-hidden="true"
    />
  </div>
</template>
