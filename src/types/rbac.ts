// Khớp 1-1 với các DTO trong doc/Workspace-RBAC-API-Contract.md — sửa API thì sửa cả 2 chỗ.

export type RoleScope = 'TENANT' | 'WORKSPACE' | 'PROJECT'
export type WorkspaceStatus = 'ACTIVE' | 'ARCHIVED'
export type MemberStatus = 'ACTIVE' | 'DEACTIVATED'

/** D05: loại vai trò "làm việc" của role dự án (doc/BE-Changes-2026-10-28_30-API.md §E2). */
export type RoleKind = 'BA' | 'DESIGNER' | 'QA' | 'DEV' | 'PM' | 'OTHER'
export const ROLE_KINDS: RoleKind[] = ['BA', 'DESIGNER', 'QA', 'DEV', 'PM', 'OTHER']

export interface RoleRefDto {
  roleId: number
  code: string | null
  name: string
  scope: RoleScope
  /** D05: BE trả luôn; tuỳ chọn ở FE để chạy được với BE cũ / mock RBAC (khi thiếu thì đoán theo tên). */
  kind?: RoleKind
}

export interface PermissionDto {
  key: string
  name: string
  description: string | null
  group: string
  scope: RoleScope
  isSensitive: boolean
}

export interface RoleDto {
  roleId: number
  code: string | null
  name: string
  description: string | null
  scope: RoleScope
  /** D05: loại vai trò (chỉ có nghĩa với scope PROJECT; TENANT / WORKSPACE luôn OTHER). */
  kind?: RoleKind
  isSystem: boolean
  isLocked: boolean
  isActive: boolean
  permissionKeys: string[]
  memberCount: number
  createdAt: string
  updatedAt: string
}

export interface UserRefDto {
  userId: number
  fullName: string
  email: string
  avatarUrl: string | null
}

export interface WorkspaceDto {
  workspaceId: number
  name: string
  code: string
  description: string | null
  companyId: number | null
  status: WorkspaceStatus
  myRole: RoleRefDto | null
  myPermissions: string[]
  projectCount: number
  memberCount: number
  createdBy: UserRefDto
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}

export interface WorkspaceMemberDto extends UserRefDto {
  role: RoleRefDto
  companyRole: RoleRefDto
  joinedAt: string
}

export interface CompanyUserDto extends UserRefDto {
  role: RoleRefDto
  status: MemberStatus
  workspaceCount: number
  joinedAt: string
}

export interface RoleMemberDto {
  userId: number
  fullName: string
  email: string
  workspace: { workspaceId: number; name: string } | null
  project?: { projectId: number; key: string; name: string } | null
}

export interface PageDto<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
}

export interface ItemsDto<T> {
  items: T[]
}

// Key quyền dùng trong FE — khớp bảng §0.2 của contract. Dùng hằng số thay vì gõ chuỗi để tránh sai chính tả.
export const PERMISSIONS = {
  // TENANT - Phạm vi Quản trị Tổ chức
  companyView: 'company.view',
  companyUpdate: 'company.update',
  userView: 'user.view',
  userInvite: 'user.invite',
  userUpdate: 'user.update',
  userDeactivate: 'user.deactivate',
  roleView: 'role.view',
  roleManage: 'role.manage',
  userAssignRole: 'user.assign_role',
  workspaceCreate: 'workspace.create',
  workspaceViewAll: 'workspace.view_all',
  auditView: 'audit.view',
  // WORKSPACE - Phạm vi Không gian làm việc
  workspaceView: 'workspace.view',
  workspaceUpdate: 'workspace.update',
  workspaceArchive: 'workspace.archive',
  workspaceMemberView: 'workspace.member.view',
  workspaceMemberManage: 'workspace.member.manage',
  workspaceMemberAssignRole: 'workspace.member.assign_role',
  projectCreate: 'project.create',
  projectInheritAccess: 'project.inherit_access',
  // PROJECT - Phạm vi Thực thi dự án
  projectView: 'project.view',
  projectUpdate: 'project.update', // gồm cả bật/tắt tiện ích AI
  projectArchive: 'project.archive',
  projectMemberManage: 'project.member.manage',
  projectWorkflowView: 'project.workflow.view',
  projectWorkflowManage: 'project.workflow.manage',
  projectWorkflowTransitionManage: 'project.workflow.transition.manage',
  issueView: 'issue.view',
  issueCreate: 'issue.create',
  issueUpdate: 'issue.update',
  issueAssign: 'issue.assign',
  issueChangeStatus: 'issue.change_status',
  issueDelete: 'issue.delete',
  // Key mới đề xuất trong doc/Issues-Testcases-API-Contract.md §0 (BE cần thêm vào PermissionKeys.cs).
  sprintManage: 'sprint.manage',
  documentView: 'document.view',
  documentEdit: 'document.edit',
  documentApprove: 'document.approve',
  documentRevise: 'document.revise',
  documentDelete: 'document.delete',
  figmaCreate: 'figma.create',
  figmaUpdate: 'figma.update',
  figmaArchive: 'figma.archive',
  testCaseView: 'testcase.view',
  testCaseManage: 'testcase.manage',
  testCaseExecute: 'testcase.execute',
  // Mới (doc/Issues-Testcases-API-Contract.md v2): thiết lập đợt test, phân công, regression, bàn giao.
  testCasePlan: 'testcase.plan',
  commentView: 'comment.view',
  commentWrite: 'comment.write',
  activityView: 'activity.view',
  aiUse: 'ai.use',
} as const

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]
