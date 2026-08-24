import type { ProjectActionResult, ProjectEntry, ProjectsSnapshot } from '../api'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import { gateway } from '../api'
import { useChangesStore } from './changes'
import { useDetailStore } from './detail'
import { useViewStore } from './view'

/**
 * 側欄專案清單的狀態源。切換是一個伺服端動作（design D1），所以這裡的每個
 * 動作都是「呼叫 → 收下新的清單快照 → 若目前專案換了就讓其他 store 失效」。
 */
export const useProjectsStore = defineStore('projects', () => {
  const projects = shallowRef<ProjectEntry[]>([])
  const currentPath = ref<string | null>(null)
  /** 清單至少取過一次；在此之前不能把「沒有專案」當成事實（否則首幀會閃空狀態） */
  const loaded = ref(false)
  /** 切換／加入／移除進行中：清單項據此進入 pending */
  const busy = ref(false)
  /** 每次切換 +1，讓背景的徽章刷新認得出自己已過期 */
  const generation = ref(0)

  const hasProject = computed(() => currentPath.value !== null)
  const currentProject = computed(() => projects.value.find(each => each.current) ?? null)

  /**
   * 目前專案徽章的即時更新（spec project-management「每專案徽章弱一致」）：changes store
   * 每次真的落地（load 成功／loadSilently 成功／load 佔版錯誤）就會撞一下 changesLandSeq，
   * 這裡就地改掉目前專案那一項——不呼叫 refreshBadges()，那支要對清單裡每個專案各跑一趟
   * `openspec list --json`（約 1s／個），旁邊每存一次檔就壓 N 個 node process，不划算。
   *
   * 數字取自 `changes.changes`（真實資料）而非 `changes.visibleChanges`（含樂觀搬移層）：
   * park／unpark 進行中那一刻兩者會差 1，但 visibleChanges 只是「畫面上暫時多顯示一張卡」
   * 的呈現手法，真正落地的 change 數以伺服端資料為準——徽章若跟著樂觀層走，操作失敗、
   * 卡片彈回原群組時徽章又要再跳一次，反而製造抖動。
   *
   * blockingError 非空（CLI 失敗／非 openspec 專案）時徽章寫回 null，不把「取不到數字」
   * 編造成「0 個 change」（spec 驗收：取數失敗不編數字）。
   *
   * 非目前專案不受影響（規格允許延遲到下次刷新才反映）；invalidate() 清空 changes 資料
   * 時不會撞 changesLandSeq，所以切換專案途中不會把新專案的徽章瞬間寫成 0。
   */
  watch(() => useChangesStore().changesLandSeq, () => {
    const project = currentProject.value
    if (!project)
      return

    const changes = useChangesStore()
    const badge = changes.blockingError ? null : changes.changes.length
    projects.value = projects.value.map(each => (each.path === project.path ? { ...each, badge } : each))
  // sync flush：badge 更新本身很輕（一次陣列 map），沒有等下個 tick 的理由；
  // 用預設的 pre/post flush 會讓 `await changes.load()` 之後立刻讀 projects.projects
  // 讀到還沒更新的舊值（watch 回呼被排到下一個 microtask 才跑）
  }, { flush: 'sync' })

  async function load(): Promise<void> {
    const result = await gateway.listProjects()
    if (result.ok)
      applySnapshot(result.snapshot)
    else
      useChangesStore().notify(result.message, result.detail)

    loaded.value = true
  }

  /**
   * 加入專案的唯一入口（spec：原生 dialog）：側欄與各頁空狀態共用同一段分流，
   * 免得四個按鈕各養一份。沒有可貼訊息的輸入列，所有失敗一律走 toast（design D4、D5）。
   */
  async function startAdd(): Promise<void> {
    const outcome = await gateway.pickFolder()
    // 取消與「已有 dialog 開著」都不留痕跡：那一刻使用者的注意力在 dialog 上，補提示是雜訊
    if (outcome.status === 'canceled' || outcome.status === 'busy')
      return
    if (outcome.status !== 'picked') {
      useChangesStore().notify(
        outcome.status === 'unsupported'
          ? 'Choosing a folder is not available on this platform.'
          : 'Could not open the folder picker.',
      )
      return
    }

    const result = await add(outcome.path)
    if (!result.ok)
      useChangesStore().notify(result.message)
    else if (result.alreadyExisted)
      useChangesStore().notifyInfo('That project is already in the list. Switched to it.')
  }

  /** 加入即切換（spec 加入專案）；失敗原因交給 startAdd 決定怎麼呈現 */
  async function add(input: string): Promise<{ ok: true, alreadyExisted: boolean } | { ok: false, message: string }> {
    return mutate(
      () => gateway.addProject(input),
      result => ({ ok: true as const, alreadyExisted: result.alreadyExisted === true }),
    )
  }

  /** 移除與切換沒有專屬的錯誤位置可貼，失敗走全 App 共用的 toast */
  async function remove(path: string): Promise<void> {
    const result = await mutate(() => gateway.removeProject(path), () => ({ ok: true as const, alreadyExisted: false }))
    if (!result.ok)
      useChangesStore().notify(result.message)
  }

  async function switchTo(path: string): Promise<void> {
    if (path === currentPath.value)
      return
    const result = await mutate(() => gateway.switchProject(path), () => ({ ok: true as const, alreadyExisted: false }))
    if (!result.ok)
      useChangesStore().notify(result.message)
  }

  async function mutate<T>(
    call: () => Promise<ProjectActionResult>,
    onSuccess: (result: Extract<ProjectActionResult, { ok: true }>) => T,
  ): Promise<T | { ok: false, message: string }> {
    if (busy.value)
      return { ok: false, message: 'Another project action is still running.' }

    busy.value = true
    const before = currentPath.value
    try {
      const result = await call()
      if (!result.ok)
        return { ok: false, message: result.message }

      await adopt(result.snapshot, before)
      return onSuccess(result)
    }
    finally {
      busy.value = false
    }
  }

  /**
   * 收下新的清單快照；目前專案真的換了才動其他 store——
   * 回主頁、detail 清空、changes 全量重載，最後才在背景補徽章（design D8）。
   */
  async function adopt(snapshot: ProjectsSnapshot, before: string | null): Promise<void> {
    applySnapshot(snapshot)
    if (snapshot.currentPath === before)
      return

    generation.value++
    const changes = useChangesStore()
    const detail = useDetailStore()

    // 換專案一律落在新專案的 Changes 主頁（spec project-management）——加入與移除
    // 也可能換掉目前專案，所以攔在這個唯一的匯流點，而不是各個按鈕上
    useViewStore().show('changes')
    detail.resetForProject()
    changes.invalidate()
    await changes.load()
    detail.prefetch(changes.changes.map(change => change.name))

    // 徽章不擋切換的關鍵路徑：清單換好之後才去跑 N 趟 CLI
    void refreshBadges()
  }

  /**
   * 帶徽章的完整清單重取；期間又切過專案就丟棄（晚到的數字屬於上一個世代）。
   * 換 CLI 執行檔後也走這裡——徽章同樣是 CLI 算出來的（spec app-settings 重載範圍）。
   */
  async function refreshBadges(): Promise<void> {
    const mine = generation.value
    const result = await gateway.listProjects()
    if (result.ok && mine === generation.value)
      applySnapshot(result.snapshot)
  }

  function applySnapshot(snapshot: ProjectsSnapshot): void {
    // 不帶徽章的回應（切換／加入／移除）沿用既有數字，等 refreshBadges 換上新的
    const known = new Map(projects.value.map(each => [each.path, each.badge]))
    projects.value = snapshot.badgesIncluded
      ? snapshot.projects
      : snapshot.projects.map(each => ({ ...each, badge: known.get(each.path) ?? null }))
    currentPath.value = snapshot.currentPath
  }

  return {
    projects,
    currentPath,
    loaded,
    busy,
    hasProject,
    currentProject,
    load,
    startAdd,
    remove,
    switchTo,
    refreshBadges,
  }
})
