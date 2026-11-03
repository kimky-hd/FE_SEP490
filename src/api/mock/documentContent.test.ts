import { describe, expect, it } from 'vitest'
import type { TipTapDoc } from '@/types/document'
import { extractRequirements, formatReqSummary, isValidContent, sha256, summarizeReqChanges } from './documentContent'
import { callout, figma, h, mermaid, p, table, tasks } from './documentSeed'

const counter = () => {
  let i = 0
  return () => `uid-${String(++i).padStart(4, '0')}-0000`
}

const doc = (...content: TipTapDoc['content']): TipTapDoc => ({ type: 'doc', content })

describe('sha256', () => {
  it('khớp vector chuẩn', () => {
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

describe('extractRequirements', () => {
  const sample = () =>
    doc(
      h('h1', 1, 'Tổng quan'),
      p('p1', 'Mở đầu'),
      h('r1', 2, 'Sinh mã QR', { uid: 'u-1', priority: 'HIGH' }),
      p('p2', 'Thân REQ 1'),
      table('t1', [
        ['A', 'B'],
        ['1', '2'],
      ]),
      tasks('k1', [
        ['QR hết hạn sau 15 phút', false],
        ['Mỗi đơn 1 mã', true],
      ]),
      h('r1a', 3, 'Mục con vẫn thuộc REQ 1'),
      mermaid('m1', 'flowchart LR\nA-->B'),
      h('r2', 2, 'Webhook', { uid: 'u-2' }),
      figma('f1', 'https://figma.com/x', 'Màn hình'),
      callout('c1', 'warning', 'Lưu ý'),
      h('h2', 1, 'Phụ lục'),
      tasks('k2', [['Không thuộc REQ nào', false]]),
    )

  it('đánh số REQ theo thứ tự, thân dừng ở heading cùng / cao cấp hơn', () => {
    const { requirements } = extractRequirements(sample(), counter())
    expect(requirements.map((r) => r.reqKey)).toEqual(['REQ-01', 'REQ-02'])
    const [r1, r2] = requirements
    expect(r1.title).toBe('Sinh mã QR')
    expect(r1.priority).toBe('HIGH')
    expect(r1.anchorId).toBe('r1')
    expect(r1.hasTable).toBe(true)
    expect(r1.hasDiagram).toBe(true) // mermaid nằm dưới H3 con, vẫn thuộc REQ 1
    expect(r1.hasFigma).toBe(false)
    expect(r1.acceptanceCriteria).toEqual([
      { text: 'QR hết hạn sau 15 phút', checked: false },
      { text: 'Mỗi đơn 1 mã', checked: true },
    ])
    expect(r2.priority).toBe('MEDIUM')
    expect(r2.hasFigma).toBe(true)
    expect(r2.acceptanceCriteria).toEqual([]) // taskList sau H1 "Phụ lục" không thuộc REQ 2
    expect(r1.bodyPreview).toContain('Thân REQ 1')
    expect(r1.contentHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('đánh lại ReqKey khi xoá REQ đầu, reqUid giữ nguyên', () => {
    const d = sample()
    d.content = d.content.filter((n) => n.attrs?.id !== 'r1')
    const { requirements } = extractRequirements(d, counter())
    expect(requirements).toHaveLength(1)
    expect(requirements[0]).toMatchObject({ reqKey: 'REQ-01', reqUid: 'u-2', title: 'Webhook' })
  })

  it('vá reqUid thiếu / trùng và id heading REQ thiếu, trả content đã vá', () => {
    const d = doc(
      { type: 'heading', attrs: { level: 2, req: true }, content: [{ type: 'text', text: 'Thiếu cả id lẫn uid' }] },
      h('a', 2, 'Có uid', { uid: 'dup' }),
      h('b', 2, 'Trùng uid', { uid: 'dup' }),
      { type: 'paragraph', content: [{ type: 'text', text: 'khối thường thiếu id để nguyên' }] },
    )
    const res = extractRequirements(d, counter())
    expect(res.patched).toBe(true)
    const [first, second, third, para] = res.content.content
    expect(first.attrs?.reqUid).toBe('uid-0002-0000')
    expect(first.attrs?.id).toBe('h-uid-0001')
    expect(second.attrs?.reqUid).toBe('dup')
    expect(third.attrs?.reqUid).toBe('uid-0003-0000')
    expect(para.attrs).toBeUndefined()
    expect(new Set(res.requirements.map((r) => r.reqUid)).size).toBe(3)
  })

  it('không vá gì khi content đã đủ', () => {
    const res = extractRequirements(sample(), counter())
    expect(res.patched).toBe(false)
  })

  it('đổi priority không đổi contentHash, đổi chữ thì đổi', () => {
    const a = extractRequirements(sample()).requirements[0]
    const changedPriority = sample()
    changedPriority.content[2].attrs = { ...changedPriority.content[2].attrs, priority: 'LOW' }
    expect(extractRequirements(changedPriority).requirements[0].contentHash).toBe(a.contentHash)
    const changedText = sample()
    changedText.content[3] = p('p2', 'Thân REQ 1 đã sửa')
    expect(extractRequirements(changedText).requirements[0].contentHash).not.toBe(a.contentHash)
  })
})

describe('isValidContent', () => {
  it('chỉ nhận doc', () => {
    expect(isValidContent({ type: 'doc', content: [] })).toBe(true)
    expect(isValidContent({ type: 'paragraph' })).toBe(false)
    expect(isValidContent('{"type":"doc"}')).toBe(false)
    expect(isValidContent({ type: 'doc', content: 'x' })).toBe(false)
  })
})

describe('summarizeReqChanges', () => {
  it('tóm tắt sửa / thêm / xoá theo reqUid', () => {
    const before = [
      { reqUid: 'a', reqKey: 'REQ-01', contentHash: '1' },
      { reqUid: 'b', reqKey: 'REQ-02', contentHash: '2' },
      { reqUid: 'c', reqKey: 'REQ-03', contentHash: '3' },
    ]
    const after = [
      { reqUid: 'a', reqKey: 'REQ-01', contentHash: '1x' },
      { reqUid: 'c', reqKey: 'REQ-02', contentHash: '3' },
      { reqUid: 'd', reqKey: 'REQ-03', contentHash: '4' },
    ]
    const s = summarizeReqChanges(before, after)
    expect(s).toEqual({ modified: ['REQ-01'], added: ['REQ-03'], removed: ['REQ-02'] })
    expect(formatReqSummary(s)).toBe('Sửa REQ-01; thêm REQ-03; xoá REQ-02')
    expect(formatReqSummary(summarizeReqChanges(before, before))).toBeNull()
  })
})
