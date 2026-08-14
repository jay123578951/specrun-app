<template>
  <!-- 手動刷新專用的讀取回饋（導航動作不用動畫，見 design D8）。
       寬度依 68ch 的閱讀欄，行高比照 read tokens，換成真內容時位移最小 -->
  <div class="max-w-[68ch]" aria-hidden="true">
    <div class="h-5 w-52 animate-pulse rounded-full bg-surface-hover" />

    <div class="mt-6 space-y-2.5">
      <div class="h-3 animate-pulse rounded-full bg-surface" />
      <div class="h-3 animate-pulse rounded-full bg-surface" />
      <div class="h-3 w-3/5 animate-pulse rounded-full bg-surface" />
    </div>

    <div class="mt-8 h-4 w-36 animate-pulse rounded-full bg-surface-hover" />

    <div class="mt-5 space-y-2.5">
      <div class="h-3 animate-pulse rounded-full bg-surface" />
      <div class="h-3 animate-pulse rounded-full bg-surface" />
      <div class="h-3 w-4/5 animate-pulse rounded-full bg-surface" />
    </div>
  </div>
</template>
