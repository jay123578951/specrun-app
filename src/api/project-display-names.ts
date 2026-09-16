/**
 * 側欄清單的顯示名：目錄名即顯示名，撞名才帶一層父目錄消歧。
 * 不另存顯示名欄位，所以兩種執行形態都得算出同一組名字——算法放在共用處。
 */
export function projectDisplayNames(paths: string[]): string[] {
  const bases = paths.map(each => lastSegment(each) || each)
  const counts = new Map<string, number>()
  for (const base of bases)
    counts.set(base, (counts.get(base) ?? 0) + 1)

  return paths.map((each, index) => {
    const base = bases[index]!
    if ((counts.get(base) ?? 0) < 2)
      return base
    const parent = lastSegment(dropLastSegment(each))
    return parent ? `${parent}/${base}` : base
  })
}

/** 兩種分隔符一起切：設定檔可能是在另一個平台寫下的（兩形態共用同一份） */
function segments(target: string): string[] {
  return target.split(/[/\\]/).filter(Boolean)
}

function lastSegment(target: string): string {
  return segments(target).at(-1) ?? ''
}

function dropLastSegment(target: string): string {
  return segments(target).slice(0, -1).join('/')
}
