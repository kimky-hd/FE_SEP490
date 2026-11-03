import { describe, expect, it } from 'vitest'
import mermaid from 'mermaid'
import { cleanLabel, detectDiagramKind, generateDiagram, splitSteps } from './diagramGenerator'

const FLOW =
  'Khách chọn VietQR. Hệ thống sinh mã QR. Nếu thanh toán đúng số tiền thì đơn chuyển PAID. Nếu quá 15 phút thì huỷ đơn.'

/** Nhãn trong ["…"] / {"…"} không được chứa dấu nháy kép hay xuống dòng; mọi nút được nối. */
function structural(code: string) {
  const lines = code.split('\n')
  expect(lines[0]).toMatch(/^(flowchart TD|sequenceDiagram|stateDiagram-v2)$/)
  for (const l of lines.slice(1)) expect(l).toMatch(/^ {2}/)
  for (const m of code.matchAll(/\["([^\n]*?)"\]|\{"([^\n]*?)"\}/g)) {
    const label = m[1] ?? m[2]
    expect(label).not.toContain('"')
    expect(label.length).toBeLessThanOrEqual(41)
  }
}

async function valid(code: string) {
  structural(code)
  await expect(mermaid.parse(code)).resolves.toBeTruthy()
}

describe('diagramGenerator', () => {
  it('mermaid.parse chạy được trong jsdom (từ chối mã sai)', async () => {
    await expect(mermaid.parse('flowchart TD\n  A["x"] --> B{"y"')).rejects.toBeTruthy()
  })

  it('tách câu, gạch đầu dòng, dòng đánh số', () => {
    expect(splitSteps('- Bước một\n2) Bước hai. Bước ba; bước bốn\n\n• Giá 1.5 triệu')).toEqual([
      'Bước một',
      'Bước hai',
      'Bước ba',
      'bước bốn',
      'Giá 1.5 triệu',
    ])
  })

  it('lưu đồ: mỗi câu một bước, "nếu … thì …" thành nhánh có nhãn', async () => {
    const r = generateDiagram(FLOW)
    expect(r.kind).toBe('flowchart')
    expect(r.mermaid).toContain('N1["Khách chọn VietQR"]')
    expect(r.mermaid).toContain('D1{"Thanh toán đúng số tiền?"}')
    expect(r.mermaid).toContain('D1 -->|Có| N3')
    // Câu "nếu" liền sau nằm ở nhánh "Không" của câu trước.
    expect(r.mermaid).toContain('D1 -->|Không| D2')
    expect(r.mermaid).toContain('D2 -->|Không| E')
    expect(r.notes.some((n) => n.includes('Quá 15 phút'))).toBe(true)
    await valid(r.mermaid)
  })

  it('nhánh "ngược lại" đóng điều kiện, không còn ghi chú thiếu nhánh', async () => {
    const r = generateDiagram(
      'Người dùng nhập OTP.\nNếu OTP đúng thì đăng nhập thành công.\nNgược lại, báo lỗi.\nGhi nhật ký.',
    )
    expect(r.mermaid).toMatch(/D1 -->\|Không\| N\d/)
    expect(r.notes).toEqual([])
    await valid(r.mermaid)
  })

  it('"khi … thì …" cũng là nhánh rẽ', () => {
    expect(generateDiagram('Khi hết hàng thì ẩn sản phẩm').mermaid).toContain('{"Hết hàng?"}')
  })

  it('sequence khi các tác nhân gửi / trả về cho nhau', async () => {
    const text =
      'Ứng dụng gửi yêu cầu thanh toán cho Cổng thanh toán.\nCổng thanh toán gọi Ngân hàng.\nNgân hàng trả về kết quả.\nCổng thanh toán trả về mã giao dịch cho Ứng dụng.'
    expect(detectDiagramKind(text)).toBe('sequence')
    const r = generateDiagram(text)
    expect(r.kind).toBe('sequence')
    expect(r.mermaid).toContain('participant P1 as Ứng dụng')
    expect(r.mermaid).toContain('P1->>P2: Gửi yêu cầu thanh toán')
    expect(r.mermaid).toContain('P3-->>P2: Trả về kết quả')
    await valid(r.mermaid)
  })

  it('state khi có "trạng thái / chuyển sang"', async () => {
    const text =
      'Đơn hàng ở trạng thái PENDING. Nếu thanh toán thành công thì chuyển sang PAID. Nếu quá 15 phút thì chuyển sang CANCELLED. Khi giao xong thì chuyển sang DONE.'
    expect(detectDiagramKind(text)).toBe('state')
    const r = generateDiagram(text)
    expect(r.kind).toBe('state')
    expect(r.mermaid).toContain('[*] --> S1')
    expect(r.mermaid).toContain('S1 --> S2 : Thanh toán thành công')
    expect(r.mermaid).toContain('S1 --> S3 : Quá 15 phút')
    await valid(r.mermaid)
  })

  it('ép kind không phù hợp → quay về lưu đồ kèm ghi chú', async () => {
    const r = generateDiagram('Mở trang. Bấm nút.', 'sequence')
    expect(r.kind).toBe('flowchart')
    expect(r.notes.length).toBeGreaterThan(0)
    await valid(r.mermaid)
    const s = generateDiagram('Mở trang. Bấm nút.', 'state')
    expect(s.kind).toBe('flowchart')
  })

  it('thoát ký tự đặc biệt và cắt nhãn ≤ 40 ký tự', async () => {
    expect(cleanLabel('Nhập "mã" [A] {b} <c> | d; #1 --> 50%')).not.toMatch(/["[\]{}<>|;#]|-->/)
    const long = cleanLabel('Hệ thống kiểm tra toàn bộ thông tin đơn hàng và tồn kho của từng chi nhánh')
    expect(long.length).toBeLessThanOrEqual(40)
    expect(long.endsWith('…')).toBe(true)
    const r = generateDiagram(
      'Người dùng nhập "tên" [bắt buộc] {x}.\nNếu tên < 3 ký tự | rỗng thì báo lỗi "ngắn"; dừng.\n%% chú thích\nend',
    )
    await valid(r.mermaid)
  })

  it('văn bản rỗng vẫn trả mã hợp lệ', async () => {
    const r = generateDiagram('   ')
    expect(r.notes.length).toBe(1)
    await valid(r.mermaid)
  })
})
