import { describe, expect, it, vi } from 'vitest'

/**
 * `desktopGateway` 是接線層：已搬到桌面形態自持的方法要指到桌面實作，
 * 其餘方法沿用 web 實作（過渡期兩個行程並存）。不連真的 Tauri，
 * 各來源模組與 web-gateway 皆以假模組取代，只驗證「接對了誰」。
 */
describe('api/desktop-gateway: 桌面實作接線', () => {
  it('已搬遷的方法指向桌面實作，未搬遷的方法沿用 web 實作', async () => {
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
    const watch = { subscribeToChanges: vi.fn() }
    const webSubscribe = vi.fn()
    vi.doMock('./desktop/cli', () => cli)
    vi.doMock('./desktop/diagnostics', () => ({ diagnostics: diagnosticsFn }))
    vi.doMock('./desktop/projects', () => projects)
    vi.doMock('./desktop/reads', () => reads)
    vi.doMock('./desktop/tasks', () => tasks)
    vi.doMock('./desktop/park', () => park)
    vi.doMock('./desktop/parked', () => parked)
    vi.doMock('./desktop/archived', () => archived)
    // watch.ts 一 import 就會接線 projects.ts 的訂閱出口，這裡整支模組替換掉，不連真的
    vi.doMock('./desktop/watch', () => watch)
    vi.doMock('./web-gateway', () => ({
      webGateway: { subscribeToChanges: webSubscribe, getDiagnostics: vi.fn() },
    }))

    const { desktopGateway } = await import('./desktop-gateway')

    expect(desktopGateway.getCliSettings).toBe(cli.cliSettings)
    expect(desktopGateway.applyCliPath).toBe(cli.applyOverride)
    expect(desktopGateway.redetectCli).toBe(cli.redetect)
    expect(desktopGateway.getDiagnostics).toBe(diagnosticsFn)
    expect(desktopGateway.listProjects).toBe(projects.listProjects)
    expect(desktopGateway.addProject).toBe(projects.addProject)
    expect(desktopGateway.removeProject).toBe(projects.removeProject)
    expect(desktopGateway.switchProject).toBe(projects.switchProject)
    expect(desktopGateway.listChanges).toBe(reads.listChanges)
    expect(desktopGateway.getChangeDetail).toBe(reads.getChangeDetail)
    expect(desktopGateway.listSpecs).toBe(reads.listSpecs)
    expect(desktopGateway.getSpecContent).toBe(reads.getSpecContent)
    expect(desktopGateway.toggleTask).toBe(tasks.toggleTask)
    expect(desktopGateway.parkChange).toBe(park.parkChange)
    expect(desktopGateway.unparkChange).toBe(park.unparkChange)
    expect(desktopGateway.listParked).toBe(parked.listParked)
    expect(desktopGateway.getParkedDetail).toBe(parked.getParkedDetail)
    expect(desktopGateway.listArchived).toBe(archived.listArchived)
    expect(desktopGateway.getArchivedDetail).toBe(archived.getArchivedDetail)
    // 已搬遷：不再落到 web 形態的實作
    expect(desktopGateway.subscribeToChanges).toBe(watch.subscribeToChanges)
    expect(desktopGateway.subscribeToChanges).not.toBe(webSubscribe)
  })
})
