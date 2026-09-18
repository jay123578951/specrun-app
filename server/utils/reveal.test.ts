import { execFile } from 'node:child_process'
import { realpath, stat } from 'node:fs/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { revealPath } from './reveal'

/**
 * `revealPath` 依目標型別分岔（design D4，`open-project-folder-directly`）：
 * 目標是一般資料夾就 `/usr/bin/open -- <path>` 把那個資料夾本身開起來；其餘
 * 一律 `/usr/bin/open -R -- <path>`，在 Finder 中選取該項目而不開啟它。走選取
 * 的有兩種：檔案（設定檔按下去不該跳出編輯器），以及 macOS 的應用程式包——
 * 一個 `.app` 目錄 `stat()` 底下 `isDirectory()` 為真，交給不帶 `-R` 的那條就是
 * 啟動那個應用程式。兩條都補 `--` 分隔旗標與路徑。
 *
 * 這一檔的 `execFile`、`stat`、`realpath` 全是假的，不碰真的檔案系統也不碰真的
 * Finder：驗的是「答案是這樣時分岔走到哪一條命令列」。`.app` 的判定本身（哪些
 * 路徑會被認成應用程式包）假物件驗不到，那部分對著真的檔案系統驗，在同目錄的
 * `reveal.filesystem.test.ts`。
 *
 * 平台分支另外驗一次非 macOS 仍回 unsupported——`canReveal()` 答的是這個平台
 * 辦不辦得到，跟路徑指向什麼無關，不隨分岔而動。
 *
 * 每一條開跑前先把 `process.platform` 釘成 `darwin`，最後那條專驗非 macOS 的自己
 * 再蓋掉：不釘的話，`canReveal()` 在 macOS 以外一律為假，除了最後那條以外每一條
 * 都會落在 unsupported 而驗不到分岔。釘住之後這一檔在任何平台都跑得起來——它的
 * `stat` 與 `realpath` 都是假的，沒碰任何平台專屬的檔案系統行為。
 */

vi.mock('node:child_process', () => ({ execFile: vi.fn() }))
vi.mock('node:fs/promises', () => ({ realpath: vi.fn(), stat: vi.fn() }))

const execFileMock = vi.mocked(execFile)
const statMock = vi.mocked(stat)
const realpathMock = vi.mocked(realpath)

function execFileSucceeds(): void {
  execFileMock.mockImplementation((..._args: unknown[]) => {
    const callback = _args[_args.length - 1] as (error: Error | null) => void
    callback(null)
    return {} as ReturnType<typeof execFile>
  })
}

function statSaysDirectory(isDirectory: boolean): void {
  statMock.mockResolvedValue({ isDirectory: () => isDirectory } as Awaited<ReturnType<typeof stat>>)
}

describe('revealPath', () => {
  const originalPlatform = process.platform

  beforeEach(() => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })
    execFileMock.mockReset()
    statMock.mockReset()
    realpathMock.mockReset()
  })

  it('目標是一般資料夾時，open 不帶 -R，把該資料夾本身開起來', async () => {
    statSaysDirectory(true)
    realpathMock.mockResolvedValue('/repo/project')
    execFileSucceeds()

    await expect(revealPath('/repo/project')).resolves.toEqual({ status: 'revealed' })
    expect(execFileMock).toHaveBeenCalledWith('/usr/bin/open', ['--', '/repo/project'], expect.anything(), expect.any(Function))
  })

  it('目標是檔案時，open 帶 -R 與 -- 分隔，在其所在資料夾中選取該檔', async () => {
    statSaysDirectory(false)
    execFileSucceeds()

    await expect(revealPath('/repo/project/config.json')).resolves.toEqual({ status: 'revealed' })
    expect(execFileMock).toHaveBeenCalledWith('/usr/bin/open', ['-R', '--', '/repo/project/config.json'], expect.anything(), expect.any(Function))
  })

  it('目標是 .app 目錄時走選取那條，不走開起那條——開起等於啟動該應用程式', async () => {
    statSaysDirectory(true)
    realpathMock.mockResolvedValue('/Applications/Evil.app')
    execFileSucceeds()

    await expect(revealPath('/Applications/Evil.app')).resolves.toEqual({ status: 'revealed' })
    expect(execFileMock).toHaveBeenCalledWith('/usr/bin/open', ['-R', '--', '/Applications/Evil.app'], expect.anything(), expect.any(Function))
  })

  it('realpath 解不開時當成應用程式包，走選取那條，不開起任何東西', async () => {
    statSaysDirectory(true)
    realpathMock.mockRejectedValue(new Error('ELOOP'))
    execFileSucceeds()

    await expect(revealPath('/repo/tangled')).resolves.toEqual({ status: 'revealed' })
    expect(execFileMock).toHaveBeenCalledWith('/usr/bin/open', ['-R', '--', '/repo/tangled'], expect.anything(), expect.any(Function))
  })

  it('目標路徑以 - 開頭時，-- 分隔仍讓它被當成路徑而不是被 open 誤判成旗標（檔案分支）', async () => {
    statSaysDirectory(false)
    execFileSucceeds()

    await expect(revealPath('-weird-file')).resolves.toEqual({ status: 'revealed' })
    expect(execFileMock).toHaveBeenCalledWith('/usr/bin/open', ['-R', '--', '-weird-file'], expect.anything(), expect.any(Function))
  })

  it('stat 失敗（路徑不存在或讀不到）回 failed，不呼叫 open', async () => {
    statMock.mockRejectedValue(new Error('ENOENT'))

    await expect(revealPath('/repo/missing')).resolves.toEqual({ status: 'failed' })
    expect(execFileMock).not.toHaveBeenCalled()
  })

  it('非 macOS 一律回 unsupported，不呼叫 stat 或 open', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })

    await expect(revealPath('/repo/project')).resolves.toEqual({ status: 'unsupported' })
    expect(statMock).not.toHaveBeenCalled()
    expect(execFileMock).not.toHaveBeenCalled()
  })
})
