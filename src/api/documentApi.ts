import type {
  ConfluenceBlock,
  DocumentComment,
  HistoryChangeType,
  ItemPriority,
  RequirementHistoryLog,
  RequirementItem,
  SpecificationDocument,
} from '@/types/document'

const STORAGE_KEY = 'ssam.documents.v3'

interface StoredData {
  documents: SpecificationDocument[]
  items: RequirementItem[]
  history: RequirementHistoryLog[]
  comments: DocumentComment[]
}

/**
 * Hàm Parser Trái tim Kỹ thuật:
 * Quét danh sách các khối (ConfluenceBlock[]) từ trên xuống dưới, chia tách theo từng Heading (H1, H2, H3).
 * Toàn bộ nội dung (đoạn văn, bảng biểu, checklist, callout, sơ đồ Mermaid, khung Figma) nằm dưới một Heading
 * có gắn nhãn `isReq: true` cho đến trước Heading tiếp theo được gom thành 1 Section Slice và ánh xạ thành `RequirementItem`.
 */
export function extractRequirementsFromBlocks(
  docId: number,
  blocks: ConfluenceBlock[],
  existingItems: RequirementItem[] = [],
): RequirementItem[] {
  const existingMap = new Map<string, RequirementItem>()
  existingItems.forEach((it) => {
    existingMap.set(it.id, it)
    existingMap.set(it.keyCode, it)
  })

  const extracted: RequirementItem[] = []
  let currentHeading: ConfluenceBlock | null = null
  let currentSlice: ConfluenceBlock[] = []
  let reqCounter = 0

  const flushSlice = (heading: ConfluenceBlock | null, slice: ConfluenceBlock[]) => {
    if (!heading || !heading.isReq) return
    reqCounter++

    const reqId = heading.reqId || `req-${docId}-${heading.id}`
    const prev = existingMap.get(reqId) || (heading.reqKeyCode ? existingMap.get(heading.reqKeyCode) : undefined)
    const keyCode = heading.reqKeyCode || prev?.keyCode || `REQ-${String(reqCounter).padStart(2, '0')}`

    // Bóc tách số thứ tự Heading (nếu người dùng gõ "2.1. Đăng nhập" -> headingNumber = "2.1")
    const rawHeadingText = (heading.text || 'Mục yêu cầu chưa đặt tên').trim()
    const numMatch = rawHeadingText.match(/^(\d+(?:\.\d+)*)\.?\s+(.*)$/)
    const headingNumber = numMatch ? numMatch[1] : `${reqCounter}.0`
    const headingTitle = rawHeadingText

    const contentParts: string[] = []
    const acParts: string[] = []
    let diagramTitle: string | undefined
    let diagramSourceCode: string | undefined
    let diagramType: 'MERMAID_PLANTUML' | 'IMAGE_UPLOAD' | 'NONE' = 'NONE'
    let requiresUi = false
    let figmaFrameName: string | undefined
    let figmaUrl: string | undefined
    let hasTable = false

    for (const b of slice) {
      if (b.type === 'paragraph' && b.text?.trim()) {
        contentParts.push(b.text.trim())
      } else if (b.type === 'bullet_list' && b.listItems && b.listItems.length > 0) {
        contentParts.push(b.listItems.map((li) => `• ${li}`).join('\n'))
      } else if (b.type === 'numbered_list' && b.listItems && b.listItems.length > 0) {
        contentParts.push(b.listItems.map((li, idx) => `${idx + 1}. ${li}`).join('\n'))
      } else if (b.type === 'table' && b.tableHeaders && b.tableRows) {
        hasTable = true
        const headerLine = `| ${b.tableHeaders.join(' | ')} |`
        const sepLine = `| ${b.tableHeaders.map(() => '---').join(' | ')} |`
        const rowLines = b.tableRows.map((r) => `| ${r.join(' | ')} |`).join('\n')
        const tableMd = `${headerLine}\n${sepLine}\n${rowLines}`
        contentParts.push(tableMd)
      } else if (b.type === 'callout' && b.text?.trim()) {
        const label = b.calloutTitle || (b.calloutTone === 'rule' ? 'Quy tắc nghiệp vụ' : 'Ghi chú')
        const formatted = `[${label}]: ${b.text.trim()}`
        contentParts.push(formatted)
        acParts.push(formatted)
      } else if (b.type === 'checklist' && b.checklistItems && b.checklistItems.length > 0) {
        const clText = b.checklistItems.map((ci) => `${ci.checked ? '[x]' : '[ ]'} ${ci.text}`).join('\n')
        acParts.push(clText)
        contentParts.push(`Tiêu chí nghiệm thu:\n${clText}`)
      } else if (b.type === 'diagram' && b.diagramSourceCode?.trim()) {
        diagramType = b.diagramType || 'MERMAID_PLANTUML'
        diagramTitle = b.diagramTitle || `Sơ đồ ${keyCode}`
        diagramSourceCode = b.diagramSourceCode.trim()
      } else if (b.type === 'figma' && (b.figmaUrl?.trim() || b.figmaFrameName?.trim())) {
        requiresUi = true
        figmaFrameName = b.figmaFrameName || 'Màn hình thiết kế UI'
        figmaUrl = b.figmaUrl || ''
      }
    }

    const finalContent = contentParts.join('\n\n') || prev?.content || 'Chưa có mô tả chi tiết dưới Heading này.'
    const finalAc =
      acParts.join('\n\n') ||
      prev?.acceptanceCriteria ||
      (contentParts.length > 0 ? `Kiểm thử toàn bộ quy tắc trong phân đoạn ${keyCode}` : '')

    extracted.push({
      id: reqId,
      documentId: docId,
      keyCode,
      headingNumber,
      headingTitle,
      itemType: 'REQUIREMENT',
      priority: heading.reqPriority || prev?.priority || 'HIGH',
      content: finalContent,
      acceptanceCriteria: finalAc,
      clarificationNeeded:
        heading.clarificationNeeded !== undefined ? heading.clarificationNeeded : prev?.clarificationNeeded || null,
      isAiGenerated: heading.isAiGenerated ?? prev?.isAiGenerated ?? false,
      confidenceScore: heading.confidenceScore ?? prev?.confidenceScore ?? 95,
      diagramTitle,
      diagramType,
      diagramSourceCode,
      requiresUi,
      figmaFrameName,
      figmaUrl,
      hasTable,
      linkedTestCases:
        prev?.linkedTestCases && prev.linkedTestCases.length > 0
          ? prev.linkedTestCases
          : [`TC-${keyCode.replace('REQ-', '')}-01`, `TC-${keyCode.replace('REQ-', '')}-02`],
      linkedIssues:
        prev?.linkedIssues && prev.linkedIssues.length > 0
          ? prev.linkedIssues
          : [`CORE-${100 + reqCounter}`],
      syncStatus: prev?.syncStatus || 'FRESH',
    })
  }

  for (const block of blocks) {
    if (block.type === 'h1' || block.type === 'h2' || block.type === 'h3') {
      flushSlice(currentHeading, currentSlice)
      currentHeading = block
      currentSlice = []
    } else {
      currentSlice.push(block)
    }
  }
  flushSlice(currentHeading, currentSlice)

  return extracted
}

/** Chuyển đổi danh sách RequirementItem sang các khối ConfluenceBlock tự nhiên (dùng cho AI import hoặc mẫu) */
export function convertItemsToBlocks(items: Partial<RequirementItem>[]): ConfluenceBlock[] {
  const blocks: ConfluenceBlock[] = []
  items.forEach((it, idx) => {
    const reqId = it.id || `req-gen-${Date.now()}-${idx + 1}`
    const keyCode = it.keyCode || `REQ-${String(idx + 1).padStart(2, '0')}`
    const headingPrefix = it.headingNumber ? `${it.headingNumber}. ` : `${idx + 1}. `
    const rawTitle = (it.headingTitle || 'Mục yêu cầu mới').replace(/^\d+(\.\d+)*\.?\s*/, '')

    blocks.push({
      id: `blk-h-${Date.now()}-${idx}`,
      type: 'h2',
      text: `${headingPrefix}${rawTitle}`,
      isReq: it.itemType !== 'INFO_SECTION',
      reqId,
      reqKeyCode: keyCode,
      reqPriority: it.priority || 'HIGH',
      clarificationNeeded: it.clarificationNeeded || null,
      isAiGenerated: !!it.isAiGenerated,
      confidenceScore: it.confidenceScore || 94,
    })

    if (it.content) {
      blocks.push({
        id: `blk-p-${Date.now()}-${idx}`,
        type: 'paragraph',
        text: it.content,
      })
    }

    if (it.acceptanceCriteria) {
      const lines = it.acceptanceCriteria
        .split('\n')
        .map((l) => l.replace(/^[-•*]\s*/, '').trim())
        .filter(Boolean)
      blocks.push({
        id: `blk-ac-${Date.now()}-${idx}`,
        type: 'checklist',
        checklistItems: lines.map((line, cIdx) => ({
          id: `chk-${idx}-${cIdx}`,
          text: line,
          checked: true,
        })),
      })
    }

    if (it.diagramType === 'MERMAID_PLANTUML' && it.diagramSourceCode) {
      blocks.push({
        id: `blk-diag-${Date.now()}-${idx}`,
        type: 'diagram',
        diagramType: 'MERMAID_PLANTUML',
        diagramTitle: it.diagramTitle || `Sơ đồ luồng ${keyCode}`,
        diagramSourceCode: it.diagramSourceCode,
      })
    }

    if (it.requiresUi && (it.figmaUrl || it.figmaFrameName)) {
      blocks.push({
        id: `blk-fig-${Date.now()}-${idx}`,
        type: 'figma',
        figmaFrameName: it.figmaFrameName || 'Màn hình thiết kế Figma',
        figmaUrl: it.figmaUrl || 'https://www.figma.com/file/ssam-design-system',
      })
    }
  })

  return blocks
}

function createInitialSeed(): StoredData {
  // 1. Trang 101: SRS - Phân hệ Xác thực & Phân quyền RBAC (APPROVED 🔒)
  const doc101Blocks: ConfluenceBlock[] = [
    {
      id: 'b101-intro-h',
      type: 'h1',
      text: '1. Giới thiệu chung & Phạm vi Phân hệ Xác thực',
      isReq: false,
    },
    {
      id: 'b101-intro-p',
      type: 'paragraph',
      text: 'Tài liệu này quy định đặc tả kỹ thuật chi tiết cho dịch vụ Xác thực người dùng (Authentication Service), Quản lý phiên đăng nhập JWT và Phân quyền RBAC 3 tầng (Tenant - Workspace - Project) trên toàn hệ thống SSAM.',
    },
    {
      id: 'b101-intro-callout',
      type: 'callout',
      calloutTone: 'info',
      calloutTitle: 'Tiêu chuẩn Bảo mật Áp dụng (OWASP ASVS L2)',
      text: 'Mọi mật khẩu bắt buộc băm bằng thuật toán Argon2id hoặc Bcrypt (cost >= 12). Access Token có thời hạn tối đa 15 phút; Refresh Token lưu trữ an toàn kèm cơ chế Token Rotation.',
    },
    {
      id: 'b101-req1-h',
      type: 'h2',
      text: '2.1. Xác thực Đăng nhập Đa yếu tố & Khóa Tài khoản Tạm thời',
      isReq: true,
      reqId: 'item-101-1',
      reqKeyCode: 'REQ-01',
      reqPriority: 'HIGH',
      isAiGenerated: true,
      confidenceScore: 96,
    },
    {
      id: 'b101-req1-p',
      type: 'paragraph',
      text: 'Hệ thống cung cấp giao diện đăng nhập bằng Email/Mật khẩu hoặc Google OAuth 2.0. Khi phát hiện đăng nhập sai liên tiếp vượt ngưỡng an toàn, hệ thống tự động kích hoạt khóa tạm thời nhằm chống tấn công Brute-force.',
    },
    {
      id: 'b101-req1-table',
      type: 'table',
      tableHeaders: ['Tham số / Quy tắc', 'Giá trị cấu hình', 'Hành vi xử lý của Hệ thống', 'Mã lỗi HTTP'],
      tableRows: [
        ['Số lần nhập sai tối đa', '5 lần liên tiếp / 10 phút', 'Chuyển trạng thái tài khoản sang TEMP_LOCKED', '423 Locked'],
        ['Thời gian khóa tạm thời', '15 phút', 'Từ chối mọi request đăng nhập, gửi email cảnh báo bảo mật', '423 Locked'],
        ['Thời hạn Access Token', '15 phút (900 giây)', 'Đính kèm danh sách權 (Permissions) và Tenant ID trong Payload', '200 OK'],
      ],
    },
    {
      id: 'b101-req1-ac',
      type: 'checklist',
      checklistItems: [
        { id: 'c101-1', text: 'Nhập đúng Email và Mật khẩu -> Cấp cặp Access/Refresh Token và điều hướng vào Dashboard trong < 500ms.', checked: true },
        { id: 'c101-2', text: 'Nhập sai mật khẩu 5 lần liên tiếp -> Khóa tài khoản 15 phút và hiển thị đồng hồ đếm ngược trên màn hình.', checked: true },
        { id: 'c101-3', text: 'Tự động mở khóa sau 15 phút hoặc khi Tenant Admin bấm mở khóa thủ công.', checked: true },
      ],
    },
    {
      id: 'b101-req1-diag',
      type: 'diagram',
      diagramType: 'MERMAID_PLANTUML',
      diagramTitle: 'Luồng Xác thực & Kiểm soát Brute-Force (REQ-01)',
      diagramSourceCode: `flowchart TD\n  A[Người dùng gửi Email + Password] --> B{Tài khoản đang bị khóa?}\n  B -->|Đang khóa < 15p| C[Trả lỗi 423 Locked & Thời gian chờ]\n  B -->|Không khóa| D{Kiểm tra Hash Mật khẩu}\n  D -->|Hợp lệ| E[Reset bộ đếm sai = 0 & Cấp JWT Token]\n  D -->|Sai mật khẩu| F[Tăng bộ đếm sai + 1]\n  F --> G{Bộ đếm >= 5?}\n  G -->|Có| H[Khóa tài khoản 15 phút & Gửi Email Cảnh báo]\n  G -->|Chưa| I[Trả lỗi 401 Sai thông tin đăng nhập]`,
    },
    {
      id: 'b101-req1-figma',
      type: 'figma',
      figmaFrameName: 'Auth / Login & Lockout Screen v2.4',
      figmaUrl: 'https://www.figma.com/file/ssam-auth-login-flow',
    },
    {
      id: 'b101-req2-h',
      type: 'h2',
      text: '2.2. Kiểm soát Truy cập Phân quyền RBAC Đa tầng (Tenant / Workspace / Project)',
      isReq: true,
      reqId: 'item-101-2',
      reqKeyCode: 'REQ-02',
      reqPriority: 'HIGH',
      isAiGenerated: false,
    },
    {
      id: 'b101-req2-p',
      type: 'paragraph',
      text: 'Mỗi API Endpoint và thành phần giao diện phải được kiểm tra quyền hạn theo ma trận RBAC. Quyền cấp Công ty (Tenant) có phạm vi bao trùm hoặc kế thừa xuống Không gian làm việc (Workspace) và Dự án (Project).',
    },
    {
      id: 'b101-req2-ac',
      type: 'checklist',
      checklistItems: [
        { id: 'c101-4', text: 'Người dùng không có quyền project:update thì ẩn các nút chỉnh sửa và trả về 403 Forbidden nếu gọi API trực tiếp.', checked: true },
        { id: 'c101-5', text: 'Khi Tenant Admin cập nhật Role, quyền mới có hiệu lực ngay ở lần làm mới Token tiếp theo.', checked: true },
      ],
    },
  ]

  // 2. Trang 102: SRS - Phân hệ Thanh toán VietQR & Quản lý RTM (IN_REVIEW - Có mục UNCONFIRMED_STALE)
  const doc102Blocks: ConfluenceBlock[] = [
    {
      id: 'b102-intro-h',
      type: 'h1',
      text: '1. Tổng quan Kiến trúc Cổng Thanh toán VietQR Động & Đồng bộ RTM',
      isReq: false,
    },
    {
      id: 'b102-intro-p',
      type: 'paragraph',
      text: 'Trang tài liệu này đặc tả luồng sinh mã VietQR động theo chuẩn EMVCo Napas247, cơ chế lắng nghe sự kiện Webhook biến động số dư tức thời và quy tắc tự động đánh dấu Lạc hậu (Stale) trên Ma trận Truy xuất RTM khi yêu cầu thay đổi.',
    },
    {
      id: 'b102-req1-h',
      type: 'h2',
      text: '2.1. Sinh mã VietQR Động theo Đơn hàng & Kiểm soát Thời hạn Hiệu lực',
      isReq: true,
      reqId: 'item-102-1',
      reqKeyCode: 'REQ-01',
      reqPriority: 'HIGH',
      isAiGenerated: true,
      confidenceScore: 95,
    },
    {
      id: 'b102-req1-p',
      type: 'paragraph',
      text: 'Khi khách hàng xác nhận thanh toán, hệ thống gọi API sang cổng Napas / Ngân hàng thụ hưởng để khởi tạo chuỗi VietQR động chứa chính xác số tiền và mã tham chiếu giao dịch duy nhất (Reference Code).',
    },
    {
      id: 'b102-req1-table',
      type: 'table',
      tableHeaders: ['Trường dữ liệu QR', 'Kiểu dữ liệu', 'Bắt buộc', 'Quy tắc Nghiệp vụ & Ràng buộc'],
      tableRows: [
        ['merchantAccount', 'String (19 ký tự)', 'Có', 'Số tài khoản định danh ảo (VA) cấp riêng cho từng đơn hàng'],
        ['amount', 'Decimal (VND)', 'Có', 'Lớn hơn 1.000đ và nhỏ hơn 499.999.999đ / giao dịch'],
        ['expireSeconds', 'Integer', 'Có', 'Mặc định 900 giây (15 phút). Quá hạn tự động hủy mã VA'],
        ['transferContent', 'String (ASCII)', 'Có', 'Định dạng: SSAM [MaDonHang] (Không dấu, tối đa 25 ký tự)'],
      ],
    },
    {
      id: 'b102-req1-diag',
      type: 'diagram',
      diagramType: 'MERMAID_PLANTUML',
      diagramTitle: 'Sơ đồ Luồng Thanh toán VietQR & Xử lý Webhook',
      diagramSourceCode: `flowchart TD\n  A[Khách hàng chọn Thanh toán QR] --> B[Sinh Tài khoản VA & Mã VietQR 15p]\n  B --> C{Nhận Webhook từ Ngân hàng?}\n  C -->|Trong 15p & Đúng số tiền| D[Cập nhật Đơn hàng PAID & Xuất Hóa đơn]\n  C -->|Sai lệch số tiền| E[Chuyển trạng thái CẦN ĐỐI SOÁT THỦ CÔNG]\n  C -->|Quá 15p không thanh toán| F[Thu hồi mã VA & Hủy đơn tự động]`,
    },
    {
      id: 'b102-req1-figma',
      type: 'figma',
      figmaFrameName: 'Checkout / Dynamic VietQR Countdown Modal',
      figmaUrl: 'https://www.figma.com/file/ssam-vietqr-checkout',
    },
    {
      id: 'b102-req2-h',
      type: 'h2',
      text: '2.2. Xử lý Webhook Ngân hàng & Đối soát Giao dịch Bất đồng bộ',
      isReq: true,
      reqId: 'item-102-2',
      reqKeyCode: 'REQ-02',
      reqPriority: 'HIGH',
      clarificationNeeded: 'Cần xác nhận rõ: Nếu khách hàng chuyển khoản thành công ở phút thứ 15:02 (ngay sau khi đơn vừa hết hạn) thì tự động hoàn tiền hay kích hoạt lại đơn?',
      isAiGenerated: true,
      confidenceScore: 91,
    },
    {
      id: 'b102-req2-p',
      type: 'paragraph',
      text: 'Endpoint nhận Webhook từ ngân hàng phải xác thực chữ ký số HMAC-SHA256 trên Header, đảm bảo tính Idempotency (chống xử lý trùng lặp khi ngân hàng bắn lại bản tin) và phản hồi trong vòng tối đa 3 giây (SLA <= 3000ms).',
    },
    {
      id: 'b102-req2-callout',
      type: 'callout',
      calloutTone: 'warning',
      calloutTitle: 'Cập nhật Quy tắc Chuyển thừa / Chuyển thiếu (Vừa sửa đổi trong v1.1)',
      text: 'Nếu số tiền thực nhận trong Webhook chênh lệch quá 1.000đ so với giá trị đơn hàng, hệ thống KHÔNG tự động kích hoạt gói dịch vụ mà đẩy vào hàng đợi "Cần Kế toán Đối soát" và bắn cảnh báo qua Slack/Zalo.',
    },
    {
      id: 'b102-req2-ac',
      type: 'checklist',
      checklistItems: [
        { id: 'c102-1', text: 'Kiểm tra chữ ký HMAC-SHA256 hợp lệ trước khi xử lý payload.', checked: true },
        { id: 'c102-2', text: 'Nếu trùng transactionId đã xử lý -> Trả về 200 OK (Idempotent) và không cộng tiền lần 2.', checked: true },
        { id: 'c102-3', text: 'Nếu số tiền lệch > 1.000đ -> Chuyển trạng thái MANUAL_RECONCILE và gửi thông báo cho Kế toán.', checked: true },
      ],
    },
    {
      id: 'b102-req3-h',
      type: 'h2',
      text: '2.3. Tự động Bóc tách Requirement Items & Cảnh báo Lạc hậu (Stale RTM)',
      isReq: true,
      reqId: 'item-102-3',
      reqKeyCode: 'REQ-03',
      reqPriority: 'MEDIUM',
      isAiGenerated: false,
    },
    {
      id: 'b102-req3-p',
      type: 'paragraph',
      text: 'Mỗi khi Business Analyst chỉnh sửa nội dung văn bản, bảng biểu hoặc sơ đồ bên dưới một Heading mang nhãn REQ-xx và bấm Lưu, hệ thống tự động ghi nhận bản ghi đối chiếu (Diff) vào RequirementHistoryLog và chuyển các Test Case liên kết sang trạng thái Unconfirmed Stale.',
    },
  ]

  // 3. Trang 107 (Trang con của 102): 2.2.1. Chi tiết Luồng Hoàn tiền & Đối soát Tự động
  const doc107Blocks: ConfluenceBlock[] = [
    {
      id: 'b107-h1',
      type: 'h1',
      text: '1. Quy trình Hoàn tiền Tự động (Auto-Refund Workflow)',
      isReq: true,
      reqId: 'item-107-1',
      reqKeyCode: 'REQ-01',
      reqPriority: 'HIGH',
    },
    {
      id: 'b107-p1',
      type: 'paragraph',
      text: 'Đối với các giao dịch chuyển khoản muộn sau khi đơn hàng đã hủy hoặc chuyển dư số tiền quy định, hệ thống hỗ trợ lệnh hoàn tiền tự động qua kênh chuyển khoản nhanh Napas 24/7 sau khi Kế toán trưởng bấm xác nhận.',
    },
    {
      id: 'b107-table',
      type: 'table',
      tableHeaders: ['Trường hợp hoàn tiền', 'Thời gian xử lý SLA', 'Người phê duyệt', 'Phí hoàn tiền'],
      tableRows: [
        ['Lỗi hệ thống / Hủy đơn tự động', 'Tức thời (< 5 phút)', 'Hệ thống tự động', 'Miễn phí (Công ty chịu)'],
        ['Khách hàng chuyển nhầm số tiền', 'Trong 24 giờ làm việc', 'Kế toán trưởng', 'Khấu trừ phí chuyển khoản 3.300đ'],
      ],
    },
  ]

  // 4. Trang 103: URD - Hành trình Khách hàng & Mở tài khoản eKYC
  const doc103Blocks: ConfluenceBlock[] = [
    {
      id: 'b103-h1',
      type: 'h1',
      text: '1. Hành trình Định danh Điện tử eKYC 3 Bước',
      isReq: true,
      reqId: 'item-103-1',
      reqKeyCode: 'REQ-01',
      reqPriority: 'HIGH',
    },
    {
      id: 'b103-p1',
      type: 'paragraph',
      text: 'Khách hàng mới có thể mở tài khoản hoàn toàn trực tuyến trên ứng dụng di động thông qua việc chụp ảnh CCCD gắn chip hai mặt kết hợp kiểm tra thực thể sống (Liveness Detection) trong vòng dưới 90 giây.',
    },
    {
      id: 'b103-ac',
      type: 'checklist',
      checklistItems: [
        { id: 'c103-1', text: 'Ảnh chụp CCCD không bị lóa sáng, mất góc hoặc chụp lại qua màn hình thiết bị khác.', checked: true },
        { id: 'c103-2', text: 'Độ khớp khuôn mặt (Face Matching Score) đạt tối thiểu >= 85%.', checked: true },
      ],
    },
  ]

  // 5. Trang 106: BRD - Quy tắc Nghiệp vụ & Hạn mức Giao dịch
  const doc106Blocks: ConfluenceBlock[] = [
    {
      id: 'b106-h1',
      type: 'h1',
      text: '1. Phân nhóm Hạn mức Giao dịch theo Cấp độ Định danh KYC',
      isReq: true,
      reqId: 'item-106-1',
      reqKeyCode: 'REQ-01',
      reqPriority: 'MEDIUM',
    },
    {
      id: 'b106-p1',
      type: 'paragraph',
      text: 'Hạn mức giao dịch ngày và tháng của khách hàng được áp dụng tự động dựa trên cấp độ xác thực sinh trắc học tuân thủ quy định của Ngân hàng Nhà nước.',
    },
    {
      id: 'b106-table',
      type: 'table',
      tableHeaders: ['Cấp độ KYC', 'Điều kiện đạt cấp', 'Hạn mức / Giao dịch', 'Hạn mức / Ngày'],
      tableRows: [
        ['KYC Cấp 1 (Cơ bản)', 'Xác thực SĐT OTP + CCCD OCR', '20.000.000 VNĐ', '50.000.000 VNĐ'],
        ['KYC Cấp 2 (Nâng cao)', 'Đọc chip NFC CCCD + Sinh trắc khuôn mặt', '500.000.000 VNĐ', '2.000.000.000 VNĐ'],
      ],
    },
  ]

  const documents: SpecificationDocument[] = [
    // Nhánh thư mục 01 của Project 20
    {
      id: 100,
      projectId: 20,
      parentPageId: null,
      isFolder: true,
      icon: '📂',
      orderIndex: 1,
      code: 'SPACE-01',
      title: '01. Tài liệu Nghiệp vụ & Người dùng (BRD / URD)',
      docType: 'BRD',
      version: 'v1.0',
      status: 'APPROVED',
      description: 'Thư mục lưu trữ toàn bộ tài liệu Yêu cầu Nghiệp vụ (BRD), Yêu cầu Người dùng (URD) và Biên bản họp phân tích.',
      blocks: [
        {
          id: 'b100-1',
          type: 'h1',
          text: '1. Không gian Tài liệu Nghiệp vụ & Người dùng (BRD / URD)',
          isReq: false,
        },
        {
          id: 'b100-2',
          type: 'paragraph',
          text: 'Chọn các trang tài liệu con bên trong nhánh thư mục này ở thanh điều hướng bên trái hoặc bấm nút [+] để thêm trang đặc tả nghiệp vụ mới.',
        },
      ],
      createdBy: 'Sarah Lin (Tenant Admin)',
      createdAt: '2026-10-08T08:00:00.000Z',
      updatedAt: '2026-10-20T10:00:00.000Z',
    },
    {
      id: 103,
      projectId: 20,
      parentPageId: 100,
      isFolder: false,
      icon: '📄',
      orderIndex: 2,
      code: 'URD-01',
      title: '1.1. URD - Hành trình Khách hàng & Mở tài khoản eKYC',
      docType: 'URD',
      version: 'v1.0',
      status: 'APPROVED',
      description: 'Yêu cầu người dùng cho luồng định danh điện tử eKYC, chụp CCCD gắn chip và nhận diện khuôn mặt.',
      blocks: doc103Blocks,
      createdBy: 'Phạm Minh Lương (BA)',
      createdAt: '2026-10-12T10:00:00.000Z',
      updatedAt: '2026-10-22T11:20:00.000Z',
      approvedBy: 'Phạm Văn Khoa (PM)',
      approvedAt: '2026-10-22T15:00:00.000Z',
    },
    {
      id: 106,
      projectId: 20,
      parentPageId: 100,
      isFolder: false,
      icon: '📄',
      orderIndex: 3,
      code: 'BRD-01',
      title: '1.2. BRD - Quy tắc Nghiệp vụ & Hạn mức Giao dịch',
      docType: 'BRD',
      version: 'v0.9',
      status: 'DRAFT',
      description: 'Quy định phân nhóm hạn mức giao dịch theo cấp độ eKYC và kiểm soát rủi ro.',
      blocks: doc106Blocks,
      createdBy: 'Vũ Kim Kỳ (BA)',
      createdAt: '2026-10-24T09:00:00.000Z',
      updatedAt: '2026-10-27T11:00:00.000Z',
    },

    // Nhánh thư mục 02 của Project 20
    {
      id: 200,
      projectId: 20,
      parentPageId: null,
      isFolder: true,
      icon: '📂',
      orderIndex: 4,
      code: 'SPACE-02',
      title: '02. Đặc tả Yêu cầu Phần mềm (SRS)',
      docType: 'SRS',
      version: 'v1.0',
      status: 'APPROVED',
      description: 'Thư mục trung tâm chứa các tài liệu Đặc tả Yêu cầu Phần mềm (SRS) chi tiết cho từng phân hệ kỹ thuật.',
      blocks: [
        {
          id: 'b200-1',
          type: 'h1',
          text: '1. Không gian Đặc tả Yêu cầu Phần mềm (SRS)',
          isReq: false,
        },
        {
          id: 'b200-2',
          type: 'paragraph',
          text: 'Nơi tập hợp toàn bộ tài liệu SRS chuẩn hóa của dự án. Mỗi dòng Heading được đánh dấu [REQ-xx] sẽ tự động đồng bộ trực tiếp vào Ma trận Truy xuất RTM và liên kết với Test Case của đội QA.',
        },
      ],
      createdBy: 'Sarah Lin (Tenant Admin)',
      createdAt: '2026-10-09T08:00:00.000Z',
      updatedAt: '2026-10-21T10:00:00.000Z',
    },
    {
      id: 101,
      projectId: 20,
      parentPageId: 200,
      isFolder: false,
      icon: '🔐',
      orderIndex: 5,
      code: 'SRS-01',
      title: '2.1. SRS - Phân hệ Xác thực & Phân quyền RBAC',
      docType: 'SRS',
      version: 'v1.0',
      status: 'APPROVED',
      description: 'Đặc tả kỹ thuật luồng đăng nhập, xác thực đa yếu tố, giới hạn thử lại và phân quyền theo mô hình RBAC 3 cấp.',
      normalizedRawNotes: {
        scope: 'Đăng nhập, bảo mật tài khoản, khóa đăng nhập sai và phân quyền người dùng.',
        actors: 'Khách hàng cá nhân, Quản trị viên chi nhánh, Hệ thống giám sát bảo mật.',
        mainFlows: 'Đăng nhập mật khẩu/SSO -> Xác thực token JWT -> Kiểm tra quyền RBAC -> Điều hướng.',
        businessRules: 'Khóa tài khoản 15 phút sau 5 lần sai; Access Token hết hạn sau 15 phút, Refresh Token 7 ngày.',
      },
      blocks: doc101Blocks,
      createdBy: 'Sarah Lin (Tenant Admin)',
      createdAt: '2026-10-10T08:30:00.000Z',
      updatedAt: '2026-10-18T14:20:00.000Z',
      approvedBy: 'Phạm Văn Khoa (Project Manager)',
      approvedAt: '2026-10-18T15:00:00.000Z',
    },
    {
      id: 102,
      projectId: 20,
      parentPageId: 200,
      isFolder: false,
      icon: '💳',
      orderIndex: 6,
      code: 'SRS-02',
      title: '2.2. SRS - Phân hệ Thanh toán & VietQR Động',
      docType: 'SRS',
      version: 'v1.1',
      status: 'IN_REVIEW',
      description: 'Đặc tả kỹ thuật sinh mã VietQR động theo đơn hàng, xử lý Webhook ngân hàng và đồng bộ trạng thái RTM.',
      normalizedRawNotes: {
        scope: 'Phân hệ thanh toán VietQR động, xử lý Webhook biến động số dư và đối soát tự động.',
        actors: 'Khách hàng, Cổng Napas / Ngân hàng, Kế toán đối soát, Hệ thống SSAM.',
        mainFlows: 'Sinh mã QR 15 phút -> Quét mã chuyển khoản -> Nhận Webhook HMAC -> Cập nhật đơn hàng.',
        businessRules: 'Mọi thay đổi trên yêu cầu đã được Baseline phải gắn cờ Stale lên các Test Case liên quan.',
      },
      blocks: doc102Blocks,
      createdBy: 'Vũ Kim Kỳ (BA)',
      createdAt: '2026-10-20T09:00:00.000Z',
      updatedAt: '2026-10-27T16:45:00.000Z',
      parentDocId: 101,
    },
    {
      id: 107,
      projectId: 20,
      parentPageId: 102, // Trang con cấp 3 nằm dưới trang 2.2!
      isFolder: false,
      icon: '📄',
      orderIndex: 7,
      code: 'SRS-02.1',
      title: '2.2.1. Chi tiết Luồng Hoàn tiền & Đối soát Tự động',
      docType: 'SRS',
      version: 'v1.0',
      status: 'DRAFT',
      description: 'Trang con đặc tả chi tiết nghiệp vụ hoàn tiền tự động khi giao dịch lỗi hoặc chuyển dư.',
      blocks: doc107Blocks,
      createdBy: 'Vũ Kim Kỳ (BA)',
      createdAt: '2026-10-25T14:00:00.000Z',
      updatedAt: '2026-10-27T17:10:00.000Z',
    },

    // Dữ liệu cho Project 21 (PAY) & 22 (NOTIF)
    {
      id: 104,
      projectId: 21,
      parentPageId: null,
      isFolder: false,
      icon: '💳',
      orderIndex: 1,
      code: 'SRS-01',
      title: '1.1. SRS - Cổng Thanh toán VietQR & Hoàn tiền tức thì',
      docType: 'SRS',
      version: 'v1.0',
      status: 'APPROVED',
      description: 'Đặc tả kỹ thuật sinh mã VietQR động, xử lý Webhook ngân hàng thụ hưởng và cơ chế đối soát giao dịch.',
      blocks: doc102Blocks,
      createdBy: 'Phạm Văn Khoa (PM)',
      createdAt: '2026-10-15T09:30:00.000Z',
      updatedAt: '2026-10-21T10:15:00.000Z',
      approvedBy: 'Sarah Lin',
      approvedAt: '2026-10-21T11:00:00.000Z',
    },
    {
      id: 105,
      projectId: 22,
      parentPageId: null,
      isFolder: false,
      icon: '🔔',
      orderIndex: 1,
      code: 'URD-01',
      title: '1.1. URD - Hệ thống Thông báo Đẩy Đa kênh (Push/SMS/Zalo)',
      docType: 'URD',
      version: 'v1.0',
      status: 'APPROVED',
      description: 'Yêu cầu người dùng đối với luồng gửi tin tức biến động số dư, mã OTP qua Zalo ZNS và thông báo ứng dụng.',
      blocks: doc103Blocks,
      createdBy: 'Vũ Kim Kỳ',
      createdAt: '2026-10-18T14:00:00.000Z',
      updatedAt: '2026-10-24T16:30:00.000Z',
      approvedBy: 'Phạm Văn Khoa',
      approvedAt: '2026-10-24T17:00:00.000Z',
    },
  ]

  // Tự động chạy Parser để khởi tạo danh sách RequirementItems từ các khối của từng trang tài liệu
  const items: RequirementItem[] = []
  for (const doc of documents) {
    if (doc.blocks && doc.blocks.length > 0) {
      const docItems = extractRequirementsFromBlocks(doc.id, doc.blocks, [])
      // Đặt mẫu REQ-02 của doc 102 ở trạng thái UNCONFIRMED_STALE để demo cảnh báo Stale
      docItems.forEach((it) => {
        if (doc.id === 102 && it.keyCode === 'REQ-02') {
          it.syncStatus = 'UNCONFIRMED_STALE'
          it.linkedTestCases = ['TC-02-01', 'TC-02-02', 'TC-02-03']
          it.linkedIssues = ['CORE-105', 'CORE-108']
        }
        items.push(it)
      })
    }
  }

  const history: RequirementHistoryLog[] = [
    {
      id: 'hist-seed-1',
      documentId: 102,
      requirementItemId: 'item-102-2',
      requirementKeyCode: 'REQ-02',
      version: 'v1.1',
      changeType: 'CONTENT',
      previousContent:
        'Endpoint nhận Webhook từ ngân hàng phải xác thực chữ ký số HMAC-SHA256 và tự động duyệt đơn cho mọi giao dịch chuyển khoản.',
      newContent:
        'Endpoint nhận Webhook từ ngân hàng phải xác thực chữ ký số HMAC-SHA256 trên Header, đảm bảo tính Idempotency (chống xử lý trùng lặp khi ngân hàng bắn lại bản tin) và phản hồi trong vòng tối đa 3 giây (SLA <= 3000ms).\n\n[Cập nhật Quy tắc Chuyển thừa / Chuyển thiếu (Vừa sửa đổi trong v1.1)]: Nếu số tiền thực nhận trong Webhook chênh lệch quá 1.000đ so với giá trị đơn hàng, hệ thống KHÔNG tự động kích hoạt gói dịch vụ mà đẩy vào hàng đợi "Cần Kế toán Đối soát" và bắn cảnh báo qua Slack/Zalo.',
      previousAcceptanceCriteria:
        '[x] Kiểm tra chữ ký HMAC-SHA256 hợp lệ.\n[x] Tự động duyệt đơn hàng ngay khi nhận Webhook.',
      newAcceptanceCriteria:
        '[x] Kiểm tra chữ ký HMAC-SHA256 hợp lệ trước khi xử lý payload.\n[x] Nếu trùng transactionId đã xử lý -> Trả về 200 OK (Idempotent) và không cộng tiền lần 2.\n[x] Nếu số tiền lệch > 1.000đ -> Chuyển trạng thái MANUAL_RECONCILE và gửi thông báo cho Kế toán.',
      changedBy: 'Vũ Kim Kỳ (BA)',
      changedAt: '2026-10-27T16:40:00.000Z',
      confirmationState: 'UNCONFIRMED_DRAFT',
    },
    {
      id: 'hist-seed-2',
      documentId: 102,
      requirementItemId: 'item-102-1',
      requirementKeyCode: 'REQ-01',
      version: 'v1.1',
      changeType: 'DIAGRAM',
      previousContent: 'Khởi tạo mã VietQR tĩnh không có thời hạn hiệu lực.',
      newContent:
        'Khi khách hàng xác nhận thanh toán, hệ thống gọi API sang cổng Napas / Ngân hàng thụ hưởng để khởi tạo chuỗi VietQR động chứa chính xác số tiền và mã tham chiếu giao dịch duy nhất (Reference Code).',
      previousDiagram: 'flowchart TD\n  A[Tạo đơn] --> B[Hiện QR tĩnh]\n  B --> C[Kế toán duyệt tay]',
      newDiagram:
        'flowchart TD\n  A[Khách hàng chọn Thanh toán QR] --> B[Sinh Tài khoản VA & Mã VietQR 15p]\n  B --> C{Nhận Webhook từ Ngân hàng?}\n  C -->|Trong 15p & Đúng số tiền| D[Cập nhật Đơn hàng PAID & Xuất Hóa đơn]\n  C -->|Sai lệch số tiền| E[Chuyển trạng thái CẦN ĐỐI SOÁT THỦ CÔNG]\n  C -->|Quá 15p không thanh toán| F[Thu hồi mã VA & Hủy đơn tự động]',
      changedBy: 'Sarah Lin (Tenant Admin)',
      changedAt: '2026-10-26T10:15:00.000Z',
      confirmationState: 'CONFIRMED_APPROVED',
    },
    {
      id: 'hist-seed-3',
      documentId: 101,
      requirementItemId: 'item-101-1',
      requirementKeyCode: 'REQ-01',
      version: 'v1.0',
      changeType: 'CONTENT',
      previousContent: 'Cho phép người dùng nhập sai mật khẩu tối đa 10 lần trước khi khóa tài khoản 5 phút.',
      newContent:
        'Hệ thống cung cấp giao diện đăng nhập bằng Email/Mật khẩu hoặc Google OAuth 2.0. Khi phát hiện đăng nhập sai liên tiếp vượt ngưỡng an toàn (5 lần), hệ thống tự động kích hoạt khóa tạm thời 15 phút nhằm chống tấn công Brute-force.',
      changedBy: 'Phạm Văn Khoa (PM)',
      changedAt: '2026-10-18T14:00:00.000Z',
      confirmationState: 'CONFIRMED_APPROVED',
    },
  ]

  const comments: DocumentComment[] = [
    {
      id: 'cmt-seed-1',
      documentId: 102,
      requirementItemId: 'item-102-2',
      authorName: 'Trương Quang Tâm',
      authorRole: 'QA Lead',
      body: 'Phần quy tắc lệch số tiền > 1.000đ vừa mới sửa ở mục REQ-02 làm 3 Test Case (TC-02-01, TC-02-02, TC-02-03) bị chuyển sang Unconfirmed Stale. Đội QA đang chờ PM duyệt Baseline v1.1 để cập nhật lại bộ kịch bản kiểm thử.',
      content:
        'Phần quy tắc lệch số tiền > 1.000đ vừa mới sửa ở mục REQ-02 làm 3 Test Case (TC-02-01, TC-02-02, TC-02-03) bị chuyển sang Unconfirmed Stale. Đội QA đang chờ PM duyệt Baseline v1.1 để cập nhật lại bộ kịch bản kiểm thử.',
      createdAt: '2026-10-27T16:50:00.000Z',
      isResolved: false,
      isStale: true,
    },
    {
      id: 'cmt-seed-2',
      documentId: 102,
      requirementItemId: 'item-102-1',
      authorName: 'Phạm Văn Khoa',
      authorRole: 'Project Manager',
      body: 'Bảng đặc tả trường dữ liệu QR và sơ đồ Flowchart đã rất rõ ràng, đội Backend có thể dựa vào bảng này để code API tích hợp Napas.',
      content:
        'Bảng đặc tả trường dữ liệu QR và sơ đồ Flowchart đã rất rõ ràng, đội Backend có thể dựa vào bảng này để code API tích hợp Napas.',
      createdAt: '2026-10-27T11:20:00.000Z',
      isResolved: true,
      isStale: false,
    },
  ]

  return { documents, items, history, comments }
}

function loadStorage(): StoredData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const seed = createInitialSeed()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed))
      return seed
    }
    return JSON.parse(raw) as StoredData
  } catch {
    const seed = createInitialSeed()
    return seed
  }
}

function saveStorage(data: StoredData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.error('Không thể lưu dữ liệu tài liệu vào localStorage:', e)
  }
}

/** Tạo mẫu khối nội dung theo Template khi người dùng tạo trang Confluence mới */
export function buildTemplateBlocks(
  template: 'BLANK' | 'SRS' | 'URD' | 'MEETING_NOTES',
  title: string,
): ConfluenceBlock[] {
  const ts = Date.now()
  if (template === 'BLANK') {
    return [
      {
        id: `blk-${ts}-1`,
        type: 'h1',
        text: `1. ${title || 'Tiêu đề Mục Yêu cầu Đầu tiên'}`,
        isReq: true,
        reqId: `req-${ts}-1`,
        reqKeyCode: 'REQ-01',
        reqPriority: 'HIGH',
      },
      {
        id: `blk-${ts}-2`,
        type: 'paragraph',
        text: 'Gõ nội dung tự do tại đây, nhấn Enter để thêm đoạn mới hoặc gõ dấu "/" để chèn Bảng biểu, Sơ đồ Mermaid, Khung Figma, Checklist...',
      },
    ]
  }

  if (template === 'URD') {
    return [
      {
        id: `blk-${ts}-intro`,
        type: 'h1',
        text: '1. Bối cảnh & Chân dung Người dùng (User Personas)',
        isReq: false,
      },
      {
        id: `blk-${ts}-intro-p`,
        type: 'paragraph',
        text: 'Mô tả đối tượng người dùng mục tiêu, mục đích sử dụng và giá trị nghiệp vụ mang lại.',
      },
      {
        id: `blk-${ts}-us1`,
        type: 'h2',
        text: '2.1. User Story 01: Thực hiện Giao dịch Nhanh trên Ứng dụng',
        isReq: true,
        reqId: `req-${ts}-1`,
        reqKeyCode: 'REQ-01',
        reqPriority: 'HIGH',
      },
      {
        id: `blk-${ts}-us1-callout`,
        type: 'callout',
        calloutTone: 'info',
        calloutTitle: 'Mô tả User Story (As a... I want... So that...)',
        text: 'Là một Khách hàng cá nhân, tôi muốn thực hiện thao tác trên giao diện trực quan trong tối đa 3 bước để tiết kiệm thời gian giao dịch.',
      },
      {
        id: `blk-${ts}-us1-ac`,
        type: 'checklist',
        checklistItems: [
          { id: `chk-${ts}-1`, text: 'Given người dùng đã đăng nhập thành công vào hệ thống', checked: true },
          { id: `chk-${ts}-2`, text: 'When người dùng nhập thông tin hợp lệ và bấm Xác nhận', checked: true },
          { id: `chk-${ts}-3`, text: 'Then hệ thống xử lý thành công trong < 2 giây và hiển thị biên lai', checked: true },
        ],
      },
    ]
  }

  if (template === 'MEETING_NOTES') {
    return [
      {
        id: `blk-${ts}-m1`,
        type: 'h1',
        text: '1. Tóm tắt Cuộc họp Phân tích Yêu cầu (Raw Notes)',
        isReq: false,
      },
      {
        id: `blk-${ts}-m1-info`,
        type: 'callout',
        calloutTone: 'rule',
        calloutTitle: 'Thông tin cuộc họp & Thành phần tham dự',
        text: 'Thời gian: Hôm nay · Tham dự: Product Owner, Business Analyst, Tech Lead, QA Lead. Bạn có thể bấm nút [✨ AI Sinh nội dung] trên thanh Top Bar để bóc tách tự động thành các mục REQ.',
      },
      {
        id: `blk-${ts}-m2`,
        type: 'h2',
        text: '2.1. Yêu cầu Chức năng Thống nhất từ Cuộc họp',
        isReq: true,
        reqId: `req-${ts}-1`,
        reqKeyCode: 'REQ-01',
        reqPriority: 'HIGH',
      },
      {
        id: `blk-${ts}-m2-list`,
        type: 'bullet_list',
        listItems: [
          'Hệ thống cần kiểm tra điều kiện đầu vào chặt chẽ trước khi lưu dữ liệu.',
          'Gửi thông báo thời gian thực cho các bên liên quan sau khi phê duyệt.',
          'Lưu vết toàn bộ lịch sử thay đổi để phục vụ kiểm toán (Audit Trail).',
        ],
      },
    ]
  }

  // Default: SRS Template chuẩn kỹ thuật
  return [
    {
      id: `blk-${ts}-1`,
      type: 'h1',
      text: '1. Giới thiệu & Phạm vi Hệ thống',
      isReq: false,
    },
    {
      id: `blk-${ts}-2`,
      type: 'paragraph',
      text: 'Mô tả phạm vi phân hệ, các tác nhân tương tác (Actors) và kiến trúc tổng thể.',
    },
    {
      id: `blk-${ts}-3`,
      type: 'h2',
      text: '2.1. Đặc tả Chức năng & Luồng Xử lý Chính',
      isReq: true,
      reqId: `req-${ts}-1`,
      reqKeyCode: 'REQ-01',
      reqPriority: 'HIGH',
    },
    {
      id: `blk-${ts}-4`,
      type: 'paragraph',
      text: 'Mô tả chi tiết luồng sự kiện chính (Main Flow), luồng thay thế (Alternative Flows) và các điều kiện tiền đề / hậu điều kiện.',
    },
    {
      id: `blk-${ts}-5`,
      type: 'table',
      tableHeaders: ['Tên trường dữ liệu', 'Kiểu dữ liệu', 'Bắt buộc', 'Ràng buộc & Quy tắc kiểm tra (Validation)'],
      tableRows: [
        ['requestId', 'UUID v4', 'Có', 'Khóa chống trùng lặp giao dịch (Idempotency Key)'],
        ['payloadData', 'JSON Object', 'Có', 'Không được rỗng, kích thước tối đa 64KB'],
      ],
    },
    {
      id: `blk-${ts}-6`,
      type: 'checklist',
      checklistItems: [
        { id: `chk-${ts}-1`, text: 'Xác thực đầy đủ dữ liệu đầu vào và trả mã lỗi chuẩn 400 Bad Request nếu sai định dạng.', checked: true },
        { id: `chk-${ts}-2`, text: 'Đảm bảo thời gian phản hồi API đạt SLA < 500ms ở mức tải 1.000 CCU.', checked: true },
      ],
    },
    {
      id: `blk-${ts}-7`,
      type: 'diagram',
      diagramType: 'MERMAID_PLANTUML',
      diagramTitle: 'Sơ đồ Luồng Xử lý Hệ thống (REQ-01)',
      diagramSourceCode: `flowchart TD\n  A[Client gửi Request] --> B{Validate dữ liệu đầu vào}\n  B -->|Hợp lệ| C[Thực thi Logic Nghiệp vụ & Lưu DB]\n  B -->|Không hợp lệ| D[Trả lỗi 400 Bad Request]\n  C --> E[Trả kết quả 200 OK]`,
    },
  ]
}

export const documentApi = {
  /** Lấy danh sách toàn bộ các trang/nhánh tài liệu của dự án */
  list: async (projectId: number): Promise<SpecificationDocument[]> => {
    const data = loadStorage()
    const projectDocs = data.documents
      .filter((d) => d.projectId === projectId)
      .sort((a, b) => (a.orderIndex ?? 99) - (b.orderIndex ?? 99))

    if (projectDocs.length === 0) {
      // Tự động tạo cây Confluence mẫu nếu dự án mới chưa có trang nào
      const now = new Date().toISOString()
      const folderId = Date.now()
      const pageId = folderId + 1
      const sampleBlocks = buildTemplateBlocks('SRS', 'Đặc tả Yêu cầu Phân hệ Core')

      const folderDoc: SpecificationDocument = {
        id: folderId,
        projectId,
        parentPageId: null,
        isFolder: true,
        icon: '📂',
        orderIndex: 1,
        code: 'SPACE-01',
        title: '01. Đặc tả Yêu cầu Phần mềm (SRS)',
        docType: 'SRS',
        version: 'v1.0',
        status: 'APPROVED',
        description: 'Nhánh thư mục gốc lưu trữ các trang tài liệu đặc tả của dự án.',
        blocks: [
          {
            id: `blk-f-${folderId}`,
            type: 'h1',
            text: '1. Không gian Tài liệu Đặc tả Dự án',
            isReq: false,
          },
          {
            id: `blk-fp-${folderId}`,
            type: 'paragraph',
            text: 'Chọn trang tài liệu bên dưới hoặc bấm dấu [+] trên thanh cây thư mục trái để tạo trang con mới.',
          },
        ],
        createdBy: 'Hệ thống khởi tạo tự động',
        createdAt: now,
        updatedAt: now,
      }

      const firstPage: SpecificationDocument = {
        id: pageId,
        projectId,
        parentPageId: folderId,
        isFolder: false,
        icon: '📄',
        orderIndex: 2,
        code: 'SRS-01',
        title: '1.1. SRS - Đặc tả Yêu cầu Chức năng Khởi tạo',
        docType: 'SRS',
        version: 'v1.0',
        status: 'DRAFT',
        description: 'Trang tài liệu đặc tả mặc định được khởi tạo cho dự án.',
        blocks: sampleBlocks,
        createdBy: 'Hệ thống khởi tạo tự động',
        createdAt: now,
        updatedAt: now,
      }

      data.documents.push(folderDoc, firstPage)
      const extracted = extractRequirementsFromBlocks(pageId, sampleBlocks, [])
      data.items.push(...extracted)
      saveStorage(data)
      return [folderDoc, firstPage]
    }

    return projectDocs
  },

  /** Lấy thông tin chi tiết 1 trang Confluence: Document + Blocks + Auto-Extracted Items + History + Comments */
  get: async (
    docId: number,
  ): Promise<{
    document: SpecificationDocument
    items: RequirementItem[]
    history: RequirementHistoryLog[]
    comments: DocumentComment[]
  }> => {
    const data = loadStorage()
    const document = data.documents.find((d) => d.id === docId)
    if (!document) {
      throw new Error(`Không tìm thấy trang tài liệu #${docId}`)
    }

    // Nếu trang cũ chưa có mảng blocks thì tự động sinh blocks từ items hiện có
    let existingItems = data.items.filter((i) => i.documentId === docId)
    if (!document.blocks || document.blocks.length === 0) {
      if (existingItems.length > 0) {
        document.blocks = convertItemsToBlocks(existingItems)
      } else {
        document.blocks = buildTemplateBlocks('SRS', document.title)
      }
      existingItems = extractRequirementsFromBlocks(docId, document.blocks, existingItems)
      data.items = data.items.filter((i) => i.documentId !== docId).concat(existingItems)
      saveStorage(data)
    }

    const history = data.history
      .filter((h) => h.documentId === docId)
      .sort((a, b) => b.changedAt.localeCompare(a.changedAt))
    const comments = data.comments
      .filter((c) => c.documentId === docId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

    return { document, items: existingItems, history, comments }
  },

  /**
   * Lưu nội dung trang Confluence (Title + Blocks):
   * Tự động chạy Parser bóc tách các Heading [REQ-xx], phát hiện thay đổi (Diff) so với bản lưu trước,
   * tự động ghi RequirementHistoryLog và kích hoạt cảnh báo UNCONFIRMED_STALE cho các Test Case liên quan.
   */
  saveConfluencePage: async (
    docId: number,
    patch: Partial<SpecificationDocument>,
    newBlocks: ConfluenceBlock[],
    authorName: string,
  ): Promise<{
    document: SpecificationDocument
    items: RequirementItem[]
    changedKeys: string[]
  }> => {
    const data = loadStorage()
    const doc = data.documents.find((d) => d.id === docId)
    if (!doc) throw new Error(`Không tìm thấy trang tài liệu #${docId}`)

    const now = new Date().toISOString()
    const oldItems = data.items.filter((i) => i.documentId === docId)
    const oldItemMap = new Map<string, RequirementItem>()
    oldItems.forEach((it) => {
      oldItemMap.set(it.id, it)
      oldItemMap.set(it.keyCode, it)
    })

    // Chạy Parser bóc tách các RequirementItem từ danh sách khối mới
    const nextItems = extractRequirementsFromBlocks(docId, newBlocks, oldItems)
    const changedKeys: string[] = []

    for (const nextItem of nextItems) {
      const oldItem = oldItemMap.get(nextItem.id) || oldItemMap.get(nextItem.keyCode)
      if (oldItem) {
        const contentChanged =
          oldItem.content.trim() !== nextItem.content.trim() ||
          oldItem.headingTitle.trim() !== nextItem.headingTitle.trim() ||
          oldItem.acceptanceCriteria.trim() !== nextItem.acceptanceCriteria.trim()
        const diagramChanged =
          (oldItem.diagramSourceCode || '').trim() !== (nextItem.diagramSourceCode || '').trim() ||
          oldItem.diagramType !== nextItem.diagramType
        const figmaChanged =
          (oldItem.figmaUrl || '').trim() !== (nextItem.figmaUrl || '').trim() ||
          oldItem.requiresUi !== nextItem.requiresUi

        if (contentChanged || diagramChanged || figmaChanged) {
          let changeType: HistoryChangeType = 'CONTENT'
          if (contentChanged) changeType = 'CONTENT'
          else if (diagramChanged) changeType = 'DIAGRAM'
          else if (figmaChanged) changeType = 'FIGMA_UI'

          data.history.unshift({
            id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            documentId: docId,
            requirementItemId: nextItem.id,
            requirementKeyCode: nextItem.keyCode,
            version: doc.version,
            changeType,
            previousContent: oldItem.content,
            newContent: nextItem.content,
            previousAcceptanceCriteria: oldItem.acceptanceCriteria,
            newAcceptanceCriteria: nextItem.acceptanceCriteria,
            previousDiagram: oldItem.diagramSourceCode,
            newDiagram: nextItem.diagramSourceCode,
            previousFigmaUrl: oldItem.figmaUrl,
            newFigmaUrl: nextItem.figmaUrl,
            changedBy: authorName,
            changedAt: now,
            confirmationState: 'UNCONFIRMED_DRAFT',
          })

          // Đánh dấu bình luận cũ trên mục REQ này là Stale
          data.comments
            .filter((c) => c.documentId === docId && c.requirementItemId === nextItem.id)
            .forEach((c) => {
              c.isStale = true
            })

          // Kích hoạt cảnh báo Stale cấp 1: UNCONFIRMED_STALE
          nextItem.syncStatus = 'UNCONFIRMED_STALE'
          changedKeys.push(nextItem.keyCode)
        }
      } else {
        // Mục REQ mới vừa được đánh dấu từ Heading
        data.history.unshift({
          id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          documentId: docId,
          requirementItemId: nextItem.id,
          requirementKeyCode: nextItem.keyCode,
          version: doc.version,
          changeType: 'CREATED',
          newContent: nextItem.content,
          newAcceptanceCriteria: nextItem.acceptanceCriteria,
          newDiagram: nextItem.diagramSourceCode,
          newFigmaUrl: nextItem.figmaUrl,
          changedBy: authorName,
          changedAt: now,
          confirmationState: 'UNCONFIRMED_DRAFT',
        })
        changedKeys.push(nextItem.keyCode)
      }
    }

    // Cập nhật document & items trong store
    Object.assign(doc, patch, {
      blocks: newBlocks,
      updatedAt: now,
    })
    data.items = data.items.filter((i) => i.documentId !== docId).concat(nextItems)
    saveStorage(data)

    return { document: doc, items: nextItems, changedKeys }
  },

  /** Tạo trang tài liệu mới hoặc trang con (nhánh con) trên cây Confluence */
  createConfluencePage: async (params: {
    projectId: number
    parentPageId?: number | null
    title: string
    docType?: 'SRS' | 'URD' | 'BRD'
    template?: 'BLANK' | 'SRS' | 'URD' | 'MEETING_NOTES'
    isFolder?: boolean
    icon?: string
    createdBy: string
    initialBlocks?: ConfluenceBlock[]
  }): Promise<SpecificationDocument> => {
    const data = loadStorage()
    const id = Date.now()
    const now = new Date().toISOString()
    const projectDocs = data.documents.filter((d) => d.projectId === params.projectId)
    const nextIdx = projectDocs.length + 1
    const docType = params.docType || 'SRS'
    const code = `${docType}-${String(nextIdx).padStart(2, '0')}`

    const blocks =
      params.initialBlocks && params.initialBlocks.length > 0
        ? params.initialBlocks
        : buildTemplateBlocks(params.template || 'SRS', params.title)

    const newDoc: SpecificationDocument = {
      id,
      projectId: params.projectId,
      parentPageId: params.parentPageId ?? null,
      isFolder: !!params.isFolder,
      icon: params.icon || (params.isFolder ? '📂' : '📄'),
      orderIndex: nextIdx,
      code,
      title: params.title,
      docType,
      version: 'v1.0',
      status: 'DRAFT',
      description: `Trang tài liệu đặc tả ${params.title}`,
      blocks,
      createdBy: params.createdBy,
      createdAt: now,
      updatedAt: now,
    }

    data.documents.push(newDoc)
    const extracted = extractRequirementsFromBlocks(id, blocks, [])
    data.items.push(...extracted)
    saveStorage(data)
    return newDoc
  },

  /** Nhân bản một trang tài liệu trên cây Confluence */
  duplicatePage: async (docId: number, authorName: string): Promise<SpecificationDocument> => {
    const data = loadStorage()
    const source = data.documents.find((d) => d.id === docId)
    if (!source) throw new Error(`Không tìm thấy trang #${docId}`)

    const newId = Date.now()
    const now = new Date().toISOString()
    const clonedBlocks: ConfluenceBlock[] = JSON.parse(JSON.stringify(source.blocks || []))
    clonedBlocks.forEach((b, idx) => {
      b.id = `blk-${newId}-${idx}`
      if (b.isReq) {
        b.reqId = `item-${newId}-${idx}`
      }
    })

    const copyDoc: SpecificationDocument = {
      ...source,
      id: newId,
      title: `${source.title} (Bản sao)`,
      code: `${source.code}-COPY`,
      status: 'DRAFT',
      version: 'v1.0',
      blocks: clonedBlocks,
      createdBy: authorName,
      createdAt: now,
      updatedAt: now,
      approvedBy: null,
      approvedAt: null,
    }

    data.documents.push(copyDoc)
    const extracted = extractRequirementsFromBlocks(newId, clonedBlocks, [])
    data.items.push(...extracted)
    saveStorage(data)
    return copyDoc
  },

  /** Xóa một trang tài liệu trên cây Confluence */
  deletePage: async (docId: number): Promise<void> => {
    const data = loadStorage()
    const target = data.documents.find((d) => d.id === docId)
    if (!target) return

    // Đưa các trang con của trang bị xóa lên cấp cha của nó
    data.documents.forEach((d) => {
      if (d.parentPageId === docId) {
        d.parentPageId = target.parentPageId ?? null
      }
    })

    data.documents = data.documents.filter((d) => d.id !== docId)
    data.items = data.items.filter((i) => i.documentId !== docId)
    saveStorage(data)
  },

  /** Tạo bộ tài liệu mới (Tương thích ngược với CreateDocumentModal & AiSpecificationModal) */
  create: async (
    doc: Omit<SpecificationDocument, 'id' | 'createdAt' | 'updatedAt'>,
    initialItems?: Partial<RequirementItem>[],
  ): Promise<SpecificationDocument> => {
    const data = loadStorage()
    const id = Date.now()
    const now = new Date().toISOString()

    const blocks =
      doc.blocks && doc.blocks.length > 0
        ? doc.blocks
        : initialItems && initialItems.length > 0
          ? convertItemsToBlocks(initialItems)
          : buildTemplateBlocks('SRS', doc.title)

    const newDoc: SpecificationDocument = {
      ...doc,
      id,
      parentPageId: doc.parentPageId ?? null,
      icon: doc.icon || '📄',
      blocks,
      createdAt: now,
      updatedAt: now,
    }
    data.documents.push(newDoc)

    const extracted = extractRequirementsFromBlocks(id, blocks, [])
    data.items.push(...extracted)
    saveStorage(data)
    return newDoc
  },

  /** Cập nhật thông tin metadata của tài liệu */
  update: async (docId: number, patch: Partial<SpecificationDocument>): Promise<SpecificationDocument> => {
    const data = loadStorage()
    const doc = data.documents.find((d) => d.id === docId)
    if (!doc) throw new Error(`Không tìm thấy tài liệu #${docId}`)
    Object.assign(doc, patch, { updatedAt: new Date().toISOString() })
    saveStorage(data)
    return doc
  },

  /** Tạo phiên bản sửa đổi mới từ bản APPROVED (GB-01 Safe Mode clone) */
  createRevision: async (parentDocId: number, newVersion?: string): Promise<SpecificationDocument> => {
    const data = loadStorage()
    const parentDoc = data.documents.find((d) => d.id === parentDocId)
    if (!parentDoc) throw new Error(`Không tìm thấy tài liệu gốc #${parentDocId}`)

    let nextVersion = newVersion
    if (!nextVersion) {
      const vMatch = parentDoc.version.match(/v?(\d+)\.(\d+)/)
      if (vMatch) {
        nextVersion = `v${vMatch[1]}.${Number(vMatch[2]) + 1}`
      } else {
        nextVersion = `${parentDoc.version}.1`
      }
    }

    const newId = Date.now()
    const now = new Date().toISOString()
    const clonedBlocks: ConfluenceBlock[] = JSON.parse(JSON.stringify(parentDoc.blocks || []))
    clonedBlocks.forEach((b, idx) => {
      if (b.isReq) {
        b.reqId = `item-${newId}-${idx + 1}`
      }
    })

    const newDoc: SpecificationDocument = {
      ...parentDoc,
      id: newId,
      version: nextVersion,
      status: 'DRAFT',
      parentDocId: parentDoc.id,
      blocks: clonedBlocks,
      createdAt: now,
      updatedAt: now,
      approvedBy: null,
      approvedAt: null,
    }
    data.documents.push(newDoc)

    const extracted = extractRequirementsFromBlocks(newId, clonedBlocks, [])
    data.items.push(...extracted)
    saveStorage(data)
    return newDoc
  },

  /** Phê duyệt Baseline (Approve): khóa Safe Mode, chốt History Log và chuyển Test Cases sang Confirmed Stale */
  approve: async (docId: number, approvedBy: string): Promise<SpecificationDocument> => {
    const data = loadStorage()
    const doc = data.documents.find((d) => d.id === docId)
    if (!doc) throw new Error(`Không tìm thấy tài liệu #${docId}`)

    const now = new Date().toISOString()
    doc.status = 'APPROVED'
    doc.approvedBy = approvedBy
    doc.approvedAt = now
    doc.updatedAt = now

    data.history
      .filter((h) => h.documentId === docId && h.confirmationState === 'UNCONFIRMED_DRAFT')
      .forEach((h) => {
        h.confirmationState = 'CONFIRMED_APPROVED'
      })

    data.items
      .filter((i) => i.documentId === docId && i.syncStatus === 'UNCONFIRMED_STALE')
      .forEach((i) => {
        i.syncStatus = 'CONFIRMED_STALE'
      })

    saveStorage(data)
    return doc
  },

  /** Từ chối phê duyệt (Reject) hoặc hoàn tác về DRAFT: khôi phục các Test Case về FRESH */
  rejectOrReturn: async (docId: number, _reason: string): Promise<SpecificationDocument> => {
    const data = loadStorage()
    const doc = data.documents.find((d) => d.id === docId)
    if (!doc) throw new Error(`Không tìm thấy tài liệu #${docId}`)

    doc.status = 'DRAFT'
    doc.updatedAt = new Date().toISOString()

    data.items
      .filter((i) => i.documentId === docId && i.syncStatus === 'UNCONFIRMED_STALE')
      .forEach((i) => {
        i.syncStatus = 'FRESH'
      })

    saveStorage(data)
    return doc
  },

  /** Cập nhật nhanh mức độ ưu tiên hoặc gắn thêm Test Case cho 1 Requirement Item */
  updateRequirementMeta: async (
    docId: number,
    itemId: string,
    patch: { priority?: ItemPriority; linkedTestCases?: string[]; linkedIssues?: string[] },
  ): Promise<RequirementItem> => {
    const data = loadStorage()
    const item = data.items.find((i) => i.documentId === docId && i.id === itemId)
    if (!item) throw new Error(`Không tìm thấy mục yêu cầu #${itemId}`)

    if (patch.priority) item.priority = patch.priority
    if (patch.linkedTestCases) item.linkedTestCases = patch.linkedTestCases
    if (patch.linkedIssues) item.linkedIssues = patch.linkedIssues

    // Đồng bộ ngược độ ưu tiên vào block Heading tương ứng
    const doc = data.documents.find((d) => d.id === docId)
    if (doc?.blocks && patch.priority) {
      const headingBlock = doc.blocks.find((b) => b.reqId === itemId || b.reqKeyCode === item.keyCode)
      if (headingBlock) {
        headingBlock.reqPriority = patch.priority
      }
    }

    saveStorage(data)
    return item
  },

  /** Lưu cập nhật 1 Requirement Item đơn lẻ (tương thích ngược) */
  saveRequirementItem: async (
    docId: number,
    updatedItem: RequirementItem,
    authorName: string,
  ): Promise<RequirementItem> => {
    const data = loadStorage()
    const existingIndex = data.items.findIndex((i) => i.id === updatedItem.id)
    const doc = data.documents.find((d) => d.id === docId)
    const now = new Date().toISOString()

    if (existingIndex >= 0) {
      const oldItem = data.items[existingIndex]
      const contentChanged =
        oldItem.content.trim() !== updatedItem.content.trim() ||
        oldItem.acceptanceCriteria.trim() !== updatedItem.acceptanceCriteria.trim()
      if (contentChanged) {
        data.history.unshift({
          id: `hist-${Date.now()}`,
          documentId: docId,
          requirementItemId: updatedItem.id,
          requirementKeyCode: updatedItem.keyCode,
          version: doc?.version || 'v1.0',
          changeType: 'CONTENT',
          previousContent: oldItem.content,
          newContent: updatedItem.content,
          previousAcceptanceCriteria: oldItem.acceptanceCriteria,
          newAcceptanceCriteria: updatedItem.acceptanceCriteria,
          changedBy: authorName,
          changedAt: now,
          confirmationState: 'UNCONFIRMED_DRAFT',
        })
        updatedItem.syncStatus = 'UNCONFIRMED_STALE'
      }
      data.items[existingIndex] = updatedItem
    } else {
      data.items.push(updatedItem)
    }

    if (doc) doc.updatedAt = now
    saveStorage(data)
    return updatedItem
  },

  /** Xóa một Requirement Item */
  deleteRequirementItem: async (docId: number, itemId: string): Promise<void> => {
    const data = loadStorage()
    data.items = data.items.filter((i) => !(i.documentId === docId && i.id === itemId))
    saveStorage(data)
  },

  /** Thêm bình luận phản biện vào mục yêu cầu */
  addComment: async (
    docId: number,
    comment: Omit<DocumentComment, 'id' | 'createdAt' | 'isResolved' | 'isStale'>,
  ): Promise<DocumentComment> => {
    const data = loadStorage()
    const newComment: DocumentComment = {
      ...comment,
      documentId: docId,
      body: comment.body || comment.content || '',
      content: comment.content || comment.body || '',
      id: `cmt-${Date.now()}`,
      createdAt: new Date().toISOString(),
      isResolved: false,
      isStale: false,
    }
    data.comments.unshift(newComment)
    saveStorage(data)
    return newComment
  },

  /** Đánh dấu giải quyết bình luận */
  resolveComment: async (docId: number, commentId: string): Promise<DocumentComment> => {
    const data = loadStorage()
    const cmt = data.comments.find((c) => c.documentId === docId && c.id === commentId)
    if (!cmt) throw new Error(`Không tìm thấy bình luận #${commentId}`)
    cmt.isResolved = true
    saveStorage(data)
    return cmt
  },

  /** Giả lập QA đồng bộ Test Case: khôi phục trạng thái về FRESH */
  syncArtifactsToFresh: async (docId: number, itemId: string): Promise<RequirementItem> => {
    const data = loadStorage()
    const item = data.items.find((i) => i.documentId === docId && i.id === itemId)
    if (!item) throw new Error(`Không tìm thấy mục yêu cầu #${itemId}`)
    item.syncStatus = 'FRESH'
    saveStorage(data)
    return item
  },

  /** Thống kê số liệu tài liệu cho trang Overview và Dashboard */
  getProjectStats: async (
    projectId: number,
  ): Promise<{
    totalDocs: number
    approvedDocs: number
    totalItems: number
    staleCount: number
    freshCount: number
  }> => {
    const data = loadStorage()
    const docs = data.documents.filter((d) => d.projectId === projectId && !d.isFolder)
    const allDocs = data.documents.filter((d) => d.projectId === projectId)
    const docIds = new Set(allDocs.map((d) => d.id))
    const items = data.items.filter((i) => docIds.has(i.documentId))
    const approvedDocs = docs.filter((d) => d.status === 'APPROVED').length
    const staleCount = items.filter((i) => i.syncStatus !== 'FRESH').length
    const freshCount = items.filter((i) => i.syncStatus === 'FRESH').length

    return {
      totalDocs: docs.length,
      approvedDocs,
      totalItems: items.length,
      staleCount,
      freshCount,
    }
  },

  /** Alias lấy tài liệu theo Id */
  getDocumentById: async (id: number): Promise<SpecificationDocument | null> => {
    const data = loadStorage()
    return data.documents.find((d) => d.id === id) || null
  },

  /** Alias lấy danh sách tài liệu theo projectId */
  getProjectDocuments: async (projectId: number): Promise<SpecificationDocument[]> => {
    return documentApi.list(projectId)
  },

  /** Lấy toàn bộ tài liệu trên tất cả dự án */
  getAllDocuments: async (): Promise<SpecificationDocument[]> => {
    const data = loadStorage()
    return data.documents
  },

  /** Alias lấy items của tài liệu */
  getRequirementItems: async (docId: number): Promise<RequirementItem[]> => {
    const res = await documentApi.get(docId)
    return res.items
  },

  /** Alias lấy lịch sử thay đổi của tài liệu */
  getDocumentHistory: async (docId: number): Promise<RequirementHistoryLog[]> => {
    const res = await documentApi.get(docId)
    return res.history
  },

  /** Alias lấy bình luận của tài liệu */
  getDocumentComments: async (docId: number): Promise<DocumentComment[]> => {
    const res = await documentApi.get(docId)
    return res.comments
  },
}
