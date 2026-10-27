// Khớp 1-1 với các DTO trong doc/Auth-API-Contract.md — sửa API thì sửa cả 2 chỗ.
// Field đánh dấu "RBAC" là phần mở rộng ở doc/Workspace-RBAC-API-Contract.md §1.1; để optional vì BE cũ chưa trả.

import type { RoleRefDto, WorkspaceStatus } from './rbac'

export interface UserDto {
  id: number
  fullName: string
  email: string
  avatarUrl: string | null
  emailVerified: boolean
}

export interface CompanyDto {
  id: number
  name: string
  code: string
  emailDomain: string | null
  domainAutoJoinEnabled: boolean
  taxCode: string
  address: string
  logoUrl: string | null
}

export interface CompanyMembershipDto {
  companyId: number
  companyName: string
  roleName: string
  roleId?: number // RBAC
  roleCode?: string | null // RBAC
  permissions?: string[] // RBAC — quyền hiệu lực cấp công ty
}

export interface WorkspaceSummaryDto {
  workspaceId: number
  workspaceName: string
  companyId: number | null
  code?: string // RBAC
  status?: WorkspaceStatus // RBAC
  role?: RoleRefDto | null // RBAC — role riêng trong workspace này
  permissions?: string[] // RBAC — quyền hiệu lực trong workspace này
}

export interface AuthSessionDto {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: UserDto
}

export interface MeResponseDto {
  user: UserDto
  companies: CompanyMembershipDto[]
  workspaces: WorkspaceSummaryDto[]
}

export interface CompanyMatchDto {
  matched: boolean
  company?: {
    id: number
    name: string
    domain: string
    logoUrl: string | null
    autoJoinEnabled: boolean
  }
}

export interface InvitationPreviewDto {
  valid: boolean
  reason?: 'EXPIRED' | 'ALREADY_USED'
  email?: string
  companyName?: string
  workspaceName?: string | null
  roleName?: string
  workspaceRoleName?: string | null // RBAC
  expiresAt?: string
}

export interface ApiErrorBody {
  code: string
  message: string
  errors?: Record<string, string[]>
  /** Chỉ có ở 400 WORKFLOW_INVALID (doc/Workspace-RBAC-API-Contract.md §12.5). */
  workflowIssues?: import('./project').WorkflowIssue[]
}
