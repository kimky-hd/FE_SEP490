// Dữ liệu mock cho Workspace / RBAC / Project — chỉ dùng khi VITE_USE_MOCK=true. Có state thật (lưu localStorage) để
// tạo role / đổi quyền / tạo dự án xong reload vẫn còn, và để test được ẩn/hiện + 403 theo từng người dùng.

import type { PermissionDto, RoleScope, WorkspaceStatus, MemberStatus } from '@/types/rbac'
import type { ProjectStatus, SdlcMethod, StatusCategory } from '@/types/project'
import { SDLC_TEMPLATES } from './sdlcTemplates'

// Bảng §0.2 của doc/Workspace-RBAC-API-Contract.md — giữ đúng thứ tự hiển thị.
export const PERMISSION_CATALOG: PermissionDto[] = [
  // TENANT
  { key: 'company.view', name: 'Xem thông tin công ty', group: 'Công ty', scope: 'TENANT', isSensitive: false, description: 'Xem hồ sơ công ty.' },
  { key: 'company.update', name: 'Cập nhật thông tin công ty', group: 'Công ty', scope: 'TENANT', isSensitive: true, description: 'Sửa tên, mã số thuế, địa chỉ, logo của công ty.' },
  { key: 'user.view', name: 'Xem danh sách người dùng', group: 'Người dùng', scope: 'TENANT', isSensitive: false, description: 'Xem hồ sơ và trạng thái của mọi tài khoản trong công ty.' },
  { key: 'user.invite', name: 'Mời người dùng vào công ty', group: 'Người dùng', scope: 'TENANT', isSensitive: false, description: 'Gửi email mời tham gia công ty.' },
  { key: 'user.update', name: 'Cập nhật người dùng', group: 'Người dùng', scope: 'TENANT', isSensitive: false, description: 'Cập nhật thông tin thành viên.' },
  { key: 'user.assign_role', name: 'Đổi role cấp công ty của người dùng', group: 'Người dùng', scope: 'TENANT', isSensitive: true, description: 'Gán / thu hồi role cấp công ty.' },
  { key: 'user.deactivate', name: 'Vô hiệu hoá / kích hoạt tài khoản', group: 'Người dùng', scope: 'TENANT', isSensitive: true, description: 'Khoá đăng nhập của nhân viên đã nghỉ.' },
  { key: 'role.view', name: 'Xem danh mục role', group: 'Role & Phân quyền', scope: 'TENANT', isSensitive: false, description: 'Xem role và ma trận quyền của công ty.' },
  { key: 'role.manage', name: 'Tạo / sửa / bật-tắt role và quyền của role', group: 'Role & Phân quyền', scope: 'TENANT', isSensitive: true, description: 'Định nghĩa role mới và chọn quyền cho từng role.' },
  { key: 'workspace.create', name: 'Tạo workspace mới', group: 'Workspace', scope: 'TENANT', isSensitive: false, description: 'Khởi tạo không gian làm việc mới trong công ty.' },
  { key: 'workspace.view_all', name: 'Xem mọi workspace trong công ty', group: 'Workspace', scope: 'TENANT', isSensitive: false, description: 'Thấy cả workspace mình không phải thành viên (chỉ xem).' },
  { key: 'audit.view', name: 'Xem nhật ký hệ thống (Audit Log)', group: 'Bảo mật', scope: 'TENANT', isSensitive: true, description: 'Xem lịch sử thao tác quản trị.' },
  // WORKSPACE
  { key: 'workspace.view', name: 'Xem thông tin workspace', group: 'Workspace', scope: 'WORKSPACE', isSensitive: false, description: null },
  { key: 'workspace.update', name: 'Sửa tên / mã / mô tả workspace', group: 'Workspace', scope: 'WORKSPACE', isSensitive: false, description: null },
  { key: 'workspace.archive', name: 'Lưu trữ / khôi phục workspace', group: 'Workspace', scope: 'WORKSPACE', isSensitive: true, description: 'Chuyển toàn bộ dữ liệu workspace sang chỉ đọc.' },
  { key: 'workspace.member.view', name: 'Xem thành viên workspace', group: 'Thành viên', scope: 'WORKSPACE', isSensitive: false, description: null },
  { key: 'workspace.member.manage', name: 'Thêm / gỡ / đổi role thành viên workspace', group: 'Thành viên', scope: 'WORKSPACE', isSensitive: true, description: null },
  { key: 'workspace.member.assign_role', name: 'Gán role cho thành viên workspace', group: 'Thành viên', scope: 'WORKSPACE', isSensitive: true, description: null },
  { key: 'project.create', name: 'Tạo dự án trong workspace', group: 'Dự án', scope: 'WORKSPACE', isSensitive: false, description: 'Vai trò "Project Initiator" trong SRS.' },
  { key: 'project.inherit_access', name: 'Xem mọi dự án trong workspace', group: 'Dự án', scope: 'WORKSPACE', isSensitive: false, description: null },
  // PROJECT
  { key: 'project.view', name: 'Xem dự án và thành viên dự án', group: 'Dự án', scope: 'PROJECT', isSensitive: false, description: null },
  { key: 'project.update', name: 'Sửa tên / mô tả dự án & bật/tắt AI', group: 'Dự án', scope: 'PROJECT', isSensitive: false, description: null },
  { key: 'project.archive', name: 'Lưu trữ / khôi phục dự án', group: 'Dự án', scope: 'PROJECT', isSensitive: true, description: 'Đóng băng mọi tài liệu / issue sang chỉ đọc.' },
  { key: 'project.member.manage', name: 'Thêm / gỡ / đổi role thành viên dự án', group: 'Thành viên dự án', scope: 'PROJECT', isSensitive: true, description: null },
  { key: 'project.workflow.view', name: 'Xem cấu hình workflow', group: 'Workflow', scope: 'PROJECT', isSensitive: false, description: null },
  { key: 'project.workflow.manage', name: 'Cấu hình phase, trạng thái, luồng chuyển', group: 'Workflow', scope: 'PROJECT', isSensitive: true, description: 'Thêm / sửa phase, trạng thái và transition rule (UC-44~50).' },
  { key: 'project.workflow.transition.manage', name: 'Quản lý luật chuyển trạng thái', group: 'Workflow', scope: 'PROJECT', isSensitive: true, description: null },
  { key: 'issue.view', name: 'Xem issue', group: 'Issue', scope: 'PROJECT', isSensitive: false, description: null },
  { key: 'issue.create', name: 'Tạo issue', group: 'Issue', scope: 'PROJECT', isSensitive: false, description: null },
  { key: 'issue.update', name: 'Cập nhật issue', group: 'Issue', scope: 'PROJECT', isSensitive: false, description: null },
  { key: 'issue.assign', name: 'Phân công issue', group: 'Issue', scope: 'PROJECT', isSensitive: false, description: null },
  { key: 'issue.change_status', name: 'Chuyển trạng thái issue', group: 'Issue', scope: 'PROJECT', isSensitive: false, description: null },
  { key: 'issue.delete', name: 'Xoá issue', group: 'Issue', scope: 'PROJECT', isSensitive: true, description: null },
  { key: 'document.view', name: 'Xem tài liệu yêu cầu', group: 'Tài liệu', scope: 'PROJECT', isSensitive: false, description: null },
  { key: 'document.edit', name: 'Chỉnh sửa tài liệu yêu cầu', group: 'Tài liệu', scope: 'PROJECT', isSensitive: false, description: null },
  { key: 'document.approve', name: 'Phê duyệt tài liệu yêu cầu', group: 'Tài liệu', scope: 'PROJECT', isSensitive: true, description: null },
  { key: 'document.revise', name: 'Tạo phiên bản tài liệu mới', group: 'Tài liệu', scope: 'PROJECT', isSensitive: false, description: null },
  { key: 'document.delete', name: 'Xoá tài liệu yêu cầu', group: 'Tài liệu', scope: 'PROJECT', isSensitive: true, description: null },
  { key: 'figma.create', name: 'Kết nối thiết kế Figma', group: 'Figma', scope: 'PROJECT', isSensitive: false, description: null },
  { key: 'figma.update', name: 'Đồng bộ thiết kế Figma', group: 'Figma', scope: 'PROJECT', isSensitive: false, description: null },
  { key: 'figma.archive', name: 'Lưu trữ liên kết Figma', group: 'Figma', scope: 'PROJECT', isSensitive: false, description: null },
  { key: 'testcase.view', name: 'Xem testcase', group: 'Testcase', scope: 'PROJECT', isSensitive: false, description: null },
  { key: 'testcase.manage', name: 'Tạo / sửa / xoá testcase', group: 'Testcase', scope: 'PROJECT', isSensitive: false, description: null },
  { key: 'comment.view', name: 'Xem bình luận', group: 'Tương tác', scope: 'PROJECT', isSensitive: false, description: null },
  { key: 'comment.write', name: 'Viết bình luận', group: 'Tương tác', scope: 'PROJECT', isSensitive: false, description: null },
  { key: 'activity.view', name: 'Xem lịch sử hoạt động', group: 'Tương tác', scope: 'PROJECT', isSensitive: false, description: null },
  { key: 'ai.use', name: 'Sử dụng trợ lý AI', group: 'AI', scope: 'PROJECT', isSensitive: false, description: null },
]

export const keysOfScope = (scope: RoleScope) => PERMISSION_CATALOG.filter((p) => p.scope === scope).map((p) => p.key)

export interface MockUser {
  id: number
  fullName: string
  email: string
  password: string
}

export interface MockRole {
  id: number
  companyId: number
  code: string | null
  name: string
  description: string | null
  scope: RoleScope
  isSystem: boolean
  isLocked: boolean
  isActive: boolean
  permissionKeys: string[]
  createdAt: string
  updatedAt: string
}

export interface MockCompanyMember {
  companyId: number
  userId: number
  roleId: number
  status: MemberStatus
  joinedAt: string
}

export interface MockWorkspace {
  id: number
  companyId: number | null
  name: string
  code: string
  description: string | null
  createdBy: number
  status: WorkspaceStatus
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}

export interface MockWorkspaceMember {
  workspaceId: number
  userId: number
  roleId: number
  isActive: boolean
  joinedAt: string
}

export interface MockProject {
  id: number
  workspaceId: number
  key: string
  name: string
  description: string | null
  sdlcMethod: SdlcMethod
  aiEnabled: boolean
  status: ProjectStatus
  createdBy: number
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}

export interface MockProjectMember {
  projectId: number
  userId: number
  roleId: number
  isActive: boolean
  joinedAt: string
}

export interface MockPhase {
  id: number
  projectId: number
  name: string
  description: string | null
  position: number
  isActive: boolean
}

export interface MockStatus {
  id: number
  projectId: number
  phaseId: number
  name: string
  category: StatusCategory
  color: string | null
  description: string | null
  isInitial: boolean
  position: number
  isActive: boolean
}

export interface MockTransition {
  id: number
  projectId: number
  phaseId: number
  fromStatusId: number
  toStatusId: number
  allowedRoleIds: number[]
  requireComment: boolean
  commentHint: string | null
  condition: string | null
}

export interface MockDb {
  seq: number
  users: MockUser[]
  companies: { id: number; name: string }[]
  roles: MockRole[]
  companyMembers: MockCompanyMember[]
  workspaces: MockWorkspace[]
  workspaceMembers: MockWorkspaceMember[]
  projects: MockProject[]
  projectMembers: MockProjectMember[]
  phases: MockPhase[]
  statuses: MockStatus[]
  transitions: MockTransition[]
}

export const MOCK_PASSWORD = 'Password@123'

const at = (date: string) => `${date}T08:00:00.000Z`

function role(
  id: number,
  code: string | null,
  name: string,
  scope: RoleScope,
  permissionKeys: string[],
  extra: Partial<MockRole> = {},
): MockRole {
  return {
    id,
    companyId: 1,
    code,
    name,
    description: null,
    scope,
    isSystem: false,
    isLocked: false,
    isActive: true,
    permissionKeys,
    createdAt: at('2026-09-12'),
    updatedAt: at('2026-09-12'),
    ...extra,
  }
}

/** Sinh phase / trạng thái / transition từ 1 mẫu SDLC cho 1 dự án (dùng cho seed). */
export function instantiateTemplate(db: MockDb, projectId: number, method: SdlcMethod) {
  const template = SDLC_TEMPLATES.find((t) => t.method === method)!
  const roleIdOf = (code: string) => db.roles.find((r) => r.companyId === 1 && r.code === code)?.id
  template.phases.forEach((tp, phaseIndex) => {
    const phaseId = ++db.seq
    db.phases.push({ id: phaseId, projectId, name: tp.name, description: tp.description, position: phaseIndex + 1, isActive: true })
    const idOfKey = new Map<string, number>()
    tp.statuses.forEach((ts, i) => {
      const id = ++db.seq
      idOfKey.set(ts.key, id)
      db.statuses.push({
        id,
        projectId,
        phaseId,
        name: ts.name,
        category: ts.category,
        color: ts.color,
        description: ts.description,
        isInitial: ts.isInitial,
        position: i + 1,
        isActive: true,
      })
    })
    for (const tt of tp.transitions) {
      db.transitions.push({
        id: ++db.seq,
        projectId,
        phaseId,
        fromStatusId: idOfKey.get(tt.from)!,
        toStatusId: idOfKey.get(tt.to)!,
        allowedRoleIds: tt.allowedRoleCodes.map(roleIdOf).filter((x): x is number => x !== undefined),
        requireComment: tt.requireComment,
        commentHint: tt.commentHint,
        condition: tt.condition,
      })
    }
  })
}

const PROJECT_VIEW = ['project.view', 'project.workflow.view']

export function createSeed(): MockDb {
  const users: MockUser[] = [
    { id: 1, fullName: 'Sarah Lin', email: 'sarah@fintechcorp.com', password: MOCK_PASSWORD },
    { id: 2, fullName: 'Phạm Văn Khoa', email: 'khoa@fintechcorp.com', password: MOCK_PASSWORD },
    { id: 3, fullName: 'Vũ Kim Kỳ', email: 'ky@fintechcorp.com', password: MOCK_PASSWORD },
    { id: 4, fullName: 'Phạm Minh Lương', email: 'luong@fintechcorp.com', password: MOCK_PASSWORD },
    { id: 5, fullName: 'Trương Quang Tâm', email: 'tam@fintechcorp.com', password: MOCK_PASSWORD },
    { id: 6, fullName: 'Phạm Công Minh', email: 'minh@fintechcorp.com', password: MOCK_PASSWORD },
    { id: 7, fullName: 'Đặng Thu Trang', email: 'trang@fintechcorp.com', password: MOCK_PASSWORD },
    { id: 8, fullName: 'Hoàng Minh Quân', email: 'quan@fintechcorp.com', password: MOCK_PASSWORD },
  ]

  // Role hệ thống theo §0.3 (id 1–10) + vài role tự tạo (11+).
  const roles: MockRole[] = [
    role(1, 'TENANT_ADMIN', 'Tenant Admin', 'TENANT', keysOfScope('TENANT'), {
      isSystem: true,
      isLocked: true,
      description: 'Toàn quyền cấu hình tổ chức và bảo mật. Gán cho người tạo công ty.',
    }),
    role(2, 'MEMBER', 'Member', 'TENANT', ['company.view', 'user.view'], { isSystem: true, description: 'Thành viên cơ bản của công ty, mặc định khi được mời.' }),
    role(3, 'WORKSPACE_ADMIN', 'Workspace Admin', 'WORKSPACE', keysOfScope('WORKSPACE'), {
      isSystem: true,
      isLocked: true,
      description: 'Quản trị workspace và mọi dự án bên trong. Gán cho người tạo workspace.',
    }),
    role(4, 'PROJECT_INITIATOR', 'Project Initiator', 'WORKSPACE', ['workspace.view', 'workspace.member.view', 'project.create', 'project.inherit_access'], {
      isSystem: true,
      description: 'Được khởi tạo dự án mới trong workspace (actor "Project Initiator" của SRS).',
    }),
    role(5, 'WORKSPACE_MEMBER', 'Workspace Member', 'WORKSPACE', ['workspace.view', 'workspace.member.view', 'project.inherit_access'], {
      isSystem: true,
      description: 'Thành viên mặc định khi được thêm vào workspace.',
    }),
    role(6, 'PROJECT_MANAGER', 'Project Manager', 'PROJECT', keysOfScope('PROJECT'), {
      isSystem: true,
      isLocked: true,
      description: 'Khởi tạo Sprint, cấu hình Phase SDLC, duyệt thành viên dự án. Gán cho người tạo dự án.',
    }),
    role(7, 'TECH_LEAD', 'Tech Lead', 'PROJECT', PROJECT_VIEW, { isSystem: true, description: 'Dẫn dắt kỹ thuật, duyệt code review.' }),
    role(8, 'BA', 'Business Analyst', 'PROJECT', PROJECT_VIEW, { isSystem: true, description: 'Soạn thảo đặc tả SRS, quản lý khối yêu cầu và backlog.' }),
    role(9, 'DEVELOPER', 'Developer', 'PROJECT', PROJECT_VIEW, { isSystem: true, description: 'Lập trình, nhận issue, chuyển trạng thái theo luồng kỹ thuật.' }),
    role(10, 'QA', 'QA / Tester', 'PROJECT', PROJECT_VIEW, { isSystem: true, description: 'Kiểm thử, xác nhận Definition of Done.' }),
    role(11, 'TEAM_LEAD', 'Trưởng nhóm', 'TENANT', ['company.view', 'user.view', 'user.invite', 'workspace.create'], {
      description: 'Được tạo workspace mới và mời người vào công ty.',
    }),
    role(12, 'AUDITOR', 'Kiểm toán viên', 'TENANT', ['company.view', 'user.view', 'role.view', 'workspace.view_all'], {
      isActive: false,
      description: 'Chỉ xem, phục vụ kiểm toán nội bộ. Đang tắt.',
    }),
    role(13, 'EXTERNAL_REVIEWER', 'External Reviewer', 'PROJECT', PROJECT_VIEW, {
      description: 'Chuyên gia bên ngoài, đánh giá kiến trúc và phản biện tài liệu.',
    }),
  ]

  const companyMembers: MockCompanyMember[] = [
    { companyId: 1, userId: 1, roleId: 1, status: 'ACTIVE', joinedAt: at('2026-09-12') },
    { companyId: 1, userId: 2, roleId: 11, status: 'ACTIVE', joinedAt: at('2026-09-12') },
    { companyId: 1, userId: 3, roleId: 2, status: 'ACTIVE', joinedAt: at('2026-09-13') },
    { companyId: 1, userId: 4, roleId: 2, status: 'ACTIVE', joinedAt: at('2026-09-13') },
    { companyId: 1, userId: 5, roleId: 2, status: 'ACTIVE', joinedAt: at('2026-09-13') },
    { companyId: 1, userId: 6, roleId: 2, status: 'ACTIVE', joinedAt: at('2026-09-15') },
    { companyId: 1, userId: 7, roleId: 2, status: 'ACTIVE', joinedAt: at('2026-09-16') },
    { companyId: 1, userId: 8, roleId: 2, status: 'DEACTIVATED', joinedAt: at('2026-09-16') },
  ]

  const ws = (id: number, name: string, code: string, description: string, createdBy: number, created: string, updated: string, archived = false): MockWorkspace => ({
    id,
    companyId: 1,
    name,
    code,
    description,
    createdBy,
    status: archived ? 'ARCHIVED' : 'ACTIVE',
    createdAt: at(created),
    updatedAt: at(updated),
    archivedAt: archived ? at(updated) : null,
  })

  const workspaces: MockWorkspace[] = [
    ws(10, 'Mobile Banking Revamp', 'mobile-banking-revamp', 'Tái thiết kế app ngân hàng di động, Q1–Q2 2026', 2, '2026-09-12', '2026-10-09'),
    ws(11, 'Internal Portal v2', 'internal-portal-v2', 'Cổng thông tin nội bộ cho nhân viên', 1, '2026-09-14', '2026-10-08'),
    ws(12, 'Legacy Core Banking', 'legacy-core-banking', 'Hệ thống cũ, đã chuyển sang chỉ đọc', 1, '2026-09-12', '2026-10-01', true),
  ]

  const wm = (workspaceId: number, userId: number, roleId: number, joined: string): MockWorkspaceMember => ({
    workspaceId,
    userId,
    roleId,
    isActive: true,
    joinedAt: at(joined),
  })

  const workspaceMembers: MockWorkspaceMember[] = [
    wm(10, 2, 3, '2026-09-12'), // Khoa — Workspace Admin
    wm(10, 3, 4, '2026-09-13'), // Kỳ — Project Initiator
    wm(10, 4, 5, '2026-09-13'), // Lương — Workspace Member
    wm(10, 5, 5, '2026-09-13'), // Tâm — Workspace Member
    wm(11, 1, 3, '2026-09-14'),
    wm(11, 3, 5, '2026-09-15'), // Kỳ — 1 người, role khác ở workspace khác
    wm(11, 7, 5, '2026-09-16'),
    wm(12, 1, 3, '2026-09-12'),
  ]

  const db: MockDb = {
    seq: 100,
    users,
    companies: [{ id: 1, name: 'Acme Fintech Corp' }],
    roles,
    companyMembers,
    workspaces,
    workspaceMembers,
    projects: [],
    projectMembers: [],
    phases: [],
    statuses: [],
    transitions: [],
  }

  const project = (
    id: number,
    workspaceId: number,
    key: string,
    name: string,
    description: string,
    sdlcMethod: SdlcMethod,
    createdBy: number,
    created: string,
    updated: string,
    members: [number, number][],
    archived = false,
  ) => {
    db.projects.push({
      id,
      workspaceId,
      key,
      name,
      description,
      sdlcMethod,
      aiEnabled: true,
      status: archived ? 'ARCHIVED' : 'ACTIVE',
      createdBy,
      createdAt: at(created),
      updatedAt: at(updated),
      archivedAt: archived ? at(updated) : null,
    })
    for (const [userId, roleId] of members) {
      db.projectMembers.push({ projectId: id, userId, roleId, isActive: true, joinedAt: at(created) })
    }
    instantiateTemplate(db, id, sdlcMethod)
  }

  project(20, 10, 'CORE', 'Lõi tài khoản & KYC', 'Mở tài khoản, eKYC và quản lý hồ sơ khách hàng', 'CUSTOM', 2, '2026-09-12', '2026-10-09', [[2, 6], [4, 9], [5, 10]])
  project(21, 10, 'PAY', 'Thanh toán & QR', 'Thanh toán QR, chuyển khoản nhanh 24/7', 'KANBAN', 3, '2026-09-15', '2026-10-08', [[3, 6], [4, 9]])
  project(22, 10, 'NOTIF', 'Thông báo đẩy', 'Push notification & in-app message', 'SCRUM', 2, '2026-09-18', '2026-10-07', [[2, 6], [5, 10]])
  project(23, 10, 'RPT', 'Báo cáo & Đối soát', 'Báo cáo giao dịch và đối soát cuối ngày', 'CUSTOM', 3, '2026-09-13', '2026-10-02', [[3, 6]], true)
  project(24, 11, 'PORTAL', 'Cổng thông tin nội bộ', 'Tin tức, quy trình và biểu mẫu nội bộ', 'KANBAN', 1, '2026-09-14', '2026-10-08', [[1, 6], [7, 9]])

  return db
}
