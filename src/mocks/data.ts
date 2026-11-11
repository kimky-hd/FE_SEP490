// Dữ liệu mock cho Workspace / RBAC / Project — chỉ dùng khi VITE_USE_MOCK=true. Có state thật (lưu localStorage) để
// tạo role / đổi quyền / tạo dự án xong reload vẫn còn, và để test được ẩn/hiện + 403 theo từng người dùng.

import type { PermissionDto, RoleKind, RoleScope, WorkspaceStatus, MemberStatus } from '@/types/rbac'
import type { GateCriterion } from '@/lib/phaseGates'
import type { PhaseLifecycleStatus, ProjectStatus, SdlcMethod, StatusCategory } from '@/types/project'
import { SDLC_TEMPLATES } from './sdlcTemplates'

// Bảng §0.2 của doc/Workspace-RBAC-API-Contract.md — giữ đúng thứ tự hiển thị + 3 quyền mới của Kanban / Test cases v2.
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
  { key: 'sprint.manage', name: 'Tạo / chạy / hoàn tất sprint', group: 'Issue', scope: 'PROJECT', isSensitive: false, description: 'Khởi tạo, bắt đầu và đóng Sprint trong Kanban/Scrum.' },
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
  { key: 'testcase.execute', name: 'Ghi kết quả chạy testcase', group: 'Testcase', scope: 'PROJECT', isSensitive: false, description: 'Chấm Pass / Fail / N/A trên từng môi trường SIT / UAT / Staging.' },
  { key: 'testcase.plan', name: 'Thiết lập đợt test & bàn giao', group: 'Testcase', scope: 'PROJECT', isSensitive: false, description: 'Tạo đợt test, môi trường, module từ tài liệu, phân công QA và bàn giao.' },
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
  kind?: RoleKind
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
  exitCriteria?: GateCriterion[]
  lifecycleStatus?: PhaseLifecycleStatus
  completedAt?: string | null
  completedBy?: number | null
  overrideReason?: string | null
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
export function instantiateTemplate(
  db: MockDb,
  projectId: number,
  method: SdlcMethod,
  activePhasePosition = 1,
  completedByUserId = 6,
) {
  const template = SDLC_TEMPLATES.find((t) => t.method === method) ?? SDLC_TEMPLATES[0]
  const roleIdOf = (code: string) => db.roles.find((r) => r.companyId === 1 && r.code === code)?.id
  template.phases.forEach((tp, phaseIndex) => {
    const pos = phaseIndex + 1
    const phaseId = ++db.seq
    const lifecycleStatus: PhaseLifecycleStatus =
      pos < activePhasePosition ? 'COMPLETED' : pos === activePhasePosition ? 'ACTIVE' : 'UPCOMING'
    db.phases.push({
      id: phaseId,
      projectId,
      name: tp.name,
      description: tp.description,
      position: pos,
      isActive: true,
      exitCriteria: tp.exitCriteria ? ([...tp.exitCriteria] as GateCriterion[]) : ['ISSUES_DONE'],
      lifecycleStatus,
      completedAt: lifecycleStatus === 'COMPLETED' ? at('2026-10-18') : null,
      completedBy: lifecycleStatus === 'COMPLETED' ? completedByUserId : null,
      overrideReason: null,
    })
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

const TECH_LEAD_PERMS = [
  ...PROJECT_VIEW,
  'project.workflow.manage',
  'project.workflow.transition.manage',
  'sprint.manage',
  'issue.view',
  'issue.create',
  'issue.update',
  'issue.assign',
  'issue.change_status',
  'issue.delete',
  'document.view',
  'document.edit',
  'document.approve',
  'document.revise',
  'figma.create',
  'figma.update',
  'testcase.view',
  'testcase.manage',
  'testcase.execute',
  'testcase.plan',
  'comment.view',
  'comment.write',
  'activity.view',
  'ai.use',
]

const BA_PERMS = [
  ...PROJECT_VIEW,
  'document.view',
  'document.edit',
  'document.approve',
  'document.revise',
  'issue.view',
  'issue.create',
  'issue.update',
  'issue.assign',
  'issue.change_status',
  'figma.create',
  'figma.update',
  'testcase.view',
  'testcase.manage',
  'comment.view',
  'comment.write',
  'activity.view',
  'ai.use',
]

const DEV_PERMS = [
  ...PROJECT_VIEW,
  'document.view',
  'issue.view',
  'issue.create',
  'issue.update',
  'issue.change_status',
  'figma.update',
  'testcase.view',
  'comment.view',
  'comment.write',
  'activity.view',
  'ai.use',
]

const QA_LEAD_PERMS = [
  ...PROJECT_VIEW,
  'document.view',
  'issue.view',
  'issue.create',
  'issue.update',
  'issue.assign',
  'issue.change_status',
  'testcase.view',
  'testcase.manage',
  'testcase.execute',
  'testcase.plan',
  'comment.view',
  'comment.write',
  'activity.view',
  'ai.use',
]

const QA_TESTER_PERMS = [
  ...PROJECT_VIEW,
  'document.view',
  'issue.view',
  'issue.create',
  'issue.update',
  'issue.change_status',
  'testcase.view',
  'testcase.execute',
  'comment.view',
  'comment.write',
  'activity.view',
]

const DESIGNER_PERMS = [
  ...PROJECT_VIEW,
  'document.view',
  'issue.view',
  'issue.create',
  'issue.update',
  'issue.change_status',
  'figma.create',
  'figma.update',
  'figma.archive',
  'testcase.view',
  'comment.view',
  'comment.write',
  'activity.view',
  'ai.use',
]

const REVIEWER_PERMS = [
  ...PROJECT_VIEW,
  'document.view',
  'issue.view',
  'testcase.view',
  'comment.view',
  'comment.write',
  'activity.view',
]

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
    { id: 9, fullName: 'Trần Thị Mai Hương', email: 'tran.c@fintechcorp.com', password: MOCK_PASSWORD },
    { id: 10, fullName: 'Nguyễn Hoàng Nam', email: 'nam@fintechcorp.com', password: MOCK_PASSWORD },
    { id: 11, fullName: 'Lê Thị Khánh Linh', email: 'linh@fintechcorp.com', password: MOCK_PASSWORD },
    { id: 12, fullName: 'Bùi Đức Duy', email: 'duy@fintechcorp.com', password: MOCK_PASSWORD },
  ]

  // Role hệ thống theo §0.3 (id 1–10) + các role chuyên biệt sát thực tế dự án Chứng khoán (11–15).
  const roles: MockRole[] = [
    role(1, 'TENANT_ADMIN', 'Tenant Admin', 'TENANT', keysOfScope('TENANT'), {
      isSystem: true,
      isLocked: true,
      kind: 'OTHER',
      description: 'Toàn quyền cấu hình tổ chức, quản lý người dùng, ma trận phân quyền RBAC và nhật ký bảo mật.',
    }),
    role(2, 'MEMBER', 'Member', 'TENANT', ['company.view', 'user.view'], {
      isSystem: true,
      kind: 'OTHER',
      description: 'Thành viên cơ bản của công ty chứng khoán, mặc định khi được mời vào tổ chức.',
    }),
    role(3, 'WORKSPACE_ADMIN', 'Workspace Admin', 'WORKSPACE', keysOfScope('WORKSPACE'), {
      isSystem: true,
      isLocked: true,
      kind: 'PM',
      description: 'Quản trị khối nghiệp vụ (Workspace) và toàn quyền trên mọi dự án bên trong.',
    }),
    role(4, 'PROJECT_INITIATOR', 'Project Initiator', 'WORKSPACE', ['workspace.view', 'workspace.member.view', 'project.create', 'project.inherit_access'], {
      isSystem: true,
      kind: 'PM',
      description: 'Được khởi tạo dự án mới trong khối nghiệp vụ (actor "Project Initiator" của SRS).',
    }),
    role(5, 'WORKSPACE_MEMBER', 'Workspace Member', 'WORKSPACE', ['workspace.view', 'workspace.member.view', 'project.inherit_access'], {
      isSystem: true,
      kind: 'OTHER',
      description: 'Thành viên mặc định khi được thêm vào không gian làm việc của khối.',
    }),
    role(6, 'PROJECT_MANAGER', 'Project Manager', 'PROJECT', keysOfScope('PROJECT'), {
      isSystem: true,
      isLocked: true,
      kind: 'PM',
      description: 'Quản trị toàn diện dự án: điều phối Sprint, chốt cổng chất lượng Phase Gate, cấu hình đợt kiểm thử và duyệt thành viên.',
    }),
    role(7, 'TECH_LEAD', 'Tech Lead', 'PROJECT', TECH_LEAD_PERMS, {
      isSystem: true,
      kind: 'DEV',
      description: 'Kiến trúc sư kỹ thuật: quản lý workflow, phê duyệt đặc tả kỹ thuật, điều phối Sprint, review code Matching Engine/KRX.',
    }),
    role(8, 'BA', 'Business Analyst', 'PROJECT', BA_PERMS, {
      isSystem: true,
      kind: 'BA',
      description: 'Phân tích nghiệp vụ chứng khoán (HOSE/HNX/VSD): soạn thảo & phê duyệt URD/SRS, tách REQ, bóc tách ghi chú bằng AI.',
    }),
    role(9, 'DEVELOPER', 'Developer', 'PROJECT', DEV_PERMS, {
      isSystem: true,
      kind: 'DEV',
      description: 'Kỹ sư phát triển phần mềm (Backend OMS/Margin & Frontend Bảng giá): nhận và xử lý issue/bug theo luồng trạng thái.',
    }),
    role(10, 'QA', 'QA Lead', 'PROJECT', QA_LEAD_PERMS, {
      isSystem: true,
      kind: 'QA',
      description: 'Trưởng nhóm Kiểm thử: thiết lập đợt test (SIT/UAT/Staging), quản lý testcase, phân công QA, sinh TC bằng AI và bàn giao.',
    }),
    role(11, 'TEAM_LEAD', 'Trưởng khối Công nghệ', 'TENANT', ['company.view', 'user.view', 'user.invite', 'workspace.create', 'workspace.view_all'], {
      kind: 'PM',
      description: 'Được khởi tạo các khối nghiệp vụ (Workspace), xem tổng thể các khối và mời nhân sự mới vào công ty.',
    }),
    role(12, 'AUDITOR', 'Kiểm toán & Pháp chế UBCKNN', 'TENANT', ['company.view', 'user.view', 'role.view', 'workspace.view_all', 'audit.view'], {
      isActive: true,
      kind: 'OTHER',
      description: 'Kiểm soát nội bộ & Tuân thủ UBCKNN: chỉ xem toàn bộ workspace, dự án và nhật ký hệ thống phục vụ thanh tra.',
    }),
    role(13, 'EXTERNAL_REVIEWER', 'Compliance Reviewer', 'PROJECT', REVIEWER_PERMS, {
      kind: 'OTHER',
      description: 'Chuyên gia Kiểm soát Rủi ro / Pháp chế dự án: chỉ xem đặc tả, tiến độ Kanban, kết quả Test và viết bình luận phản biện.',
    }),
    role(14, 'DESIGNER', 'UI/UX Designer', 'PROJECT', DESIGNER_PERMS, {
      kind: 'DESIGNER',
      description: 'Thiết kế giao diện Bảng giá Lightning & App ProTrading, đồng bộ frame Figma và xử lý công việc DESIGN.',
    }),
    role(15, 'QA_TESTER', 'QA / Tester', 'PROJECT', QA_TESTER_PERMS, {
      kind: 'QA',
      description: 'Chuyên viên Kiểm thử thực thi: chạy kịch bản kiểm thử trên SIT/UAT, chấm kết quả Pass/Fail và tạo Bug lên Kanban.',
    }),
  ]

  const companyMembers: MockCompanyMember[] = [
    { companyId: 1, userId: 1, roleId: 1, status: 'ACTIVE', joinedAt: at('2026-09-12') },  // Sarah Lin — Tenant Admin
    { companyId: 1, userId: 2, roleId: 11, status: 'ACTIVE', joinedAt: at('2026-09-12') }, // Phạm Văn Khoa — Trưởng khối Công nghệ
    { companyId: 1, userId: 3, roleId: 11, status: 'ACTIVE', joinedAt: at('2026-09-13') }, // Vũ Kim Kỳ — Trưởng khối / PM
    { companyId: 1, userId: 4, roleId: 2, status: 'ACTIVE', joinedAt: at('2026-09-13') },  // Phạm Minh Lương — Senior Backend Dev
    { companyId: 1, userId: 5, roleId: 2, status: 'ACTIVE', joinedAt: at('2026-09-13') },  // Trương Quang Tâm — QA Lead
    { companyId: 1, userId: 6, roleId: 2, status: 'ACTIVE', joinedAt: at('2026-09-15') },  // Phạm Công Minh — Lead BA
    { companyId: 1, userId: 7, roleId: 2, status: 'ACTIVE', joinedAt: at('2026-09-16') },  // Đặng Thu Trang — Tech Lead
    { companyId: 1, userId: 8, roleId: 2, status: 'ACTIVE', joinedAt: at('2026-09-16') },  // Hoàng Minh Quân — UI/UX Designer
    { companyId: 1, userId: 9, roleId: 12, status: 'ACTIVE', joinedAt: at('2026-09-17') }, // Trần Thị Mai Hương — Kiểm toán & Pháp chế UBCKNN
    { companyId: 1, userId: 10, roleId: 2, status: 'ACTIVE', joinedAt: at('2026-09-18') }, // Nguyễn Hoàng Nam — Frontend Dev
    { companyId: 1, userId: 11, roleId: 2, status: 'ACTIVE', joinedAt: at('2026-09-18') }, // Lê Thị Khánh Linh — QA / Tester
    { companyId: 1, userId: 12, roleId: 2, status: 'ACTIVE', joinedAt: at('2026-09-19') }, // Bùi Đức Duy — Business Analyst
  ]

  const ws = (
    id: number,
    name: string,
    code: string,
    description: string,
    createdBy: number,
    created: string,
    updated: string,
    archived = false,
  ): MockWorkspace => ({
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
    ws(
      10,
      'Khối Giao dịch Chứng khoán & Ký quỹ (Core Trading & Margin)',
      'core-trading-krx',
      'Hệ thống OMS Đặt lệnh Cổ phiếu/Phái sinh kết nối Sở GDCK (HOSE/HNX/UPCoM - KRX), Quản trị Rủi ro Ký quỹ (Margin) và Bảng giá Thời gian thực',
      2,
      '2026-09-12',
      '2026-11-05',
    ),
    ws(
      11,
      'Khối Mở Tài khoản eKYC, Lưu ký VSD & Cổng Giao dịch Số',
      'wealth-custody-vsd',
      'Nền tảng Mở tài khoản Chứng khoán eKYC NFC, Nộp/Rút tiền Định danh VietQR 24/7, Đối soát Lưu ký VSD T+2 và Quản lý Quyền Cổ đông',
      1,
      '2026-09-14',
      '2026-11-04',
    ),
    ws(
      12,
      'Hệ thống Lưu ký & Back-Office Thế hệ cũ (Legacy T+3)',
      'legacy-bo-custody',
      'Hệ thống Đối soát Sổ cái Lưu ký và Báo cáo Thanh toán Bù trừ T+3 cũ — Đã đóng băng lưu trữ chỉ đọc sau khi chuyển đổi sang nền tảng KRX',
      1,
      '2026-09-12',
      '2026-10-01',
      true,
    ),
  ]

  const wm = (workspaceId: number, userId: number, roleId: number, joined: string): MockWorkspaceMember => ({
    workspaceId,
    userId,
    roleId,
    isActive: true,
    joinedAt: at(joined),
  })

  const workspaceMembers: MockWorkspaceMember[] = [
    // Workspace 10: Core Trading & Margin — đầy đủ các vai trò
    wm(10, 1, 3, '2026-09-12'),  // Sarah Lin — Workspace Admin
    wm(10, 2, 3, '2026-09-12'),  // Phạm Văn Khoa — Workspace Admin
    wm(10, 3, 4, '2026-09-13'),  // Vũ Kim Kỳ — Project Initiator
    wm(10, 4, 5, '2026-09-13'),  // Phạm Minh Lương — Workspace Member (Senior Backend Dev)
    wm(10, 5, 5, '2026-09-13'),  // Trương Quang Tâm — Workspace Member (QA Lead)
    wm(10, 6, 5, '2026-09-15'),  // Phạm Công Minh — Workspace Member (Lead BA)
    wm(10, 7, 5, '2026-09-16'),  // Đặng Thu Trang — Workspace Member (Tech Lead)
    wm(10, 8, 5, '2026-09-16'),  // Hoàng Minh Quân — Workspace Member (UI/UX Designer)
    wm(10, 9, 5, '2026-09-17'),  // Trần Thị Mai Hương — Workspace Member (Compliance Reviewer)
    wm(10, 10, 5, '2026-09-18'), // Nguyễn Hoàng Nam — Workspace Member (Frontend Dev)
    wm(10, 11, 5, '2026-09-18'), // Lê Thị Khánh Linh — Workspace Member (QA / Tester)
    wm(10, 12, 5, '2026-09-19'), // Bùi Đức Duy — Workspace Member (BA)
    // Workspace 11: Wealth, eKYC & Custody VSD
    wm(11, 1, 3, '2026-09-14'),  // Sarah Lin — Workspace Admin
    wm(11, 2, 4, '2026-09-15'),  // Phạm Văn Khoa — Project Initiator
    wm(11, 3, 4, '2026-09-15'),  // Vũ Kim Kỳ — Project Initiator
    wm(11, 4, 5, '2026-09-16'),  // Phạm Minh Lương — Dev
    wm(11, 5, 5, '2026-09-16'),  // Trương Quang Tâm — QA Lead
    wm(11, 6, 5, '2026-09-16'),  // Phạm Công Minh — Lead BA
    wm(11, 7, 5, '2026-09-16'),  // Đặng Thu Trang — Tech Lead
    wm(11, 8, 5, '2026-09-16'),  // Hoàng Minh Quân — UI/UX Designer
    wm(11, 9, 5, '2026-09-17'),  // Trần Thị Mai Hương — Compliance Reviewer
    wm(11, 10, 5, '2026-09-18'), // Nguyễn Hoàng Nam — Frontend Dev
    wm(11, 11, 5, '2026-09-18'), // Lê Thị Khánh Linh — QA / Tester
    wm(11, 12, 5, '2026-09-19'), // Bùi Đức Duy — BA
    // Workspace 12 (Archived)
    wm(12, 1, 3, '2026-09-12'),
    wm(12, 9, 5, '2026-09-17'),
  ]

  const db: MockDb = {
    seq: 100,
    users,
    companies: [{ id: 1, name: 'SSI – Kibo Securities & FinTech Corp' }],
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
    activePhasePosition = 3,
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
    instantiateTemplate(db, id, sdlcMethod, activePhasePosition, 6)
  }

  // Đội ngũ đầy đủ 12 thành viên với phân quyền sát thực tế cho các dự án Chứng khoán:
  // PM (6), Tech Lead (7), BA (8), Developer (9), QA Lead (10), Compliance Reviewer (13), UI/UX Designer (14), QA/Tester (15)
  const fullSecuritiesTeam: [number, number][] = [
    [3, 6],   // Vũ Kim Kỳ — Project Manager (Lead)
    [2, 6],   // Phạm Văn Khoa — Project Manager
    [1, 6],   // Sarah Lin — Project Manager / CTO
    [7, 7],   // Đặng Thu Trang — Tech Lead / Solution Architect
    [6, 8],   // Phạm Công Minh — Lead Business Analyst (BA)
    [12, 8],  // Bùi Đức Duy — Business Analyst (BA)
    [4, 9],   // Phạm Minh Lương — Senior Backend Developer
    [10, 9],  // Nguyễn Hoàng Nam — Frontend Developer
    [5, 10],  // Trương Quang Tâm — QA Lead (testcase.plan + testcase.manage + testcase.execute)
    [11, 15], // Lê Thị Khánh Linh — QA / Tester (testcase.execute + issue.create)
    [8, 14],  // Hoàng Minh Quân — Product UI/UX Designer
    [9, 13],  // Trần Thị Mai Hương — Compliance Reviewer (Chỉ xem & bình luận)
  ]

  project(
    20,
    10,
    'OMS',
    'Hệ thống Đặt lệnh & Khớp lệnh Chứng khoán KRX (Order Management System)',
    'Xử lý đặt lệnh LO/MP/ATO/ATC/PLO & Lô lẻ trên HOSE/HNX/UPCoM, kiểm tra sức mua (Buying Power) thời gian thực, kết nối cổng FIX 4.4 Sở GDCK và Nộp tiền chứng khoán qua VietQR Napas247',
    'SCRUM',
    3,
    '2026-09-12',
    '2026-11-06',
    fullSecuritiesTeam,
    3, // Đang ở Phase 3: Sprint Execution & Coding (Phase 1 & 2 đã COMPLETED)
  )

  project(
    21,
    10,
    'MARGIN',
    'Quản trị Giao dịch Ký quỹ, Cảnh báo Call Margin & Force Sell Tự động',
    'Tính toán tỷ lệ ký quỹ thực tế (RTT), quản lý danh mục cổ phiếu cho vay (Marginable List), cảnh báo Call Margin đa kênh và tự động kích hoạt lệnh giải chấp (Force Sell) khi chạm ngưỡng xử lý',
    'SCRUM',
    2,
    '2026-09-15',
    '2026-11-05',
    fullSecuritiesTeam,
    3, // Đang ở Phase 3: Sprint Execution & Coding
  )

  project(
    22,
    10,
    'PRICE',
    'Bảng giá Chứng khoán Lightning (WebSocket) & Cảnh báo Tín hiệu AI',
    'Streaming dữ liệu thị trường độ trễ dưới 50ms (Top 10 bước giá, Khớp lệnh theo lô, Đồ thị TradingView, Dòng tiền khối ngoại) và bộ lọc cổ phiếu đột biến khối lượng bằng AI',
    'KANBAN',
    2,
    '2026-09-18',
    '2026-11-04',
    fullSecuritiesTeam,
    2, // Đang ở Phase 2: Continuous Dev & QA Flow
  )

  project(
    25,
    11,
    'VSD',
    'Lưu ký VSD, Thanh toán Bù trừ T+2 & Thực hiện Quyền Cổ đông',
    'Hạch toán thanh toán bù trừ tiền/cổ phiếu chu kỳ T+1.5/T+2 với Tổng Công ty Lưu ký (VSDC), ứng trước tiền bán chứng khoán tự động và phân bổ cổ tức/quyền mua phát hành thêm',
    'CUSTOM',
    3,
    '2026-09-22',
    '2026-11-03',
    fullSecuritiesTeam,
    3, // Đang ở Phase 3: Sprint Execution & Coding
  )

  project(
    24,
    11,
    'EKYC',
    'Mở Tài khoản Chứng khoán eKYC NFC & Hợp đồng Ký quỹ Điện tử',
    'Định danh khách hàng bằng CCCD gắn chip (NFC RAR Bộ Công An), Liveness Detection chống giả mạo, sinh số tài khoản lưu ký tự động và ký số Hợp đồng Mở tài khoản / Margin',
    'KANBAN',
    1,
    '2026-09-14',
    '2026-11-02',
    fullSecuritiesTeam,
    2, // Đang ở Phase 2: Continuous Dev & QA Flow
  )

  project(
    23,
    10,
    'CAR',
    'Báo cáo Tỷ lệ An toàn Tài chính (CAR) & Giám sát Giao dịch UBCKNN',
    'Hệ thống tổng hợp báo cáo tỷ lệ vốn khả dụng (CAR >= 180%), báo cáo giao dịch cổ đông nội bộ và đối chiếu sổ cái cuối ngày theo Thông tư 91/2020/TT-BTC (Đã đóng băng)',
    'CUSTOM',
    3,
    '2026-09-13',
    '2026-10-05',
    [
      [3, 6],
      [1, 6],
      [5, 10],
      [9, 13],
    ],
    4,
    true,
  )

  return db
}
