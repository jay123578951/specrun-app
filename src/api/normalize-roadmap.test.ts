import type { RoadmapFileProbe, RoadmapListProbe, RoadmapRefContext, RoadmapSummary } from './types'
import { describe, expect, it } from 'vitest'
import { buildRoadmapRefContext, normalizeRoadmapList, resolveRoadmapRef, splitRoadmapSections } from './normalize-roadmap'

const TARGET = '/repo'

function listProbe(files: RoadmapFileProbe[], overrides: Partial<RoadmapListProbe> = {}): RoadmapListProbe {
  return {
    targetPath: TARGET,
    dirExists: true,
    offExists: false,
    files,
    refs: { specs: [], changes: [], archived: [], parked: [] },
    ...overrides,
  }
}

function file(name: string, content: string, overrides: Partial<RoadmapFileProbe> = {}): RoadmapFileProbe {
  return { name, content, mtime: 1_758_000_000_000, ...overrides }
}

function itemOf(probe: RoadmapListProbe, name: string): RoadmapSummary {
  const result = normalizeRoadmapList(probe)
  if (!result.ok)
    throw new Error('expected ok result')
  const found = result.items.find(item => item.name === name)
  if (!found)
    throw new Error(`item not found: ${name}`)
  return found
}

describe('normalizeRoadmapList: 標題與狀態字', () => {
  it('取最後一段連續兩個以上空白之後的文字為狀態字', () => {
    const item = itemOf(listProbe([file('培訓機構管理.md', '# 培訓機構管理        1/4\n\n內容\n')]), '培訓機構管理')
    expect(item.title).toBe('培訓機構管理')
    expect(item.statusText).toBe('1/4')
  })

  it('標題含行內 code：原樣保留 Markdown 語法', () => {
    const item = itemOf(listProbe([file('色彩透明度寫法失效.md', '# 色彩透明度寫法失效（`/N`）\n\n內容\n')]), '色彩透明度寫法失效')
    expect(item.title).toBe('色彩透明度寫法失效（`/N`）')
    expect(item.group).toBe('other') // 無狀態字、內文不含四個規定段落
  })

  it('標題行不含連續兩個以上空白時，整段為標題、狀態字為空', () => {
    const item = itemOf(listProbe([file('單純標題.md', '# 單純標題 沒有雙空白\n\n內容\n')]), '單純標題')
    expect(item.title).toBe('單純標題 沒有雙空白')
    expect(item.statusText).toBe('')
  })

  it('沒有 # 標題行：標題退回檔名、狀態字視為不存在、歸 Other（無段落標題歸 Other）', () => {
    const probe = listProbe([file('內容沒有標題行.md', '這份檔案沒有 # 開頭的行。\n\n## 動工前必知\n\n內容\n')])
    const item = itemOf(probe, '內容沒有標題行')
    expect(item.title).toBe('內容沒有標題行')
    expect(item.statusText).toBe('')
    expect(item.group).toBe('other')
  })
})

describe('normalizeRoadmapList: 清單分組', () => {
  it('0/M 歸 Available', () => {
    const item = itemOf(listProbe([file('某可挑項目.md', '# 某可挑項目        0/3\n\n## 動工前必知\n\n內容\n')]), '某可挑項目')
    expect(item.group).toBe('available')
    expect(item.progress).toEqual({ completed: 0, total: 3 })
  })

  it('狀態字 N/M 且 N=M 歸 Other（全數完成未刪檔）', () => {
    const item = itemOf(listProbe([file('全數完成.md', '# 全數完成        8/8\n\n內容\n')]), '全數完成')
    expect(item.group).toBe('other')
  })

  it('狀態字 N/M 且 0<N<M 歸 In progress', () => {
    const item = itemOf(listProbe([file('進行中.md', '# 進行中        1/4\n\n內容\n')]), '進行中')
    expect(item.group).toBe('in-progress')
    expect(item.progress).toEqual({ completed: 1, total: 4 })
  })

  it('狀態字為卡著歸 Blocked', () => {
    const item = itemOf(listProbe([file('卡住的項目.md', '# 卡住的項目        卡著\n\n內容\n')]), '卡住的項目')
    expect(item.group).toBe('blocked')
  })

  it('無段落標題歸 Other（總覽檔：無狀態字，內文只有自訂段落標題）', () => {
    const content = [
      '# 執行順序',
      '',
      'roadmap 各項之間的先後與現況。',
      '',
      '## 交接主線',
      '',
      '內容。',
      '',
      '## 卡著（前置未解除）',
      '',
      '內容。',
      '',
    ].join('\n')
    const item = itemOf(listProbe([file('00-執行順序.md', content)]), '00-執行順序')
    expect(item.group).toBe('other')
  })

  it('一般單段項：無狀態字、內文含規定段落標題之一，歸 Available', () => {
    const content = '# 標章草稿與退回案可編輯的範圍\n\n說明文字。\n\n## 動工前必知\n\n內容。\n'
    const item = itemOf(listProbe([file('標章草稿可編輯範圍.md', content)]), '標章草稿可編輯範圍')
    expect(item.group).toBe('available')
  })

  it('狀態字不是卡著／N-M／空三種標準形式時歸 Other，即使內文含規定段落標題', () => {
    const content = '# 審核中的項目        審核中\n\n## 動工前必知\n\n內容\n'
    const item = itemOf(listProbe([file('審核中的項目.md', content)]), '審核中的項目')
    expect(item.group).toBe('other')
  })

  it('單檔讀取失敗：以檔名列入 Other 組，其餘卡片正常', () => {
    const probe = listProbe([
      { name: '讀不到的檔.md', readError: 'EACCES', mtime: 1_758_000_000_000 },
      file('正常的檔.md', '# 正常的檔        1/2\n\n內容\n'),
    ])
    const result = normalizeRoadmapList(probe)
    if (!result.ok)
      throw new Error('expected ok result')

    const broken = result.items.find(item => item.name === '讀不到的檔')!
    expect(broken.group).toBe('other')
    expect(broken.title).toBe('讀不到的檔')
    expect(broken.readFailed).toBe(true)
    expect(broken.body).toBe('')

    const fine = result.items.find(item => item.name === '正常的檔')!
    expect(fine.group).toBe('in-progress')
    expect(fine.readFailed).toBe(false)
  })
})

describe('normalizeRoadmapList: 排序', () => {
  it('組內依檔名字母序，組間依 In progress → Available → Blocked → Other', () => {
    const probe = listProbe([
      file('z卡著項.md', '# z卡著項        卡著\n'),
      file('a其他項.md', '# a其他項        3/3\n'),
      file('b可挑項.md', '# b可挑項        0/1\n\n## 動工前必知\n'),
      file('a可挑項.md', '# a可挑項        0/1\n\n## 動工前必知\n'),
      file('a進行中.md', '# a進行中        1/2\n'),
    ])
    const result = normalizeRoadmapList(probe)
    if (!result.ok)
      throw new Error('expected ok result')
    expect(result.items.map(item => item.name)).toEqual([
      'a進行中',
      'a可挑項',
      'b可挑項',
      'z卡著項',
      'a其他項',
    ])
  })
})

describe('normalizeRoadmapList: Next／Needs／part of', () => {
  it('進行中項目：Next 取拆分表 ⬅ 接下來那列的範圍欄', () => {
    const content = [
      '# 培訓機構管理        1/4',
      '',
      '## 拆分與進度',
      '',
      '| # | 範圍 | change | 狀態 |',
      '|---|------|--------|------|',
      '| 2 | 停用機構的下游影響 | — | ⬅ 接下來 |',
      '| 1 | 七頁不顯示角色切換器 | `2026-09-22-dpo-role-switcher-unification` | ✅ |',
      '',
    ].join('\n')
    const item = itemOf(listProbe([file('培訓機構管理.md', content)]), '培訓機構管理')
    expect(item.next).toBe('停用機構的下游影響')
  })

  it('卡著的項目：Needs 取開頭段前置行內容，去除行內 code 與粗體記號', () => {
    const content = [
      '# 撤銷後重新輔導        卡著',
      '',
      '說明文字。**不是開發工時的問題**。',
      '',
      '- **前置**：業主確認重新輔導的實際運作流程（見下）',
      '',
      '## 開始的條件',
      '',
      '內容。',
      '',
    ].join('\n')
    const item = itemOf(listProbe([file('撤銷後重新輔導.md', content)]), '撤銷後重新輔導')
    expect(item.needs).toBe('業主確認重新輔導的實際運作流程（見下）')
  })

  it('needs 去除行內 code 與粗體標記', () => {
    const content = [
      '# 撤銷後重新輔導        卡著',
      '',
      '- **前置**：`2026-09-01-badge-issuance`完成後，**業主**確認流程',
      '',
      '## 開始的條件',
      '',
      '內容。',
      '',
    ].join('\n')
    const item = itemOf(listProbe([file('撤銷後重新輔導.md', content)]), '撤銷後重新輔導')
    expect(item.needs).toBe('2026-09-01-badge-issuance完成後，業主確認流程')
  })

  it('取不到 Next／Needs 時為空', () => {
    const content = '# 卡著但沒有前置行        卡著\n\n## 開始的條件\n\n內容。\n'
    const item = itemOf(listProbe([file('卡著但沒有前置行.md', content)]), '卡著但沒有前置行')
    expect(item.needs).toBeNull()
    expect(item.next).toBeNull()
  })

  it('part of：屬於行第一個對得到的 .md 引用，解析為父項標題', () => {
    const parent = file('培訓機構管理.md', '# 培訓機構管理        1/4\n\n內容\n')
    const childContent = [
      '# 契約化並改吃資料存取層',
      '',
      '- **屬於**：`培訓機構管理.md`',
      '',
      '## 動工前必知',
      '',
      '內容。',
      '',
    ].join('\n')
    const child = file('契約化並改吃資料存取層.md', childContent)
    const item = itemOf(listProbe([parent, child]), '契約化並改吃資料存取層')
    expect(item.partOf).toBe('培訓機構管理')
  })

  it('part of：屬於行有多個行內 code，跳過非 .md 形狀，取第一個對得到的 .md', () => {
    const parent = file('培訓機構管理.md', '# 培訓機構管理        1/4\n\n內容\n')
    const childContent = [
      '# 契約化並改吃資料存取層',
      '',
      '- **屬於**：見 `某功能代號` 之下的 `培訓機構管理.md`',
      '',
      '## 動工前必知',
      '',
      '內容。',
      '',
    ].join('\n')
    const child = file('契約化並改吃資料存取層.md', childContent)
    const item = itemOf(listProbe([parent, child]), '契約化並改吃資料存取層')
    expect(item.partOf).toBe('培訓機構管理')
  })

  it('part of：引用對不到清單內規劃檔時為 null', () => {
    const content = '# 孤兒項目\n\n- **屬於**：`不存在的父項.md`\n\n## 動工前必知\n\n內容。\n'
    const item = itemOf(listProbe([file('孤兒項目.md', content)]), '孤兒項目')
    expect(item.partOf).toBeNull()
  })
})

describe('normalizeRoadmapList: 錯誤分類', () => {
  it('非 openspec 專案與讀取失敗分開（前者沒得重試）', () => {
    const notProject = normalizeRoadmapList(listProbe([], {
      failure: { kind: 'not-openspec-project', message: 'No openspec/ directory at /repo.' },
    }))
    const readFailed = normalizeRoadmapList(listProbe([], {
      failure: { kind: 'read-failed', message: 'EACCES: permission denied' },
    }))

    expect(notProject).toMatchObject({ ok: false, error: { kind: 'not-openspec-project' } })
    expect(readFailed).toMatchObject({ ok: false, error: { kind: 'call-failed' } })
  })

  it('目錄不存在是正常狀態，不是錯誤：ok:true 且 dirExists 反映現況', () => {
    const result = normalizeRoadmapList(listProbe([], { dirExists: false, offExists: true }))
    expect(result).toMatchObject({ ok: true, dirExists: false, offExists: true, items: [] })
  })
})

describe('splitRoadmapSections', () => {
  it('冒號全形與半形都認得', () => {
    const body = [
      '- **規格**：全形冒號',
      '- **相關**: 半形冒號',
      '',
      '## 動工前必知',
      '',
      '內容',
      '',
    ].join('\n')
    const { relations } = splitRoadmapSections(body)
    expect(relations).toEqual([
      { label: '規格', value: '全形冒號' },
      { label: '相關', value: '半形冒號' },
    ])
  })

  it('欄名超過 6 字不算關係欄：留在導言', () => {
    const body = '- **超過六個字的欄位名稱**：內容\n\n## 動工前必知\n\n內容\n'
    const { lead, relations } = splitRoadmapSections(body)
    expect(relations).toEqual([])
    expect(lead).toContain('超過六個字的欄位名稱')
  })

  it('非規定欄名照收', () => {
    const body = '- **順序與現況**：`00-執行順序.md`\n\n## 動工前必知\n\n內容\n'
    const { relations } = splitRoadmapSections(body)
    expect(relations).toEqual([{ label: '順序與現況', value: '`00-執行順序.md`' }])
  })

  it('其餘段落維持原順序', () => {
    const body = [
      '## 開始的條件',
      '',
      'A 段內容',
      '',
      '## 拆分與進度',
      '',
      '表格內容',
      '',
      '## 動工前必知',
      '',
      'B 段內容',
      '',
    ].join('\n')
    const { split, rest } = splitRoadmapSections(body)
    expect(split).toContain('## 拆分與進度')
    expect(split).toContain('表格內容')
    const startIdx = rest.indexOf('## 開始的條件')
    const endIdx = rest.indexOf('## 動工前必知')
    expect(startIdx).toBeGreaterThanOrEqual(0)
    expect(endIdx).toBeGreaterThan(startIdx)
    expect(rest).not.toContain('## 拆分與進度')
  })

  it('沒有開頭段時導言與關係欄為空', () => {
    const body = '## 動工前必知\n\n內容\n'
    const { lead, relations } = splitRoadmapSections(body)
    expect(lead).toBe('')
    expect(relations).toEqual([])
  })

  it('沒有拆分段時 split 為空', () => {
    const body = '說明文字。\n\n## 動工前必知\n\n內容\n'
    const { split } = splitRoadmapSections(body)
    expect(split).toBe('')
  })
})

describe('fenced code block 內的假標題／關係欄／表格列不生效', () => {
  it('開頭段 fence 內的 `## 拆分與進度` 與 `- **前置**：…` 不被當標題／關係欄：仍留在導言，needs 為空', () => {
    const content = [
      '# 卡著但範例混淆        卡著',
      '',
      '說明文字。',
      '',
      '```',
      '## 拆分與進度',
      '- **前置**：不是真的前置',
      '```',
      '',
      '## 開始的條件',
      '',
      '內容。',
      '',
    ].join('\n')
    const item = itemOf(listProbe([file('卡著但範例混淆.md', content)]), '卡著但範例混淆')

    expect(item.needs).toBeNull()

    const { lead, relations, split } = splitRoadmapSections(item.body)
    expect(relations).toEqual([])
    expect(split).toBe('')
    expect(lead).toContain('## 拆分與進度')
    expect(lead).toContain('- **前置**：不是真的前置')
  })

  it('fence 內的 `## 開始的條件` 不讓無狀態字的檔歸 Available', () => {
    const content = [
      '# 假裝可挑的項目',
      '',
      '```',
      '## 開始的條件',
      '```',
      '',
    ].join('\n')
    const item = itemOf(listProbe([file('假裝可挑的項目.md', content)]), '假裝可挑的項目')

    expect(item.group).toBe('other')
  })

  it('拆分段內 ~~~ 包住的 `## fake` 不切新段，fence 外的真 `## ` 照常切', () => {
    const body = [
      '## 拆分與進度',
      '',
      '~~~',
      '## fake',
      '~~~',
      '',
      '## 動工前必知',
      '真的段落內容',
    ].join('\n')
    const { split, rest } = splitRoadmapSections(body)

    expect(split).toContain('## fake')
    expect(rest).not.toContain('## fake')
    expect(rest).toContain('## 動工前必知')
    expect(rest).toContain('真的段落內容')
  })

  it('拆分表以外（fence 內）含 ⬅ 的表格列不被當 Next，真正的表格列才算數', () => {
    const content = [
      '# 有假 Next 的項目        1/2',
      '',
      '## 拆分與進度',
      '',
      '```',
      '| 範圍 | 狀態 |',
      '|------|------|',
      '| 假的 | ⬅ 接下來 |',
      '```',
      '',
      '| 範圍 | 狀態 |',
      '|------|------|',
      '| 真的 | ⬅ 接下來 |',
      '',
    ].join('\n')
    const item = itemOf(listProbe([file('有假Next的項目.md', content)]), '有假Next的項目')

    expect(item.next).toBe('真的')
  })
})

describe('resolveRoadmapRef', () => {
  function ctx(overrides: Partial<RoadmapRefContext> = {}): RoadmapRefContext {
    return { roadmapFiles: [], specs: [], changes: [], archived: [], ...overrides }
  }

  it('規則1：.md 存在於本次清單則連到規劃檔', () => {
    const resolved = resolveRoadmapRef('培訓機構管理.md', ctx({ roadmapFiles: ['培訓機構管理.md', '其他.md'] }))
    expect(resolved).toEqual({ kind: 'roadmap', target: '培訓機構管理.md' })
  })

  it('撞名時連到規格：spec 與封存 change 同名，優先 spec', () => {
    const resolved = resolveRoadmapRef('resilient-community-lifecycle', ctx({
      specs: ['resilient-community-lifecycle'],
      archived: ['2026-08-10-resilient-community-lifecycle'],
    }))
    expect(resolved).toEqual({ kind: 'spec', target: 'resilient-community-lifecycle' })
  })

  it('短的 archive/ 路徑', () => {
    const resolved = resolveRoadmapRef('archive/2026-09-02-badge-issuance-roster/', ctx({
      archived: ['2026-09-02-badge-issuance-roster'],
    }))
    expect(resolved).toEqual({ kind: 'archived', target: '2026-09-02-badge-issuance-roster' })
  })

  it('整段為 YYYY-MM-DD-名稱', () => {
    const resolved = resolveRoadmapRef('2026-09-22-dpo-role-switcher-unification', ctx({
      archived: ['2026-09-22-dpo-role-switcher-unification'],
    }))
    expect(resolved).toEqual({ kind: 'archived', target: '2026-09-22-dpo-role-switcher-unification' })
  })

  it('specs/<id>/spec.md', () => {
    const resolved = resolveRoadmapRef('specs/institution-venue-management/spec.md', ctx({
      specs: ['institution-venue-management'],
    }))
    expect(resolved).toEqual({ kind: 'spec', target: 'institution-venue-management' })
  })

  it('kebab 名比對到 change（含 parked 併入的 changes 清單）', () => {
    const resolved = resolveRoadmapRef('add-roadmap-view', ctx({ changes: ['add-roadmap-view'] }))
    expect(resolved).toEqual({ kind: 'change', target: 'add-roadmap-view' })
  })

  it('kebab 名同時是 change 與封存目錄同名時，優先 change', () => {
    const resolved = resolveRoadmapRef('quality-gate-baseline-zero', ctx({
      changes: ['quality-gate-baseline-zero'],
      archived: ['2026-09-22-quality-gate-baseline-zero'],
    }))
    expect(resolved).toEqual({ kind: 'change', target: 'quality-gate-baseline-zero' })
  })

  it('kebab 名比對到封存目錄去日期前綴後同名', () => {
    const resolved = resolveRoadmapRef('quality-gate-baseline-zero', ctx({
      archived: ['2026-09-22-quality-gate-baseline-zero'],
    }))
    expect(resolved).toEqual({ kind: 'archived', target: '2026-09-22-quality-gate-baseline-zero' })
  })

  it('不存在的 .md 不成連結', () => {
    expect(resolveRoadmapRef('已刪除的項目.md', ctx({ roadmapFiles: ['其他規劃檔.md'] }))).toBeNull()
  })

  it('對不到的 kebab 名不成連結', () => {
    expect(resolveRoadmapRef('no-restricted-imports', ctx())).toBeNull()
  })
})

describe('buildRoadmapRefContext', () => {
  it('把 items 的檔名與 refs 的四類名稱組成比對清單，changes 併入 parked', () => {
    const items = [{ file: 'a.md' } as RoadmapSummary]
    const context = buildRoadmapRefContext(items, {
      specs: ['spec-a'],
      changes: ['change-a'],
      archived: ['2026-01-01-old'],
      parked: ['parked-a'],
    })
    expect(context).toEqual({
      roadmapFiles: ['a.md'],
      specs: ['spec-a'],
      changes: ['change-a', 'parked-a'],
      archived: ['2026-01-01-old'],
    })
  })
})
