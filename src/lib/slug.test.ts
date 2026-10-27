import { describe, expect, it } from 'vitest'
import { slugify, toRoleCode, toProjectKey, PROJECT_KEY_PATTERN, ROLE_CODE_PATTERN, WORKSPACE_CODE_PATTERN } from './slug'

describe('slugify', () => {
  it('bỏ dấu tiếng Việt, đổi đ → d, nối bằng gạch ngang', () => {
    expect(slugify('Dự án Ngân hàng Điện tử')).toBe('du-an-ngan-hang-dien-tu')
  })

  it('gộp ký tự đặc biệt liên tiếp, cắt gạch ở 2 đầu', () => {
    expect(slugify('  Internal Portal v2 !! ')).toBe('internal-portal-v2')
  })

  it('kết quả luôn khớp pattern code workspace (nếu không rỗng)', () => {
    for (const name of ['Mobile Banking Revamp', 'QA & Test', 'Đội 1']) {
      expect(slugify(name)).toMatch(WORKSPACE_CODE_PATTERN)
    }
  })

  it('cắt tối đa 50 ký tự và không để gạch ở cuối', () => {
    const slug = slugify('a'.repeat(49) + ' bcd')
    expect(slug.length).toBeLessThanOrEqual(50)
    expect(slug.endsWith('-')).toBe(false)
  })
})

describe('toRoleCode', () => {
  it('sinh UPPER_SNAKE từ tên tiếng Việt', () => {
    expect(toRoleCode('Trưởng nhóm QA')).toBe('TRUONG_NHOM_QA')
  })

  it('tên bắt đầu bằng số vẫn ra code hợp lệ', () => {
    expect(toRoleCode('2nd Reviewer')).toMatch(ROLE_CODE_PATTERN)
  })
})

describe('toProjectKey', () => {
  it('ưu tiên từ viết hoa có sẵn trong tên (Figma frame 02: "… SSAM" → SSAM)', () => {
    expect(toProjectKey('Hệ thống Quản trị Dự án Doanh nghiệp SSAM')).toBe('SSAM')
  })

  it('không có từ viết hoa thì lấy chữ cái đầu, bỏ dấu', () => {
    expect(toProjectKey('Thanh toán điện tử')).toBe('TTDT')
  })

  it('kết quả khớp PROJECT_KEY_PATTERN với tên thông thường', () => {
    for (const name of ['Báo cáo & Đối soát v2', 'Lõi tài khoản', 'Mobile app']) {
      expect(toProjectKey(name)).toMatch(PROJECT_KEY_PATTERN)
    }
  })
})
