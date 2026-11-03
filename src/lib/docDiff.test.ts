import { describe, expect, it } from 'vitest'
import type { TipTapDoc, TipTapNode } from '@/types/document'
import { compareBlocks, diffDocs, formatReqSummary, lcsPairs, listDiff, tableDiff, wordDiff } from './docDiff'
import { h, p, paySrsV10, paySrsV11, table, tasks, txt } from '@/api/mock/documentSeed'

const doc = (...content: TipTapNode[]): TipTapDoc => ({ type: 'doc', content })
const status = (d: ReturnType<typeof diffDocs>) => Object.fromEntries([...d.blocks].map(([id, c]) => [id, c.status]))

describe('diffDocs — cấp khối', () => {
  it('sửa / thêm / xoá theo id, xoá hiện ở vị trí cũ', () => {
    const a = doc(p('a', 'Một'), p('b', 'Hai'), p('c', 'Ba'), p('d', 'Bốn'), p('e', 'Năm'))
    const b = doc(p('a', 'Một'), p('b', 'Hai đã sửa'), p('x', 'Mới'), p('e', 'Năm'))
    const d = diffDocs(a, b)
    expect(status(d)).toEqual({ b: 'modified', x: 'added' })
    expect(d.deleted).toEqual([{ afterId: 'b', blocks: [p('c', 'Ba'), p('d', 'Bốn')] }])
    expect(d.count).toBe(4) // 1 sửa + 1 thêm + 2 xoá
  })

  it('khối đổi thứ tự (ngoài LCS) là CHUYỂN, kèm tiêu đề cũ', () => {
    const a = doc(h('h1', 1, 'Tổng quan'), p('a', 'A'), p('b', 'B'), h('h2', 1, 'Chi tiết'), p('c', 'C'))
    const b = doc(h('h1', 1, 'Tổng quan'), p('b', 'B'), h('h2', 1, 'Chi tiết'), p('c', 'C'), p('a', 'A'))
    const d = diffDocs(a, b)
    expect(status(d)).toEqual({ a: 'moved' })
    expect(d.blocks.get('a')?.movedFrom).toBe('Tổng quan')
    expect(d.count).toBe(1)
  })

  it('chỉ đổi định dạng → FORMAT, không đếm', () => {
    const a = doc(p('a', 'Mã hết hạn sau 15 phút'))
    const b = doc(p('a', 'Mã hết hạn sau ', txt('15 phút', [{ type: 'bold' }])))
    expect(compareBlocks(a.content[0], b.content[0])).toBe('format')
    const d = diffDocs(a, b)
    expect(status(d)).toEqual({ a: 'format' })
    expect(d.count).toBe(0)
  })

  it('bỏ qua attr mặc định của TipTap', () => {
    const fromEditor: TipTapNode = {
      type: 'paragraph',
      attrs: { id: 'a', textAlign: null },
      content: [{ type: 'text', text: 'x', marks: [] }],
    }
    expect(compareBlocks(p('a', 'x'), fromEditor)).toBe('same')
    expect(diffDocs(null, doc(p('a', '1'))).count).toBe(0)
  })

  it('xoá khối đầu trang neo vào null', () => {
    const d = diffDocs(doc(p('a', '1'), p('b', '2')), doc(p('b', '2')))
    expect(d.deleted).toEqual([{ afterId: null, blocks: [p('a', '1')] }])
  })
})

describe('diffDocs — cấp REQ', () => {
  const base = () =>
    doc(
      h('r1', 2, 'REQ một', { uid: 'u1', priority: 'HIGH' }),
      p('p1', 'Thân 1'),
      h('r2', 2, 'REQ hai', { uid: 'u2' }),
      p('p2', 'Thân 2'),
      h('r3', 2, 'REQ ba', { uid: 'u3' }),
      p('p3', 'Thân 3'),
      h('r4', 2, 'REQ bốn', { uid: 'u4' }),
      p('p4', 'Thân 4'),
    )

  it('sửa thân / đổi priority / xoá khối trong thân / thêm / xoá REQ', () => {
    const b = doc(
      h('r1', 2, 'REQ một', { uid: 'u1', priority: 'LOW' }), // đổi priority
      p('p1', 'Thân 1'),
      h('r2', 2, 'REQ hai', { uid: 'u2' }),
      p('p2', 'Thân 2 sửa'), // sửa thân
      h('r3', 2, 'REQ ba', { uid: 'u3' }), // mất p3
      h('r5', 2, 'REQ năm', { uid: 'u5' }), // REQ mới
      p('p5', 'Thân 5'),
    )
    const d = diffDocs(base(), b)
    expect(d.reqs).toEqual({ modified: ['REQ-01', 'REQ-02', 'REQ-03'], added: ['REQ-04'], removed: ['REQ-04'] })
    expect(d.changedReqUids).toEqual(new Set(['u1', 'u2', 'u3', 'u5']))
    expect(formatReqSummary(d.reqs)).toBe('sửa REQ-01, REQ-02, REQ-03, thêm REQ-04, xoá REQ-04')
    // priority không làm khối heading thành "sửa"
    expect(d.blocks.has('r1')).toBe(false)
  })

  it('không đổi gì → summary null', () => {
    const d = diffDocs(base(), base())
    expect(d.count).toBe(0)
    expect(formatReqSummary(d.reqs)).toBeNull()
  })

  it('seed SRS-02: 1.1 → 1.2', () => {
    const d = diffDocs(paySrsV10(), paySrsV11())
    expect(d.blocks.get('b-p1')?.status).toBe('modified')
    expect(d.blocks.get('b-tb1')?.status).toBe('added')
    expect(d.deleted.map((g) => g.blocks.map((x) => x.attrs?.id))).toEqual([['b-p2']])
    expect(d.reqs).toEqual({ modified: ['REQ-01', 'REQ-02'], added: ['REQ-03'], removed: [] })
  })
})

describe('diff bên trong khối', () => {
  it('theo từ', () => {
    expect(wordDiff('Mã hết hạn sau 15 phút', 'Mã hết hạn sau 10 phút')).toEqual([
      { text: 'Mã hết hạn sau ', kind: 'same' },
      { text: '15', kind: 'removed' },
      { text: '10', kind: 'added' },
      { text: ' phút', kind: 'same' },
    ])
  })

  it('bảng: ô sửa, hàng mới, cột mới', () => {
    const a = table('t', [
      ['A', 'B'],
      ['1', '2'],
    ])
    const b = table('t', [
      ['A', 'B', 'C'],
      ['1', '3', 'x'],
      ['4', '5', 'y'],
    ])
    const d = tableDiff(a, b)
    expect(d.addedRows).toEqual([2])
    expect(d.addedCols).toEqual([2])
    expect([...d.changedCells].sort()).toEqual(['0:2', '1:1', '1:2', '2:0', '2:1', '2:2'])
    expect(tableDiff(b, a).removedRows).toBe(1)
  })

  it('checklist: thêm / xoá / đổi tick theo mục', () => {
    const a = tasks('k', [
      ['QR hết hạn sau 15 phút', false],
      ['Mỗi đơn 1 mã', false],
      ['Gửi email', false],
    ])
    const b = tasks('k', [
      ['Hiện đồng hồ đếm ngược', false],
      ['Mỗi đơn 1 mã', true],
      ['Gửi email', false],
    ])
    expect(listDiff(a, b)).toEqual({
      items: ['added', 'checked', 'same'],
      removed: [{ afterIndex: -1, text: 'QR hết hạn sau 15 phút' }],
    })
  })

  it('lcsPairs', () => {
    expect(lcsPairs(['a', 'b', 'c', 'd'], ['b', 'a', 'c', 'd'])).toEqual([
      [1, 0],
      [2, 2],
      [3, 3],
    ])
  })
})
