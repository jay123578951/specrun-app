/**
 * 驗證 `build-app-icon.ts` 產出的圖示同時符合三件事：尺寸與格式正確、
 * 留白比例維持圖示在 Dock 排列時的視覺大小、顏色只用既有的
 * surface 與 accent-bright 兩個色票混出（不會混入新色票）。
 *
 * 產生器沒有匯出任何函式（純腳本，`import` 就會跑完整流程並落地 PNG），
 * 所以這裡走黑盒驗證：真的執行一次腳本，讀它印出的數值 log，
 * 再自己解碼它輸出的 PNG 檢查像素——不複製產生器內部的算式。
 *
 * 「色值是否取自既有 token」用一個線性代數的事實來驗：
 * 只要每個像素的顏色都是 surface 與 accent-bright 之間 alpha 混合出來的，
 * 該像素的 RGB 必落在這兩點連成的直線上（仿射組合封閉在線段上）。
 * 量出每個像素落在這條線上的哪個位置（t：0 是 surface、1 是 accent-bright），
 * 也量出離線的距離（residual）——residual 大代表混進了不在這兩個 token 之間的新顏色。
 */

import type { RgbColor } from '../src/utils/orb-color.ts'
import { Buffer } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { inflateSync } from 'node:zlib'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { parseHexColor } from '../src/utils/orb-color.ts'

const projectRoot = join(import.meta.dirname, '..')
const scriptPath = join(import.meta.dirname, 'build-app-icon.ts')

// 四周留白比例，讓圖示縮在畫布內、在 Dock 裡與其他 App 的視覺大小相當
const BASE_INSET_RATIO = 0.0977
const BRIGHTNESS_FLOOR = 0.55
const BRIGHTNESS_CEIL = 0.95

interface DecodedPng {
  width: number
  height: number
  colorType: number
  bitDepth: number
  pixels: Uint8Array // RGBA，未預乘 alpha
}

/** 只解碼本產生器會產出的格式（8-bit RGBA、無交錯），支援全部 5 種 filter type 以求穩健。 */
function decodePng(buffer: Buffer): DecodedPng {
  if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a')
    throw new Error('不是合法的 PNG 檔頭')

  let offset = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  const idatChunks: Buffer[] = []

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii')
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
    }
    else if (type === 'IDAT') {
      idatChunks.push(data)
    }
    else if (type === 'IEND') {
      break
    }
    offset += 12 + length
  }

  if (bitDepth !== 8 || colorType !== 6)
    throw new Error(`目前只支援 8-bit RGBA：實際 bitDepth=${bitDepth} colorType=${colorType}`)

  const raw = inflateSync(Buffer.concat(idatChunks))
  const channels = 4
  const stride = width * channels
  const pixels = new Uint8Array(width * height * channels)
  const prior = new Uint8Array(stride)

  const paeth = (a: number, b: number, c: number): number => {
    const p = a + b - c
    const pa = Math.abs(p - a)
    const pb = Math.abs(p - b)
    const pc = Math.abs(p - c)
    if (pa <= pb && pa <= pc)
      return a
    return pb <= pc ? b : c
  }

  let rawOffset = 0
  for (let y = 0; y < height; y++) {
    const filterType = raw[rawOffset]
    rawOffset += 1
    const rowStart = y * stride
    for (let x = 0; x < stride; x++) {
      const rawByte = raw[rawOffset + x]
      const a = x >= channels ? pixels[rowStart + x - channels] : 0
      const b = prior[x]
      const c = x >= channels ? prior[x - channels] : 0
      let value: number
      switch (filterType) {
        case 0:
          value = rawByte
          break
        case 1:
          value = rawByte + a
          break
        case 2:
          value = rawByte + b
          break
        case 3:
          value = rawByte + ((a + b) >> 1)
          break
        case 4:
          value = rawByte + paeth(a, b, c)
          break
        default:
          throw new Error(`不支援的 PNG filter type: ${filterType}`)
      }
      pixels[rowStart + x] = value & 0xFF
    }
    prior.set(pixels.subarray(rowStart, rowStart + stride))
    rawOffset += stride
  }

  return { width, height, colorType, bitDepth, pixels }
}

function pixelAt(png: DecodedPng, x: number, y: number): { r: number, g: number, b: number, a: number } {
  const index = (y * png.width + x) * 4
  return { r: png.pixels[index], g: png.pixels[index + 1], b: png.pixels[index + 2], a: png.pixels[index + 3] }
}

/**
 * 把顏色投影到 surface→accentBright 這條線上：t=0 是 surface、t=1 是 accentBright，
 * residual 是顏色離這條線的實際距離（RGB 空間），非 0 代表這個顏色不是兩個 token 的內插結果。
 */
function projectOntoTokenLine(color: { r: number, g: number, b: number }, from: RgbColor, to: RgbColor): { t: number, residual: number } {
  const dr = to.r - from.r
  const dg = to.g - from.g
  const db = to.b - from.b
  const denom = dr * dr + dg * dg + db * db
  const t = ((color.r - from.r) * dr + (color.g - from.g) * dg + (color.b - from.b) * db) / denom
  const projR = from.r + t * dr
  const projG = from.g + t * dg
  const projB = from.b + t * db
  const residual = Math.hypot(color.r - projR, color.g - projG, color.b - projB)
  return { t, residual }
}

/**
 * 判斷一個不透明像素是不是「刻度線上的像素」而不是底色或提示符號：
 * 刻度線最亮也只會走到重對應後的亮度上限 0.95、再乘上小於 1 的透明度，t 因此封頂在 0.96；
 * 提示符號用滿版 accentBright（alpha=1）畫出，t 會逼近 1；底色 t 則是 0。
 * 這個門檻與下方「環與提示符號兩部分都畫出來了」那條測試用的是同一個。
 */
function isRingPixel(png: DecodedPng, x: number, y: number, surface: RgbColor, accentBright: RgbColor): boolean {
  const color = pixelAt(png, x, y)
  if (color.a !== 255)
    return false
  const { t } = projectOntoTokenLine(color, surface, accentBright)
  return t > 0.15 && t <= 0.96
}

/** 數列裡「轉折」的次數：變化量小於 tolerance 視為雜訊、忽略；只在方向真的由升轉降或由降轉升時計數一次 */
function countLocalExtrema(values: number[], tolerance: number): number {
  let extrema = 0
  let lastDirection = 0
  for (let i = 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1]
    if (Math.abs(diff) < tolerance)
      continue
    const direction = diff > 0 ? 1 : -1
    if (lastDirection !== 0 && direction !== lastDirection)
      extrema++
    lastDirection = direction
  }
  return extrema
}

/**
 * 對單一刻度線的「轉折次數」評分，數字越大代表這條線的邊緣起伏越多：
 * 1. 用 4-鄰接 flood fill 把種子像素所在的整條刻度線的像素都撈出來（限制在種子附近的包圍盒內，避免誤連到鄰線）
 * 2. 對這些像素的座標做主成分分析，取主軸方向（不假設是徑向，量測結果自己說了算）
 * 3. 把每個像素投影到主軸（t，沿線的位置）與垂直軸（p，離中心線的距離），依 t 取整數分箱，
 *    每箱內 |p| 的最大值就是那個位置的半寬
 * 4. 半寬序列沿線應該只隨兩端的筆畫粗細擬合平滑增減（先粗後細或先細後粗，至多一次轉折）；
 *    如果線是由一串圓點疊成，相鄰圓點之間的凹陷會讓半寬序列多出好幾次轉折
 */
function measureSpokeTurns(png: DecodedPng, seedX: number, seedY: number, surface: RgbColor, accentBright: RgbColor): { turns: number | null, visited: Set<string> } {
  const key = (x: number, y: number): string => `${x},${y}`
  const visited = new Set<string>([key(seedX, seedY)])
  const stack: [number, number][] = [[seedX, seedY]]
  const points: [number, number][] = []

  while (stack.length > 0) {
    const [x, y] = stack.pop()!
    points.push([x, y])
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx
      const ny = y + dy
      const k = key(nx, ny)
      if (visited.has(k))
        continue
      // 單一刻度線的長度遠小於這個範圍，超出視為連到別的東西（理論上不會發生，防禦用）
      if (Math.hypot(nx - seedX, ny - seedY) > 60)
        continue
      if (!isRingPixel(png, nx, ny, surface, accentBright))
        continue
      visited.add(k)
      stack.push([nx, ny])
    }
  }

  if (points.length < 30)
    return { turns: null, visited } // 太小片，可能是雜訊而不是完整一條刻度線

  const count = points.length
  const meanX = points.reduce((sum, [x]) => sum + x, 0) / count
  const meanY = points.reduce((sum, [, y]) => sum + y, 0) / count
  let sxx = 0
  let syy = 0
  let sxy = 0
  for (const [x, y] of points) {
    const dx = x - meanX
    const dy = y - meanY
    sxx += dx * dx
    syy += dy * dy
    sxy += dx * dy
  }
  const trace = sxx + syy
  const det = sxx * syy - sxy * sxy
  const eigenvalue = trace / 2 + Math.sqrt(Math.max(0, (trace * trace) / 4 - det))
  let axisX = sxy
  let axisY = eigenvalue - sxx
  if (Math.hypot(axisX, axisY) < 1e-9) {
    axisX = 1
    axisY = 0
  }
  const axisLength = Math.hypot(axisX, axisY)
  axisX /= axisLength
  axisY /= axisLength

  const halfWidthByBin = new Map<number, number>()
  for (const [x, y] of points) {
    const dx = x - meanX
    const dy = y - meanY
    const t = dx * axisX + dy * axisY
    const p = Math.abs(-dx * axisY + dy * axisX)
    const bin = Math.round(t)
    const current = halfWidthByBin.get(bin) ?? 0
    if (p > current)
      halfWidthByBin.set(bin, p)
  }
  const widths = [...halfWidthByBin.entries()].sort((a, b) => a[0] - b[0]).map(([, width]) => width)
  // 容忍值 0.75px：小於這個的寬度變化視為量化雜訊，不是真的轉折（用兩種畫法實測校準過）
  return { turns: countLocalExtrema(widths, 0.75), visited }
}

/** 把整張圖沿角度掃一圈，逐一找出每條刻度線並回傳它們的轉折次數（flood fill 過的像素不會重複量測到） */
function measureAllSpokeTurns(png: DecodedPng, surface: RgbColor, accentBright: RgbColor): number[] {
  const centerX = png.width / 2
  const centerY = png.height / 2

  // 環的半徑帶：以密度直方圖找出主峰、向外擴到密度掉到主峰十分之一以下，
  // 排除中央提示符號邊緣抗鋸齒造成的零星雜訊像素（它們的半徑遠小於真正的環，密度也低很多）
  const bucketCounts = new Map<number, number>()
  const histogramStep = 2
  for (let y = 0; y < png.height; y += histogramStep) {
    for (let x = 0; x < png.width; x += histogramStep) {
      if (!isRingPixel(png, x, y, surface, accentBright))
        continue
      const bucket = Math.round(Math.hypot(x - centerX, y - centerY) / 8)
      bucketCounts.set(bucket, (bucketCounts.get(bucket) ?? 0) + 1)
    }
  }
  let peakBucket = 0
  let peakCount = 0
  for (const [bucket, count] of bucketCounts) {
    if (count > peakCount) {
      peakCount = count
      peakBucket = bucket
    }
  }
  let lowBucket = peakBucket
  let highBucket = peakBucket
  while ((bucketCounts.get(lowBucket - 1) ?? 0) > peakCount * 0.1) lowBucket--
  while ((bucketCounts.get(highBucket + 1) ?? 0) > peakCount * 0.1) highBucket++
  const radiusMin = lowBucket * 8 - 4
  const radiusMax = highBucket * 8 + 12

  const globalVisited = new Set<string>()
  const turnsPerSpoke: number[] = []
  for (let degree = 0; degree < 360; degree++) {
    const angle = degree * Math.PI / 180
    let seed: [number, number] | null = null
    for (let radius = radiusMin; radius <= radiusMax; radius++) {
      const x = Math.round(centerX + radius * Math.cos(angle))
      const y = Math.round(centerY + radius * Math.sin(angle))
      if (isRingPixel(png, x, y, surface, accentBright)) {
        seed = [x, y]
        break
      }
    }
    if (!seed || globalVisited.has(`${seed[0]},${seed[1]}`))
      continue

    const { turns, visited } = measureSpokeTurns(png, seed[0], seed[1], surface, accentBright)
    for (const k of visited) globalVisited.add(k)

    if (turns !== null)
      turnsPerSpoke.push(turns)
  }
  return turnsPerSpoke
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

describe('build-app-icon（App 圖示產生器）', () => {
  let tempDir: string
  let stdout: string
  let png: DecodedPng
  let surface: RgbColor
  let accentBright: RgbColor

  beforeAll(() => {
    // 輸出到暫存目錄、不寫回 repo：產生器預設會落地 src-tauri/app-icon.png，
    // 真的執行一次會靜默覆蓋 repo 裡的來源圖，讓它與已產出的 icons/ 脫鉤
    tempDir = mkdtempSync(join(tmpdir(), 'app-icon-'))
    const outputPath = join(tempDir, 'app-icon.png')
    // 真的跑一次產生器（實測 0.4 秒內完成，不需要降級為只驗數值層）
    stdout = execFileSync(process.execPath, [scriptPath, outputPath], { cwd: projectRoot, encoding: 'utf8' })
    png = decodePng(readFileSync(outputPath))

    const tokensCss = readFileSync(join(projectRoot, 'src/styles/tokens.css'), 'utf8')
    const surfaceMatch = tokensCss.match(/--sr-surface:\s*(#[0-9a-fA-F]{6})/)
    const accentMatch = tokensCss.match(/--sr-accent-bright:\s*(#[0-9a-fA-F]{6})/)
    if (!surfaceMatch || !accentMatch)
      throw new Error('tokens.css 找不到 --sr-surface 或 --sr-accent-bright，測試的比對基準就不存在')
    surface = parseHexColor(surfaceMatch[1])
    accentBright = parseHexColor(accentMatch[1])
  })

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  describe('定格幀與亮度／透明度重對應（數值層，來自產生器自己印出的 log）', () => {
    it('取得 484 個點的定格幀', () => {
      const match = stdout.match(/定格幀：(\d+) 個點/)
      expect(match).not.toBeNull()
      expect(Number(match![1])).toBe(484)
    })

    it('原始亮度與透明度本來就有落差，不是齊一值（重對應是否保留差距，前提是原始資料本身有差距）', () => {
      const brightMatch = stdout.match(/原始亮度：([\d.]+)～([\d.]+)/)
      const alphaMatch = stdout.match(/原始透明度：([\d.]+)～([\d.]+)/)
      expect(brightMatch).not.toBeNull()
      expect(alphaMatch).not.toBeNull()
      expect(Number(brightMatch![2])).toBeGreaterThan(Number(brightMatch![1]))
      expect(Number(alphaMatch![2])).toBeGreaterThan(Number(alphaMatch![1]))
    })

    // 這條只防兩件事：log 印出 NaN（重對應對 lightestInk === darkestInk 的退化輸入除以零），
    // 以及測試裡抄的常數跟實作常數對不上。它驗不到「深淺差距有沒有真的畫到像素上」——
    // stats.remappedBrightness 是產生器直接回填 BRIGHTNESS_FLOOR／CEIL 常數、不是從實際點算出來的，
    // 所以只要沒有退化成 NaN，low/high 必然等於這兩個常數，跟點有沒有畫對無關。
    // 深淺差距是否真的反映在畫面上，由下面像素層「環上的刻度線深淺不一」那條驗證。
    it('log 印出的重對應後亮度是常數 0.55～0.95、且不是 NaN（防退化輸入，不驗像素）', () => {
      const match = stdout.match(/重對應後亮度：([\d.]+)～([\d.]+)/)
      expect(match).not.toBeNull()
      const low = Number(match![1])
      const high = Number(match![2])
      expect(Number.isNaN(low)).toBe(false)
      expect(Number.isNaN(high)).toBe(false)
      expect(low).toBeCloseTo(BRIGHTNESS_FLOOR, 2)
      expect(high).toBeCloseTo(BRIGHTNESS_CEIL, 2)
    })

    it('透明度乘 1.3 後真的觸發了上限封頂（原始最高透明度 ×1.3 本來就會超過 1，封頂後應貼齊 1）', () => {
      const origAlphaMatch = stdout.match(/原始透明度：([\d.]+)～([\d.]+)/)
      const remappedAlphaMatch = stdout.match(/重對應後透明度：([\d.]+)～([\d.]+)/)
      expect(origAlphaMatch).not.toBeNull()
      expect(remappedAlphaMatch).not.toBeNull()

      const origHigh = Number(origAlphaMatch![2])
      const remappedHigh = Number(remappedAlphaMatch![2])
      // 先確認封頂「真的有事情要蓋」，不然下面貼齊 1 也可能只是巧合
      expect(origHigh * 1.3).toBeGreaterThan(1)
      // 不驗 remappedHigh <= 1：那是 Math.min(1, …) 的必然結果，不是行為。
      // 真正驗證封頂生效的是「貼齊 1」——若封頂沒被觸發，remappedHigh 會等於 origHigh * 1.3，不會貼齊 1
      expect(remappedHigh).toBeCloseTo(1, 2)
    })
  })

  describe('產出的 PNG 檔（像素層，實際解碼輸出檔案）', () => {
    it('尺寸為 1024×1024、是 8-bit RGBA（含 alpha 通道）', () => {
      expect(png.width).toBe(1024)
      expect(png.height).toBe(1024)
      expect(png.colorType).toBe(6)
      expect(png.bitDepth).toBe(8)
    })

    it('四個角落完全透明——圖示沒有佔滿整張畫布', () => {
      expect(pixelAt(png, 0, 0).a).toBe(0)
      expect(pixelAt(png, png.width - 1, 0).a).toBe(0)
      expect(pixelAt(png, 0, png.height - 1).a).toBe(0)
      expect(pixelAt(png, png.width - 1, png.height - 1).a).toBe(0)
    })

    it('底的留白比例維持在 9.77%，讓圖示在 Dock 裡與其他 App 視覺大小相當（沿中軸量測底的邊界，避開圓角的模糊區）', () => {
      const expectedInset = Math.round(png.width * BASE_INSET_RATIO)
      const centerX = Math.floor(png.width / 2)
      const centerY = Math.floor(png.height / 2)

      let topInset = -1
      for (let y = 0; y < png.height; y++) {
        if (pixelAt(png, centerX, y).a > 0) {
          topInset = y
          break
        }
      }
      let leftInset = -1
      for (let x = 0; x < png.width; x++) {
        if (pixelAt(png, x, centerY).a > 0) {
          leftInset = x
          break
        }
      }

      expect(topInset).toBeGreaterThan(0)
      expect(leftInset).toBeGreaterThan(0)
      expect(Math.abs(topInset - expectedInset)).toBeLessThanOrEqual(2)
      expect(Math.abs(leftInset - expectedInset)).toBeLessThanOrEqual(2)
    })

    it('底完全不透明、顏色等於 --sr-surface（在環的中空處量測，該處確定沒有任何刻度線覆蓋）', () => {
      // 已用 orb-engine 實測過：定格幀在設計座標 (32,32)（畫布正中央）附近 19 個單位內沒有任何點，
      // 這裡不重複那段推導，只斷言其結果——正中央必為純底色。
      const center = pixelAt(png, png.width / 2, png.height / 2)
      expect(center.a).toBe(255)
      expect(center.r).toBe(surface.r)
      expect(center.g).toBe(surface.g)
      expect(center.b).toBe(surface.b)
    })

    it('底的內部（不透明區）沒有引入新色票——每個不透明像素的顏色都落在 surface→accent-bright 這條線上', () => {
      const step = 6
      let sampled = 0
      let maxResidual = 0
      for (let y = 0; y < png.height; y += step) {
        for (let x = 0; x < png.width; x += step) {
          const color = pixelAt(png, x, y)
          if (color.a !== 255)
            continue
          sampled++
          const { residual } = projectOntoTokenLine(color, surface, accentBright)
          if (residual > maxResidual)
            maxResidual = residual
        }
      }
      expect(sampled).toBeGreaterThan(1000) // 底夠大，抽樣不會抽空
      // 8-bit 量化＋超取樣平均會有 rounding，容忍到 3 個色階
      expect(maxResidual).toBeLessThanOrEqual(3)
    })

    it('環與終端機提示符號兩部分都畫出來了，且環上的刻度線深淺不一（不是單一亮度）', () => {
      const step = 4
      const ts: number[] = []
      for (let y = 0; y < png.height; y += step) {
        for (let x = 0; x < png.width; x += step) {
          const color = pixelAt(png, x, y)
          if (color.a !== 255)
            continue
          const { t } = projectOntoTokenLine(color, surface, accentBright)
          ts.push(t)
        }
      }

      // 刻度線最亮也只會走到重對應後的亮度上限 0.95、且還要再乘上不到 1 的透明度，
      // 所以刻度線的顏色 t 理論上限就是 0.95；能量到 t > 0.96 的，只可能是
      // 提示符號那段用滿版 accentBright（alpha=1）畫出來的線段。
      const hasPrompt = ts.some(t => t > 0.96)
      // 環上的刻度線會落在一段中段的 t 範圍（base 的 0 與 prompt 的 ~1 之間）
      const ringTs = ts.filter(t => t > 0.15 && t <= 0.96)
      const hasBase = ts.some(t => t < 0.05)

      expect(hasPrompt).toBe(true)
      expect(hasBase).toBe(true)
      expect(ringTs.length).toBeGreaterThan(20)
      expect(Math.max(...ringTs) - Math.min(...ringTs)).toBeGreaterThan(0.15)
    })

    // 驗的是：每條刻度線要是一筆連續的線、邊緣平滑、看不出是圓點串成的。
    // 量測法：沿每條刻度線自己的主軸取「半寬包絡」（詳見 measureSpokeTurns 的說明），
    // 一筆平滑筆畫的半寬只會單調變粗或變細（至多 1 次轉折），圓點串成的線則會在每顆點的接縫處多出轉折。
    // 用全部 44 條刻度線轉折次數的中位數斷言，不用單一條線，抵抗個別刻度線因主軸擬合方向誤差造成的雜訊。
    it('環上每條刻度線是連續平滑的筆畫，邊緣沒有圓點造成的週期性凹凸', () => {
      const turnsPerSpoke = measureAllSpokeTurns(png, surface, accentBright)

      // 環上量得到的刻度線數應接近 44 條，找到的太少代表偵測邏輯本身有問題，量出的中位數就沒有意義
      expect(turnsPerSpoke.length).toBeGreaterThanOrEqual(40)
      expect(median(turnsPerSpoke)).toBeLessThanOrEqual(1)
    })
  })
})
