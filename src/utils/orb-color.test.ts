import { describe, expect, it } from 'vitest'
import { orbDotColor, parseHexColor } from './orb-color'

// 用 tokens.css 實際的兩個色票，驗證映射落在 spec 要求的兩端（design D3：不墊下限）
const surface = parseHexColor('#1a1f27')
const accentBright = parseHexColor('#82b4c9')

describe('orbDotColor', () => {
  it('最暗端（white = 1）落在 surface', () => {
    expect(orbDotColor(1, surface, accentBright)).toEqual(surface)
  })

  it('最亮端（white = 0）落在 accent-bright', () => {
    expect(orbDotColor(0, surface, accentBright)).toEqual(accentBright)
  })

  it('中間值單調遞增（white 越小、每個色版都越接近 accent-bright）', () => {
    const samples = [1, 0.8, 0.6, 0.4, 0.2, 0].map(white => orbDotColor(white, surface, accentBright))
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]!.r).toBeGreaterThanOrEqual(samples[i - 1]!.r)
      expect(samples[i]!.g).toBeGreaterThanOrEqual(samples[i - 1]!.g)
      expect(samples[i]!.b).toBeGreaterThanOrEqual(samples[i - 1]!.b)
    }
    // 頭尾必須嚴格不同，否則上面的「遞增」測不出東西
    expect(samples[0]).not.toEqual(samples[samples.length - 1])
  })

  it('超出 [0, 1] 的 white 會被夾住，不外插', () => {
    expect(orbDotColor(-0.5, surface, accentBright)).toEqual(accentBright)
    expect(orbDotColor(1.5, surface, accentBright)).toEqual(surface)
  })

  it('white = 0.5 精確落在線性中點（design D3：直接內插、不套曲線，也不四捨五入）', () => {
    // surface #1a1f27＝(26,31,39)、accentBright #82b4c9＝(130,180,201)，中點＝算術平均
    expect(orbDotColor(0.5, surface, accentBright)).toEqual({ r: 78, g: 105.5, b: 120 })
  })

  it('顏色由傳入的 surface/accent 決定，不寫死色票（spec：記號 MUST NOT 引入新色票）', () => {
    const altSurface = parseHexColor('#000000')
    const altAccent = parseHexColor('#ff8800')
    expect(orbDotColor(1, altSurface, altAccent)).toEqual(altSurface)
    expect(orbDotColor(0, altSurface, altAccent)).toEqual(altAccent)
    // 換一組色票，結果不能巧合等於本檔其他測試寫死的 surface/accentBright
    expect(orbDotColor(1, altSurface, altAccent)).not.toEqual(surface)
    expect(orbDotColor(0, altSurface, altAccent)).not.toEqual(accentBright)
  })
})

describe('parseHexColor', () => {
  it('解析 #rrggbb', () => {
    expect(parseHexColor('#1a1f27')).toEqual({ r: 26, g: 31, b: 39 })
  })

  it('去掉前後空白（getComputedStyle().getPropertyValue() 對 CSS 自訂屬性常回傳帶空白的值）', () => {
    expect(parseHexColor('  #82b4c9  ')).toEqual({ r: 130, g: 180, b: 201 })
  })

  it('沒有前導 # 也能解析', () => {
    expect(parseHexColor('82b4c9')).toEqual({ r: 130, g: 180, b: 201 })
  })
})
