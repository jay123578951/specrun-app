import { beforeAll, describe, expect, it } from 'vitest'
import { renderMarkdown } from './render'

/**
 * `renderMarkdown` 的 roadmap 選項（design D4，Requirement 引用連結／拆分與進度提前與狀態圖示）。
 * 暖機原因同 `task-consistency.test.ts`：首次呼叫要真的動態載入 shiki，時間不可預期。
 */
beforeAll(async () => {
  await renderMarkdown('warmup')
})

describe('roadmap 選項：引用連結（code_inline）', () => {
  it('對得到目標時輸出 .md-ref button，跨頁目標（spec）附 Specs ↗ 提示', async () => {
    const html = await renderMarkdown('`no-restricted-imports`', {
      roadmap: {
        resolveRef: code => code === 'no-restricted-imports' ? { kind: 'spec', target: 'no-restricted-imports' } : null,
      },
    })

    expect(html).toContain('<button type="button" class="md-ref" data-ref-kind="spec" data-ref-target="no-restricted-imports"><code>no-restricted-imports</code><span class="md-ref-dest">Specs ↗</span></button>')
  })

  it('對得到 change／archived 目標時分別附 Changes ↗／Archived ↗ 提示', async () => {
    const changeHtml = await renderMarkdown('`add-roadmap-view`', {
      roadmap: { resolveRef: () => ({ kind: 'change', target: 'add-roadmap-view' }) },
    })
    const archivedHtml = await renderMarkdown('`2026-09-02-badge-issuance-roster`', {
      roadmap: { resolveRef: () => ({ kind: 'archived', target: '2026-09-02-badge-issuance-roster' }) },
    })

    expect(changeHtml).toContain('<span class="md-ref-dest">Changes ↗</span>')
    expect(archivedHtml).toContain('<span class="md-ref-dest">Archived ↗</span>')
  })

  it('目標是規劃檔（同頁原地切換）時不附目標頁提示', async () => {
    const html = await renderMarkdown('`防災士名冊契約化.md`', {
      roadmap: { resolveRef: () => ({ kind: 'roadmap', target: '防災士名冊契約化.md' }) },
    })

    expect(html).toContain('data-ref-kind="roadmap"')
    expect(html).not.toContain('md-ref-dest')
  })

  it('對不到目標時維持一般行內 code，不輸出 .md-ref', async () => {
    const html = await renderMarkdown('`no-restricted-imports`', {
      roadmap: { resolveRef: () => null },
    })

    expect(html).not.toContain('md-ref')
    expect(html).toContain('<code>no-restricted-imports</code>')
  })

  it('code block（fence）內的行內 code 樣文字不經過引用解析——不會被轉成連結', async () => {
    const source = ['```', '`no-restricted-imports`', '```'].join('\n')
    const html = await renderMarkdown(source, {
      roadmap: { resolveRef: () => ({ kind: 'spec', target: 'no-restricted-imports' }) },
    })

    expect(html).not.toContain('md-ref')
  })

  it('data-ref-target 含 < > & " 時 escape，不形成屬性逸出或標籤注入（design D4 安全重點）', async () => {
    const html = await renderMarkdown('`xss`', {
      roadmap: { resolveRef: () => ({ kind: 'spec', target: '<b>"x&y' }) },
    })

    expect(html).toContain('data-ref-target="&lt;b&gt;&quot;x&amp;y"')
    expect(html).not.toContain('data-ref-target="<b>"')
    expect(html).not.toContain('"x&y"')
  })

  it('code_inline 顯示文字含 < > & 時，包成 .md-ref 後 <code> 內文字仍維持 escape', async () => {
    const html = await renderMarkdown('`<b>&<i>`', {
      roadmap: { resolveRef: () => ({ kind: 'roadmap', target: 'x.md' }) },
    })

    expect(html).toContain('<code>&lt;b&gt;&amp;&lt;i&gt;</code>')
    expect(html).not.toContain('<code><b></code>')
  })
})

describe('roadmap 選項：拆分表模式（狀態欄圖示）', () => {
  const SPLIT_SOURCE = [
    '## 拆分與進度',
    '',
    '| 範圍 | 狀態 |',
    '| --- | --- |',
    '| 停用機構的下游影響 | ⬅ 接下來 |',
    '| 已完成的項目 | ✅ |',
    '| 卡住的項目 | 卡著 |',
    '| 其他 | 暫緩 |',
  ].join('\n')

  it('三個固定值換成內嵌 SVG 圖示＋title，並替該列加上狀態 class', async () => {
    const html = await renderMarkdown(SPLIT_SOURCE, {
      roadmap: { resolveRef: () => null, splitTable: true },
    })

    expect(html).toContain('md-status-icon-next')
    expect(html).toContain('title="Next up"')
    expect(html).toContain('md-status-row-next')
    expect(html).toContain('md-status-icon-done')
    expect(html).toContain('title="Done"')
    expect(html).toContain('md-status-row-done')
    expect(html).toContain('md-status-icon-blocked')
    expect(html).toContain('title="Blocked"')
    expect(html).toContain('md-status-row-blocked')
    expect(html).toContain('<svg')
    // 不認得的值照原文顯示，不強行套圖示
    expect(html).toContain('暫緩')
    expect(html).not.toContain('md-status-icon-暫緩')
  })

  it('三個狀態圖示各自有 role="img" 與對應 aria-label，svg 對讀屏器隱藏（title 仍保留）', async () => {
    const html = await renderMarkdown(SPLIT_SOURCE, {
      roadmap: { resolveRef: () => null, splitTable: true },
    })

    expect(html).toContain('class="md-status-icon md-status-icon-next" role="img" aria-label="Next up" title="Next up"')
    expect(html).toContain('class="md-status-icon md-status-icon-done" role="img" aria-label="Done" title="Done"')
    expect(html).toContain('class="md-status-icon md-status-icon-blocked" role="img" aria-label="Blocked" title="Blocked"')
    expect(html.match(/<svg aria-hidden="true"/g)?.length).toBe(3)
  })

  it('狀態欄（含表頭）加上不折行的 class', async () => {
    const html = await renderMarkdown(SPLIT_SOURCE, {
      roadmap: { resolveRef: () => null, splitTable: true },
    })

    // 表頭「狀態」與每個資料列的狀態欄都要能被 CSS 選到（Requirement：該欄 MUST NOT 折行）
    expect(html.match(/class="[^"]*md-status-col[^"]*"/g)?.length).toBe(5)
  })

  it('splitTable 未開啟時，「## 拆分與進度」段以外的表格不受影響（原文照舊）', async () => {
    const html = await renderMarkdown(SPLIT_SOURCE, {
      roadmap: { resolveRef: () => null },
    })

    expect(html).not.toContain('md-status-icon')
    expect(html).not.toContain('md-status-row')
    expect(html).toContain('⬅ 接下來')
    expect(html).toContain('✅')
  })

  it('狀態欄非精確三值的內容含 HTML 特殊字元時，照原文 escape，不套圖示（design D4 安全重點）', async () => {
    const source = ['| 範圍 | 狀態 |', '| --- | --- |', '| 其他 | <script>x</script> |'].join('\n')
    const html = await renderMarkdown(source, {
      roadmap: { resolveRef: () => null, splitTable: true },
    })

    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;')
    expect(html).not.toContain('<script>x</script>')
    expect(html).not.toContain('md-status-icon')
  })

  it('狀態欄的值被其他標記包住（如加粗）時不轉圖示，照原文呈現', async () => {
    const source = ['| 範圍 | 狀態 |', '| --- | --- |', '| A | **✅** |'].join('\n')
    const html = await renderMarkdown(source, {
      roadmap: { resolveRef: () => null, splitTable: true },
    })

    expect(html).toContain('<strong>✅</strong>')
    expect(html).not.toContain('md-status-icon-done')
  })

  it('只有表頭為「狀態」的表格受影響，其他表格內相同文字不受影響', async () => {
    const source = [
      '| foo | bar |',
      '| --- | --- |',
      '| x | ✅ |',
      '',
      '| 範圍 | 狀態 |',
      '| --- | --- |',
      '| y | ✅ |',
    ].join('\n')
    const html = await renderMarkdown(source, {
      roadmap: { resolveRef: () => null, splitTable: true },
    })

    expect(html.match(/md-status-icon-done/g)?.length).toBe(1)
  })
})

describe('roadmap 選項：不傳時的相容性（3.1 硬要求）', () => {
  it('不傳 options 與傳空物件的輸出逐字相同', async () => {
    const source = ['# Tasks', '', '`no-restricted-imports`', '', '- [ ] a', '', '[link](https://example.com)'].join('\n')

    const withoutOptions = await renderMarkdown(source)
    const withEmptyOptions = await renderMarkdown(source, {})

    expect(withoutOptions).toBe(withEmptyOptions)
    expect(withoutOptions).toContain('<code>no-restricted-imports</code>')
    expect(withoutOptions).not.toContain('md-ref')
  })

  it('未傳 roadmap 選項時，含「狀態」欄的表格照常輸出，不套圖示', async () => {
    const source = ['| 狀態 |', '| --- |', '| ✅ |'].join('\n')

    const html = await renderMarkdown(source)

    expect(html).not.toContain('md-status-icon')
    expect(html).toContain('✅')
  })
})
