import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 桌面形態的流程檔版本讀取與更新（對應 server/utils/workflow-files.test.ts）。
 * 外殼通道、CLI 執行、設定、授權都以假的替換，`./paths` 與共用解析照常跑真邏輯。
 */

/** 內文很長且內含另一個 generatedBy：讀超過 frontmatter 就會被看出來 */
const BODY = `\ngeneratedBy: "9.9.9"\n${'x'.repeat(4000)}\n`

function skill(generatedBy: string | null): string {
  return `---\nname: x\nmetadata:\n${generatedBy ? `  generatedBy: "${generatedBy}"\n` : ''}---${BODY}`
}

interface Project {
  /** 不存在的資料夾 */
  missing?: boolean
  /** 各 skill 檔的 generatedBy；key 為目錄名 */
  skills?: Record<string, string | null>
  /** 這些 skill 檔讀取時丟錯 */
  unreadable?: string[]
  /** 授權時丟錯 */
  denied?: boolean
}

interface OpenFile { file: string, bytes: Uint8Array, offset: number, closed: boolean }

function makeFakes(projects: Record<string, Project>, cli: { bin: string | null, version: string | null } = { bin: 'openspec', version: '1.14.1' }) {
  const open: OpenFile[] = []
  const shell = {
    canonicalPath: vi.fn(async (p: string) => {
      if (projects[p]?.missing || !projects[p])
        throw new Error(`ENOENT ${p}`)
      return p
    }),
    statPath: vi.fn(async () => ({ isDirectory: true, birthtime: 1, mtime: 1 })),
    readDir: vi.fn(async (dir: string) => {
      const project = Object.keys(projects).find(p => dir === `${p}/.claude/skills`)
      if (!project || !projects[project]!.skills)
        throw new Error(`ENOENT ${dir}`)
      return Object.keys(projects[project]!.skills!).map(name => ({ name, isDirectory: true, isFile: false, isSymlink: false }))
    }),
    openFileForRead: vi.fn(async (file: string) => {
      const [, project, name] = /^(.*)\/\.claude\/skills\/([^/]+)\/SKILL\.md$/.exec(file)!
      if (projects[project!]!.unreadable?.includes(name!))
        throw new Error(`EACCES ${file}`)
      const rid = open.length
      open.push({ file, bytes: new TextEncoder().encode(skill(projects[project!]!.skills![name!]!)), offset: 0, closed: false })
      return rid
    }),
    readFileChunk: vi.fn(async (rid: number, len: number) => {
      const handle = open[rid]!
      const chunk = handle.bytes.slice(handle.offset, handle.offset + len)
      handle.offset += chunk.length
      return chunk
    }),
    closeResource: vi.fn(async (rid: number) => {
      open[rid]!.closed = true
    }),
  }
  const cliModule = {
    cliSettings: vi.fn(async () => ({ mode: 'auto', message: null, ...cli })),
    runCli: vi.fn(),
  }
  const configModule = { config: vi.fn(async () => ({ projects: Object.keys(projects), lastActivePath: null, openspecBin: null })) }
  const projectsModule = {
    ensureAccess: vi.fn(async (p: string) => {
      if (projects[p]?.denied)
        throw new Error('forbidden')
    }),
  }
  return { shell, open, cliModule, configModule, projectsModule }
}

async function load(fakes: ReturnType<typeof makeFakes>) {
  vi.doMock('./shell', () => fakes.shell)
  vi.doMock('./cli', () => fakes.cliModule)
  vi.doMock('./config-store', () => fakes.configModule)
  vi.doMock('./projects', () => fakes.projectsModule)
  return import('./workflow-files')
}

describe('desktop/workflow-files: listWorkflowFiles', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('逐專案先授權再讀；版本取最舊並與 CLI 比較', async () => {
    const fakes = makeFakes({
      '/a': { skills: { 'openspec-x': '1.14.1', 'openspec-y': '1.8.0', 'other-skill': '0.0.1' } },
      '/b': { skills: { 'openspec-x': '1.14.1' } },
    })
    const { listWorkflowFiles } = await load(fakes)

    expect(await listWorkflowFiles()).toEqual({
      ok: true,
      entries: [
        { path: '/a', version: '1.8.0', status: 'behind' },
        { path: '/b', version: '1.14.1', status: 'current' },
      ],
    })
    expect(fakes.projectsModule.ensureAccess.mock.calls.map(c => c[0])).toEqual(['/a', '/b'])
    // 每個專案都是先授權、後讀檔
    const { ensureAccess } = fakes.projectsModule
    for (const [index, project] of ['/a', '/b'].entries()) {
      const grant = ensureAccess.mock.invocationCallOrder[index]!
      const reads = [...fakes.shell.readDir.mock.calls, ...fakes.shell.openFileForRead.mock.calls]
        .map((call, i) => ({ path: call[0] as string, order: [...fakes.shell.readDir.mock.invocationCallOrder, ...fakes.shell.openFileForRead.mock.invocationCallOrder][i]! }))
        .filter(read => read.path.startsWith(`${project}/`))
      expect(reads.length).toBeGreaterThan(0)
      expect(reads.every(read => read.order > grant)).toBe(true)
    }
    // 非 openspec-* 目錄不讀
    expect(fakes.shell.openFileForRead.mock.calls.map(c => c[0])).not.toContain('/a/.claude/skills/other-skill/SKILL.md')
  })

  it('只讀到 frontmatter 結束就停：每個檔只讀開頭一段，不讀內文，且一定關檔', async () => {
    const fakes = makeFakes({
      '/a': { skills: { 'openspec-x': '1.14.1', 'openspec-y': '1.8.0' } },
      '/b': { skills: { 'openspec-x': '1.14.1' } },
    })
    const { listWorkflowFiles } = await load(fakes)
    await listWorkflowFiles()

    expect(fakes.open).toHaveLength(3)
    for (const handle of fakes.open) {
      // 檔案本身遠大於一段，但只讀了一段（512 位元組），內文裡的 9.9.9 不會被碰到
      expect(handle.bytes.length).toBeGreaterThan(4000)
      expect(handle.offset).toBe(512)
      expect(handle.closed).toBe(true)
    }
    expect(fakes.shell.readFileChunk).toHaveBeenCalledTimes(3)
    expect(fakes.shell.closeResource).toHaveBeenCalledTimes(3)
  })

  it('資料夾不存在、授權失敗、沒有 skills 目錄、檔案讀不到：各自獨立，不拖垮其他專案', async () => {
    const fakes = makeFakes({
      '/gone': { missing: true },
      '/denied': { denied: true, skills: { 'openspec-x': '1.13.1' } },
      '/bare': {},
      '/partial': { skills: { 'openspec-x': '1.13.1', 'openspec-y': '1.2.0' }, unreadable: ['openspec-y'] },
      '/ok': { skills: { 'openspec-x': '1.14.1' } },
    })
    const { listWorkflowFiles } = await load(fakes)

    expect(await listWorkflowFiles()).toEqual({
      ok: true,
      entries: [
        { path: '/gone', version: null, status: 'missing' },
        { path: '/denied', version: null, status: 'missing' },
        { path: '/bare', version: null, status: 'unset' },
        { path: '/partial', version: '1.13.1', status: 'behind' },
        { path: '/ok', version: '1.14.1', status: 'current' },
      ],
    })
    // 授權失敗的專案不讀它底下任何東西
    const touched = [...fakes.shell.readDir.mock.calls, ...fakes.shell.openFileForRead.mock.calls].map(c => c[0] as string)
    expect(touched.some(p => p.startsWith('/denied/'))).toBe(false)
    // 讀得到的檔都關了；讀不到的檔根本沒開
    expect(fakes.open.every(handle => handle.closed)).toBe(true)
    expect(fakes.open.map(h => h.file)).not.toContain('/partial/.claude/skills/openspec-y/SKILL.md')
  })

  it('讀取中途失敗：該檔視為沒有版本，仍然關檔，其他檔不受影響', async () => {
    const fakes = makeFakes({ '/a': { skills: { 'openspec-x': '1.13.1', 'openspec-y': '1.2.0' } } })
    fakes.shell.readFileChunk.mockImplementation(async (rid: number, len: number) => {
      const handle = fakes.open[rid]!
      if (handle.file.includes('openspec-y'))
        throw new Error('EIO')
      const chunk = handle.bytes.slice(handle.offset, handle.offset + len)
      handle.offset += chunk.length
      return chunk
    })
    const { listWorkflowFiles } = await load(fakes)

    expect(await listWorkflowFiles()).toEqual({ ok: true, entries: [{ path: '/a', version: '1.13.1', status: 'behind' }] })
    expect(fakes.open).toHaveLength(2)
    expect(fakes.open.every(handle => handle.closed)).toBe(true)
  })

  it('cli 不可用：只回版本，status 為 null', async () => {
    const fakes = makeFakes({ '/a': { skills: { 'openspec-x': '1.13.1' } } }, { bin: null, version: null })
    const { listWorkflowFiles } = await load(fakes)

    expect(await listWorkflowFiles()).toEqual({ ok: true, entries: [{ path: '/a', version: '1.13.1', status: null }] })
  })

  it('通道本身出事（讀不到設定）：ok:false，不丟例外', async () => {
    const fakes = makeFakes({})
    fakes.configModule.config.mockRejectedValue(new Error('boom'))
    const { listWorkflowFiles } = await load(fakes)

    expect(await listWorkflowFiles()).toEqual({ ok: false, message: 'boom' })
  })
})

describe('desktop/workflow-files: updateWorkflowFiles', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('成功：以 [update, 路徑] 執行，不加 --force', async () => {
    const fakes = makeFakes({ '/a': {} })
    fakes.cliModule.runCli.mockResolvedValue({ ok: true, exitCode: 0, stdout: 'Updated: Claude Code (v1.14.1)', stderr: '' })
    const { updateWorkflowFiles } = await load(fakes)

    expect(await updateWorkflowFiles('/a')).toEqual({ ok: true })
    expect(fakes.cliModule.runCli).toHaveBeenCalledWith(['update', '/a'], '/a')
  })

  it('警告：成功但輸出含 ⚠，附上警告文字', async () => {
    const fakes = makeFakes({ '/a': {} })
    fakes.cliModule.runCli.mockResolvedValue({ ok: true, exitCode: 0, stdout: '⚠ Run with --force to auto-cleanup legacy files, or run interactively.', stderr: '' })
    const { updateWorkflowFiles } = await load(fakes)

    expect(await updateWorkflowFiles('/a')).toEqual({
      ok: true,
      warning: '⚠ Run with --force to auto-cleanup legacy files, or run interactively.',
    })
  })

  it('失敗：非 0 結束、逾時等沒跑成、例外，都以回傳值表達', async () => {
    const fakes = makeFakes({ '/a': {} })
    const { updateWorkflowFiles } = await load(fakes)

    fakes.cliModule.runCli.mockResolvedValueOnce({ ok: true, exitCode: 1, stdout: '', stderr: 'boom' })
    expect(await updateWorkflowFiles('/a')).toEqual({ ok: false, message: 'boom' })

    fakes.cliModule.runCli.mockResolvedValueOnce({ ok: false, failure: { kind: 'spawn-failed', message: 'did not finish within 15000ms.' } })
    expect(await updateWorkflowFiles('/a')).toEqual({ ok: false, message: 'did not finish within 15000ms.' })

    fakes.cliModule.runCli.mockRejectedValueOnce(new Error('exploded'))
    expect(await updateWorkflowFiles('/a')).toEqual({ ok: false, message: 'exploded' })

    // 設定讀不到也不逸出例外
    fakes.configModule.config.mockRejectedValueOnce(new Error('no config'))
    expect(await updateWorkflowFiles('/a')).toEqual({ ok: false, message: 'no config' })
  })

  it('清單外路徑：拒絕，不呼叫 CLI', async () => {
    const fakes = makeFakes({ '/a': {} })
    const { updateWorkflowFiles } = await load(fakes)

    expect(await updateWorkflowFiles('/etc')).toMatchObject({ ok: false })
    expect(await updateWorkflowFiles('')).toMatchObject({ ok: false })
    // 變形：尾斜線、`..` 繞路、相對路徑、同名前綴、子資料夾
    for (const input of ['/a/', '/a/../a', '/a/.', 'a', '/a2', '/a/.claude', '/b/../etc'])
      expect(await updateWorkflowFiles(input)).toMatchObject({ ok: false })
    expect(fakes.cliModule.runCli).not.toHaveBeenCalled()
  })
})
