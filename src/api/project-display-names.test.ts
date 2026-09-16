import { describe, expect, it } from 'vitest'
import { projectDisplayNames } from './project-display-names'

/**
 * 顯示名是兩種執行形態共用的算法（設定檔也共用），所以它不能倚賴任一平台的
 * 路徑函式——這裡連 Windows 寫下的路徑一起測。
 */

describe('projectDisplayNames', () => {
  it('目錄名即顯示名', () => {
    expect(projectDisplayNames(['/Users/x/code/app', '/Users/x/code/site'])).toEqual(['app', 'site'])
  })

  it('撞名才帶一層父目錄消歧，沒撞名的維持原樣', () => {
    expect(projectDisplayNames(['/a/one/app', '/b/two/app', '/c/site'])).toEqual(['one/app', 'two/app', 'site'])
  })

  it('結尾分隔符與重複分隔符不影響取名', () => {
    expect(projectDisplayNames(['/Users/x/code//app/'])).toEqual(['app'])
  })

  it('windows 路徑同樣取得到目錄名與父目錄', () => {
    expect(projectDisplayNames(['C:\\code\\one\\app', 'C:\\code\\two\\app'])).toEqual(['one/app', 'two/app'])
  })

  it('沒有可取的段時退回整串路徑', () => {
    expect(projectDisplayNames(['/'])).toEqual(['/'])
  })
})
