import type { OpenSpecGateway } from './types'
import { describe, expect, it, vi } from 'vitest'

/**
 * `desktopGateway` 至此不再展開 web 形態的實作（T4c 移除了 `...webGateway`
 * 那一行）——介面上的每一個方法都要指到桌面自己的模組，一個都不落在 web 形態
 * 的實作上。不連真的 Tauri，各來源模組與 web-gateway 皆以假模組取代，逐一比對
 * 兩份實作的方法參照，不只測新搬的兩個（`revealPath`／`openUrl`）。
 */
describe('api/desktop-gateway: 桌面實作接線，不再落回 web 形態', () => {
  it('介面上每一個方法都指向桌面自己的實作，沒有任何一個等於 web 形態的實作', async () => {
    vi.resetModules()

    const cli = {
      cliSettings: vi.fn(),
      applyOverride: vi.fn(),
      redetect: vi.fn(),
    }
    const diagnosticsFn = vi.fn()
    const projects = {
      listProjects: vi.fn(),
      addProject: vi.fn(),
      removeProject: vi.fn(),
      switchProject: vi.fn(),
    }
    const reads = {
      listChanges: vi.fn(),
      getChangeDetail: vi.fn(),
      listSpecs: vi.fn(),
      getSpecContent: vi.fn(),
    }
    const tasks = { toggleTask: vi.fn() }
    const park = { parkChange: vi.fn(), unparkChange: vi.fn() }
    const parked = { listParked: vi.fn(), getParkedDetail: vi.fn() }
    const archived = { listArchived: vi.fn(), getArchivedDetail: vi.fn() }
    const roadmap = { listRoadmap: vi.fn() }
    const watch = { subscribeToChanges: vi.fn() }
    const folderPicker = { pickFolder: vi.fn() }
    const opener = { revealPath: vi.fn(), openUrl: vi.fn() }

    // web 形態的每一個方法都給獨立的假函式，逐一比對時才能斷言「不是這一個」；
    // 若真的還有任何方法漏搬，desktopGateway 上的它會 `toBe` 這裡對應的假函式。
    // 型別綁在 `OpenSpecGateway` 本身（不是自己另一份手寫物件、也不透過 `Record`——
    // `Record<keyof T, V>` 會把 `keyof T` 攤成純字串聯集，丟失原本個別欄位的
    // optional 修飾，逼著這裡連還沒兩形態都接上的 optional 方法也要先湊一個假函式）：
    // 介面新增的必填方法，這裡少一個 key 就編譯不過，逼著這份 fixture 跟著介面走。
    const webGatewayFake: { [K in keyof OpenSpecGateway]: ReturnType<typeof vi.fn> } = {
      listChanges: vi.fn(),
      getChangeDetail: vi.fn(),
      toggleTask: vi.fn(),
      subscribeToChanges: vi.fn(),
      listProjects: vi.fn(),
      addProject: vi.fn(),
      removeProject: vi.fn(),
      switchProject: vi.fn(),
      listSpecs: vi.fn(),
      getSpecContent: vi.fn(),
      listParked: vi.fn(),
      parkChange: vi.fn(),
      unparkChange: vi.fn(),
      getParkedDetail: vi.fn(),
      listArchived: vi.fn(),
      getArchivedDetail: vi.fn(),
      listRoadmap: vi.fn(),
      pickFolder: vi.fn(),
      getCliSettings: vi.fn(),
      applyCliPath: vi.fn(),
      redetectCli: vi.fn(),
      getDiagnostics: vi.fn(),
      revealPath: vi.fn(),
      openUrl: vi.fn(),
    }

    vi.doMock('./desktop/cli', () => cli)
    vi.doMock('./desktop/diagnostics', () => ({ diagnostics: diagnosticsFn }))
    vi.doMock('./desktop/projects', () => projects)
    vi.doMock('./desktop/reads', () => reads)
    vi.doMock('./desktop/tasks', () => tasks)
    vi.doMock('./desktop/park', () => park)
    vi.doMock('./desktop/parked', () => parked)
    vi.doMock('./desktop/archived', () => archived)
    vi.doMock('./desktop/roadmap', () => roadmap)
    vi.doMock('./desktop/folder-picker', () => folderPicker)
    vi.doMock('./desktop/opener', () => opener)
    // watch.ts 一 import 就會接線 projects.ts 的訂閱出口，這裡整支模組替換掉，不連真的
    vi.doMock('./desktop/watch', () => watch)
    vi.doMock('./web-gateway', () => ({ webGateway: webGatewayFake }))

    const { desktopGateway } = await import('./desktop-gateway')

    const expectedBySource: { [K in keyof OpenSpecGateway]: unknown } = {
      listChanges: reads.listChanges,
      getChangeDetail: reads.getChangeDetail,
      toggleTask: tasks.toggleTask,
      subscribeToChanges: watch.subscribeToChanges,
      listProjects: projects.listProjects,
      addProject: projects.addProject,
      removeProject: projects.removeProject,
      switchProject: projects.switchProject,
      listSpecs: reads.listSpecs,
      getSpecContent: reads.getSpecContent,
      listParked: parked.listParked,
      parkChange: park.parkChange,
      unparkChange: park.unparkChange,
      getParkedDetail: parked.getParkedDetail,
      listArchived: archived.listArchived,
      getArchivedDetail: archived.getArchivedDetail,
      listRoadmap: roadmap.listRoadmap,
      pickFolder: folderPicker.pickFolder,
      getCliSettings: cli.cliSettings,
      applyCliPath: cli.applyOverride,
      redetectCli: cli.redetect,
      getDiagnostics: diagnosticsFn,
      revealPath: opener.revealPath,
      openUrl: opener.openUrl,
    }

    // 逐一比對兩份實作的方法參照：desktopGateway 的每個方法都要等於桌面自己
    // 的模組匯出，且不等於 webGatewayFake 上同名的假函式。
    for (const key of Object.keys(expectedBySource) as (keyof OpenSpecGateway)[]) {
      expect(desktopGateway[key], `${key} 應指向桌面自己的實作`).toBe(expectedBySource[key])
      expect(desktopGateway[key], `${key} 不應落在 web 形態的實作上`).not.toBe(webGatewayFake[key])
    }

    // desktopGateway 未從 web-gateway 展開任何方法：webGatewayFake 上定義的方法數
    // 與比對過的方法數一致，確認沒有漏比對的方法（介面新增方法時，這裡也要跟著補）。
    expect(Object.keys(expectedBySource)).toHaveLength(Object.keys(webGatewayFake).length)
  })
})
