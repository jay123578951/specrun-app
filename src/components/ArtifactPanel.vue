<script setup lang="ts">
import { computed } from 'vue'
import { useChangesStore } from '../stores/changes'
import { useDetailStore } from '../stores/detail'
import { formatCreatedAt, formatCreatedAtFull } from '../utils/time'
import ArtifactSkeleton from './ArtifactSkeleton.vue'
import ArtifactTabs from './ArtifactTabs.vue'
import CopyNameButton from './CopyNameButton.vue'
import MarkdownView from './MarkdownView.vue'
import PanelShell from './PanelShell.vue'
import StateNotice from './StateNotice.vue'

/** 詳情內容面板：外殼走共用的 PanelShell，內容是 artifact tabs＋Markdown 渲染 */

const changes = useChangesStore()
const detail = useDetailStore()

// 面板覆蓋著清單自己的 Refresh，所以這顆把兩邊一起重取（沿用窄軌時代的語意）
function refresh(): void {
  changes.load()
  detail.refresh()
}

const busy = computed(() => changes.busy || detail.refreshing)

/**
 * 建立時刻：據目前開啟的 change 名稱回查清單，不打詳情端點。
 * 查的是原始清單（`changes.changes`／`changes.parked`）而非套過樂觀搬移層的 visible 版本
 * ——與「檢視中 change 消失自動關閉」（App.vue 的 syncWithChanges）用的是同一份基準，
 * 保持「面板開著就查得到」這條不變式的來源一致。取不到就是 null，面板整欄不渲染。
 */
const createdAt = computed(() => {
  const name = detail.changeName
  if (!name)
    return null
  const list = detail.isParked ? changes.parked : changes.changes
  return list.find(item => item.name === name)?.createdAt ?? null
})

/**
 * 勾選只在單檔 tasks tab 開放：其他 artifact、多檔 tasks（非預設 schema）
 * 與 custom schema 的任何 tab 一律維持唯讀。parked change 整份唯讀——渲染端把
 * checkbox 交回 markdown-it 的 disabled 預設（視覺與行為一次到位）。
 */
const interactiveTasks = computed(() =>
  !detail.isParked && detail.currentArtifact?.id === 'tasks' && detail.currentArtifact.files.length === 1,
)

/**
 * 批次入口的可用性：無未勾行就沒有可寫的目標；有任何寫入在飛時也停用——
 * 那時快取已是樂觀翻轉後的內容，批次算出的 expectedText 與磁碟必然不符、整批會被判衝突。
 * 停用不隱藏：勾完最後一項時該列不會突然少一塊。
 */
const tasksWriting = computed(() => detail.pendingTaskLines.length > 0)
const checkAllDisabled = computed(() => !detail.hasUncheckedTasks || tasksWriting.value)

/** 停用時說明「為什麼點不動」——灰掉的按鈕不自己解釋，就只剩猜 */
const checkAllTitle = computed(() => {
  if (tasksWriting.value)
    return 'Waiting for the current task update'
  return detail.hasUncheckedTasks
    ? 'Mark every remaining task as done'
    : 'Every task is already checked'
})
</script>

<template>
  <PanelShell
    collapse-label="detail"
    :identity-key="detail.changeName ?? ''"
    :content-key="detail.currentTab ?? ''"
    @collapse="detail.close()"
  >
    <!-- 動作區：建立時刻（非互動）在最前，Open in editor 等按鈕之後才填，
         複製名稱與 refresh 包一層自己的 gap-2——PanelShell 的 gap-4 只用來拉開
         建立時刻與這個按鈕群組的間距 -->
    <template #actions>
      <!-- 不可互動：無 tabindex、無 hover／press、無邊框底色；對比明顯低於同列的 icon 按鈕
           （text-text-3 對 icon-btn 的 text-text-2）。取不到（createdAt 為 null）整個不渲染、
           不留佔位——沒有建立時刻可顯示時，留白位置沒有意義 -->
      <time
        v-if="createdAt !== null"
        class="shrink-0 font-mono text-ui-xs tabular-nums text-text-3"
        :datetime="new Date(createdAt).toISOString()"
        :title="formatCreatedAtFull(createdAt)"
      >
        Created {{ formatCreatedAt(createdAt) }}
      </time>
      <div class="flex shrink-0 items-center gap-2">
        <CopyNameButton v-if="detail.changeName" :name="detail.changeName" />
        <button
          type="button"
          class="icon-btn"
          :disabled="busy"
          :aria-busy="busy"
          aria-label="Refresh changes"
          title="Refresh changes"
          @click="refresh()"
        >
          <span
            class="i-lucide-refresh-cw h-4 w-4"
            :class="{ 'animate-spin': busy }"
            aria-hidden="true"
          />
        </button>
      </div>
    </template>

    <template #header>
      <!-- 上下留白刻意不對稱：tabs 自帶 h-12（42px）的垂直置中（文字上方還有 ~10.6px），
           padding 抵掉那一段，標題到按鈕與標題到 tabs 的「看起來」才等距。
           tab 高一改，這裡的 pb 就得跟著重算（ArchivedPanel 的頭部同構、必須同值） -->
      <div class="flex items-center gap-3 pb-[2px] pt-4.5">
        <!-- font-medium 是 Plex Mono 目前載入的最重字重（400／500 兩檔，見 main.ts） -->
        <h2 class="truncate text-ui-lg text-text font-mono font-medium" :title="detail.changeName ?? ''">
          {{ detail.changeName }}
        </h2>

        <!-- 唯讀不是壞掉：講清楚「這是 parked 的樣貌」比讓人納悶 checkbox 為何點不動好 -->
        <span
          v-if="detail.isParked"
          class="shrink-0 flex items-center gap-1.5 rounded-full bg-parked/12 px-2 py-0.5 text-ui-xs text-parked"
        >
          <span class="i-lucide-pause h-3 w-3" aria-hidden="true" />
          Parked · read-only
        </span>

        <!-- 背景重取失敗但畫面有內容：不換錯誤畫面，只在頭部留一個小記號 -->
        <span
          v-if="detail.staleWarning"
          class="shrink-0 flex items-center gap-1.5 text-ui-xs text-text-3"
          title="The last refresh did not complete. Showing the content loaded earlier."
        >
          <span class="i-lucide-cloud-off h-3 w-3" aria-hidden="true" />
          Not refreshed
        </span>
      </div>

      <!-- tabs 完全依 CLI 回傳的 artifact 清單，名稱不寫死（custom schema 必須可用）。
           標記與選中指示都在 ArtifactTabs，與 archived 詳情共用同一份 -->
      <ArtifactTabs
        v-if="detail.artifacts.length"
        :items="detail.artifacts"
        :current="detail.currentTab"
        :identity="detail.changeName"
        id-prefix=""
        @select="detail.selectTab($event)"
      >
        <!-- 批次勾選：出現條件與 checkbox 可互動同源（interactiveTasks），
             因此 parked／非 tasks tab／多檔 tasks 一律長不出來。帶文字而非純圖示——
             一次改寫數十行的操作，光靠圖示猜不出後果 -->
        <!-- 寫入中不放 spinner：樂觀更新已讓結果即刻可見，這裡只需 aria-busy＋停用；
             失敗才有動靜（整片彈回＋toast），成功一律靜默 -->
        <!-- btn-inline 而非 btn-sm：這一列容不下有邊框的盒子（理由見 uno.config.ts）。
             -mr-2 抵掉自身右內距，讓文字右緣落在面板右緣——與 tabs 用 -ml-3 對齊左緣
             同一手法，兩端因此都對得上上方那列 icon-btn 的邊界 -->
        <template v-if="interactiveTasks" #trailing>
          <button
            type="button"
            class="btn-inline -mr-2"
            :disabled="checkAllDisabled"
            :aria-busy="tasksWriting"
            :title="checkAllTitle"
            @click="detail.checkAllTasks()"
          >
            <span class="i-lucide-list-checks h-4 w-4" aria-hidden="true" />
            Check all
          </button>
        </template>
      </ArtifactTabs>
      <!-- 沒有 tabs（載入中／失敗）時撐住同高度，頭部不會先塌一截再彈回來 -->
      <div v-else class="h-12" aria-hidden="true" />
    </template>

    <!-- 主動刷新是「我要等新資料」的明示：清空面板、大膽用 skeleton 回饋 -->
    <ArtifactSkeleton v-if="detail.refreshing" />

    <!-- 墊底路徑（無快取可顯示）：同一個面板的讀取中只有一種樣子，
         沿用刷新那份 skeleton，不因觸發來源分岔出第二種骨架 -->
    <ArtifactSkeleton v-else-if="detail.loading" />

    <StateNotice
      v-else-if="detail.error"
      icon="i-lucide-file-warning"
      tone="error"
      title="Could not load this change"
      body="Reading this change did not complete. It may have been archived or removed while open."
      :detail="detail.error.detail"
    >
      <button type="button" class="btn" @click="detail.load()">
        Try again
      </button>
    </StateNotice>

    <!-- 缺件不灰化、不當錯誤：文案與上面的失敗提示刻意分開 -->
    <StateNotice
      v-else-if="detail.currentArtifact?.missing"
      icon="i-lucide-file-plus-2"
      title="Not created yet"
      :body="`This change has no ${detail.currentArtifact.id} file yet. It shows up here once the openspec CLI writes it.`"
    />

    <div
      v-else-if="detail.currentArtifact"
      :id="`panel-${detail.currentArtifact.id}`"
      role="tabpanel"
      :aria-labelledby="`tab-${detail.currentArtifact.id}`"
      tabindex="0"
      class="kbd-focus"
    >
      <!-- 多檔 artifact（specs）串成一頁往下捲，各檔前掛檔名標頭 -->
      <article
        v-for="(file, index) in detail.currentArtifact.files"
        :key="file.path"
        :class="index > 0 ? 'mt-10 border-t border-line pt-8' : ''"
      >
        <h3
          v-if="detail.currentArtifact.files.length > 1"
          class="mb-4 truncate text-ui-sm text-text-3 font-mono"
          :title="file.path"
        >
          {{ file.path }}
        </h3>
        <MarkdownView
          :source="file.content"
          :interactive="interactiveTasks"
          :pending-lines="detail.pendingTaskLines"
          @toggle="detail.toggleTask($event)"
        />
      </article>
    </div>
  </PanelShell>
</template>
