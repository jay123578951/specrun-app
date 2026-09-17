/**
 * 純字串的路徑計算：接路徑、取上一層、算相對路徑、判斷是否落在某目錄底下。
 * 同步、不碰外殼、可直接單元測試（design D1）。
 *
 * 語意對齊 Node.js `node:path`（web 形態那側用的就是它），差別只有兩處，各自在
 * 函式上註明：`toRelative` 在目標落在根目錄之外時回原路徑，`isInside` 不把根目錄
 * 自己算在「底下」。外殼的路徑 API 沒有「算相對路徑」這個能力，而 park 的 artifact
 * 快照非它不可——且外殼的每一個路徑操作都是一趟跨行程呼叫。
 *
 * `/` 與 `\` 一律認作分隔符；輸出沿用輸入裡先出現的那一種。
 *
 * TODO(debt): 根只認 `/` 與 `C:\` 兩種。UNC（`\\nas\share\…`）與 Windows verbatim 前綴
 * （`\\?\C:\…`）的開頭連續反斜線會被當成一個分隔符收掉，結果比 `node:path` 少一個
 * 反斜線。上限：撐到本 App 只出 macOS 版為止——外殼的 `canonical_path` 走
 * `std::fs::canonicalize`，在 Windows 一定回 `\\?\` 前綴的路徑。升級條件：要出 Windows
 * 版時，把這兩種前綴補進根的辨識並加測試。
 */

const SEPARATOR = /[/\\]/
const SEPARATORS = /[/\\]+/
const ROOT = /^(?:[a-z]:[/\\]|[/\\])/i

/** 路徑開頭的根：POSIX 是 `/`，Windows 是 `C:\`；相對路徑沒有根，回空字串 */
function rootOf(input: string): string {
  return ROOT.exec(input)?.[0] ?? ''
}

/** 根的比較不看分隔符長相：`C:/` 與 `C:\` 是同一個根 */
function rootKey(input: string): string {
  return rootOf(input).replace(SEPARATORS, '/')
}

function separatorOf(input: string): string | undefined {
  return SEPARATOR.exec(input)?.[0]
}

/**
 * 切成片段並收掉 `.` 與 `..`。有根時 `..` 在根之上無處可去，直接丟掉
 * （同 Node `path.resolve`）；沒有根時留著，它是相對路徑的一部分。
 */
function collapse(raw: string[], rooted: boolean): string[] {
  const kept: string[] = []
  for (const segment of raw) {
    if (segment === '' || segment === '.')
      continue
    if (segment === '..') {
      if (kept.length > 0 && kept[kept.length - 1] !== '..')
        kept.pop()
      else if (!rooted)
        kept.push('..')
      continue
    }
    kept.push(segment)
  }
  return kept
}

/** 根以外的片段。先把根切掉，`C:` 才不會被當成一個片段 */
function segmentsOf(input: string): string[] {
  const root = rootOf(input)
  return collapse(input.slice(root.length).split(SEPARATORS), root !== '')
}

/** 相對路徑收乾淨後可能一個片段都不剩，Node 這時給的是 `.` */
function format(root: string, segments: string[], separator: string): string {
  if (root !== '')
    return root + segments.join(separator)
  return segments.length > 0 ? segments.join(separator) : '.'
}

/**
 * 接路徑。第一段決定有沒有根，`.` 與 `..` 就地收掉——`join('/a/b', '../c')` 得到
 * `/a/c`，與 Node `path.join` 一致。
 */
export function join(...parts: string[]): string {
  const given = parts.filter(part => part !== '')
  const first = given[0] ?? ''
  const root = rootOf(first)
  const separator = given.map(separatorOf).find(found => found !== undefined) ?? '/'
  const rest = [first.slice(root.length), ...given.slice(1)].join('/')
  return format(root, collapse(rest.split(SEPARATORS), root !== ''), separator)
}

/** 取上一層。已在最上層時回自己（`/` → `/`、`a` → `.`），同 Node `path.dirname` */
export function parentDir(input: string): string {
  const segments = segmentsOf(input)
  segments.pop()
  return format(rootOf(input), segments, separatorOf(input) ?? '/')
}

/**
 * target 落在 root 底下時回兩者的差距片段；target 就是 root 時回空陣列；
 * 不在底下回 null。逐片段比對而非比字串開頭——`/a/bc` 不是 `/a/b` 的底下。
 */
function gapSegments(target: string, root: string): string[] | null {
  if (rootKey(target) !== rootKey(root))
    return null

  const rootSegments = segmentsOf(root)
  const targetSegments = segmentsOf(target)
  if (targetSegments.length < rootSegments.length)
    return null
  for (let index = 0; index < rootSegments.length; index++) {
    if (targetSegments[index] !== rootSegments[index])
      return null
  }
  return targetSegments.slice(rootSegments.length)
}

/**
 * 把絕對路徑換算成相對 root 的路徑。target 就是 root 時回空字串（同 Node
 * `path.relative`）；落在 root 之外時回原路徑，不回一串 `..`——快照存的是 change
 * 目錄內的相對路徑，換算不出來就存絕對路徑，讓它至少在 repo 沒搬家時還讀得到。
 */
export function toRelative(absolute: string, root: string): string {
  if (root === '')
    return absolute
  const gap = gapSegments(absolute, root)
  if (gap === null)
    return absolute
  return gap.join(separatorOf(absolute) ?? '/')
}

/**
 * target 是否落在 root 底下。root 自己不算（要的是「底下」），`..` 在比對前就已收掉
 * ——這是擋住快照路徑逃出 change 目錄的那道防線，不能只比字串開頭。
 */
export function isInside(target: string, root: string): boolean {
  if (root === '')
    return false
  const gap = gapSegments(target, root)
  return gap !== null && gap.length > 0
}
