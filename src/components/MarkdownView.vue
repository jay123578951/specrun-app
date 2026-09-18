<script setup lang="ts">
import { shallowRef, useTemplateRef, watch } from 'vue'
import { gateway } from '../api'
import { renderMarkdown } from '../markdown/render'
import { useChangesStore } from '../stores/changes'

const props = defineProps<{
  source: string
  /** tasks 單檔時開啟：checkbox 可點 */
  interactive?: boolean
  /** 寫入進行中的來源行號；這些 checkbox 呈現 pending 且不再接受點擊 */
  pendingLines?: number[]
}>()

const emit = defineEmits<{ toggle: [line: number] }>()

const html = shallowRef('')
// 渲染是 async（highlighter 首次要載語言），快速切 tab 會有多個 render 在飛：
// 只認最後一次發出的，避免舊內容後到覆蓋新的
let seq = 0

watch([() => props.source, () => props.interactive], async ([source, interactive]) => {
  const mine = ++seq
  const rendered = await renderMarkdown(source, { interactive })
  if (mine === seq)
    html.value = rendered
}, { immediate: true })

const root = useTemplateRef<HTMLElement>('root')

/**
 * pending 是短暫的 in-flight 記號，走 DOM 屬性而非重渲染——
 * 為了一個狀態把整片 Markdown 重跑一次高亮並不划算。
 */
watch([html, () => props.pendingLines], () => {
  const el = root.value
  if (!el)
    return
  const pending = props.pendingLines ?? []
  for (const box of el.querySelectorAll<HTMLInputElement>('.task-list-item-checkbox[data-line]'))
    box.toggleAttribute('data-pending', pending.includes(Number(box.dataset.line)))
}, { flush: 'post' })

/**
 * 整片 md-body 一個委派接住點擊，不逐顆 checkbox／連結綁 listener——每次重渲染整片都被換掉。
 * 連結這一段不受 `interactive` 限制：唯讀模式（Specs 全文、已歸檔詳情）也要點得動外部連結，
 * 只有 tasks 勾選才是可勾選模式的專屬行為（design 的 Risks 第三項）。
 */
function onClick(event: MouseEvent): void {
  const target = event.target as Element | null

  // render.ts 的 `applyLinkPolicy` 已經是通道的入口守衛：不可點的連結（相對路徑、
  // 允許範圍以外的 scheme）一律渲染成 `<span class="md-link-inert">`，不會是 `<a>`——
  // 這裡撞到的 `<a>` 保證是 http／https／mailto。不看 metaKey／ctrlKey（design D2）。
  const link = target?.closest<HTMLAnchorElement>('a[href]')
  if (link) {
    // `a[href]` 選擇器已保證屬性存在，理論上不會拿到 null；取不到就直接放棄，
    // 不要把空字串交給資料入口（web 形態的 `window.open('')` 會開出一個 about:blank）
    const href = link.getAttribute('href')
    if (href === null)
      return

    event.preventDefault()
    const normalized = normalizeAllowedUrl(href)
    if (normalized)
      void openLink(normalized)
    return
  }

  if (!props.interactive)
    return

  const box = target?.closest<HTMLInputElement>('.task-list-item-checkbox[data-line]')
  if (!box)
    return

  // DOM 不是狀態源：翻轉一律由 store 對來源字串處理後重渲染，
  // 這裡擋掉瀏覽器自己的勾選，免得被忽略的點擊（pending 中）在畫面上留下假狀態
  event.preventDefault()
  if (box.hasAttribute('data-pending'))
    return

  const line = Number(box.dataset.line)
  if (Number.isInteger(line))
    emit('toggle', line)
}

const ALLOWED_SCHEMES = ['http:', 'https:', 'mailto:']

/**
 * render.ts 的 `^(?:https?:|mailto:)/i` 帶 `/i`，`HTTPS://…` 這種大寫 scheme 一樣會
 * 被畫成可點的 `<a>`。但桌面形態送進 `plugin:opener|open_url` 之後，Rust 端拿
 * `glob::Pattern` 比對允許的網址集，`Pattern::matches` 是大小寫敏感的（glob crate
 * 的 `MatchOptions::new()` 預設 `case_sensitive: true`），大寫 scheme 會直接被判定
 * 不在允許清單內、開不起來。這裡在交給資料入口之前把 scheme 正規化成小寫，並用同一份
 * 允許清單重新比對一次；缺 scheme 或不在清單內就不呼叫資料入口，等於補上畫面端
 * 只看 `a[href]`、不看 scheme 的守衛缺口。
 */
function normalizeAllowedUrl(href: string): string | null {
  const match = /^[a-z][a-z\d+.-]*:/i.exec(href)
  if (!match)
    return null
  const scheme = match[0].toLowerCase()
  if (!ALLOWED_SCHEMES.includes(scheme))
    return null
  return scheme + href.slice(match[0].length)
}

/** 開啟失敗沒有專屬位置可貼，走全 App 共用的 toast（比照 settings store 的 reveal） */
async function openLink(url: string): Promise<void> {
  const outcome = await gateway.openUrl(url)
  if (outcome.status === 'failed')
    useChangesStore().notify('Could not open this link.')
}
</script>

<template>
  <!-- 渲染來源是本機 artifact，且管線維持 markdown-it 的 html: false -->
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div ref="root" class="md-body" @click="onClick" v-html="html" />
</template>
