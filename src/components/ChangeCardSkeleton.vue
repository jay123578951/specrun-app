<template>
  <!-- 幾何與 ChangeCard 逐項對齊（內距、標題列 h-7 行盒、進度軌高度），換成真卡片時零位移 -->
  <div class="border border-line rounded bg-surface px-4.5 py-4" aria-hidden="true">
    <div class="h-7 flex items-center gap-3">
      <div class="h-3.5 w-40 animate-pulse rounded-full bg-surface-hover" />
      <div class="ml-auto h-3 w-24 animate-pulse rounded-full bg-surface-hover" />
    </div>
    <!-- 摘錄佔位：對齊「有摘錄」的卡片（design D5）——多數 change 有 proposal，
         常見情況零跳動。1.6em 行盒＝ChangeCard 的摘錄段落自 body 承接的行高，
         乘上 text-ui-sm 的字級後兩行高度與真卡片逐 px 相同 -->
    <div class="mt-3 text-ui-sm">
      <div class="h-[1.6em] flex items-center">
        <div class="h-3 w-full animate-pulse rounded-full bg-surface-hover" />
      </div>
      <div class="h-[1.6em] flex items-center">
        <div class="h-3 w-3/5 animate-pulse rounded-full bg-surface-hover" />
      </div>
    </div>

    <div class="mt-3 h-1.5 rounded-full bg-line" />
  </div>
</template>
