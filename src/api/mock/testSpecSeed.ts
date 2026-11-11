// Tài liệu đặc tả mẫu cho module Test cases (doc/mockups/testcases-combined.html): SRS-014 Cấu hình phí, URD-014 Thanh
// toán QR, SRS-020 Báo cáo doanh số. Mục lớn của bảng testcase = heading thường (3.1, 3.2…), REQ = heading REQ bên dưới.

import type { TipTapDoc } from '@/types/document'
import { h, p, tasks } from './documentSeed'

export const FEE_REQ = {
  create: 'c3f2e9d4-0001-4e30-9c30-000000000001',
  limit: 'c3f2e9d4-0002-4e30-9c30-000000000002',
  edit: 'c3f2e9d4-0003-4e30-9c30-000000000003',
  history: 'c3f2e9d4-0004-4e30-9c30-000000000004',
}
export const QR_REQ = {
  scan: 'd4a3fae5-0001-4f40-8d40-000000000001',
  expired: 'd4a3fae5-0002-4f40-8d40-000000000002',
  otp: 'd4a3fae5-0003-4f40-8d40-000000000003',
}
export const RPT_REQ = {
  filter: 'e5b40bf6-0001-4a50-9e50-000000000001',
  excel: 'e5b40bf6-0002-4a50-9e50-000000000002',
}

/** Anchor (id heading) của các mục — module Test cases tạo mục lớn theo đúng các anchor này. */
export const SPEC_ANCHORS = {
  feeCreate: 'fee-s31',
  feeEdit: 'fee-s32',
  feeHistory: 'fee-s33',
  qrPay: 'qr-s2',
  rptSummary: 'rpt-s1',
}

const doc = (...content: TipTapDoc['content']): TipTapDoc => ({ type: 'doc', content })

export const feeSrsContent = (): TipTapDoc =>
  doc(
    h('fee-h1', 1, '1. Tổng quan'),
    p('fee-p1', 'Quản trị phí cấu hình biểu phí thanh toán theo từng ngân hàng.'),
    h(SPEC_ANCHORS.feeCreate, 1, '3.1 Thêm mới cấu hình phí'),
    h('fee-r1', 2, 'Thêm mới biểu phí', { uid: FEE_REQ.create, priority: 'HIGH' }),
    p('fee-p2', 'Quản trị phí tạo biểu phí mới gồm tên, mô tả và mức phí theo từng ngân hàng.'),
    tasks('fee-t1', [
      ['Bỏ trống tên biểu phí thì báo lỗi', false],
      ['Lưu thành công thì biểu phí hiện trong danh sách', false],
    ]),
    h('fee-r2', 2, 'Kiểm tra mức phí hợp lệ (≥ 0, tối đa 5%)', { uid: FEE_REQ.limit, priority: 'HIGH' }),
    p('fee-p3', 'Mức phí phải ≥ 0 và tối đa 5%. Nhập ngoài khoảng thì báo lỗi, không cho lưu.'),
    h(SPEC_ANCHORS.feeEdit, 1, '3.2 Sửa cấu hình phí'),
    h('fee-r3', 2, 'Sửa biểu phí, áp dụng từ ngày hôm sau', { uid: FEE_REQ.edit, priority: 'MEDIUM' }),
    p('fee-p4', 'Sửa biểu phí đang áp dụng phải hỏi xác nhận; thay đổi có hiệu lực từ ngày hôm sau.'),
    h(SPEC_ANCHORS.feeHistory, 1, '3.3 Xem lịch sử thay đổi'),
    h('fee-r4', 2, 'Xem lịch sử thay đổi biểu phí', { uid: FEE_REQ.history, priority: 'MEDIUM' }),
    p('fee-p5', 'Mỗi biểu phí có lịch sử thay đổi: thời gian, người sửa, giá trị cũ → mới.'),
  )

export const qrUrdContent = (): TipTapDoc =>
  doc(
    h('qr-h1', 1, '1. Bối cảnh'),
    p('qr-p1', 'Khách hàng thanh toán tại cửa hàng bằng cách quét mã QR tĩnh.'),
    h(SPEC_ANCHORS.qrPay, 1, '2. Quét QR thanh toán'),
    h('qr-r1', 2, 'Quét QR tĩnh khởi tạo giao dịch', { uid: QR_REQ.scan, priority: 'HIGH' }),
    p('qr-p2', 'Người dùng quét mã QR tĩnh của cửa hàng để khởi tạo giao dịch.'),
    h('qr-r2', 2, 'Từ chối QR quá 15 phút', { uid: QR_REQ.expired, priority: 'HIGH' }),
    p('qr-p3', 'Mã QR quá 15 phút kể từ lúc tạo thì từ chối thanh toán, báo "Mã QR đã hết hạn".'),
    h('qr-r3', 2, 'OTP khi giao dịch trên 5.000.000đ', { uid: QR_REQ.otp, priority: 'HIGH' }),
    p('qr-p4', 'Giao dịch trên 5.000.000đ bắt buộc xác thực OTP qua SMS.'),
  )

export const rptSrsContent = (): TipTapDoc =>
  doc(
    h(SPEC_ANCHORS.rptSummary, 1, '1. Báo cáo tổng hợp'),
    h('rpt-r1', 2, 'Lọc báo cáo theo khoảng ngày', { uid: RPT_REQ.filter, priority: 'MEDIUM' }),
    p('rpt-p1', 'Báo cáo doanh số lọc được theo khoảng ngày.'),
    h('rpt-r2', 2, 'Xuất báo cáo ra Excel', { uid: RPT_REQ.excel, priority: 'MEDIUM' }),
    p('rpt-p2', 'Báo cáo xuất được ra file Excel (.xlsx) đúng cột như màn hình.'),
  )

export const TEST_SPEC_DOCS = [
  { code: 'SRS-014', title: 'Cấu hình phí', docType: 'SRS' as const, content: feeSrsContent, approved: true },
  { code: 'URD-014', title: 'Thanh toán QR', docType: 'URD' as const, content: qrUrdContent, approved: true },
  { code: 'SRS-020', title: 'Báo cáo doanh số', docType: 'SRS' as const, content: rptSrsContent, approved: false },
]

// ---------- Tài liệu đặc tả Kiểm thử lĩnh vực Chứng khoán (projectId >= 20) ----------

export const securitiesFeeSrsContent = (): TipTapDoc =>
  doc(
    h('fee-h1', 1, '1. Tổng quan'),
    p(
      'fee-p1',
      'Đặc tả phân hệ quản trị biểu phí môi giới cổ phiếu (HOSE/HNX/UPCOM), phí trả Sở GDCK (0.027%), thuế TNCN bán chứng khoán (0.1%) và gói lãi suất cho vay giao dịch ký quỹ (Margin).',
    ),
    h(SPEC_ANCHORS.feeCreate, 1, '3.1 Thiết lập biểu phí môi giới & gói lãi vay Margin'),
    h('fee-r1', 2, 'Thêm mới biểu phí giao dịch cổ phiếu & gói lãi suất Margin', {
      uid: FEE_REQ.create,
      priority: 'HIGH',
    }),
    p(
      'fee-p2',
      'Quản trị viên nghiệp vụ thiết lập biểu phí mới gồm mã gói phí, phân hạng khách hàng (Standard / VIP / Institutional), tỷ lệ phí môi giới và lãi suất vay Margin (%/năm).',
    ),
    tasks('fee-t1', [
      ['Bỏ trống tên gói biểu phí thì báo lỗi và không cho lưu', true],
      ['Lưu thành công thì gói phí hiển thị ngay trong danh sách cấu hình phí chứng khoán', true],
    ]),
    h('fee-r2', 2, 'Kiểm tra biên độ phí môi giới (0% – 0.35%) & lãi vay Margin hợp lệ', {
      uid: FEE_REQ.limit,
      priority: 'HIGH',
    }),
    p(
      'fee-p3',
      'Tỷ lệ phí môi giới phải ≥ 0% và tối đa 0.35% theo trần quy định của Bộ Tài chính; lãi suất Margin trong khoảng 0% – 15%/năm. Nhập số âm hoặc vượt trần phải chặn lưu.',
    ),
    h(SPEC_ANCHORS.feeEdit, 1, '3.2 Điều chỉnh biểu phí & Lãi suất áp dụng từ phiên T+1'),
    h('fee-r3', 2, 'Điều chỉnh biểu phí đang áp dụng, có hiệu lực từ phiên giao dịch kế tiếp (T+1)', {
      uid: FEE_REQ.edit,
      priority: 'MEDIUM',
    }),
    p(
      'fee-p4',
      'Khi sửa gói phí đang gán cho tiểu khoản khách hàng trong giờ giao dịch (09:00–15:00), hệ thống yêu cầu xác nhận và chỉ áp dụng mức phí mới từ kỳ batch EOD sang ngày T+1.',
    ),
    h(SPEC_ANCHORS.feeHistory, 1, '3.3 Truy vết lịch sử thay đổi biểu phí (Audit Trail)'),
    h('fee-r4', 2, 'Xem lịch sử thay đổi biểu phí & đối chiếu kiểm toán UBCKNN', {
      uid: FEE_REQ.history,
      priority: 'MEDIUM',
    }),
    p(
      'fee-p5',
      'Mỗi lần điều chỉnh biểu phí hoặc lãi suất Margin đều lưu vết đầy đủ: thời điểm, người thực hiện, người phê duyệt và giá trị cũ → mới.',
    ),
  )

export const securitiesQrUrdContent = (): TipTapDoc =>
  doc(
    h('qr-h1', 1, '1. Bối cảnh nghiệp vụ'),
    p(
      'qr-p1',
      'Nhà đầu tư nộp tiền ký quỹ qua mã QR định danh 9688 để tăng sức mua cổ phiếu hoặc giải tỏa cảnh báo Call Margin, và xác thực SmartOTP khi rút tiền / ứng trước tiền bán.',
    ),
    h(SPEC_ANCHORS.qrPay, 1, '2. Quét QR nộp tiền ký quỹ & Xác thực rút tiền'),
    h('qr-r1', 2, 'Quét mã QR định danh 9688 khởi tạo lệnh nộp tiền vào tiểu khoản', {
      uid: QR_REQ.scan,
      priority: 'HIGH',
    }),
    p(
      'qr-p2',
      'Nhà đầu tư quét mã VietQR định danh (9688 + Số TK + Tiểu khoản 1/6) trên ứng dụng ngân hàng để nạp tiền tức thời vào tài khoản chứng khoán.',
    ),
    h('qr-r2', 2, 'Từ chối mã QR nộp tiền chứng khoán đã quá hạn 15 phút', {
      uid: QR_REQ.expired,
      priority: 'HIGH',
    }),
    p(
      'qr-p3',
      'Mã QR динамик quá 15 phút kể từ thời điểm tạo phải từ chối hạch toán tự động và hiển thị thông báo "Mã QR nộp tiền đã hết hạn".',
    ),
    h('qr-r3', 2, 'Bắt buộc xác thực SmartOTP khi rút tiền / ứng trước trên 50.000.000đ', {
      uid: QR_REQ.otp,
      priority: 'HIGH',
    }),
    p(
      'qr-p4',
      'Mọi giao dịch rút tiền ra ngân hàng liên kết hoặc ứng trước tiền bán chứng khoán T+0 có giá trị trên 50.000.000đ bắt buộc xác thực bằng SmartOTP 6 số.',
    ),
  )

export const securitiesRptSrsContent = (): TipTapDoc =>
  doc(
    h(SPEC_ANCHORS.rptSummary, 1, '1. Báo cáo Sao kê Danh mục & Đối soát VSD T+2'),
    h('rpt-r1', 2, 'Lọc sao kê giao dịch cổ phiếu, dư nợ Margin & đối soát VSD theo kỳ', {
      uid: RPT_REQ.filter,
      priority: 'MEDIUM',
    }),
    p(
      'rpt-p1',
      'Cho phép lọc báo cáo sao kê lệnh khớp, phí môi giới, thuế TNCN 0.1%, lãi vay Margin và trạng thái thanh toán bù trừ VSD T+2 theo khoảng ngày và tiểu khoản.',
    ),
    h('rpt-r2', 2, 'Xuất báo cáo Sao kê Chứng khoán & Đối soát VSD ra Excel (.xlsx)', {
      uid: RPT_REQ.excel,
      priority: 'MEDIUM',
    }),
    p(
      'rpt-p2',
      'Kết xuất báo cáo Sao kê Danh mục, Thuế & Phí chuẩn định dạng Excel (.xlsx) đúng cấu trúc biểu mẫu đối soát của Tổng công ty Lưu ký và Bù trừ Chứng khoán Việt Nam (VSDC).',
    ),
  )

export const SECURITIES_TEST_SPEC_DOCS = [
  {
    code: 'SRS-014',
    title: 'Biểu phí Môi giới, Thuế TNCN 0.1% & Lãi vay Margin',
    docType: 'SRS' as const,
    content: securitiesFeeSrsContent,
    approved: true,
  },
  {
    code: 'URD-014',
    title: 'Nộp tiền QR Định danh 9688 & Giải tỏa Call Margin',
    docType: 'URD' as const,
    content: securitiesQrUrdContent,
    approved: true,
  },
  {
    code: 'SRS-020',
    title: 'Sao kê Danh mục, Đối soát Lưu ký VSD T+2 & Quyền Cổ đông',
    docType: 'SRS' as const,
    content: securitiesRptSrsContent,
    approved: false,
  },
]

