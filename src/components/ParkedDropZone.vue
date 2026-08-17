<script setup lang="ts">
import { computed } from 'vue'
import { useChangesStore } from '../stores/changes'
import { parkUnavailableCopy } from '../utils/park-copy'

/** 是否為當前拖曳的目的地（清單判定，見 ChangeList） */
const props = defineProps<{ target: boolean }>()

const changes = useChangesStore()

/**
 * 三態的強度階梯只用透明度與一層極淡底色表達，不新增顏色（design D4）。
 * 這個區塊自己就是目的地標示的載體——它已經有一圈虛線框，外層再套群組 outline
 * 就會出現兩個嵌套的框，使用者無從判斷哪個才是落點。
 */
const unavailable = computed(() => !changes.parkAvailable)
const active = computed(() => props.target && !unavailable.value)

// 常駐是陳述句、成為目的地才改成放手動作語意——「放開就成立」值得那一次文字變動
const body = computed(() => {
  if (unavailable.value)
    return parkUnavailableCopy(changes.parkReason)
  return active.value ? 'Drop to park this change' : 'Changes dragged here are parked out of the way.'
})
</script>

<template>
  <div
    class="border rounded border-dashed px-6 py-7 text-center text-ui-sm transition-[background-color,border-color,color] duration-150"
    :class="unavailable
      ? 'border-line/30 text-text-3/60'
      : (active ? 'border-line bg-accent/6 text-text-2' : 'border-line/40 text-text-3')"
    :aria-disabled="unavailable"
  >
    {{ body }}
  </div>
</template>
