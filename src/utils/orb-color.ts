/**
 * 品牌記號的染色（design D3）：把 orb-engine 幾何算出的明暗值映射到
 * `--sr-surface` 與 `--sr-accent-bright` 之間，不墊下限——墊下限會壓縮深淺差距，
 * 點會失去前後層次、糊成短橫槓（design D3 打樣結論）。
 *
 * 純函式、不碰 DOM：呼叫端自行用 getComputedStyle 讀兩個色票、parseHexColor 轉成 RgbColor 再傳入。
 */

export interface RgbColor {
  r: number
  g: number
  b: number
}

/**
 * 解析 `#rrggbb` 形式的色票值（tokens.css 的既有寫法）。
 * 非此格式（3 碼縮寫、`rgb()` 等）解析不出來時各色版回退到 0，
 * 避免 NaN 流進 canvas fillStyle 後靜默沿用前一個顏色。
 */
export function parseHexColor(hex: string): RgbColor {
  const value = hex.trim().replace('#', '')
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return {
    r: Number.isNaN(r) ? 0 : r,
    g: Number.isNaN(g) ? 0 : g,
    b: Number.isNaN(b) ? 0 : b,
  }
}

/**
 * `white` 是 orb-engine 座標系的墨色值（0 最亮、1 最暗，見 engine 內 `Dot.white` 的用法）；
 * 套件原本在深色底下會鏡射成 `1 - white` 再轉灰階，這裡同樣先鏡射成亮度，
 * 再以亮度在 surface（最暗）與 accentBright（最亮）之間線性內插。
 */
export function orbDotColor(white: number, surface: RgbColor, accentBright: RgbColor): RgbColor {
  const brightness = 1 - Math.min(1, Math.max(0, white))
  return {
    r: lerp(surface.r, accentBright.r, brightness),
    g: lerp(surface.g, accentBright.g, brightness),
    b: lerp(surface.b, accentBright.b, brightness),
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}
