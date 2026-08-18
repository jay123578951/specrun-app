<template>
  <!-- 面板讀取中的通用骨架：手動刷新與無快取可顯示的墊底路徑共用同一份形態。
       只承諾「正在載入、寬度到這裡」，不預告段落結構——每個 artifact 的首個
       元素不同，預告不準（design D4）。行寬 68ch、行距 1.8em 對齊 md-body，
       換成真內容時位移最小；色階用 surface-hover，面板底是 surface -->
  <div class="max-w-[68ch] text-[16px]" aria-hidden="true">
    <div class="h-[1.8em] flex items-center">
      <div class="h-3 w-full animate-pulse rounded-full bg-surface-hover" />
    </div>
    <div class="h-[1.8em] flex items-center">
      <div class="h-3 w-full animate-pulse rounded-full bg-surface-hover" />
    </div>
    <div class="h-[1.8em] flex items-center">
      <div class="h-3 w-full animate-pulse rounded-full bg-surface-hover" />
    </div>
    <div class="h-[1.8em] flex items-center">
      <div class="h-3 w-full animate-pulse rounded-full bg-surface-hover" />
    </div>
    <div class="h-[1.8em] flex items-center">
      <div class="h-3 w-3/5 animate-pulse rounded-full bg-surface-hover" />
    </div>
  </div>
</template>
