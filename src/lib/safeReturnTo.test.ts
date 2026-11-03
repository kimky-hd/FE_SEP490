import { describe, expect, it } from 'vitest'
import { safeReturnTo } from './safeReturnTo'

describe('safeReturnTo', () => {
  it('nhận path nội bộ', () => {
    expect(safeReturnTo('/projects/5/documents?doc=1')).toBe('/projects/5/documents?doc=1')
  })

  it.each([
    ['//evil.com', 'protocol-relative'],
    ['/\\evil.com', 'gạch ngược sau gạch chéo'],
    ['\\\\evil.com', 'gạch ngược đầu'],
    ['/foo\\..\\@evil.com', 'gạch ngược giữa path'],
    ['https://evil.com', 'URL tuyệt đối'],
    ['evil.com', 'không bắt đầu bằng /'],
  ])('chặn %s (%s)', (from) => {
    expect(safeReturnTo(from)).toBeNull()
  })

  it('bỏ qua giá trị không phải chuỗi', () => {
    expect(safeReturnTo(undefined)).toBeNull()
    expect(safeReturnTo({ pathname: '/x' })).toBeNull()
  })
})
