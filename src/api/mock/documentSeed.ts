// Dữ liệu mẫu cho mock module Tài liệu (§9: dự án demo có 2 thư mục). Mọi khối cấp cao nhất đều có `attrs.id`
// để so sánh phiên bản theo id (§3). Bản 1.1 của SRS-02 copy từ 1.0 rồi sửa → id trùng ở các khối giữ nguyên.

import type { CalloutTone, Priority, TipTapDoc, TipTapNode } from '@/types/document'

type Marks = TipTapNode['marks']

export const txt = (text: string, marks?: Marks): TipTapNode =>
  marks ? { type: 'text', text, marks } : { type: 'text', text }
export const p = (id: string, ...parts: (string | TipTapNode)[]): TipTapNode => ({
  type: 'paragraph',
  attrs: { id },
  content: parts.map((x) => (typeof x === 'string' ? txt(x) : x)),
})
export const h = (id: string, level: number, text: string, req?: { uid: string; priority?: Priority }): TipTapNode => ({
  type: 'heading',
  attrs: { id, level, ...(req ? { req: true, reqUid: req.uid, priority: req.priority ?? 'MEDIUM' } : {}) },
  content: [txt(text)],
})
const innerP = (text: string): TipTapNode => ({ type: 'paragraph', content: [txt(text)] })
export const bullets = (id: string, items: string[]): TipTapNode => ({
  type: 'bulletList',
  attrs: { id },
  content: items.map((i) => ({ type: 'listItem', content: [innerP(i)] })),
})
export const tasks = (id: string, items: [string, boolean][]): TipTapNode => ({
  type: 'taskList',
  attrs: { id },
  content: items.map(([text, checked]) => ({ type: 'taskItem', attrs: { checked }, content: [innerP(text)] })),
})
export const callout = (id: string, tone: CalloutTone, text: string): TipTapNode => ({
  type: 'callout',
  attrs: { id, tone },
  content: [innerP(text)],
})
export const mermaid = (id: string, code: string): TipTapNode => ({
  type: 'codeBlock',
  attrs: { id, language: 'mermaid' },
  content: [txt(code)],
})
export const figma = (id: string, url: string, title: string): TipTapNode => ({
  type: 'figmaFrame',
  attrs: { id, url, title },
})
export const table = (id: string, rows: string[][]): TipTapNode => ({
  type: 'table',
  attrs: { id },
  content: rows.map((cells, r) => ({
    type: 'tableRow',
    content: cells.map((c) => ({ type: r === 0 ? 'tableHeader' : 'tableCell', content: [innerP(c)] })),
  })),
})
const doc = (...content: TipTapNode[]): TipTapDoc => ({ type: 'doc', content })

const bold = [{ type: 'bold' }]

// ---------- SRS-01 · Xác thực & phân quyền (đã duyệt 1.0) ----------

export const AUTH_REQ = { login: 'a1f0c7d2-0001-4c1e-9a10-000000000001', lock: 'a1f0c7d2-0002-4c1e-9a10-000000000002' }

export const authSrsContent = (): TipTapDoc =>
  doc(
    h('a-h1', 1, '1. Tổng quan'),
    p('a-p1', 'Đặc tả đăng nhập bằng email và khoá tài khoản tạm thời khi nhập sai mật khẩu nhiều lần.'),
    h('a-h2', 1, '2. Yêu cầu chức năng'),
    h('a-r1', 2, 'Đăng nhập bằng email và mật khẩu', { uid: AUTH_REQ.login, priority: 'HIGH' }),
    p('a-p2', 'Người dùng nhập email và mật khẩu; hệ thống trả access token 15 phút và refresh token 7 ngày.'),
    tasks('a-t1', [
      ['Sai email hoặc mật khẩu hiện cùng một thông báo chung', true],
      ['Token hết hạn thì tự làm mới bằng refresh token', true],
    ]),
    h('a-r2', 2, 'Khoá tạm thời sau 5 lần sai', { uid: AUTH_REQ.lock, priority: 'MEDIUM' }),
    p('a-p3', 'Sau 5 lần nhập sai liên tiếp, tài khoản bị khoá 15 phút và người dùng nhận email cảnh báo.'),
    tasks('a-t2', [['Hết 15 phút thì tự mở khoá', false]]),
  )

// ---------- SRS-02 · Thanh toán VietQR (1.0 đã duyệt, 1.1 đang chờ duyệt) ----------

export const PAY_REQ = {
  qr: 'b2e1d8c3-0001-4d2f-8b20-000000000001',
  webhook: 'b2e1d8c3-0002-4d2f-8b20-000000000002',
  reconcile: 'b2e1d8c3-0003-4d2f-8b20-000000000003',
}

const payFlow = `flowchart LR
  A[Khách chọn VietQR] --> B[Sinh mã QR động]
  B --> C{Ngân hàng gửi webhook}
  C -->|Đúng số tiền| D[Đơn hàng PAID]
  C -->|Sai số tiền| E[Đối soát thủ công]
  B -->|Quá 15 phút| F[Huỷ đơn]`

export const paySrsV10 = (): TipTapDoc =>
  doc(
    h('b-h1', 1, '1. Tổng quan'),
    p('b-p1', 'Đặc tả luồng thanh toán đơn hàng bằng mã VietQR động và đối soát tự động qua webhook ngân hàng.'),
    p('b-p2', 'Phạm vi chưa gồm hoàn tiền; phần này sẽ đặc tả ở tài liệu riêng.'),
    h('b-h2', 1, '2. Yêu cầu chức năng'),
    h('b-r1', 2, 'Sinh mã VietQR động theo đơn hàng', { uid: PAY_REQ.qr, priority: 'HIGH' }),
    p(
      'b-p3',
      'Khi khách hàng xác nhận thanh toán, hệ thống gọi cổng Napas để sinh mã QR chứa số tiền và mã tham chiếu duy nhất.',
    ),
    tasks('b-t1', [
      ['Mã QR hết hạn sau 15 phút', false],
      ['Mỗi đơn hàng chỉ có 1 mã QR còn hiệu lực', false],
    ]),
    h('b-r2', 2, 'Xử lý webhook ngân hàng', { uid: PAY_REQ.webhook, priority: 'HIGH' }),
    p('b-p4', 'Endpoint nhận webhook xác thực chữ ký HMAC-SHA256 và chống xử lý trùng khi ngân hàng gửi lại.'),
    tasks('b-t2', [['Phản hồi ngân hàng trong tối đa 3 giây', false]]),
  )

export const paySrsV11 = (): TipTapDoc =>
  doc(
    h('b-h1', 1, '1. Tổng quan'),
    p(
      'b-p1',
      'Đặc tả luồng thanh toán đơn hàng bằng mã VietQR động, đối soát tự động qua webhook ngân hàng và cảnh báo khi sai lệch số tiền.',
    ),
    h('b-h2', 1, '2. Yêu cầu chức năng'),
    h('b-r1', 2, 'Sinh mã VietQR động theo đơn hàng', { uid: PAY_REQ.qr, priority: 'HIGH' }),
    p(
      'b-p3',
      'Khi khách hàng xác nhận thanh toán, hệ thống gọi cổng Napas để sinh mã QR chứa số tiền và mã tham chiếu duy nhất. Mã được hiển thị kèm đồng hồ đếm ngược.',
    ),
    table('b-tb1', [
      ['Trường', 'Kiểu', 'Bắt buộc', 'Ghi chú'],
      ['merchantAccount', 'String(19)', 'Có', 'Số tài khoản định danh'],
      ['amount', 'Decimal', 'Có', 'Từ 1.000đ'],
      ['expireSeconds', 'Integer', 'Có', 'Mặc định 600 giây'],
    ]),
    tasks('b-t1', [
      ['Mã QR hết hạn sau 10 phút', false],
      ['Mỗi đơn hàng chỉ có 1 mã QR còn hiệu lực', false],
    ]),
    figma('b-f1', 'https://www.figma.com/file/demo/checkout?node-id=12-48', 'Checkout · Modal VietQR đếm ngược'),
    h('b-r2', 2, 'Xử lý webhook ngân hàng', { uid: PAY_REQ.webhook, priority: 'HIGH' }),
    p('b-p4', 'Endpoint nhận webhook xác thực chữ ký HMAC-SHA256 và chống xử lý trùng khi ngân hàng gửi lại.'),
    mermaid('b-m1', payFlow),
    tasks('b-t2', [['Phản hồi ngân hàng trong tối đa 3 giây', false]]),
    h('b-r3', 2, 'Đối soát khi sai lệch số tiền', { uid: PAY_REQ.reconcile, priority: 'MEDIUM' }),
    callout(
      'b-c1',
      'warning',
      'Cần làm rõ: khách chuyển khoản ngay sau khi mã vừa hết hạn thì hoàn tiền hay kích hoạt lại đơn?',
    ),
    p(
      'b-p5',
      'Giao dịch có số tiền không khớp đơn hàng chuyển sang trạng thái Cần đối soát và gửi thông báo cho ',
      txt('kế toán', bold),
      '.',
    ),
    tasks('b-t3', [
      ['Không tự duyệt đơn khi số tiền lệch', false],
      ['Kế toán thấy giao dịch lệch trong danh sách đối soát', false],
    ]),
  )

// ---------- URD-01 · Hành trình khách hàng (nháp) ----------

export const urdContent = (): TipTapDoc =>
  doc(
    h('c-h1', 1, '1. Bối cảnh'),
    p('c-p1', 'Khách hàng mở tài khoản trực tuyến bằng CCCD gắn chip và xác thực khuôn mặt.'),
    h('c-h2', 1, '2. Hành trình chính'),
    bullets('c-l1', [
      'Tải app và đăng ký bằng số điện thoại',
      'Chụp CCCD hai mặt',
      'Quay video khuôn mặt',
      'Nhận kết quả trong 5 phút',
    ]),
    callout('c-c1', 'info', 'Bản nháp từ buổi phỏng vấn khách hàng ngày 20/10.'),
  )

/** Bản 1.0 đầu tiên: chỉ có REQ sinh mã QR. */
export const paySrsV09 = (): TipTapDoc => ({ type: 'doc', content: paySrsV10().content.slice(0, 7) })
