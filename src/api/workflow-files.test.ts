import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { buildWorkflowEntry, compareVersions, compareWithCli, extractGeneratedBy, oldestVersion, parseUpdateResult, readSkillHead } from './workflow-files'

const skill = (v: string) => `---\nname: openspec-explore\nmetadata:\n  author: openspec\n  version: "1.0"\n  generatedBy: "${v}"\n---\n\nbody generatedBy: "9.9.9"\n`

describe('extractGeneratedBy', () => {
  it('取開頭 frontmatter 的值，不看內文', () => {
    expect(extractGeneratedBy(skill('1.13.1'))).toBe('1.13.1')
  })

  it('沒有 generatedBy 或沒有 frontmatter 回 null', () => {
    expect(extractGeneratedBy('---\nname: x\n---\nbody')).toBeNull()
    expect(extractGeneratedBy('generatedBy: "1.0.0"')).toBeNull()
  })
})

describe('oldestVersion', () => {
  it('6 檔一致取該版本', () => {
    expect(oldestVersion(['1.14.1', '1.14.1', '1.14.1', '1.14.1', '1.14.1', '1.14.1'])).toBe('1.14.1')
  })

  it('5 檔 1.14.1 加 1 檔 1.8.0 取 1.8.0', () => {
    expect(oldestVersion(['1.14.1', '1.14.1', '1.8.0', '1.14.1', '1.14.1', '1.14.1'])).toBe('1.8.0')
  })

  it('沒有任何 generatedBy 為 null', () => {
    expect(oldestVersion([null, null])).toBeNull()
    expect(oldestVersion([])).toBeNull()
  })
})

describe('compareVersions', () => {
  it('1.2.0 比 1.14.1 舊（數字比較）', () => {
    expect(compareVersions('1.2.0', '1.14.1')).toBeLessThan(0)
    expect(compareVersions('1.14.1', '1.2.0')).toBeGreaterThan(0)
    expect(compareVersions('1.13.1', '1.13.1')).toBe(0)
  })
})

describe('compareWithCli', () => {
  it('落後、已是最新、比 CLI 新', () => {
    expect(compareWithCli('1.13.1', '1.14.1')).toBe('behind')
    expect(compareWithCli('1.14.1', '1.14.1')).toBe('current')
    expect(compareWithCli('1.14.1', '1.13.2')).toBe('ahead')
  })

  it('cLI 不可用時不產出比較結果', () => {
    expect(compareWithCli('1.14.1', null)).toBeNull()
    expect(buildWorkflowEntry({ path: '/p', exists: true, generatedBy: ['1.14.1'] }, null))
      .toEqual({ path: '/p', version: '1.14.1', status: null })
  })
})

describe('buildWorkflowEntry', () => {
  it('資料夾不存在與未設定，即使 CLI 不可用也有狀態', () => {
    expect(buildWorkflowEntry({ path: '/a', exists: false, generatedBy: [] }, null)).toEqual({ path: '/a', version: null, status: 'missing' })
    expect(buildWorkflowEntry({ path: '/b', exists: true, generatedBy: [null] }, '1.14.1')).toEqual({ path: '/b', version: null, status: 'unset' })
  })

  it('取最舊後與 CLI 比較', () => {
    expect(buildWorkflowEntry({ path: '/c', exists: true, generatedBy: ['1.14.1', '1.8.0'] }, '1.14.1'))
      .toEqual({ path: '/c', version: '1.8.0', status: 'behind' })
  })
})

describe('parseUpdateResult', () => {
  it('實測成功輸出：exit 0 為成功、無警告', () => {
    expect(parseUpdateResult({ exitCode: 0, stdout: 'Updating 1 tool(s): claude (1.13.1 -> 1.14.1)\nUpdated: Claude Code (v1.14.1)\n', stderr: '' })).toEqual({ ok: true })
    expect(parseUpdateResult({ exitCode: 0, stdout: 'All 1 tool(s) up to date (v1.14.1)\n', stderr: '' })).toEqual({ ok: true })
  })

  it('挑出 ⚠ 警告行', () => {
    const stdout = 'Updated: Claude Code (v1.14.1)\n\u001B[33m⚠ Run with --force to auto-cleanup legacy files, or run interactively.\u001B[0m\n'
    expect(parseUpdateResult({ exitCode: 0, stdout, stderr: '' }))
      .toEqual({ ok: true, warning: '⚠ Run with --force to auto-cleanup legacy files, or run interactively.' })
  })

  it('非 0 為失敗並附錯誤訊息，沒有輸出時給預設訊息', () => {
    expect(parseUpdateResult({ exitCode: 1, stdout: '', stderr: 'boom' })).toEqual({ ok: false, message: 'boom' })
    expect(parseUpdateResult({ exitCode: 2, stdout: '', stderr: '' })).toEqual({ ok: false, message: 'openspec update exited with code 2.' })
  })

  it('逾時、截斷、執行失敗為失敗', () => {
    expect(parseUpdateResult({ exitCode: null, stdout: '', stderr: '', timedOut: true }).ok).toBe(false)
    expect(parseUpdateResult({ exitCode: 0, stdout: '', stderr: '', truncated: true }).ok).toBe(false)
    expect(parseUpdateResult({ exitCode: null, stdout: '', stderr: '', failureMessage: 'ENOENT' })).toEqual({ ok: false, message: 'ENOENT' })
  })
})

describe('補充：extractGeneratedBy 格式變體', () => {
  it('單引號、無引號、CRLF 都能取到', () => {
    expect(extractGeneratedBy('---\nmetadata:\n  generatedBy: \'1.8.0\'\n---\n')).toBe('1.8.0')
    expect(extractGeneratedBy('---\nmetadata:\n  generatedBy: 1.2.0\n---\n')).toBe('1.2.0')
    expect(extractGeneratedBy('---\r\nmetadata:\r\n  generatedBy: "1.13.1"\r\n---\r\nbody')).toBe('1.13.1')
  })

  it('專案實際的 SKILL.md 讀得到版本', () => {
    const text = readFileSync(new URL('../../.claude/skills/openspec-explore/SKILL.md', import.meta.url), 'utf8')
    expect(extractGeneratedBy(text)).toMatch(/^\d+\.\d+\.\d+$/)
  })
})

describe('補充：多專案各自判斷（each 語意）', () => {
  it('spec 的 6 專案情境：4 落後、1 最新、1 未設定', () => {
    const cases: [string[], string][] = [
      [['1.13.1'], 'behind'],
      [['1.13.1', '1.13.1'], 'behind'],
      [['1.2.0'], 'behind'],
      [['1.14.1', '1.8.0'], 'behind'],
      [['1.14.1'], 'current'],
      [[], 'unset'],
    ]
    const statuses = cases.map(([g], i) => buildWorkflowEntry({ path: `/p${i}`, exists: true, generatedBy: g }, '1.14.1').status)
    expect(statuses).toEqual(cases.map(c => c[1]))
  })

  it('資料夾不存在優先於版本；比 CLI 新', () => {
    expect(buildWorkflowEntry({ path: '/x', exists: false, generatedBy: ['1.14.1'] }, '1.14.1').status).toBe('missing')
    expect(buildWorkflowEntry({ path: '/y', exists: true, generatedBy: ['1.14.1'] }, '1.13.2').status).toBe('ahead')
  })
})

describe('補充：parseUpdateResult 邊界', () => {
  it('多行警告與 stderr 警告都保留；非警告行不混入', () => {
    const r = parseUpdateResult({ exitCode: 0, stdout: 'Updated\n⚠ one\n', stderr: '⚠ two\nnoise\n' })
    expect(r).toEqual({ ok: true, warning: '⚠ one\n⚠ two' })
  })

  it('非 0 且 stderr 空時用 stdout 當錯誤訊息；exit 0 帶 failureMessage 仍失敗', () => {
    expect(parseUpdateResult({ exitCode: 1, stdout: 'bad thing', stderr: '' })).toEqual({ ok: false, message: 'bad thing' })
    expect(parseUpdateResult({ exitCode: 0, stdout: '', stderr: '', failureMessage: 'spawn failed' })).toEqual({ ok: false, message: 'spawn failed' })
  })

  it('逾時與截斷的訊息可辨識，且失敗不帶 warning', () => {
    const t = parseUpdateResult({ exitCode: null, stdout: '⚠ x', stderr: '', timedOut: true })
    expect(t).toEqual({ ok: false, message: expect.stringMatching(/timed out/i) })
  })
})

describe('readSkillHead', () => {
  function reader(content: string | Uint8Array) {
    const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content
    let offset = 0
    const readChunk = vi.fn(async (len: number) => {
      const chunk = bytes.slice(offset, offset + len)
      offset += chunk.length
      return chunk
    })
    return { readChunk, consumed: () => offset }
  }

  it('frontmatter 在第一段內結束：只讀一段，內文不讀', async () => {
    const { readChunk, consumed } = reader(`${skill('1.13.1')}${'x'.repeat(5000)}`)
    const text = await readSkillHead(readChunk)

    expect(readChunk).toHaveBeenCalledTimes(1)
    expect(consumed()).toBe(512)
    expect(extractGeneratedBy(text)).toBe('1.13.1')
  })

  it('frontmatter 跨多段：讀到結束行那一段就停，後面的內文與其中的 generatedBy 不讀', async () => {
    const filler = `description: ${'d'.repeat(1200)}\n`
    const content = `---\nname: x\n${filler}metadata:\n  generatedBy: "1.8.0"\n---\n${'y'.repeat(4000)}\ngeneratedBy: "9.9.9"\n`
    const { readChunk, consumed } = reader(content)
    const text = await readSkillHead(readChunk)

    expect(extractGeneratedBy(text)).toBe('1.8.0')
    // frontmatter 約 1250 位元組 → 第三段讀完就停，不會讀到整個檔
    expect(readChunk.mock.calls.length).toBe(3)
    expect(consumed()).toBe(1536)
    expect(consumed()).toBeLessThan(content.length)
  })

  it('不是以 --- 開頭：讀第一段就停', async () => {
    const { readChunk, consumed } = reader(`# no frontmatter\ngeneratedBy: "1.0.0"\n${'z'.repeat(5000)}`)
    const text = await readSkillHead(readChunk)

    expect(readChunk).toHaveBeenCalledTimes(1)
    expect(consumed()).toBe(512)
    expect(extractGeneratedBy(text)).toBeNull()
  })

  it('frontmatter 一直不結束：累計 8192 位元組封頂，每段不超過 512', async () => {
    const { readChunk, consumed } = reader(`---\n${'a: b\n'.repeat(5000)}`)
    const text = await readSkillHead(readChunk)

    expect(consumed()).toBe(8192)
    expect(readChunk).toHaveBeenCalledTimes(16)
    expect(readChunk.mock.calls.every(([len]) => len <= 512)).toBe(true)
    expect(text.length).toBe(8192)
  })

  it('檔案比一段短、空檔、檔尾：讀到檔尾就停，不無限重讀', async () => {
    const short = reader('---\nname: x\n')
    expect(await readSkillHead(short.readChunk)).toBe('---\nname: x\n')
    expect(short.readChunk).toHaveBeenCalledTimes(2)

    const empty = reader('')
    expect(await readSkillHead(empty.readChunk)).toBe('')
    expect(empty.readChunk).toHaveBeenCalledTimes(1)
  })

  it('多位元組字元剛好被段界切開：合併後不亂碼，版本照常取到', async () => {
    // 「中」為 3 位元組；讓它的第 1 個位元組落在第 512 位元組、其餘落到下一段
    const head = '---\nname: x\ndescription: '
    const pad = 'a'.repeat(512 - head.length - 1)
    const content = `${head}${pad}中文說明\nmetadata:\n  generatedBy: "1.13.1"\n---\nbody`
    const bytes = new TextEncoder().encode(content)
    expect(bytes[511]).toBe(0xE4) // 「中」的第一個位元組在段尾
    const { readChunk } = reader(bytes)
    const text = await readSkillHead(readChunk)

    expect(text).toContain('中文說明')
    expect(text).not.toContain('\uFFFD')
    expect(extractGeneratedBy(text)).toBe('1.13.1')
  })
})
