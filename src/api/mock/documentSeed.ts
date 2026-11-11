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

// ---------- Dữ liệu Chứng khoán (Securities / Stock Market KRX) cho các dự án thực tế (projectId >= 20) ----------

const securitiesPayFlow = `flowchart LR
  A["NĐT chọn Nộp tiền Ký quỹ (TK 6)"] --> B["Sinh mã VietQR định danh 9688"]
  B --> C{"Webhook Ngân hàng BIDV/VCB"}
  C -->|"Khớp số tiền & Chữ ký"| D["Cộng Sức mua T+0 & Giải tỏa Call Margin"]
  C -->|"Lệch tiền / Sai tiểu khoản"| E["Chuyển Hàng đợi Đối soát Vận hành"]
  B -->|"Quá 10 phút"| F["Thu hồi Mã QR"]`

export const securitiesBrdContent = (): TipTapDoc =>
  doc(
    h('sbrd-h1', 1, '1. Bối cảnh & Mục tiêu Kinh doanh'),
    p(
      'sbrd-p1',
      'Nâng cấp toàn diện nền tảng giao dịch chứng khoán trực tuyến kết nối hệ thống ',
      txt('KRX (HOSE / HNX / UPCOM)', bold),
      ', quản trị rủi ro giao dịch ký quỹ (Margin) theo thời gian thực và tự động hóa đối soát thanh toán bù trừ ',
      txt('VSD T+2', bold),
      '.',
    ),
    table('sbrd-tb1', [
      ['Chỉ tiêu KPI Kỹ thuật & Nghiệp vụ', 'Mục tiêu bắt buộc', 'Chuẩn tham chiếu'],
      ['Độ trễ đặt lệnh qua cổng FIX 4.4', '< 3ms (P99)', 'Quy chuẩn kết nối KRX HOSE/HNX'],
      ['Năng lực chịu tải phiên ATO / ATC', '50.000 lệnh/giây', 'Kiểm thử tải (Stress Test) toàn thị trường'],
      ['Thời gian cộng sức mua khi nộp VietQR 9688', 'Tức thời (< 3 giây)', 'Napas247 / Webhook BIDV & Vietcombank'],
      ['Tần suất tính lại tỷ lệ ký quỹ Rtt', 'Real-time theo từng tick khớp lệnh', 'Quy chế Quản trị rủi ro UBCKNN'],
    ]),
    h('sbrd-h2', 1, '2. Phạm vi Phân hệ Trọng tâm'),
    bullets('sbrd-l1', [
      'OMS Core Trading: Đặt/Sửa/Huỷ lệnh cổ phiếu lô chẵn (100 CP), lô lẻ (1–99 CP), lệnh điều kiện Stop/Trailing và kiểm tra sức mua trước giao dịch (Pre-trade Risk Check).',
      'Margin Engine: Tính toán sức mua khả dụng (Purchasing Power), cảnh báo Call Margin (Rtt < 85%) và tự động kích hoạt lệnh bán giải chấp (Force Sell khi Rtt ≤ 75%).',
      'Core Cash & VSD: Nộp/Rút tiền định danh 9688, ứng trước tiền bán chứng khoán T+0 và đối soát lưu ký VSD T+2.',
    ]),
    callout(
      'sbrd-c1',
      'info',
      'Tài liệu Đề án BRD-01 đã được Hội đồng Quản trị Rủi ro và Khối Công nghệ phê duyệt làm cơ sở triển khai Giai đoạn 1.',
    ),
  )

export const securitiesUrdContent = (): TipTapDoc =>
  doc(
    h('c-h1', 1, '1. Bối cảnh Nhà đầu tư'),
    p(
      'c-p1',
      'Nhà đầu tư cá nhân mở tài khoản chứng khoán trực tuyến bằng CCCD gắn chip (quét NFC), thực hiện Liveness Detection, ký số hợp đồng mở Tiểu khoản Thường (đuôi 1) & Tiểu khoản Ký quỹ Margin (đuôi 6), sau đó nạp tiền và đặt lệnh cổ phiếu trên bảng giá KRX.',
    ),
    h('c-h2', 1, '2. Hành trình Mở tài khoản & Giao dịch KRX'),
    bullets('c-l1', [
      'Tải ứng dụng KiboTrade Pro, xác thực số điện thoại và chọn số tài khoản chứng khoán 6 số (058Cxxxxxx)',
      'Đọc dữ liệu chip CCCD qua NFC kết hợp xác thực khuôn mặt chống giả mạo (3D Liveness Detection ≥ 98%)',
      'Ký hợp đồng mở tài khoản lưu ký VSD & hợp đồng giao dịch ký quỹ (Margin) bằng chữ ký số OTP',
      'Nộp tiền qua mã VietQR định danh 9688, hệ thống cộng sức mua T+0 trong 3 giây và sẵn sàng đặt lệnh LO/MP/ATO/ATC',
    ]),
    figma(
      'c-f1',
      'https://www.figma.com/file/ssi-krx/ekyc-onboarding-krx?node-id=18-240',
      'eKYC & Onboarding · Luồng đọc NFC CCCD & Ký số Hợp đồng Margin',
    ),
    callout(
      'c-c1',
      'info',
      'Bản đặc tả hành trình khách hàng cập nhật theo Thông tư 120/2020/TT-BTC và quy định kết nối KRX mới nhất.',
    ),
  )

export const securitiesAuthSrsContent = (): TipTapDoc =>
  doc(
    h('a-h1', 1, '1. Tổng quan'),
    p(
      'a-p1',
      'Đặc tả cơ chế xác thực đa nhân tố, quản lý phiên giao dịch chứng khoán (JWT + Refresh Token), ký số lệnh đặt cổ phiếu bằng SmartOTP 6 số (TOTP RFC 6238) và tự động khoá chức năng đặt lệnh khi phát hiện truy cập bất thường.',
    ),
    h('a-h2', 1, '2. Yêu cầu chức năng'),
    h('a-r1', 2, 'Xác thực phiên giao dịch & Ký số lệnh đặt bằng SmartOTP', {
      uid: AUTH_REQ.login,
      priority: 'HIGH',
    }),
    p(
      'a-p2',
      'Nhà đầu tư đăng nhập bằng Số lưu ký (058Cxxxxxx) hoặc Email; để gửi lệnh Mua/Bán cổ phiếu hoặc rút tiền, nhà đầu tư bắt buộc mở khoá phiên giao dịch bằng mã SmartOTP 6 số (hiệu lực 30 giây theo chuẩn TOTP).',
    ),
    table('a-tb1', [
      ['Tham số', 'Kiểu dữ liệu', 'Ràng buộc', 'Mô tả nghiệp vụ'],
      ['custodyCode', 'String(10)', 'Bắt buộc', 'Số lưu ký chuẩn VSD (VD: 058C123456)'],
      ['subAccount', 'Enum(1, 6, 8)', 'Bắt buộc', '1: Tiểu khoản Thường, 6: Ký quỹ (Margin), 8: Phái sinh'],
      ['smartOtp', 'String(6)', 'Bắt buộc khi đặt lệnh', 'Mã TOTP 6 chữ số, cửa sổ lệch tối đa ±1 bước (30s)'],
    ]),
    tasks('a-t1', [
      ['Sai số lưu ký hoặc mật khẩu hiển thị thông báo chung chống dò tài khoản', true],
      ['Phiên đặt lệnh SmartOTP có thể cấu hình tự giữ hiệu lực trong phiên (tối đa 8 giờ)', true],
      ['Access token hết hạn sau 15 phút tự động làm mới ngầm bằng Refresh token mà không làm rớt kết nối WebSocket bảng giá', true],
    ]),
    figma(
      'a-f1',
      'https://www.figma.com/file/ssi-krx/smart-otp-order-ticket?node-id=101-12',
      'Order Ticket · Xác thực SmartOTP 6 số & Đặt lệnh Cổ phiếu KRX',
    ),
    h('a-r2', 2, 'Khoá đặt lệnh tạm thời sau 5 lần nhập sai PIN SmartOTP', {
      uid: AUTH_REQ.lock,
      priority: 'MEDIUM',
    }),
    p(
      'a-p3',
      'Sau 5 lần nhập sai mật khẩu hoặc mã PIN SmartOTP liên tiếp, hệ thống khoá quyền đặt lệnh và rút tiền trong 15 phút, đồng thời gửi cảnh báo bảo mật tức thời qua Push Notification & Email.',
    ),
    tasks('a-t2', [
      ['Hết 15 phút tự động mở khoá hoặc mở khoá sớm qua xác thực khuôn mặt eKYC', true],
      ['Ghi đầy đủ nhật ký kiểm toán (Audit Log): IP, Device Fingerprint, Mã thiết bị và Thời gian', false],
    ]),
  )

export const securitiesPaySrsV10 = (): TipTapDoc =>
  doc(
    h('b-h1', 1, '1. Tổng quan'),
    p(
      'b-p1',
      'Đặc tả luồng nộp tiền vào tiểu khoản chứng khoán bằng mã VietQR động định danh (đầu số 9688) và tự động cộng sức mua T+0 qua webhook ngân hàng thanh toán.',
    ),
    p('b-p2', 'Phạm vi phiên bản 1.0 chưa bao gồm tự động giải tỏa lệnh Call Margin khi nộp tiền ngoài giờ giao dịch.'),
    h('b-h2', 1, '2. Yêu cầu chức năng'),
    h('b-r1', 2, 'Sinh mã VietQR động định danh tiểu khoản chứng khoán (9688)', {
      uid: PAY_REQ.qr,
      priority: 'HIGH',
    }),
    p(
      'b-p3',
      'Khi nhà đầu tư chọn Nộp tiền trên tiểu khoản Thường (đuôi 1) hoặc Margin (đuôi 6), hệ thống gọi cổng Napas247 sinh mã QR chứa số tài khoản định danh 9688 + số tiểu khoản và số tiền nộp.',
    ),
    tasks('b-t1', [
      ['Mã QR nộp tiền hết hạn sau 15 phút', false],
      ['Mỗi yêu cầu nộp tiền chỉ có 1 mã QR định danh còn hiệu lực', false],
    ]),
    h('b-r2', 2, 'Xử lý Webhook Ngân hàng & Cộng Sức mua T+0', {
      uid: PAY_REQ.webhook,
      priority: 'HIGH',
    }),
    p(
      'b-p4',
      'Endpoint nhận webhook từ ngân hàng thanh toán (BIDV/VCB) xác thực chữ ký số HMAC-SHA256 và chống cộng tiền trùng (Idempotency) khi ngân hàng retry.',
    ),
    tasks('b-t2', [['Phản hồi ngân hàng và cập nhật sức mua trên OMS trong tối đa 3 giây', false]]),
  )

export const securitiesPaySrsV11 = (): TipTapDoc =>
  doc(
    h('b-h1', 1, '1. Tổng quan'),
    p(
      'b-p1',
      'Đặc tả luồng nộp tiền vào tiểu khoản chứng khoán bằng mã VietQR động định danh (đầu số 9688), tự động cộng sức mua T+0, giải tỏa cảnh báo Call Margin qua webhook ngân hàng và đối soát khi sai lệch số tiền.',
    ),
    h('b-h2', 1, '2. Yêu cầu chức năng'),
    h('b-r1', 2, 'Sinh mã VietQR động định danh tiểu khoản chứng khoán (9688)', {
      uid: PAY_REQ.qr,
      priority: 'HIGH',
    }),
    p(
      'b-p3',
      'Khi nhà đầu tư xác nhận nộp tiền vào Tiểu khoản Thường (đuôi 1) hoặc Tiểu khoản Ký quỹ Margin (đuôi 6), hệ thống gọi cổng Napas247 sinh mã QR chứa tài khoản định danh 9688 và mã tham chiếu giao dịch duy nhất. Mã hiển thị kèm đồng hồ đếm ngược.',
    ),
    table('b-tb1', [
      ['Trường dữ liệu', 'Kiểu', 'Bắt buộc', 'Ghi chú nghiệp vụ Chứng khoán'],
      ['virtualAccount', 'String(19)', 'Có', '9688 + Số lưu ký 6 số + Tiểu khoản (1 hoặc 6)'],
      ['amount', 'Decimal(18,0)', 'Có', 'Tối thiểu 100.000đ, tối đa 10.000.000.000đ/lần'],
      ['expireSeconds', 'Integer', 'Có', 'Mặc định 600 giây (10 phút)'],
    ]),
    tasks('b-t1', [
      ['Mã QR hết hạn sau 10 phút kể từ thời điểm khởi tạo', true],
      ['Mỗi yêu cầu nộp tiền chỉ có 1 mã QR còn hiệu lực', true],
      ['Tự động điền sẵn số tiền cần nộp thêm (Top-up) nếu tiểu khoản đang bị Call Margin (Rtt < 85%)', false],
    ]),
    figma(
      'b-f1',
      'https://www.figma.com/file/ssi-krx/vietqr-topup-margin?node-id=204-88',
      'Cash Deposit · Modal Nộp tiền VietQR định danh 9688 & Giải tỏa Call Margin',
    ),
    h('b-r2', 2, 'Xử lý Webhook Ngân hàng & Cộng Sức mua T+0', {
      uid: PAY_REQ.webhook,
      priority: 'HIGH',
    }),
    p(
      'b-p4',
      'Endpoint nhận webhook từ ngân hàng lưu ký (BIDV / Vietcombank) xác thực chữ ký HMAC-SHA256, kiểm tra khoá chống trùng (bankTransId) và tự động hạch toán tăng tiền mặt + sức mua cổ phiếu T+0.',
    ),
    mermaid('b-m1', securitiesPayFlow),
    tasks('b-t2', [
      ['Phản hồi ngân hàng và cập nhật Sức mua (Buying Power) trên OMS trong tối đa 3 giây', true],
      ['Nếu tiểu khoản Margin có tỷ lệ Rtt tăng lên ≥ 85% sau khi nộp, tự động gỡ cờ Force Sell', false],
    ]),
    h('b-r3', 2, 'Đối soát Tự động & Xử lý Giao dịch Lệch tiền / Sai Tiểu khoản', {
      uid: PAY_REQ.reconcile,
      priority: 'MEDIUM',
    }),
    callout(
      'b-c1',
      'warning',
      'Cần làm rõ với Khối Vận hành & Quản trị Rủi ro: Nhà đầu tư chuyển khoản vào mã QR vừa hết hạn trong phiên ATC (14:30–14:45) có được tự động hạch toán cứu tài khoản Force Sell hay chuyển sang treo chờ duyệt?',
    ),
    p(
      'b-p5',
      'Giao dịch ngân hàng báo có nhưng số tiền không khớp hoặc sai hậu tố tiểu khoản chuyển sang trạng thái Cần đối soát và gửi cảnh báo tức thời cho ',
      txt('Bộ phận Kế toán Giao dịch Tiền (Cash Operations)', bold),
      '.',
    ),
    tasks('b-t3', [
      ['Không tự động cộng sức mua khi thông tin tiểu khoản hoặc chữ ký ngân hàng không khớp', true],
      ['Kế toán Giao dịch Tiền thấy giao dịch lệch trong màn hình Đối soát Ngân hàng T+0', false],
    ]),
  )

export const securitiesPaySrsV09 = (): TipTapDoc => ({
  type: 'doc',
  content: securitiesPaySrsV10().content.slice(0, 7),
})

