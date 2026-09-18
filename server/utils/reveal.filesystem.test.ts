import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { revealPath } from './reveal'

/**
 * `revealPath` 認不認得出應用程式包，對著**真的**檔案系統驗一次。
 *
 * 同目錄的 `reveal.test.ts` 把 `stat` 與 `realpath` 都換成假的，驗的是「答案是
 * 這樣時分岔走到哪一條命令列」；假物件怎麼回答是測試自己寫的，所以那一檔驗不到
 * 判定本身對不對。這一檔在暫存目錄造真的目錄、真的 symlink，讓 `revealPath` 自己
 * 去問檔案系統。被換掉的只有 `execFile`——不換的話 `open` 會真的跳出 Finder。
 *
 * 造出來的 `.app` 都是純目錄，裡面沒有任何可執行檔，就算哪天攔漏了也沒有東西能
 * 被啟動。純目錄仍足以驗判定：macOS 只憑 `.app` 這個副檔名認定應用程式包，與包內
 * 結構無關（`reveal.ts` 的 `openableFolder` 檔頭記了實測出處）。
 *
 * 四條陷阱各佔一條測試，都是實測踩出來的：副檔名大寫 `.APP` 照樣被啟動；指向
 * `.app`、自己不以 `.app` 結尾的 symlink 照樣被啟動；反過來，自己叫 `.app`、指向
 * 普通資料夾的 symlink macOS 報 `public.folder`，`open` 不啟動任何東西，所以要直接
 * 開起來；而 `Contents/MacOS/` 俱全卻不以 `.app` 結尾的目錄不會被啟動，所以不能改
 * 以包內結構判定。
 *
 * 所有 fixture 都放在一個自己造的 symlink 後面（`base` 是 symlink、`realBase` 是它
 * 指向的位置）。開起那條交給 `open` 的必須是解過 symlink 的路徑，路徑本身不經過
 * symlink 的話解過與沒解過長得一樣，那條斷言就等於沒驗。
 *
 * 這一檔只在 macOS 有意義：`canReveal()` 只認 darwin，其餘平台每一條都會落在
 * unsupported，所以整組 skipIf 掉——`reveal.test.ts` 那一檔把平台釘成 darwin 後
 * 在任何平台都跑得起來，分岔邏輯的覆蓋不會因此掉在 macOS 以外的 CI 上。
 */

vi.mock('node:child_process', () => ({ execFile: vi.fn() }))

const execFileMock = vi.mocked(execFile)

let root: string
let base: string

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'specrun-reveal-'))
  const realBase = path.join(root, 'real')
  await mkdir(realBase)
  base = path.join(root, 'via-link')
  await symlink(realBase, base)
})

beforeEach(() => {
  execFileMock.mockImplementation((..._args: unknown[]) => {
    const callback = _args[_args.length - 1] as (error: Error | null) => void
    callback(null)
    return {} as ReturnType<typeof execFile>
  })
})

afterEach(() => {
  execFileMock.mockReset()
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

async function argsHandedToOpen(target: string): Promise<unknown> {
  await expect(revealPath(target)).resolves.toEqual({ status: 'revealed' })
  expect(execFileMock).toHaveBeenCalledOnce()
  const [command, args] = execFileMock.mock.calls[0]!
  expect(command).toBe('/usr/bin/open')
  return args
}

describe.skipIf(process.platform !== 'darwin')('revealPath 對真的檔案系統的應用程式包判定', () => {
  it('一般資料夾開起它本身，交出去的是解過 symlink 的路徑', async () => {
    const target = path.join(base, 'plain-folder')
    await mkdir(target)
    const resolved = await realpath(target)
    expect(resolved).not.toBe(target)

    expect(await argsHandedToOpen(target)).toEqual(['--', resolved])
  })

  it('.app 目錄走選取，不交給 open 開起來', async () => {
    const target = path.join(base, 'Probe.app')
    await mkdir(target)

    expect(await argsHandedToOpen(target)).toEqual(['-R', '--', target])
  })

  it('副檔名大寫的 .APP 目錄一樣走選取——比對忽略大小寫', async () => {
    const target = path.join(base, 'Upper.APP')
    await mkdir(target)

    expect(await argsHandedToOpen(target)).toEqual(['-R', '--', target])
  })

  it('指向 .app、自己不以 .app 結尾的 symlink 一樣走選取——副檔名取自解過 symlink 的路徑', async () => {
    const bundle = path.join(base, 'Linked.app')
    await mkdir(bundle)
    const target = path.join(base, 'link-to-bundle')
    await symlink(bundle, target)

    expect(await argsHandedToOpen(target)).toEqual(['-R', '--', target])
  })

  it('自己叫 .app、指向普通資料夾的 symlink 照樣開起它指到的那個資料夾——副檔名只看解過 symlink 的那一端', async () => {
    const real = path.join(base, 'plain-target')
    await mkdir(real)
    const target = path.join(base, 'FakeLink.app')
    await symlink(real, target)

    expect(await argsHandedToOpen(target)).toEqual(['--', await realpath(real)])
  })

  it('不以 .app 結尾的目錄照樣開起它本身，就算 Contents/MacOS/ 俱全——判定不看包內結構', async () => {
    const target = path.join(base, 'NoExtProbe')
    await mkdir(path.join(target, 'Contents', 'MacOS'), { recursive: true })
    await writeFile(path.join(target, 'Contents', 'Info.plist'), '')

    expect(await argsHandedToOpen(target)).toEqual(['--', await realpath(target)])
  })
})
