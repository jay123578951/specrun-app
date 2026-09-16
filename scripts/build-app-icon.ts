/**
 * App 圖示的來源圖產生器：與側欄記號共用 orb-engine 的幾何與 orb-color 的染色，
 * 輸出一張 1024×1024 PNG；其餘平台尺寸由 `tauri icon` 這個 CLI 產出，它只吃單一來源圖。
 *
 * Node 24 可直接載入本專案的 .ts（型別在載入時被剝除），因此不經建置步驟、不加執行期依賴；
 * 繪製與 PNG 編碼都自寫，只用 Node 內建的 zlib 做 deflate。
 */

import type { RgbColor } from '../src/utils/orb-color.ts'
import { Buffer } from 'node:buffer'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { deflateSync } from 'node:zlib'
import { orbDotColor, parseHexColor } from '../src/utils/orb-color.ts'
import { MODE_FRAMES, resolvePreset } from '../src/utils/orb-engine.ts'

const CANVAS_SIZE = 1024
const SUPERSAMPLE = 4

const BASE_INSET_RATIO = 0.0977
const BASE_CORNER_EXPONENT = 5
const MARK_SHARE_OF_BASE = 0.95
const PROMPT_SHARE_OF_MARK = 0.32
const PROMPT_VIEWBOX = 24
const PROMPT_STROKE_WIDTH = 2.6

const DESIGN_SIZE = 64
const BRIGHTNESS_FLOOR = 0.55
const BRIGHTNESS_CEIL = 0.95
const ALPHA_GAIN = 1.3

/** orbDotColor 收的是墨色（0 最亮、1 最暗），重對應直接算在墨色上，就不必在亮度與墨色之間來回取補數 */
const INK_FLOOR = 1 - BRIGHTNESS_CEIL
const INK_CEIL = 1 - BRIGHTNESS_FLOOR

/** lucide 1.2.123 的 terminal 圖示 path `M12 19h8M4 17l6-6l-6-6` 拆成線段，端點與轉折都是圓的 */
const PROMPT_STROKES: [number, number][][] = [
  [[12, 19], [20, 19]],
  [[4, 17], [10, 11], [4, 5]],
]

const projectRoot = join(import.meta.dirname, '..')

/** 一顆點在畫布座標系（已套用縮放與亮度／透明度重對應），z 是引擎給的深度，用來決定刻度線的繪製順序 */
interface SpokePoint {
  x: number
  y: number
  r: number
  z: number
  color: RgbColor
  alpha: number
}

/** 每個區間都是 [低, 高]，只給收尾的 log 用，不參與繪製 */
interface DotStats {
  brightness: [number, number]
  remappedBrightness: [number, number]
  alpha: [number, number]
  remappedAlpha: [number, number]
}

/** 每條刻度線上的點數：11 條同心環線 × 每條在這個角度各留一顆取樣點 */
const LANE_COUNT = 11
/** 環上的刻度線條數：484 顆點 ÷ 11 顆／條 */
const SPOKE_COUNT = 44

function readToken(css: string, name: string): RgbColor {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))
  if (!match)
    throw new Error(`tokens.css 找不到 --${name}`)
  return parseHexColor(match[1])
}

/**
 * 把定格幀的 484 顆點依繞圓心的角度分成 44 桶（=44 條刻度線），每桶恰好 11 顆（同心環線各出一顆）。
 * 桶依平均深度由遠到近排序，供畫刻度線時依序繪製、疊色與引擎原本的排序一致。
 */
function buildSpokes(surface: RgbColor, accentBright: RgbColor): { spokes: SpokePoint[][], stats: DotStats } {
  const { mode, opts } = resolvePreset('breathing', DESIGN_SIZE)
  const frameFn = MODE_FRAMES[mode as keyof typeof MODE_FRAMES]
  const frame = frameFn(DESIGN_SIZE, 0, opts)

  const inks = frame.dots.map((dot: { white: number }) => Math.min(1, Math.max(0, dot.white)))
  const lightestInk = Math.min(...inks)
  const darkestInk = Math.max(...inks)
  if (darkestInk === lightestInk)
    throw new Error(`定格幀每個點的墨色都是 ${lightestInk}，重對應會除以零；除不盡的 NaN 進到色版會被當成 0，整圈點靜靜變成純黑`)

  const alphas = frame.dots.map((dot: { a?: number }) => dot.a ?? 1)
  const alphaLow = Math.min(...alphas)
  const alphaHigh = Math.max(...alphas)

  const baseSize = CANVAS_SIZE * (1 - 2 * BASE_INSET_RATIO)
  const markSize = baseSize * MARK_SHARE_OF_BASE
  const markOrigin = (CANVAS_SIZE - markSize) / 2
  const scale = markSize / DESIGN_SIZE
  // 縮放是等比的，markOrigin + DESIGN_SIZE/2*scale 恰等於畫布正中央，角度與距離的排序在縮放前後不變
  const center = CANVAS_SIZE / 2

  const points: SpokePoint[] = frame.dots.map((dot: { x: number, y: number, r: number, z: number }, index: number) => ({
    x: markOrigin + dot.x * scale,
    y: markOrigin + dot.y * scale,
    r: dot.r * scale,
    z: dot.z,
    color: orbDotColor(
      INK_FLOOR + (INK_CEIL - INK_FLOOR) * (inks[index] - lightestInk) / (darkestInk - lightestInk),
      surface,
      accentBright,
    ),
    alpha: Math.min(1, alphas[index] * ALPHA_GAIN),
  }))

  const buckets: SpokePoint[][] = Array.from({ length: SPOKE_COUNT }, () => [])
  for (const point of points) {
    const angle = Math.atan2(point.y - center, point.x - center)
    const bucketIndex = Math.round(((angle + Math.PI) / (2 * Math.PI)) * SPOKE_COUNT) % SPOKE_COUNT
    buckets[bucketIndex].push(point)
  }
  buckets.forEach((bucket, index) => {
    if (bucket.length !== LANE_COUNT)
      throw new Error(`第 ${index} 條刻度線分到 ${bucket.length} 顆點，預期恰好 ${LANE_COUNT} 顆；擬合主軸需要每條線點數一致，桶數不對會讓這條刻度線擬合出扭曲或斷裂的線段且不易察覺，因此直接停下來，不靜默畫出殘缺的環`)
  })
  buckets.sort((a, b) => averageZ(a) - averageZ(b))

  return {
    spokes: buckets,
    stats: {
      brightness: [1 - darkestInk, 1 - lightestInk],
      remappedBrightness: [BRIGHTNESS_FLOOR, BRIGHTNESS_CEIL],
      alpha: [alphaLow, alphaHigh],
      remappedAlpha: [Math.min(1, alphaLow * ALPHA_GAIN), Math.min(1, alphaHigh * ALPHA_GAIN)],
    },
  }
}

function averageZ(points: SpokePoint[]): number {
  return points.reduce((sum, point) => sum + point.z, 0) / points.length
}

function formatRange([low, high]: [number, number], digits: number): string {
  return `${low.toFixed(digits)}～${high.toFixed(digits)}`
}

function blend(buffer: Uint8ClampedArray, index: number, color: RgbColor, alpha: number): void {
  const destAlpha = buffer[index + 3] / 255
  const outAlpha = alpha + destAlpha * (1 - alpha)
  if (outAlpha <= 0)
    return
  const keep = destAlpha * (1 - alpha)
  buffer[index] = (color.r * alpha + buffer[index] * keep) / outAlpha
  buffer[index + 1] = (color.g * alpha + buffer[index + 1] * keep) / outAlpha
  buffer[index + 2] = (color.b * alpha + buffer[index + 2] * keep) / outAlpha
  buffer[index + 3] = outAlpha * 255
}

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const lengthSq = dx * dx + dy * dy
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq))
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t))
}

function paintBase(buffer: Uint8ClampedArray, width: number, surface: RgbColor): void {
  const radius = CANVAS_SIZE * (1 - 2 * BASE_INSET_RATIO) / 2 * SUPERSAMPLE
  const center = width / 2
  const from = Math.floor(center - radius)
  const to = Math.ceil(center + radius)

  for (let y = Math.max(0, from); y < Math.min(width, to); y++) {
    const ny = Math.abs((y + 0.5 - center) / radius)
    const yTerm = ny ** BASE_CORNER_EXPONENT
    if (yTerm > 1)
      continue
    for (let x = Math.max(0, from); x < Math.min(width, to); x++) {
      const nx = Math.abs((x + 0.5 - center) / radius)
      if (yTerm + nx ** BASE_CORNER_EXPONENT > 1)
        continue
      const index = (y * width + x) * 4
      buffer[index] = surface.r
      buffer[index + 1] = surface.g
      buffer[index + 2] = surface.b
      buffer[index + 3] = 255
    }
  }
}

/** 對 11 個取樣值做最小平方線性擬合，回傳可在任意主軸位置 t 內插取值的函式 */
function fitLinear(ts: number[], values: number[]): (t: number) => number {
  const meanT = ts.reduce((sum, t) => sum + t, 0) / ts.length
  const meanV = values.reduce((sum, v) => sum + v, 0) / values.length
  let numerator = 0
  let denominator = 0
  for (let i = 0; i < ts.length; i++) {
    numerator += (ts[i] - meanT) * (values[i] - meanV)
    denominator += (ts[i] - meanT) ** 2
  }
  const slope = denominator === 0 ? 0 : numerator / denominator
  return t => meanV + slope * (t - meanT)
}

/**
 * 把一條刻度線的 11 顆點畫成單一連續膠囊形：先對點的座標擬合主軸（2x2 共變異數矩陣的主特徵向量），
 * 再把粗細、顏色、透明度沿主軸位置做線性擬合，逐像素依投影位置內插取值——
 * 因此整條線沒有分段、沒有接縫，點與點之間的來回跳動被擬合直接抹平。
 */
function paintSpoke(buffer: Uint8ClampedArray, width: number, points: SpokePoint[]): void {
  const count = points.length
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / count
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / count

  let sxx = 0
  let syy = 0
  let sxy = 0
  for (const point of points) {
    const dx = point.x - meanX
    const dy = point.y - meanY
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

  const projections = points.map(point => (point.x - meanX) * axisX + (point.y - meanY) * axisY)
  const radiusAt = fitLinear(projections, points.map(point => point.r))
  const redAt = fitLinear(projections, points.map(point => point.color.r))
  const greenAt = fitLinear(projections, points.map(point => point.color.g))
  const blueAt = fitLinear(projections, points.map(point => point.color.b))
  const alphaAt = fitLinear(projections, points.map(point => point.alpha))

  const tFrom = Math.min(...projections)
  const tTo = Math.max(...projections)
  const maxRadius = Math.max(radiusAt(tFrom), radiusAt(tTo)) * SUPERSAMPLE
  const centerX = meanX * SUPERSAMPLE
  const centerY = meanY * SUPERSAMPLE
  const endXs = [tFrom, tTo].map(t => centerX + axisX * t * SUPERSAMPLE)
  const endYs = [tFrom, tTo].map(t => centerY + axisY * t * SUPERSAMPLE)
  const from = {
    x: Math.floor(Math.min(...endXs) - maxRadius - 1),
    y: Math.floor(Math.min(...endYs) - maxRadius - 1),
  }
  const to = {
    x: Math.ceil(Math.max(...endXs) + maxRadius + 1),
    y: Math.ceil(Math.max(...endYs) + maxRadius + 1),
  }

  for (let y = Math.max(0, from.y); y < Math.min(width, to.y); y++) {
    for (let x = Math.max(0, from.x); x < Math.min(width, to.x); x++) {
      const dx = (x + 0.5 - centerX) / SUPERSAMPLE
      const dy = (y + 0.5 - centerY) / SUPERSAMPLE
      let t = dx * axisX + dy * axisY
      t = Math.max(tFrom, Math.min(tTo, t))
      const perpendicular = Math.hypot(dx - axisX * t, dy - axisY * t)
      if (perpendicular > radiusAt(t))
        continue
      blend(buffer, (y * width + x) * 4, { r: redAt(t), g: greenAt(t), b: blueAt(t) }, Math.min(1, alphaAt(t)))
    }
  }
}

function paintSpokes(buffer: Uint8ClampedArray, width: number, spokes: SpokePoint[][]): void {
  for (const spoke of spokes)
    paintSpoke(buffer, width, spoke)
}

function paintPrompt(buffer: Uint8ClampedArray, width: number, accentBright: RgbColor): void {
  const baseSize = CANVAS_SIZE * (1 - 2 * BASE_INSET_RATIO)
  const promptSize = baseSize * MARK_SHARE_OF_BASE * PROMPT_SHARE_OF_MARK
  const origin = (CANVAS_SIZE - promptSize) / 2
  const scale = promptSize / PROMPT_VIEWBOX * SUPERSAMPLE
  const half = PROMPT_STROKE_WIDTH / 2 * scale

  const segments = PROMPT_STROKES.flatMap(points =>
    points.slice(1).map((point, index) => [
      origin * SUPERSAMPLE + points[index][0] * scale,
      origin * SUPERSAMPLE + points[index][1] * scale,
      origin * SUPERSAMPLE + point[0] * scale,
      origin * SUPERSAMPLE + point[1] * scale,
    ]),
  )

  const xs = segments.flatMap(([ax, , bx]) => [ax, bx])
  const ys = segments.flatMap(([, ay, , by]) => [ay, by])
  const from = { x: Math.floor(Math.min(...xs) - half), y: Math.floor(Math.min(...ys) - half) }
  const to = { x: Math.ceil(Math.max(...xs) + half), y: Math.ceil(Math.max(...ys) + half) }

  for (let y = Math.max(0, from.y); y < Math.min(width, to.y); y++) {
    for (let x = Math.max(0, from.x); x < Math.min(width, to.x); x++) {
      const px = x + 0.5
      const py = y + 0.5
      const inside = segments.some(([ax, ay, bx, by]) => distanceToSegment(px, py, ax, ay, bx, by) <= half)
      if (inside)
        blend(buffer, (y * width + x) * 4, accentBright, 1)
    }
  }
}

function downsample(buffer: Uint8ClampedArray, width: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(CANVAS_SIZE * CANVAS_SIZE * 4)
  const cells = SUPERSAMPLE * SUPERSAMPLE
  for (let y = 0; y < CANVAS_SIZE; y++) {
    for (let x = 0; x < CANVAS_SIZE; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const index = ((y * SUPERSAMPLE + sy) * width + x * SUPERSAMPLE + sx) * 4
          const alpha = buffer[index + 3] / 255
          r += buffer[index] * alpha
          g += buffer[index + 1] * alpha
          b += buffer[index + 2] * alpha
          a += alpha
        }
      }
      const index = (y * CANVAS_SIZE + x) * 4
      if (a > 0) {
        out[index] = r / a
        out[index + 1] = g / a
        out[index + 2] = b / a
      }
      out[index + 3] = a / cells * 255
    }
  }
  return out
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++)
    c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(data: Buffer): number {
  let c = 0xFFFFFFFF
  for (const byte of data)
    c = CRC_TABLE[(c ^ byte) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/** 8 位元 RGBA、逐列 filter 0 的 PNG（PNG 規格 11.2.2 的最小組合） */
function encodePng(pixels: Uint8ClampedArray, size: number): Buffer {
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0
    Buffer.from(pixels.buffer, pixels.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1)
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const tokensCss = readFileSync(join(projectRoot, 'src/styles/tokens.css'), 'utf8')
const surface = readToken(tokensCss, 'sr-surface')
const accentBright = readToken(tokensCss, 'sr-accent-bright')
const { spokes, stats } = buildSpokes(surface, accentBright)
const pointCount = spokes.reduce((sum, spoke) => sum + spoke.length, 0)

console.log(`定格幀：${pointCount} 個點，分成 ${spokes.length} 條刻度線`)
console.log(`原始透明度：${formatRange(stats.alpha, 3)}`)
console.log(`原始亮度：${formatRange(stats.brightness, 3)}`)
console.log(`重對應後亮度：${formatRange(stats.remappedBrightness, 2)}`)
console.log(`重對應後透明度：${formatRange(stats.remappedAlpha, 3)}`)

const width = CANVAS_SIZE * SUPERSAMPLE
const buffer = new Uint8ClampedArray(width * width * 4)
paintBase(buffer, width, surface)
paintSpokes(buffer, width, spokes)
paintPrompt(buffer, width, accentBright)

const outPath = process.argv[2] ?? join(projectRoot, 'src-tauri/app-icon.png')
const png = encodePng(downsample(buffer, width), CANVAS_SIZE)
writeFileSync(outPath, png)
console.log(`已輸出 ${outPath}（${CANVAS_SIZE}×${CANVAS_SIZE}，${(png.length / 1024).toFixed(0)} KB）`)
