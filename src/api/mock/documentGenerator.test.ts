import { describe, expect, it } from 'vitest'
import { buildGeneratedContent, extractRequirementsFromFields, normalizeNotes, SAMPLE_NOTES } from './documentGenerator'
import { extractRequirements } from './documentContent'

const counter = () => {
  let i = 0
  return () => `uid-${String(++i).padStart(4, '0')}-0000`
}

describe('normalizeNotes', () => {
  it('tách ghi chú mẫu thành 4 trường', () => {
    const f = normalizeNotes(SAMPLE_NOTES)
    // Dòng tiêu đề "Ghi chú họp …:" bị bỏ, câu đầu là phạm vi.
    expect(f.scope).toBe('Thanh toán đơn hàng bằng mã VietQR động, đối soát tự động qua webhook ngân hàng')
    expect(f.actors.split(', ')).toEqual(expect.arrayContaining(['Khách hàng', 'Hệ thống', 'Ngân hàng', 'Kế toán']))
    const flows = f.mainFlows.split('\n')
    expect(flows).toContain('Khách hàng chọn thanh toán VietQR ở bước checkout')
    expect(flows).toContain('Ngân hàng gửi webhook về SSAM khi giao dịch thành công')
    expect(flows).toHaveLength(5)
    const rules = f.businessRules.split('\n')
    expect(rules).toHaveLength(3)
    expect(rules[0]).toMatch(/^Mã QR chỉ có hiệu lực trong 15 phút/)
    expect(f.mainFlows).not.toMatch(/chỉ có hiệu lực/)
  })

  it('nhận "chỉ"/"phải" theo ranh giới từ tiếng Việt và tiền tố "Ràng buộc:"', () => {
    const f = normalizeNotes(
      'Quản lý kho hàng.\nRàng buộc: số lượng tối thiểu là 1\nNhân viên nhập phiếu kho\nChỉ admin được xoá phiếu',
    )
    expect(f.businessRules.split('\n')).toEqual(['Số lượng tối thiểu là 1', 'Chỉ admin được xoá phiếu'])
    expect(f.mainFlows).toBe('Nhân viên nhập phiếu kho')
  })
})

describe('extractRequirementsFromFields', () => {
  it('mỗi luồng 1 REQ, quy tắc gắn theo từ khoá chung, ưu tiên theo từ khoá', () => {
    const items = extractRequirementsFromFields(
      {
        scope: 'Thanh toán',
        actors: 'Khách hàng, Ngân hàng',
        mainFlows:
          '1. Hệ thống sinh mã QR động cho đơn hàng\n2. Ngân hàng gửi webhook về hệ thống\n3. Khách hàng xem lịch sử đơn',
        businessRules: '- Mã QR hết hạn sau 15 phút\n- Webhook phải phản hồi tối đa 3 giây',
      },
      counter(),
    )
    expect(items.map((i) => i.title)).toEqual([
      'Hệ thống sinh mã QR động cho đơn hàng',
      'Ngân hàng gửi webhook về hệ thống',
      'Khách hàng xem lịch sử đơn',
    ])
    expect(items[0].acceptanceCriteria).toEqual(['Mã QR hết hạn sau 15 phút'])
    expect(items[1].acceptanceCriteria).toEqual(['Webhook phải phản hồi tối đa 3 giây'])
    expect(items[2].acceptanceCriteria).toEqual([])
    expect(items.map((i) => i.priority)).toEqual(['MEDIUM', 'HIGH', 'MEDIUM'])
    expect(new Set(items.map((i) => i.tempId)).size).toBe(3)
  })
})

describe('sourceLines', () => {
  it('trỏ về dòng ghi chú gốc của luồng và tiêu chí', () => {
    const fields = normalizeNotes(SAMPLE_NOTES)
    const items = extractRequirementsFromFields(fields, counter(), SAMPLE_NOTES)
    const lines = SAMPLE_NOTES.split('\n')
    const qr = items.find((i) => i.title.startsWith('Hệ thống sinh mã QR'))!
    expect(qr.sourceLines.map((i) => lines[i])).toContain(
      '- Hệ thống sinh mã QR động kèm số tiền và mã đơn hàng duy nhất.',
    )
    expect(qr.sourceLines.length).toBeGreaterThanOrEqual(1)
    expect(extractRequirementsFromFields(fields, counter())[0].sourceLines).toEqual([])
  })
})

describe('buildGeneratedContent', () => {
  it('dựng đúng khung §6 và trích được REQ', () => {
    const fields = normalizeNotes(SAMPLE_NOTES)
    const items = extractRequirementsFromFields(fields, counter())
    const { content, items: generated } = buildGeneratedContent(fields, items, counter())
    const top = content.content
    expect(generated.map((g) => g.reqUid)).toEqual(top.filter((n) => n.attrs?.req === true).map((n) => n.attrs?.reqUid))
    const headings = top.filter((n) => n.type === 'heading')
    expect(headings.filter((n) => n.attrs?.level === 1).map((n) => n.content?.[0].text)).toEqual([
      '1. Tổng quan',
      '2. Yêu cầu chức năng',
      '3. Quy tắc nghiệp vụ',
    ])
    expect(top[1]).toMatchObject({ type: 'paragraph' })
    expect(top[2].type).toBe('bulletList')
    const reqHeadings = headings.filter((n) => n.attrs?.req === true)
    expect(reqHeadings).toHaveLength(items.length)
    expect(reqHeadings.every((n) => n.attrs?.level === 2 && n.attrs?.reqUid && n.attrs?.id)).toBe(true)
    const last = top[top.length - 1]
    expect(last).toMatchObject({ type: 'callout', attrs: { tone: 'rule' } })
    expect(last.content?.[0].type).toBe('bulletList')
    expect(last.content?.[0].content).toHaveLength(3)

    const extracted = extractRequirements(content)
    expect(extracted.patched).toBe(false)
    expect(extracted.requirements).toHaveLength(items.length)
    const withCriteria = extracted.requirements.filter((r) => r.acceptanceCriteria.length > 0)
    expect(withCriteria.length).toBeGreaterThan(0)
  })
})
