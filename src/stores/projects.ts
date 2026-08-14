import type { ProjectActionResult, ProjectEntry, ProjectsSnapshot } from '../api'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { gateway } from '../api'
import { useChangesStore } from './changes'
import { useDetailStore } from './detail'

/**
 * 側欄專案清單的狀態源。切換是一個伺服端動作（design D1），所以這裡的每個
 * 動作都是「呼叫 → 收下新的清單快照 → 若目前專案換了就讓其他 store 失效」。
 */
export const useProjectsStore = defineStore('projects', () => {
  const projects = shallowRef<ProjectEntry[]>([])
  const currentPath = ref<string | null>(null)
  /** 清單至少取過一次；在此之前不能把「沒有專案」當成事實（否則首幀會閃空狀態） */
  const loaded = ref(false)
  /** 切換／加入／移除進行中：清單項與輸入列據此進入 pending */
  const busy = ref(false)
  /** 「＋ Add project」輸入列的展開狀態；主區的空狀態按鈕也從這裡打開 */
  const addFormOpen = ref(false)
  /** 每次切換 +1，讓背景的徽章刷新認得出自己已過期 */
  const generation = ref(0)

  const hasProject = computed(() => currentPath.value !== null)
  const currentProject = computed(() => projects.value.find(each => each.current) ?? null)

  async function load(): Promise<void> {
    const result = await gateway.listProjects()
    if (result.ok)
      applySnapshot(result.snapshot)
    else
      useChangesStore().notify(result.message, result.detail)

    loaded.value = true
  }

  /**
   * 加入即切換（spec 加入專案）。回傳給呼叫端的是「這次為什麼沒成」——
   * 驗證訊息貼在輸入列旁，比 toast 更接近使用者正在看的地方。
   */
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
   * detail 清空、changes 全量重載，最後才在背景補徽章（design D8）。
   */
  async function adopt(snapshot: ProjectsSnapshot, before: string | null): Promise<void> {
    applySnapshot(snapshot)
    if (snapshot.currentPath === before)
      return

    generation.value++
    const changes = useChangesStore()
    const detail = useDetailStore()

    detail.resetForProject()
    changes.invalidate()
    await changes.load()
    detail.prefetch(changes.changes.map(change => change.name))

    // 徽章不擋切換的關鍵路徑：清單換好之後才去跑 N 趟 CLI
    void refreshBadges()
  }

  /** 帶徽章的完整清單重取；期間又切過專案就丟棄（晚到的數字屬於上一個世代） */
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
    addFormOpen,
    hasProject,
    currentProject,
    load,
    add,
    remove,
    switchTo,
  }
})
