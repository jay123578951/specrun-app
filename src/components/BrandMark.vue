<script setup lang="ts">
import type { RgbColor } from '../utils/orb-color'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { orbDotColor, parseHexColor } from '../utils/orb-color'
import { MODE_FRAMES, resolvePreset } from '../utils/orb-engine'

/**
 * 側欄品牌記號：orb-engine 的幾何一字不改，日後上游更新才能直接對檔比差異；
 * 這裡只負責上色、逐幀迴圈與瀏覽器事件——套件原本的 React 版（index.es.js）不搬，
 * 它要 React ≥18，本專案是 Vue 3。
 */

// 套件的 20 與 64 是兩份各自調過的設計，不是同一份縮放：20 的設計一圈只有 15 個取樣點，
// 疊 8 圈會在同一角度上徑向黏成短橫槓。用 64 的設計換取樣密度，CSS 再縮到 50px 呈現
const DESIGN_SIZE = 64
// 實測波紋繞一圈約 2.9 秒
const SPEED_MULTIPLIER = 0.6

const canvasEl = ref<HTMLCanvasElement>()

const { mode, speed, opts } = resolvePreset('breathing', DESIGN_SIZE)
// mode 來自搬入的 orb-engine（ts-nocheck，型別未受檢），這裡收斂成 any 索引即可
const frameFn = MODE_FRAMES[mode as keyof typeof MODE_FRAMES]
const effectiveSpeed = speed * SPEED_MULTIPLIER

let ctx: CanvasRenderingContext2D | null = null
let surfaceRgb: RgbColor = { r: 0, g: 0, b: 0 }
let accentBrightRgb: RgbColor = { r: 0, g: 0, b: 0 }

let rafId = 0
let animating = false
let reducedMotionQuery: MediaQueryList | null = null

function prefersReducedMotion(): boolean {
  return reducedMotionQuery?.matches ?? false
}

function drawAt(t: number): void {
  if (!ctx)
    return

  const frame = frameFn(DESIGN_SIZE, t, opts)
  ctx.clearRect(0, 0, DESIGN_SIZE, DESIGN_SIZE)
  for (const dot of frame.dots) {
    const color = orbDotColor(dot.white, surfaceRgb, accentBrightRgb)
    // orbDotColor 刻意不四捨五入（見 orb-color.test.ts），fillStyle 收到小數時會
    // 靜默沿用前一個顏色而非報錯，四捨五入放在組字串這一步做
    ctx.fillStyle = `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${dot.a ?? 1})`
    ctx.beginPath()
    ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2)
    ctx.fill()
  }
}

function tick(): void {
  drawAt(performance.now() / 1000 * effectiveSpeed)
  if (animating)
    rafId = requestAnimationFrame(tick)
}

function startLoop(): void {
  if (animating)
    return
  animating = true
  rafId = requestAnimationFrame(tick)
}

function stopLoop(): void {
  animating = false
  cancelAnimationFrame(rafId)
}

/**
 * 讀 visibilityState 與 reduced-motion，決定跑不跑。
 * 不看 hasFocus：視窗看得見但沒焦點，正是使用者最常瞥向記號的時候
 * （人在終端機跑指令、specrun 擺旁邊），拿焦點當開關會讓記號剛好在那時凍住。
 * 要再省電就降重畫頻率，不是改用焦點。
 */
function syncRunState(): void {
  if (prefersReducedMotion()) {
    stopLoop()
    drawAt(0)
    return
  }
  if (document.visibilityState === 'visible')
    startLoop()
  else
    stopLoop()
}

onMounted(() => {
  const canvas = canvasEl.value
  if (!canvas)
    return

  const dpr = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = Math.round(DESIGN_SIZE * dpr)
  canvas.height = Math.round(DESIGN_SIZE * dpr)
  ctx = canvas.getContext('2d')
  if (!ctx)
    return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const styles = getComputedStyle(document.documentElement)
  surfaceRgb = parseHexColor(styles.getPropertyValue('--sr-surface'))
  accentBrightRgb = parseHexColor(styles.getPropertyValue('--sr-accent-bright'))

  // 無條件先畫一幀，再判斷要不要進迴圈：停止不等於空白
  drawAt(0)

  document.addEventListener('visibilitychange', syncRunState)
  reducedMotionQuery = matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotionQuery.addEventListener('change', syncRunState)

  syncRunState()
})

onBeforeUnmount(() => {
  stopLoop()
  document.removeEventListener('visibilitychange', syncRunState)
  reducedMotionQuery?.removeEventListener('change', syncRunState)
})
</script>

<template>
  <!-- 純呈現、對輔助技術隱藏：App 名稱已由旁邊的 wordmark 承擔 -->
  <div aria-hidden="true" class="relative h-[50px] w-[50px] shrink-0">
    <canvas ref="canvasEl" class="block h-[50px] w-[50px]" />
    <!-- 中央的終端機提示符號：path data 抄自 @iconify-json/lucide 1.2.123 的 terminal 圖示，
         套件升版不會跟著走；stroke-width 調到 2.42 是刻意的——
         16px 圖框縮放後畫出來才是定案的 1.60px 筆畫 -->
    <svg
      class="absolute left-1/2 top-1/2 h-[16px] w-[16px] -translate-x-1/2 -translate-y-1/2 text-accent-bright"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.42" d="M12 19h8M4 17l6-6l-6-6" />
    </svg>
  </div>
</template>
