import { describe, expect, it } from 'vitest'
import { resolveOnPath } from './cli-resolver'

/**
 * 只留 node 這一側的 PATH 還原；解析的決策層（降級順序、覆寫優先、輸出取值）
 * 兩形態共用，測在 src/api/cli-resolve.test.ts。
 */

describe('resolveOnPath', () => {
  const exists = (...files: string[]) => async (file: string) => files.includes(file)

  it('取 PATH 上第一個命中的目錄，與 shell 的解析順序一致', async () => {
    const found = await resolveOnPath(
      'openspec',
      ['/usr/bin', '/opt/homebrew/bin', '/usr/local/bin'].join(':'),
      exists('/opt/homebrew/bin/openspec', '/usr/local/bin/openspec'),
    )
    expect(found).toBe('/opt/homebrew/bin/openspec')
  })

  it('pATH 為空或全數落空時回 null（呼叫端退回命令名）', async () => {
    expect(await resolveOnPath('openspec', undefined, exists())).toBeNull()
    expect(await resolveOnPath('openspec', '/usr/bin::', exists())).toBeNull()
  })
})
