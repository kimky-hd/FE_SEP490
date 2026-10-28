// Khớp 1-1 với doc/Workspace-RBAC-API-Contract.md §9–§12 (Mẫu SDLC, Dự án, Thành viên dự án, Workflow).

import type { RoleRefDto, UserRefDto } from './rbac'

export type SdlcMethod =
  | 'SCRUM'
  | 'WATERFALL'
  | 'ITERATIVE'
  | 'V_MODEL'
  | 'KANBAN'
  | 'SPIRAL'
  | 'RAD'
  | 'CUSTOM'
export type ProjectStatus = 'ACTIVE' | 'ARCHIVED'
export type StatusCategory = 'TODO' | 'IN_PROGRESS' | 'DONE'

export interface ProjectDto {
  projectId: number
  workspaceId: number
  workspaceName: string
  companyId: number | null
  key: string
  name: string
  description: string | null
  sdlcMethod: SdlcMethod
  aiEnabled: boolean
  status: ProjectStatus
  lead: UserRefDto | null
  myRole: RoleRefDto | null
  myPermissions: string[]
  memberCount: number
  phaseCount: number
  openIssueCount: number
  doneIssueCount: number
  documentCount: number
  createdBy: UserRefDto
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}

export interface ProjectMemberDto extends UserRefDto {
  role: RoleRefDto
  workspaceRole: RoleRefDto
  joinedAt: string
}

export interface ProjectMemberCandidateDto extends UserRefDto {
  workspaceRole: RoleRefDto
}

export interface WorkflowStatusDto {
  statusId: number
  name: string
  category: StatusCategory
  color: string | null
  description: string | null
  isInitial: boolean
  position: number
  isActive: boolean
  issueCount: number
}

export interface WorkflowTransitionDto {
  transitionId: number
  fromStatusId: number
  toStatusId: number
  allowedRoles: RoleRefDto[]
  requireComment: boolean
  commentHint: string | null
  condition: string | null
}

export interface PhaseDto {
  phaseId: number
  name: string
  description: string | null
  position: number
  isActive: boolean
  statuses: WorkflowStatusDto[]
  transitions: WorkflowTransitionDto[]
}

export interface WorkflowDto {
  projectId: number
  sdlcMethod: SdlcMethod
  phasesEditable: boolean
  phases: PhaseDto[]
}

// --- Mẫu SDLC (§9.1) ---

export interface TemplateStatus {
  key: string
  name: string
  category: StatusCategory
  color: string
  description: string | null
  isInitial: boolean
}

export interface TemplateTransition {
  from: string
  to: string
  allowedRoleCodes: string[]
  requireComment: boolean
  commentHint: string | null
  condition: string | null
}

export interface TemplatePhase {
  name: string
  description: string | null
  statuses: TemplateStatus[]
  transitions: TemplateTransition[]
}

export interface SdlcTemplateDto {
  method: SdlcMethod
  name: string
  description: string
  tag?: string
  phasesEditable: boolean
  phases: TemplatePhase[]
}

// --- Request tạo dự án (§10.4) / lưu workflow 1 phase (§12.4) ---

export interface StatusInput {
  /** Trạng thái đã có (§12.4) — bỏ trống với trạng thái mới. */
  statusId?: number
  /** Khoá tạm phía client để transition tham chiếu. */
  key?: string
  name: string
  category: StatusCategory
  color: string | null
  description: string | null
  isInitial: boolean
  isActive?: boolean
}

export interface TransitionInput {
  /** `statusId` (số) với trạng thái đã có hoặc `key` (chuỗi) với trạng thái mới. */
  from: number | string
  to: number | string
  allowedRoleIds: number[]
  requireComment: boolean
  commentHint: string | null
  condition: string | null
}

export interface CreateProjectBody {
  name: string
  key: string
  description?: string
  sdlcMethod: SdlcMethod
  aiEnabled: boolean
  phases: { name: string; description: string | null; statuses: StatusInput[]; transitions: TransitionInput[] }[]
  members: { userId: number; roleId: number }[]
}

export type WorkflowIssueCode =
  | 'NO_STATUS'
  | 'STATUS_NAME_REQUIRED'
  | 'NO_INITIAL_STATUS'
  | 'MULTIPLE_INITIAL_STATUS'
  | 'NO_DONE_STATUS'
  | 'DUPLICATE_STATUS_NAME'
  | 'INVALID_TRANSITION'
  | 'TRANSITION_NO_ROLE'
  | 'UNREACHABLE_STATUS'
  | 'DEAD_END_STATUS'

export interface WorkflowIssue {
  phaseIndex: number
  code: WorkflowIssueCode
  statusKey?: string
  transitionIndex?: number
  message: string
}
