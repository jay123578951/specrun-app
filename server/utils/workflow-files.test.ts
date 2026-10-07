import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 專案流程檔版本的讀取與更新（web 形態）。讀檔走真的暫存資料夾；專案清單、CLI
 * 解析與 CLI 執行以假的替換，驗證：版本取最舊、單一專案失敗不拖垮其他、
 * 清單外路徑被拒且不呼叫 CLI、不加 --force。
 */

let root: string
const runCli = vi.fn()

function skill(generatedBy: string | null): string {
  const meta = generatedBy ? `  generatedBy: "${generatedBy}"\n` : ''
  return `---\nname: x\nmetadata:\n  author: openspec\n${meta}---\n\nbody\n`
}

async function makeProject(name: string, versions: (string | null)[]): Promise<string> {
  const dir = path.join(root, name)
  for (const [index, version] of versions.entries()) {
    const skillDir = path.join(dir, '.claude', 'skills', `openspec-s${index}`)
    await mkdir(skillDir, { recursive: true })
    await writeFile(path.join(skillDir, 'SKILL.md'), skill(version))
  }
  await mkdir(dir, { recursive: true })
  return dir
}

async function load(projects: string[], cli: { bin: string | null, version: string | null }) {
  vi.doMock('./project-state', () => ({
    projectEntries: async () => projects.map(p => ({ path: p, current: false, temporary: false })),
  }))
  vi.doMock('./cli-resolver', () => ({ cliSettings: async () => ({ mode: 'auto', message: null, ...cli }) }))
  vi.doMock('./openspec-cli', () => ({ runCli, toProbeFailure: () => ({ kind: 'cli-unavailable', message: 'cannot run' }) }))
  return import('./workflow-files')
}

describe('server/utils/workflow-files', () => {
  beforeEach(async () => {
    vi.resetModules()
    runCli.mockReset()
    root = await mkdtemp(path.join(os.tmpdir(), 'wf-'))
  })

  afterEach(async () => {
    vi.doUnmock('node:fs/promises')
    await rm(root, { recursive: true, force: true })
  })

  it('列出各專案：取最舊版本、與 CLI 比較、未設定、資料夾不存在，彼此獨立', async () => {
    const mixed = await makeProject('mixed', ['1.14.1', '1.14.1', '1.8.0'])
    const current = await makeProject('current', ['1.14.1'])
    const unset = await makeProject('unset', [null])
    const gone = path.join(root, 'gone')
    const { listProjectWorkflowFiles } = await load([mixed, current, unset, gone], { bin: 'openspec', version: '1.14.1' })

    expect(await listProjectWorkflowFiles()).toEqual([
      { path: mixed, version: '1.8.0', status: 'behind' },
      { path: current, version: '1.14.1', status: 'current' },
      { path: unset, version: null, status: 'unset' },
      { path: gone, version: null, status: 'missing' },
    ])
  })

  it('cli 不可用：只回版本，status 為 null', async () => {
    const mixed = await makeProject('mixed', ['1.13.1'])
    const { listProjectWorkflowFiles } = await load([mixed], { bin: null, version: null })

    expect(await listProjectWorkflowFiles()).toEqual([{ path: mixed, version: '1.13.1', status: null }])
  })

  it('沒有 .claude/skills 的專案回未設定', async () => {
    const bare = path.join(root, 'bare')
    await mkdir(bare)
    const { listProjectWorkflowFiles } = await load([bare], { bin: 'openspec', version: '1.14.1' })

    expect(await listProjectWorkflowFiles()).toEqual([{ path: bare, version: null, status: 'unset' }])
  })

  it('更新：清單內路徑以 [update, 路徑] 執行，不加 --force', async () => {
    const project = await makeProject('p', ['1.13.1'])
    runCli.mockResolvedValue({ error: null, stdout: 'Updated: Claude Code (v1.14.1)\n', stderr: '' })
    const { updateProjectWorkflowFiles } = await load([project], { bin: 'openspec', version: '1.14.1' })

    expect(await updateProjectWorkflowFiles(project)).toEqual({ ok: true })
    expect(runCli).toHaveBeenCalledTimes(1)
    expect(runCli.mock.calls[0]![0]).toEqual(['update', project])
  })

  it('更新：輸出含 ⚠ 時附警告；結束代碼非 0 為失敗；spawn 失敗為失敗', async () => {
    const project = await makeProject('p', ['1.13.1'])
    const { updateProjectWorkflowFiles } = await load([project], { bin: 'openspec', version: '1.14.1' })

    runCli.mockResolvedValueOnce({ error: null, stdout: '⚠ Run with --force to auto-cleanup legacy files\n', stderr: '' })
    expect(await updateProjectWorkflowFiles(project)).toEqual({ ok: true, warning: '⚠ Run with --force to auto-cleanup legacy files' })

    runCli.mockResolvedValueOnce({ error: Object.assign(new Error('x'), { code: 1 }), stdout: '', stderr: 'boom' })
    expect(await updateProjectWorkflowFiles(project)).toEqual({ ok: false, message: 'boom' })

    runCli.mockResolvedValueOnce({ error: Object.assign(new Error('x'), { code: 'ENOENT' }), stdout: '', stderr: '' })
    expect(await updateProjectWorkflowFiles(project)).toEqual({ ok: false, message: 'cannot run' })
  })

  it('更新：清單外路徑被拒，不呼叫 CLI', async () => {
    const project = await makeProject('p', ['1.13.1'])
    const { updateProjectWorkflowFiles } = await load([project], { bin: 'openspec', version: '1.14.1' })

    for (const input of ['/etc', path.join(project, '..'), `${project}/../other`, '']) {
      expect(await updateProjectWorkflowFiles(input)).toMatchObject({ ok: false })
    }
    expect(runCli).not.toHaveBeenCalled()
  })

  it('更新：清單外的各種變形路徑都被拒，runCli 只會以清單內的精確路徑被呼叫', async () => {
    const project = await makeProject('p', ['1.13.1'])
    await makeProject('p2', ['1.13.1'])
    const { updateProjectWorkflowFiles } = await load([project], { bin: 'openspec', version: '1.14.1' })

    // 同名前綴的兄弟資料夾、子資料夾、相對路徑、`.`／`..`、含 `..` 繞出去的路徑
    for (const input of [`${project}2`, path.join(project, '.claude'), 'p', '.', '..', `${project}/../p2`, `${project}/sub/../../p2`]) {
      expect(await updateProjectWorkflowFiles(input)).toMatchObject({ ok: false })
    }
    expect(runCli).not.toHaveBeenCalled()

    // 繞一圈回到清單內同一個資料夾：正規化後就是清單內路徑，CLI 只拿到正規化的精確路徑
    runCli.mockResolvedValue({ error: null, stdout: '', stderr: '' })
    expect(await updateProjectWorkflowFiles(`${project}/`)).toEqual({ ok: true })
    expect(runCli.mock.calls.map(c => c[0])).toEqual([['update', project]])
    expect(runCli.mock.calls.every(c => !c[0].includes('--force'))).toBe(true)
  })

  it('更新：暫時項（不在持久化清單內）被拒，不呼叫 CLI', async () => {
    const project = await makeProject('p', ['1.13.1'])
    const temp = await makeProject('temp', ['1.13.1'])
    vi.doMock('./project-state', () => ({
      projectEntries: async () => [
        { path: temp, current: true, temporary: true },
        { path: project, current: false, temporary: false },
      ],
    }))
    vi.doMock('./cli-resolver', () => ({ cliSettings: async () => ({ mode: 'auto', message: null, bin: 'openspec', version: '1.14.1' }) }))
    vi.doMock('./openspec-cli', () => ({ runCli, toProbeFailure: () => ({ kind: 'cli-unavailable', message: 'cannot run' }) }))
    const { updateProjectWorkflowFiles } = await import('./workflow-files')

    expect(await updateProjectWorkflowFiles(temp)).toMatchObject({ ok: false })
    expect(runCli).not.toHaveBeenCalled()
  })

  it('更新：逾時（被殺、沒有數字結束代碼）與 stderr 警告都以回傳值表達', async () => {
    const project = await makeProject('p', ['1.13.1'])
    const { updateProjectWorkflowFiles } = await load([project], { bin: 'openspec', version: '1.14.1' })

    runCli.mockResolvedValueOnce({ error: Object.assign(new Error('timeout'), { killed: true, signal: 'SIGTERM' }), stdout: '', stderr: '' })
    expect(await updateProjectWorkflowFiles(project)).toEqual({ ok: false, message: 'cannot run' })

    runCli.mockResolvedValueOnce({ error: null, stdout: 'ok\n', stderr: '⚠ legacy files kept\n' })
    expect(await updateProjectWorkflowFiles(project)).toEqual({ ok: true, warning: '⚠ legacy files kept' })
  })

  it('列出：非 openspec- 前綴的 skill、同名的一般檔案、缺 SKILL.md 的目錄都不影響版本', async () => {
    const project = await makeProject('p', ['1.14.1'])
    const skills = path.join(project, '.claude', 'skills')
    await mkdir(path.join(skills, 'other-tool'), { recursive: true })
    await writeFile(path.join(skills, 'other-tool', 'SKILL.md'), skill('0.0.1'))
    await writeFile(path.join(skills, 'openspec-file'), skill('0.0.2'))
    await mkdir(path.join(skills, 'openspec-empty'))
    const { listProjectWorkflowFiles } = await load([project], { bin: 'openspec', version: '1.14.1' })

    expect(await listProjectWorkflowFiles()).toEqual([{ path: project, version: '1.14.1', status: 'current' }])
  })

  it('列出：路徑是檔案而非資料夾時回不存在，其餘專案照常', async () => {
    const ok = await makeProject('ok', ['1.14.1'])
    const file = path.join(root, 'afile')
    await writeFile(file, 'x')
    const { listProjectWorkflowFiles } = await load([file, ok], { bin: 'openspec', version: '1.14.1' })

    expect(await listProjectWorkflowFiles()).toEqual([
      { path: file, version: null, status: 'missing' },
      { path: ok, version: '1.14.1', status: 'current' },
    ])
  })

  it('更新：runCli 拋出例外時以回傳值表達', async () => {
    const project = await makeProject('p', ['1.13.1'])
    runCli.mockRejectedValue(new Error('exploded'))
    const { updateProjectWorkflowFiles } = await load([project], { bin: 'openspec', version: '1.14.1' })

    expect(await updateProjectWorkflowFiles(project)).toEqual({ ok: false, message: 'exploded' })
  })

  it('列出：只讀開頭 frontmatter，內文很長且再出現 generatedBy 也不採用，且不整檔讀入', async () => {
    const project = await makeProject('p', ['1.13.1'])
    const file = path.join(project, '.claude', 'skills', 'openspec-s0', 'SKILL.md')
    await writeFile(file, `${skill('1.13.1')}generatedBy: "9.9.9"\n${'x'.repeat(200_000)}\ngeneratedBy: "0.0.1"\n`)
    // 包住真的 fs：記下實際讀了幾個位元組、是否整檔讀入、檔案是否關閉
    const reads = { bytes: 0, wholeFile: 0, closed: 0, opened: 0 }
    vi.doMock('node:fs/promises', async (importOriginal) => {
      const real = await importOriginal<typeof import('node:fs/promises')>()
      return {
        ...real,
        readFile: (...args: Parameters<typeof real.readFile>) => {
          reads.wholeFile++
          return real.readFile(...args)
        },
        open: async (...args: Parameters<typeof real.open>) => {
          const handle = await real.open(...args)
          reads.opened++
          const read = handle.read.bind(handle) as (...a: unknown[]) => Promise<{ bytesRead: number }>
          const close = handle.close.bind(handle)
          Object.assign(handle, {
            read: async (...a: unknown[]) => {
              const result = await read(...a)
              reads.bytes += result.bytesRead
              return result
            },
            close: async () => {
              reads.closed++
              return close()
            },
          })
          return handle
        },
      }
    })
    const { listProjectWorkflowFiles } = await load([project], { bin: 'openspec', version: '1.14.1' })

    expect(await listProjectWorkflowFiles()).toEqual([{ path: project, version: '1.13.1', status: 'behind' }])
    expect(reads.wholeFile).toBe(0)
    expect(reads.opened).toBe(1)
    expect(reads.closed).toBe(1)
    // 檔案 200KB，實際只讀開頭一段
    expect(reads.bytes).toBeLessThanOrEqual(512)
  })

  it('列出：frontmatter 比一段長仍取得版本；不是 frontmatter 開頭的檔視為沒有版本', async () => {
    const long = await makeProject('long', ['1.2.0'])
    const longFile = path.join(long, '.claude', 'skills', 'openspec-s0', 'SKILL.md')
    await writeFile(longFile, `---\nname: x\ndescription: ${'d'.repeat(1500)}\nmetadata:\n  generatedBy: "1.2.0"\n---\nbody\n`)
    const plain = await makeProject('plain', ['1.13.1'])
    await writeFile(path.join(plain, '.claude', 'skills', 'openspec-s0', 'SKILL.md'), `# title\n  generatedBy: "1.13.1"\n`)
    const { listProjectWorkflowFiles } = await load([long, plain], { bin: 'openspec', version: '1.14.1' })

    expect(await listProjectWorkflowFiles()).toEqual([
      { path: long, version: '1.2.0', status: 'behind' },
      { path: plain, version: null, status: 'unset' },
    ])
  })
})
