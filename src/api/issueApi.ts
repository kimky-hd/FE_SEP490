import type {
  IssueComment,
  IssuePriority,
  IssueType,
  ProjectIssue,
  ProjectIssueStats,
} from '@/types/issue'
import type { StatusCategory } from '@/types/project'

const STORAGE_KEY = 'ssam.issues.v1'

interface StoredIssueData {
  issues: ProjectIssue[]
}

function createInitialSeed(): StoredIssueData {
  const issues: ProjectIssue[] = [
    {
      id: 'iss-20-101',
      projectId: 20,
      key: 'CORE-101',
      type: 'TASK',
      summary: 'Cấu hình Spring Security OAuth2 và Token JWT Filter',
      description:
        'Cài đặt bộ lọc xác thực JWT tại Gateway và Resource Server. Kiểm tra thời hạn Access Token (15 phút), chữ ký RSA và cơ chế tự động làm mới Refresh Token theo chuẩn OWASP ASVS.',
      phaseId: 3,
      phaseName: 'Phase 3: Sprint Execution & Coding',
      statusId: 302,
      statusName: 'In Progress',
      statusCategory: 'IN_PROGRESS',
      priority: 'HIGH',
      storyPoints: 5,
      assigneeName: 'Sarah Lin',
      assigneeRole: 'Senior Developer',
      assigneeAvatar: 'SL',
      reporterName: 'Phạm Văn Khoa (PM)',
      labels: ['Backend', 'Security', 'JWT'],
      createdAt: '2026-10-21T09:00:00.000Z',
      updatedAt: '2026-10-27T14:30:00.000Z',
      linkedDocumentId: 101,
      linkedRequirementItemId: 'item-101-1',
      linkedRequirementKeyCode: 'REQ-01',
      linkedRequirementTitle: '2.1. Xác thực Đăng nhập Đa yếu tố & Khóa Tài khoản Tạm thời',
      traceabilityStatus: 'FRESH',
      comments: [
        {
          id: 'cmt-iss-1',
          authorName: 'Phạm Văn Khoa (PM)',
          authorRole: 'Project Manager',
          body: '@Sarah Lin nhớ kiểm tra kỹ trường hợp token hết hạn khi đang tải dở file lớn nhé.',
          mentions: ['Sarah Lin'],
          createdAt: '2026-10-22T10:00:00.000Z',
        },
        {
          id: 'cmt-iss-2',
          authorName: 'Sarah Lin',
          authorRole: 'Senior Developer',
          body: 'Đã bổ sung cấu hình axios interceptor retry 1 lần khi gặp 401 token expired.',
          createdAt: '2026-10-23T11:15:00.000Z',
        },
      ],
      activityLog: [
        {
          id: 'act-1',
          authorName: 'Phạm Văn Khoa (PM)',
          action: 'Tạo mới Issue',
          details: 'Khởi tạo Task CORE-101 và gán cho Sarah Lin',
          timestamp: '2026-10-21T09:00:00.000Z',
        },
        {
          id: 'act-2',
          authorName: 'Sarah Lin',
          action: 'Chuyển trạng thái',
          details: 'Từ "To Do" sang "In Progress"',
          timestamp: '2026-10-22T08:30:00.000Z',
        },
        {
          id: 'act-3',
          authorName: 'Sarah Lin',
          action: 'Liên kết Yêu cầu Confluence',
          details: 'Đã gắn liên kết với REQ-01 thuộc SRS-01',
          timestamp: '2026-10-22T08:35:00.000Z',
        },
      ],
    },
    {
      id: 'iss-20-102',
      projectId: 20,
      key: 'CORE-102',
      type: 'BUG',
      summary: 'Lỗi Brute-force không khóa tài khoản sau 5 lần nhập sai',
      description:
        'Hệ thống không ghi nhận số lần nhập sai vào Redis cache dẫn đến sau 5 lần đăng nhập thất bại tài khoản vẫn ở trạng thái ACTIVE thay vì TEMP_LOCKED.',
      severity: 'CRITICAL',
      stepsToReproduce:
        '1. Truy cập trang /login\n2. Nhập email: test@company.com và mật khẩu sai\n3. Bấm Đăng nhập liên tiếp 6 lần\n4. Quan sát: Hệ thống vẫn báo lỗi mật khẩu sai mà không khóa tài khoản 15 phút như REQ-01 quy định.',
      linkedTestCaseCode: 'TC-01-01',
      phaseId: 3,
      phaseName: 'Phase 3: Sprint Execution & Coding',
      statusId: 301,
      statusName: 'To Do',
      statusCategory: 'TODO',
      priority: 'HIGHEST',
      storyPoints: 3,
      assigneeName: 'Vũ Kim Kỳ',
      assigneeRole: 'Backend Developer',
      assigneeAvatar: 'KK',
      reporterName: 'Vũ Thị Mai (QA)',
      labels: ['Bug', 'Security', 'Hotfix'],
      createdAt: '2026-10-25T14:00:00.000Z',
      updatedAt: '2026-10-26T16:00:00.000Z',
      linkedDocumentId: 101,
      linkedRequirementItemId: 'item-101-1',
      linkedRequirementKeyCode: 'REQ-01',
      linkedRequirementTitle: '2.1. Xác thực Đăng nhập Đa yếu tố & Khóa Tài khoản Tạm thời',
      traceabilityStatus: 'FRESH',
      comments: [
        {
          id: 'cmt-iss-3',
          authorName: 'Vũ Thị Mai (QA)',
          authorRole: 'QA Lead',
          body: '@Vũ Kim Kỳ fix gấp con bug này để kịp demo UAT chiều nay nhé.',
          mentions: ['Vũ Kim Kỳ'],
          createdAt: '2026-10-25T14:10:00.000Z',
        },
      ],
      activityLog: [
        {
          id: 'act-4',
          authorName: 'Vũ Thị Mai (QA)',
          action: 'Tạo Bug mới',
          details: 'Ghi nhận lỗi từ Test Case TC-01-01 và gán cho Vũ Kim Kỳ',
          timestamp: '2026-10-25T14:00:00.000Z',
        },
      ],
    },
    {
      id: 'iss-20-103',
      projectId: 20,
      key: 'CORE-103',
      type: 'TASK',
      summary: 'Tích hợp SDK VietQR Napas247 và sinh mã QR động',
      description:
        'Triển khai hàm sinh mã QR động chứa số tiền và mã đơn hàng theo chuẩn EMVCo Napas. Tự động kiểm tra hết hạn sau 15 phút.',
      phaseId: 3,
      phaseName: 'Phase 3: Sprint Execution & Coding',
      statusId: 302,
      statusName: 'In Progress',
      statusCategory: 'IN_PROGRESS',
      priority: 'HIGH',
      storyPoints: 8,
      assigneeName: 'Phạm Minh Lương',
      assigneeRole: 'Backend Developer',
      assigneeAvatar: 'ML',
      reporterName: 'Sarah Lin',
      labels: ['Payment', 'VietQR', 'SDK'],
      createdAt: '2026-10-22T08:00:00.000Z',
      updatedAt: '2026-10-27T10:00:00.000Z',
      linkedDocumentId: 102,
      linkedRequirementItemId: 'item-102-1',
      linkedRequirementKeyCode: 'REQ-01',
      linkedRequirementTitle: '2.1. Sinh mã VietQR Động theo Đơn hàng & Kiểm soát Thời hạn Hiệu lực',
      traceabilityStatus: 'FRESH',
      comments: [],
      activityLog: [
        {
          id: 'act-5',
          authorName: 'Sarah Lin',
          action: 'Tạo mới Issue',
          details: 'Khởi tạo Task tích hợp VietQR',
          timestamp: '2026-10-22T08:00:00.000Z',
        },
      ],
    },
    {
      id: 'iss-20-104',
      projectId: 20,
      key: 'CORE-104',
      type: 'BUG',
      summary: 'Webhook Ngân hàng bị xử lý 2 lần khi mạng chập chờn (Duplicate Credit)',
      description:
        'Cổng thanh toán bắn 2 webhook retry liên tiếp cách nhau 200ms khiến đơn hàng bị kích hoạt 2 lần. Cần bổ sung Redis Distributed Lock theo transactionId.',
      severity: 'BLOCKER',
      stepsToReproduce:
        '1. Gửi request Webhook Napas với transactionId = "TXN-9999"\n2. Trong lúc đang xử lý, gửi tiếp request thứ 2 cùng ID\n3. Quan sát: Cả 2 request đều trả 200 và cộng tiền 2 lần.',
      linkedTestCaseCode: 'TC-02-02',
      phaseId: 3,
      phaseName: 'Phase 3: Sprint Execution & Coding',
      statusId: 302,
      statusName: 'In Progress',
      statusCategory: 'IN_PROGRESS',
      priority: 'HIGHEST',
      storyPoints: 5,
      assigneeName: 'Phạm Minh Lương',
      assigneeRole: 'Backend Developer',
      assigneeAvatar: 'ML',
      reporterName: 'Vũ Thị Mai (QA)',
      labels: ['Bug', 'Webhook', 'Finance'],
      createdAt: '2026-10-26T11:00:00.000Z',
      updatedAt: '2026-10-27T15:20:00.000Z',
      linkedDocumentId: 102,
      linkedRequirementItemId: 'item-102-2',
      linkedRequirementKeyCode: 'REQ-02',
      linkedRequirementTitle: '2.2. Xử lý Webhook Ngân hàng & Đối soát Giao dịch Bất đồng bộ',
      traceabilityStatus: 'UNCONFIRMED_STALE', // Cảnh báo Stale mẫu cho demo!
      comments: [
        {
          id: 'cmt-iss-4',
          authorName: 'Vũ Kim Kỳ (BA)',
          authorRole: 'Business Analyst',
          body: 'Lưu ý: Tôi vừa cập nhật thêm quy tắc chuyển thừa / thiếu tiền trong tài liệu Confluence (v1.1). @Phạm Minh Lương xem bản diff nhé!',
          mentions: ['Phạm Minh Lương'],
          createdAt: '2026-10-27T09:30:00.000Z',
        },
      ],
      activityLog: [
        {
          id: 'act-6',
          authorName: 'Hệ thống SSAM (Traceability)',
          action: 'Cảnh báo Lạc hậu (Stale Alert)',
          details: 'Yêu cầu REQ-02 bên tài liệu SRS-02 vừa bị chỉnh sửa nháp. Cần kiểm tra lại mã nguồn!',
          timestamp: '2026-10-27T10:00:00.000Z',
        },
      ],
    },
    {
      id: 'iss-20-105',
      projectId: 20,
      key: 'CORE-105',
      type: 'TASK',
      summary: 'Xây dựng màn hình hiển thị danh sách giao dịch VietQR',
      description:
        'Giao diện hiển thị bảng lịch sử thanh toán, trạng thái giao dịch, nút xem chi tiết mã QR và bộ lọc theo ngày.',
      phaseId: 2,
      phaseName: 'Phase 2: UI/UX Design',
      statusId: 203,
      statusName: 'In Review',
      statusCategory: 'IN_PROGRESS',
      priority: 'MEDIUM',
      storyPoints: 3,
      assigneeName: 'Sarah Lin',
      assigneeRole: 'Frontend Developer',
      assigneeAvatar: 'SL',
      reporterName: 'Phạm Minh Lương',
      labels: ['Frontend', 'UI/UX'],
      createdAt: '2026-10-23T10:00:00.000Z',
      updatedAt: '2026-10-26T17:00:00.000Z',
      linkedDocumentId: 102,
      linkedRequirementItemId: 'item-102-3',
      linkedRequirementKeyCode: 'REQ-03',
      linkedRequirementTitle: '2.3. Tự động Bóc tách Requirement Items & Cảnh báo Lạc hậu (Stale RTM)',
      traceabilityStatus: 'FRESH',
      comments: [],
      activityLog: [
        {
          id: 'act-7',
          authorName: 'Phạm Minh Lương',
          action: 'Tạo mới Issue',
          details: 'Tạo task giao diện bảng giao dịch',
          timestamp: '2026-10-23T10:00:00.000Z',
        },
      ],
    },
    {
      id: 'iss-20-106',
      projectId: 20,
      key: 'CORE-106',
      type: 'TASK',
      summary: 'Đặc tả Use Case và Wireframe luồng eKYC 3 bước',
      description:
        'Hoàn thiện tài liệu URD và bản vẽ Wireframe Figma cho quy trình định danh eKYC trên thiết bị di động.',
      phaseId: 1,
      phaseName: 'Phase 1: Requirement & Analysis',
      statusId: 104,
      statusName: 'Done',
      statusCategory: 'DONE',
      priority: 'MEDIUM',
      storyPoints: 3,
      assigneeName: 'Phạm Minh Lương',
      assigneeRole: 'Business Analyst',
      assigneeAvatar: 'ML',
      reporterName: 'Phạm Văn Khoa (PM)',
      labels: ['BA', 'Design', 'eKYC'],
      createdAt: '2026-10-14T08:00:00.000Z',
      updatedAt: '2026-10-20T16:00:00.000Z',
      linkedDocumentId: 103,
      linkedRequirementItemId: 'item-103-1',
      linkedRequirementKeyCode: 'REQ-01',
      linkedRequirementTitle: '1. Hành trình Định danh Điện tử eKYC 3 Bước',
      traceabilityStatus: 'FRESH',
      comments: [],
      activityLog: [
        {
          id: 'act-8',
          authorName: 'Phạm Minh Lương',
          action: 'Hoàn thành công việc',
          details: 'Đã hoàn thành và được PM nghiệm thu',
          timestamp: '2026-10-20T16:00:00.000Z',
        },
      ],
    },
    {
      id: 'iss-20-107',
      projectId: 20,
      key: 'CORE-107',
      type: 'TASK',
      summary: 'Viết tài liệu hướng dẫn vận hành và API Swagger',
      description:
        'Tổng hợp danh mục API phân hệ Core và viết tài liệu OpenAPI 3.0 cho các đối tác tích hợp.',
      phaseId: 4,
      phaseName: 'Phase 4: UAT & Deployment',
      statusId: 404,
      statusName: 'Done',
      statusCategory: 'DONE',
      priority: 'LOW',
      storyPoints: 2,
      assigneeName: 'Vũ Kim Kỳ',
      assigneeRole: 'Backend Developer',
      assigneeAvatar: 'KK',
      reporterName: 'Phạm Văn Khoa (PM)',
      labels: ['Documentation', 'Swagger'],
      createdAt: '2026-10-18T09:00:00.000Z',
      updatedAt: '2026-10-24T12:00:00.000Z',
      traceabilityStatus: 'FRESH',
      comments: [],
      activityLog: [
        {
          id: 'act-9',
          authorName: 'Vũ Kim Kỳ',
          action: 'Hoàn thành công việc',
          details: 'Xuất bản Swagger docs tại /api-docs',
          timestamp: '2026-10-24T12:00:00.000Z',
        },
      ],
    },
  ]

  return { issues }
}

function loadStorage(): StoredIssueData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const seeded = createInitialSeed()
      saveStorage(seeded)
      return seeded
    }
    const parsed = JSON.parse(raw) as StoredIssueData
    if (!parsed || !Array.isArray(parsed.issues)) {
      const seeded = createInitialSeed()
      saveStorage(seeded)
      return seeded
    }
    return parsed
  } catch {
    const seeded = createInitialSeed()
    saveStorage(seeded)
    return seeded
  }
}

function saveStorage(data: StoredIssueData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (err) {
    console.error('Không thể lưu issues vào localStorage', err)
  }
}

/** Tự động khởi tạo dữ liệu mẫu nếu một Project chưa có Issue nào */
function ensureProjectSeeded(projectId: number, projectKey = 'PRJ'): StoredIssueData {
  const data = loadStorage()
  const exists = data.issues.some((i) => i.projectId === projectId)
  if (exists) return data

  const initial = createInitialSeed()
  const newIssues = initial.issues.map((iss, idx) => ({
    ...iss,
    id: `iss-${projectId}-${101 + idx}`,
    projectId,
    key: `${projectKey}-${101 + idx}`,
  }))

  data.issues.push(...newIssues)
  saveStorage(data)
  return data
}

export const issueApi = {
  /** Lấy danh sách Issues theo Dự án */
  getIssues: async (projectId?: number, projectKey?: string): Promise<ProjectIssue[]> => {
    let data = loadStorage()
    if (projectId) {
      data = ensureProjectSeeded(projectId, projectKey || 'TEST')
      return data.issues
        .filter((i) => i.projectId === projectId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    }
    return data.issues.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  },

  /** Lấy chi tiết 1 Issue theo ID */
  getIssueById: async (id: string): Promise<ProjectIssue | null> => {
    const data = loadStorage()
    return data.issues.find((i) => i.id === id) || null
  },

  /** Tạo mới Task hoặc Bug chuẩn Jira */
  createIssue: async (params: {
    projectId: number
    projectKey?: string
    type: IssueType
    summary: string
    description: string
    phaseId: number
    phaseName: string
    statusId: number
    statusName: string
    statusCategory: StatusCategory
    priority: IssuePriority
    storyPoints?: number
    assigneeName: string
    assigneeRole: string
    reporterName: string
    labels?: string[]
    severity?: 'BLOCKER' | 'CRITICAL' | 'MAJOR' | 'MINOR'
    stepsToReproduce?: string
    linkedTestCaseCode?: string
    linkedDocumentId?: number
    linkedRequirementItemId?: string
    linkedRequirementKeyCode?: string
    linkedRequirementTitle?: string
  }): Promise<ProjectIssue> => {
    const data = loadStorage()
    const now = new Date().toISOString()
    const projectKey = params.projectKey || 'CORE'

    // Tính mã Key tăng dần (VD: CORE-108)
    const projectIssues = data.issues.filter((i) => i.projectId === params.projectId)
    const existingNums = projectIssues
      .map((i) => {
        const parts = i.key.split('-')
        const num = parseInt(parts[parts.length - 1], 10)
        return isNaN(num) ? 0 : num
      })
      .filter((n) => n > 0)
    const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 101
    const key = `${projectKey}-${nextNum}`
    const id = `iss-${params.projectId}-${Date.now()}`

    // Lấy avatar viết tắt
    const initials = params.assigneeName
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()

    const newIssue: ProjectIssue = {
      id,
      projectId: params.projectId,
      key,
      type: params.type,
      summary: params.summary.trim(),
      description: params.description.trim(),
      severity: params.type === 'BUG' ? params.severity || 'MAJOR' : undefined,
      stepsToReproduce: params.type === 'BUG' ? params.stepsToReproduce?.trim() : undefined,
      linkedTestCaseCode: params.type === 'BUG' ? params.linkedTestCaseCode?.trim() : undefined,
      phaseId: params.phaseId,
      phaseName: params.phaseName,
      statusId: params.statusId,
      statusName: params.statusName,
      statusCategory: params.statusCategory,
      priority: params.priority,
      storyPoints: params.storyPoints || (params.type === 'BUG' ? 3 : 5),
      assigneeName: params.assigneeName,
      assigneeRole: params.assigneeRole,
      assigneeAvatar: initials,
      reporterName: params.reporterName,
      labels: params.labels || [params.type === 'BUG' ? 'Bug' : 'Task'],
      createdAt: now,
      updatedAt: now,
      linkedDocumentId: params.linkedDocumentId,
      linkedRequirementItemId: params.linkedRequirementItemId,
      linkedRequirementKeyCode: params.linkedRequirementKeyCode,
      linkedRequirementTitle: params.linkedRequirementTitle,
      traceabilityStatus: 'FRESH',
      comments: [],
      activityLog: [
        {
          id: `act-${Date.now()}`,
          authorName: params.reporterName,
          action: `Tạo mới ${params.type === 'BUG' ? 'Bug' : 'Task'}`,
          details: `Khởi tạo ${key}: "${params.summary}" và gán cho ${params.assigneeName}`,
          timestamp: now,
        },
      ],
    }

    data.issues.unshift(newIssue)
    saveStorage(data)
    return newIssue
  },

  /** Cập nhật thông tin Issue */
  updateIssue: async (
    id: string,
    updates: Partial<ProjectIssue>,
    actor = 'Người dùng',
    reason?: string,
  ): Promise<ProjectIssue> => {
    const data = loadStorage()
    const issue = data.issues.find((i) => i.id === id)
    if (!issue) throw new Error(`Không tìm thấy Issue #${id}`)

    const now = new Date().toISOString()
    Object.assign(issue, updates, { updatedAt: now })

    if (reason) {
      issue.activityLog.unshift({
        id: `act-${Date.now()}`,
        authorName: actor,
        action: 'Cập nhật Issue',
        details: reason,
        timestamp: now,
      })
    }

    saveStorage(data)
    return issue
  },

  /**
   * Xóa Issue có kiểm tra quy tắc bảo vệ RTM (GB-07):
   * Nếu Issue đang có liên kết truy xuất tới REQ-xx hoặc Test Case, bắt buộc phải có force = true
   */
  deleteIssue: async (id: string, force = false): Promise<{ success: boolean; error?: string }> => {
    const data = loadStorage()
    const idx = data.issues.findIndex((i) => i.id === id)
    if (idx === -1) throw new Error(`Không tìm thấy Issue #${id}`)

    const issue = data.issues[idx]
    const hasReqLink = !!issue.linkedRequirementKeyCode
    const hasTcLink = !!issue.linkedTestCaseCode

    if ((hasReqLink || hasTcLink) && !force) {
      return {
        success: false,
        error: `MSG04: Cảnh báo xóa Issue có liên kết truy xuất! Issue ${issue.key} đang được liên kết với ${
          hasReqLink ? `yêu cầu [${issue.linkedRequirementKeyCode}]` : ''
        } ${hasTcLink ? `và Test Case [${issue.linkedTestCaseCode}]` : ''}. Xóa issue này có thể làm đứt gãy ma trận RTM. Bạn có chắc chắn muốn xóa vĩnh viễn?`,
      }
    }

    data.issues.splice(idx, 1)
    saveStorage(data)
    return { success: true }
  },

  /** Chuyển trạng thái Workflow của Issue (có kiểm tra Transition Rules) */
  transitionIssue: async (
    id: string,
    newStatusId: number,
    newStatusName: string,
    newStatusCategory: StatusCategory,
    comment?: string,
    actor = 'Người dùng',
  ): Promise<ProjectIssue> => {
    const data = loadStorage()
    const issue = data.issues.find((i) => i.id === id)
    if (!issue) throw new Error(`Không tìm thấy Issue #${id}`)

    const prevStatusName = issue.statusName
    const now = new Date().toISOString()

    issue.statusId = newStatusId
    issue.statusName = newStatusName
    issue.statusCategory = newStatusCategory
    issue.updatedAt = now

    issue.activityLog.unshift({
      id: `act-${Date.now()}`,
      authorName: actor,
      action: 'Chuyển trạng thái',
      details: `Đổi trạng thái từ "${prevStatusName}" sang "${newStatusName}"${comment ? ` (Ghi chú: ${comment})` : ''}`,
      timestamp: now,
    })

    if (comment) {
      issue.comments.unshift({
        id: `cmt-${Date.now()}`,
        authorName: actor,
        authorRole: 'Thành viên',
        body: `[Chuyển trạng thái sang ${newStatusName}]: ${comment}`,
        createdAt: now,
      })
    }

    saveStorage(data)
    return issue
  },

  /** Bàn giao lại công việc (Re-assign) kèm ghi chú bàn giao */
  reassignIssue: async (
    id: string,
    newAssigneeName: string,
    newAssigneeRole: string,
    handoverNote?: string,
    actor = 'Người dùng',
  ): Promise<ProjectIssue> => {
    const data = loadStorage()
    const issue = data.issues.find((i) => i.id === id)
    if (!issue) throw new Error(`Không tìm thấy Issue #${id}`)

    const prevAssignee = issue.assigneeName
    const now = new Date().toISOString()
    const initials = newAssigneeName
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()

    issue.assigneeName = newAssigneeName
    issue.assigneeRole = newAssigneeRole
    issue.assigneeAvatar = initials
    issue.updatedAt = now

    issue.activityLog.unshift({
      id: `act-${Date.now()}`,
      authorName: actor,
      action: 'Bàn giao công việc (Re-assign)',
      details: `Bàn giao từ ${prevAssignee} sang @${newAssigneeName}${handoverNote ? ` · Ghi chú: "${handoverNote}"` : ''}`,
      timestamp: now,
    })

    if (handoverNote) {
      issue.comments.unshift({
        id: `cmt-${Date.now()}`,
        authorName: actor,
        authorRole: 'Thành viên',
        body: `@${newAssigneeName} Bàn giao công việc: ${handoverNote}`,
        mentions: [newAssigneeName],
        createdAt: now,
      })
    }

    saveStorage(data)
    return issue
  },

  /** Gắn liên kết với một Requirement Item Confluence */
  linkRequirement: async (
    id: string,
    req: { docId: number; reqId: string; reqKey: string; reqTitle: string },
    actor = 'Người dùng',
  ): Promise<ProjectIssue> => {
    const data = loadStorage()
    const issue = data.issues.find((i) => i.id === id)
    if (!issue) throw new Error(`Không tìm thấy Issue #${id}`)

    const now = new Date().toISOString()
    issue.linkedDocumentId = req.docId
    issue.linkedRequirementItemId = req.reqId
    issue.linkedRequirementKeyCode = req.reqKey
    issue.linkedRequirementTitle = req.reqTitle
    issue.traceabilityStatus = 'FRESH'
    issue.updatedAt = now

    issue.activityLog.unshift({
      id: `act-${Date.now()}`,
      authorName: actor,
      action: 'Liên kết Yêu cầu Confluence',
      details: `Đã gắn liên kết với [${req.reqKey}] - ${req.reqTitle}`,
      timestamp: now,
    })

    saveStorage(data)
    return issue
  },

  /** Gỡ liên kết Requirement */
  unlinkRequirement: async (id: string, actor = 'Người dùng'): Promise<ProjectIssue> => {
    const data = loadStorage()
    const issue = data.issues.find((i) => i.id === id)
    if (!issue) throw new Error(`Không tìm thấy Issue #${id}`)

    const prevKey = issue.linkedRequirementKeyCode
    const now = new Date().toISOString()

    issue.linkedDocumentId = undefined
    issue.linkedRequirementItemId = undefined
    issue.linkedRequirementKeyCode = undefined
    issue.linkedRequirementTitle = undefined
    issue.traceabilityStatus = 'FRESH'
    issue.updatedAt = now

    issue.activityLog.unshift({
      id: `act-${Date.now()}`,
      authorName: actor,
      action: 'Gỡ liên kết Yêu cầu',
      details: `Đã gỡ liên kết với yêu cầu [${prevKey}]`,
      timestamp: now,
    })

    saveStorage(data)
    return issue
  },

  /**
   * Reset trạng thái Stale về FRESH:
   * Khi lập trình viên hoặc Tester xác nhận đã cập nhật code theo bản đặc tả mới
   */
  resetStaleStatus: async (id: string, actor = 'Người dùng'): Promise<ProjectIssue> => {
    const data = loadStorage()
    const issue = data.issues.find((i) => i.id === id)
    if (!issue) throw new Error(`Không tìm thấy Issue #${id}`)

    const now = new Date().toISOString()
    issue.traceabilityStatus = 'FRESH'
    issue.updatedAt = now

    issue.activityLog.unshift({
      id: `act-${Date.now()}`,
      authorName: actor,
      action: 'Đồng bộ Trạng thái Truy xuất',
      details: `Đã xác nhận cập nhật theo đặc tả mới của [${issue.linkedRequirementKeyCode || 'REQ'}] → Trạng thái trở về Fresh.`,
      timestamp: now,
    })

    saveStorage(data)
    return issue
  },

  /**
   * Đồng bộ 2 chiều: Khi một Requirement bên Confluence bị chỉnh sửa nháp hoặc duyệt thay đổi mới,
   * tự động cập nhật cờ Stale lên các Jira Task / Bug liên kết
   */
  markRequirementStale: async (
    docId: number,
    reqKeyCode: string,
    status: 'UNCONFIRMED_STALE' | 'CONFIRMED_STALE',
  ): Promise<void> => {
    const data = loadStorage()
    const now = new Date().toISOString()
    let changed = false

    for (const iss of data.issues) {
      if (
        (iss.linkedDocumentId === docId || !iss.linkedDocumentId) &&
        iss.linkedRequirementKeyCode === reqKeyCode
      ) {
        iss.traceabilityStatus = status
        iss.updatedAt = now
        iss.activityLog.unshift({
          id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          authorName: 'Hệ thống SSAM (Confluence Sync)',
          action:
            status === 'UNCONFIRMED_STALE'
              ? 'Cảnh báo REQ sửa nháp (Unconfirmed Stale)'
              : 'Cảnh báo REQ đã duyệt thay đổi (Confirmed Stale)',
          details: `Yêu cầu [${reqKeyCode}] vừa có thay đổi nội dung đặc tả. Vui lòng kiểm tra và cập nhật mã nguồn / kịch bản kiểm thử tương ứng.`,
          timestamp: now,
        })
        changed = true
      }
    }

    if (changed) {
      saveStorage(data)
    }
  },

  /** Thêm bình luận vào Issue hỗ trợ @mention */
  addComment: async (
    issueId: string,
    comment: { authorName: string; authorRole: string; body: string; mentions?: string[] },
  ): Promise<ProjectIssue> => {
    const data = loadStorage()
    const issue = data.issues.find((i) => i.id === issueId)
    if (!issue) throw new Error(`Không tìm thấy Issue #${issueId}`)

    const now = new Date().toISOString()
    const newComment: IssueComment = {
      id: `cmt-${Date.now()}`,
      authorName: comment.authorName,
      authorRole: comment.authorRole,
      body: comment.body.trim(),
      mentions: comment.mentions || [],
      createdAt: now,
    }

    issue.comments.unshift(newComment)
    issue.updatedAt = now
    issue.activityLog.unshift({
      id: `act-${Date.now()}`,
      authorName: comment.authorName,
      action: 'Thêm bình luận',
      details: comment.mentions?.length
        ? `Đã nhắc đến @${comment.mentions.join(', @')}`
        : 'Đã gửi một bình luận mới',
      timestamp: now,
    })

    saveStorage(data)
    return issue
  },

  /** Thống kê số lượng Issue cho Project Header & Overview */
  getProjectIssueStats: async (
    projectId: number,
  ): Promise<ProjectIssueStats> => {
    const data = loadStorage()
    const projectIssues = data.issues.filter((i) => i.projectId === projectId)
    const open = projectIssues.filter((i) => i.statusCategory !== 'DONE').length
    const done = projectIssues.filter((i) => i.statusCategory === 'DONE').length
    const tasks = projectIssues.filter((i) => i.type === 'TASK').length
    const bugs = projectIssues.filter((i) => i.type === 'BUG').length
    const staleCount = projectIssues.filter((i) => i.traceabilityStatus !== 'FRESH').length

    return {
      total: projectIssues.length,
      open,
      done,
      tasks,
      bugs,
      staleCount,
    }
  },

  /** Lấy danh sách việc của tôi (My Issues) cho Dashboard Home */
  getMyIssues: async (userFullName = 'Sarah Lin'): Promise<ProjectIssue[]> => {
    const data = loadStorage()
    // Khớp tên người dùng hoặc trả về các task của Sarah Lin / Vũ Kim Kỳ
    return data.issues
      .filter((i) => i.assigneeName.toLowerCase().includes(userFullName.toLowerCase()) || i.assigneeName.includes('Sarah'))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  },
}
