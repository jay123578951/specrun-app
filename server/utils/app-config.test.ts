import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { emptyConfig, parseConfig, readConfig, resolveConfigDir, writeConfig } from './app-config'

/**
 * 設定檔的兩個承諾：損毀不 crash（parse／read）、寫入原子（write）。
 * 用真實暫存檔驗證，不 mock fs——「壞資料進來會怎樣」正是這裡唯一該測的行為。
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

describe('parseConfig', () => {
  it('讀得懂的內容原樣還原', () => {
    const raw = JSON.stringify({ projects: ['/a', '/b'], lastActivePath: '/b', openspecBin: '/opt/bin/openspec' })
    expect(parseConfig(raw)).toEqual({
      projects: ['/a', '/b'],
      lastActivePath: '/b',
      openspecBin: '/opt/bin/openspec',
    })
  })

  it('空內容、非 JSON、非物件一律視為空清單', () => {
    expect(parseConfig(null)).toEqual(emptyConfig())
    expect(parseConfig('')).toEqual(emptyConfig())
    expect(parseConfig('{ not json')).toEqual(emptyConfig())
    expect(parseConfig('[1, 2]')).toEqual(emptyConfig())
    expect(parseConfig('"a string"')).toEqual(emptyConfig())
  })

  it('欄位型別不對時逐欄位丟掉，不整份放棄', () => {
    const raw = JSON.stringify({ projects: ['/a', 42, '', null, '/a', '/b'], lastActivePath: 7 })
    expect(parseConfig(raw)).toEqual({ projects: ['/a', '/b'], lastActivePath: null, openspecBin: null })
  })

  // openspecBin 是後加的欄位，舊設定檔一定沒有它——缺失、型別不符、空字串都得降級成
  // 自動偵測（null），且不能連累同一份檔案裡讀得懂的其他欄位（design D4 的無 migration 前提）
  it('openspecBin 缺失（舊設定檔）時降級為自動偵測，其餘欄位照常', () => {
    const raw = JSON.stringify({ projects: ['/a'], lastActivePath: '/a' })
    expect(parseConfig(raw)).toEqual({ projects: ['/a'], lastActivePath: '/a', openspecBin: null })
  })

  it('openspecBin 型別不符或為空字串時降級為自動偵測，其餘欄位照常', () => {
    for (const bin of [42, null, '', {}, ['/x']]) {
      const raw = JSON.stringify({ projects: ['/a'], lastActivePath: '/a', openspecBin: bin })
      expect(parseConfig(raw)).toEqual({ projects: ['/a'], lastActivePath: '/a', openspecBin: null })
    }
  })

  it('openspecBin 為有效路徑時原樣保留，即使其餘欄位壞掉', () => {
    const raw = JSON.stringify({ projects: 'nope', lastActivePath: 7, openspecBin: '/opt/bin/openspec' })
    expect(parseConfig(raw)).toEqual({ projects: [], lastActivePath: null, openspecBin: '/opt/bin/openspec' })
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
