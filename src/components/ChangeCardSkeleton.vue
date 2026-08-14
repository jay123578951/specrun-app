<template>
  <!-- 幾何與 ChangeCard 逐項對齊（內距、標題列 1.6em 行盒、進度軌高度），換成真卡片時零位移 -->
  <div class="border border-line rounded bg-surface px-4.5 py-4" aria-hidden="true">
    <div class="h-[1.6em] flex items-center gap-3 text-mono-base">
      <div class="h-3.5 w-40 animate-pulse rounded-full bg-surface-hover" />
      <div class="ml-auto h-3 w-24 animate-pulse rounded-full bg-surface-hover" />
    </div>
    <div class="mt-3 h-1.5 rounded-full bg-bg" />
  </div>
</template>
