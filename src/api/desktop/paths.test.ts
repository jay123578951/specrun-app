import { describe, expect, it } from 'vitest'
import { isInside, join, parentDir, toRelative } from './paths'

describe('join', () => {
  it('接起絕對路徑與片段', () => {
    expect(join('/repo', 'openspec', 'changes')).toBe('/repo/openspec/changes')
  })

  it('沿用 Windows 分隔符', () => {
    expect(join('C:\\repo', 'openspec', 'changes')).toBe('C:\\repo\\openspec\\changes')
  })

  it('收掉多餘的分隔符與 `.`', () => {
    expect(join('/repo/', '/openspec', './changes')).toBe('/repo/openspec/changes')
  })

  it('就地收掉 `..`', () => {
    expect(join('/repo/openspec', '..', 'dist')).toBe('/repo/dist')
  })

  it('`..` 多過層數時停在根，不爬到根之上', () => {
    expect(join('/repo', '../../..', 'etc')).toBe('/etc')
  })

  it('相對路徑保留爬出去的 `..`', () => {
    expect(join('specs', '../../shared')).toBe('../shared')
  })

  it('全部收乾淨時回 `.`', () => {
    expect(join('a', '..')).toBe('.')
    expect(join()).toBe('.')
  })
})

describe('parentDir', () => {
  it('取上一層', () => {
    expect(parentDir('/repo/openspec/changes')).toBe('/repo/openspec')
  })

  it('沿用 Windows 分隔符', () => {
    expect(parentDir('C:\\repo\\openspec')).toBe('C:\\repo')
  })

  it('已在根底下一層時回根', () => {
    expect(parentDir('/repo')).toBe('/')
    expect(parentDir('C:\\repo')).toBe('C:\\')
  })

  it('根自己回根', () => {
    expect(parentDir('/')).toBe('/')
  })

  it('單一片段的相對路徑回 `.`', () => {
    expect(parentDir('proposal.md')).toBe('.')
  })
})

describe('toRelative', () => {
  it('換算成相對根目錄的路徑', () => {
    expect(toRelative('/repo/changes/add-x/specs/a/spec.md', '/repo/changes/add-x'))
      .toBe('specs/a/spec.md')
  })

  it('沿用 Windows 分隔符', () => {
    expect(toRelative('C:\\repo\\add-x\\specs\\a\\spec.md', 'C:\\repo\\add-x'))
      .toBe('specs\\a\\spec.md')
  })

  it('兩邊分隔符不同樣式也認得', () => {
    expect(toRelative('C:/repo/add-x/proposal.md', 'C:\\repo\\add-x')).toBe('proposal.md')
  })

  it('目標就是根目錄本身時回空字串', () => {
    expect(toRelative('/repo/add-x', '/repo/add-x')).toBe('')
  })

  it('根目錄結尾有分隔符不影響結果', () => {
    expect(toRelative('/repo/add-x/tasks.md', '/repo/add-x/')).toBe('tasks.md')
  })

  it('目標在根目錄之外時回原路徑，不回一串 `..`', () => {
    expect(toRelative('/elsewhere/tasks.md', '/repo/add-x')).toBe('/elsewhere/tasks.md')
  })

  it('前綴相同但不同層時算在外面', () => {
    expect(toRelative('/a/bc/tasks.md', '/a/b')).toBe('/a/bc/tasks.md')
  })

  it('沒有給根目錄時回原路徑', () => {
    expect(toRelative('/repo/add-x/tasks.md', '')).toBe('/repo/add-x/tasks.md')
  })
})

describe('isInside', () => {
  it('落在底下的路徑', () => {
    expect(isInside('/repo/add-x/specs/a/spec.md', '/repo/add-x')).toBe(true)
  })

  it('同樣認得 Windows 路徑', () => {
    expect(isInside('C:\\repo\\add-x\\tasks.md', 'C:\\repo\\add-x')).toBe(true)
  })

  it('兩邊分隔符不同樣式也認得', () => {
    expect(isInside('C:/repo/add-x/tasks.md', 'C:\\repo\\add-x')).toBe(true)
  })

  it('根目錄自己不算在底下', () => {
    expect(isInside('/repo/add-x', '/repo/add-x')).toBe(false)
  })

  it('前綴相同但不同層不算在底下', () => {
    expect(isInside('/a/bc', '/a/b')).toBe(false)
    expect(isInside('/a/bc/tasks.md', '/a/b')).toBe(false)
  })

  it('上一層不算在底下', () => {
    expect(isInside('/repo', '/repo/add-x')).toBe(false)
  })

  it('用 `..` 爬出去的路徑擋得下來', () => {
    expect(isInside('/repo/add-x/../../etc/passwd', '/repo/add-x')).toBe(false)
    expect(isInside(join('/repo/add-x', '../../etc/passwd'), '/repo/add-x')).toBe(false)
  })

  it('`..` 爬出去又爬回來的路徑仍算在底下', () => {
    expect(isInside('/repo/add-x/specs/../tasks.md', '/repo/add-x')).toBe(true)
  })

  it('`..` 收斂後撞上前綴相同但不同層的目錄，仍不算在底下', () => {
    expect(isInside('/a/b/../bc/x', '/a/b')).toBe(false)
  })

  it('不同磁碟根的路徑不算在底下', () => {
    expect(isInside('D:\\repo\\add-x\\tasks.md', 'C:\\repo\\add-x')).toBe(false)
  })

  it('沒有給根目錄時一律不算', () => {
    expect(isInside('/repo/add-x/tasks.md', '')).toBe(false)
  })
})
