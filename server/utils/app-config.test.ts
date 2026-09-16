import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { emptyConfig, readConfig, resolveConfigDir, writeConfig } from './app-config'

/**
 * node 這一側的檔案通道：讀壞不 crash（read）、寫入原子（write），加上設定目錄的平台分支。
 * 用真實暫存檔驗證，不 mock fs——「壞資料進來會怎樣」正是這裡唯一該測的行為。
 * 內容解析與寫出格式兩形態共用，測在 src/api/app-config.test.ts。
 */

describe('resolveConfigDir', () => {
  it('在 macOS 走 Application Support', () => {
    const dir = resolveConfigDir({ platform: 'darwin', env: {}, home: '/Users/x' })
    expect(dir).toBe('/Users/x/Library/Application Support/specrun-app')
  })

  it('在 Windows 優先用 APPDATA，缺了才退 home 下的慣例位置', () => {
    const withEnv = resolveConfigDir({ platform: 'win32', env: { APPDATA: 'C:\\Roaming' }, home: 'C:\\Users\\x' })
    expect(withEnv).toBe(path.join('C:\\Roaming', 'specrun-app'))

    const withoutEnv = resolveConfigDir({ platform: 'win32', env: {}, home: 'C:\\Users\\x' })
    expect(withoutEnv).toBe(path.join('C:\\Users\\x', 'AppData', 'Roaming', 'specrun-app'))
  })

  it('其餘平台走 XDG，未設定時退 ~/.config', () => {
    const withEnv = resolveConfigDir({ platform: 'linux', env: { XDG_CONFIG_HOME: '/xdg' }, home: '/home/x' })
    expect(withEnv).toBe('/xdg/specrun-app')

    const withoutEnv = resolveConfigDir({ platform: 'linux', env: {}, home: '/home/x' })
    expect(withoutEnv).toBe('/home/x/.config/specrun-app')
  })
})

describe('readConfig／writeConfig', () => {
  let dir: string
  let file: string

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'app-config-'))
    file = path.join(dir, 'nested', 'config.json')
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('寫入後讀回相同內容，目錄不存在時自動建立', async () => {
    await writeConfig({ projects: ['/a'], lastActivePath: '/a', openspecBin: '/opt/bin/openspec' }, file)
    expect(await readConfig(file)).toEqual({
      projects: ['/a'],
      lastActivePath: '/a',
      openspecBin: '/opt/bin/openspec',
    })
  })

  it('寫入不留下 temp 殘檔', async () => {
    await writeConfig({ projects: ['/a'], lastActivePath: null, openspecBin: null }, file)
    const entries = await readdir(path.dirname(file))
    expect(entries).toEqual(['config.json'])
  })

  it('檔案不存在時回空清單', async () => {
    expect(await readConfig(file)).toEqual(emptyConfig())
  })

  it('檔案被外部改壞時回空清單而非拋錯', async () => {
    const flat = path.join(dir, 'broken.json')
    await writeFile(flat, '{ "projects": [ ', 'utf8')
    expect(await readConfig(flat)).toEqual(emptyConfig())
  })

  it('覆寫是整檔替換，不留前一版殘餘', async () => {
    await writeConfig({ projects: ['/a', '/b', '/c'], lastActivePath: '/c', openspecBin: '/old' }, file)
    await writeConfig({ projects: ['/a'], lastActivePath: null, openspecBin: null }, file)

    const expected = { projects: ['/a'], lastActivePath: null, openspecBin: null }
    expect(await readConfig(file)).toEqual(expected)
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(expected)
  })
})
