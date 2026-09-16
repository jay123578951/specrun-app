import { describe, expect, it } from 'vitest'
import { emptyConfig, expandHome, parseConfig, serializeConfig } from './app-config'

/**
 * 設定檔共用核心的兩個承諾：損毀不 crash（parse）、寫出格式兩形態同構（serialize）。
 * 真正碰檔案的那一層各形態自己測（server 端見 server/utils/app-config.test.ts）。
 */

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
  // 自動偵測（null），且不能連累同一份檔案裡讀得懂的其他欄位（無 migration 的前提）
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

describe('serializeConfig', () => {
  it('兩格縮排、結尾一個換行——桌面與 web 寫出的位元組必須逐一相同', () => {
    const text = serializeConfig({ projects: ['/a'], lastActivePath: '/a', openspecBin: null })
    expect(text).toBe('{\n  "projects": [\n    "/a"\n  ],\n  "lastActivePath": "/a",\n  "openspecBin": null\n}\n')
  })

  it('寫出去的內容讀回來等於原本的設定', () => {
    const config = { projects: ['/a', '/b'], lastActivePath: '/b', openspecBin: '/opt/bin/openspec' }
    expect(parseConfig(serializeConfig(config))).toEqual(config)
  })
})

describe('expandHome', () => {
  it('單獨一個 ~ 就是家目錄本身', () => {
    expect(expandHome('~', '/Users/x')).toBe('/Users/x')
  })

  it('~/ 開頭接到家目錄下，多餘的分隔符收斂成一個', () => {
    expect(expandHome('~/code/app', '/Users/x')).toBe('/Users/x/code/app')
    expect(expandHome('~//code', '/Users/x')).toBe('/Users/x/code')
  })

  it('windows 家目錄用反斜線接', () => {
    expect(expandHome('~\\code', 'C:\\Users\\x')).toBe('C:\\Users\\x\\code')
    expect(expandHome('~/code', 'C:\\Users\\x')).toBe('C:\\Users\\x\\code')
  })

  it('不以 ~ 開頭的路徑原樣回傳', () => {
    expect(expandHome('/opt/bin/openspec', '/Users/x')).toBe('/opt/bin/openspec')
    expect(expandHome('~notauser/x', '/Users/x')).toBe('~notauser/x')
  })
})
