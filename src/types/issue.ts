// Khớp 1-1 với doc/Issues-Testcases-API-Contract.md §2 (Kanban: issue, sprint, board) — sửa API thì sửa cả 2 chỗ.

import type { StatusCategory } from './project'

export type IssueType = 'TASK' | 'BUG' | 'STORY' | 'DESIGN'
export type IssuePriority = 'HIGHEST' | 'HIGH' | 'MEDIUM' | 'LOW'
export type IssueStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE'
export const SPRINT_STATUSES = ['PLANNED', 'ACTIVE', 'COMPLETED'] as const
export type SprintStatus = (typeof SPRINT_STATUSES)[number]
export const ISSUE_ACTIVITY_ACTIONS = [
  'CREATED',
  'UPDATED',
  'TRANSITIONED',
  'ASSIGNED',
  'SPRINT_CHANGED',
  'REQ_LINKED',
  'REQ_ACKED',
  'REQ_CHANGED',
  'COMMENTED',
  'DELETED',
] as const
/** D10: `REQ_CHANGED` do hệ thống ghi, actor = { userId: 0, fullName: 'SSAM' }. */
export type IssueActivityAction = (typeof ISSUE_ACTIVITY_ACTIONS)[number]
export type RunResultLite = 'UNTESTED' | 'NOT_RUN' | 'PASS' | 'FAIL' | 'BLOCKED'

export const ISSUE_TYPES: IssueType[] = ['TASK', 'BUG', 'STORY', 'DESIGN']
export const ISSUE_PRIORITIES: IssuePriority[] = ['HIGHEST', 'HIGH', 'MEDIUM', 'LOW']

export interface UserRef {
  userId: number
  fullName: string
}

/** REQ liên kết, giải theo bản baseline mới nhất (§1.2, §3). */
export interface ReqRefDto {
  documentId: number
  documentCode: string
  reqUid: string
  /** null nếu REQ đã bị xoá khỏi tài liệu. */
  reqKey: string | null
  title: string | null
  freshness: 'FRESH' | 'STALE' | null
  /** vd 'Đổi trong bản 1.2' khi REQ thay đổi sau khi liên kết / ack. */
  changedNote: string | null
}

export interface RequirementRef {
  documentId: number
  reqUid: string
}

export interface BoardColumnDto {
  statusId: number
  name: string
  category: StatusCategory
  color: string | null
  phaseId: number
  phaseName: string
  position: number
  /** D14: trạng thái khởi đầu của giai đoạn (nút "+" dưới cột, issue mới). */
  isInitial: boolean
  wipLimit: number | null
}

export interface BoardDto {
  columns: BoardColumnDto[]
  activeSprint: SprintDto | null
}

export interface IssueTestCounts {
  total: number
  pass: number
  fail: number
  blocked: number
  notRun: number
}

export interface IssueSummaryDto {
  issueId: number
  key: string
  type: IssueType
  title: string
  statusId: number
  priority: IssuePriority
  points: number | null
  assignee: UserRef | null
  sprintId: number | null
  parentId: number | null
  rank: string
  labels: string[]
  requirements: ReqRefDto[]
  reqChanged: boolean
  tests: IssueTestCounts
  subtaskCount: number
  subtaskDone: number
  updatedAt: string
  phaseId?: string | number
  phaseName?: string
  phaseOrder?: number
  phaseStatusId?: string | number
  phaseStatusName?: string
  status?: IssueStatus
}

export interface IssueDetailDto extends IssueSummaryDto {
  /** D25: text thuần (≤ 10 000 ký tự), không phải JSON TipTap. */
  description: string | null
  reporter: UserRef
  dueDate: string | null
  subtasks: IssueSummaryDto[]
  testCases: { testCaseId: number; key: string; title: string; lastResult: RunResultLite | null }[]
  allowedTransitions: { toStatusId: number; name: string }[]
  can: { edit: boolean; assign: boolean; changeStatus: boolean; delete: boolean }
  createdAt: string
}

export interface SprintDto {
  sprintId: number
  name: string
  goal: string | null
  startDate: string | null
  endDate: string | null
  status: SprintStatus
  capacityPoints: number | null
  committedPoints: number
  donePoints: number
  issueCount: number
}

export interface IssueCommentDto {
  commentId: number
  parentId: number | null
  body: string
  mentions: UserRef[]
  author: UserRef
  createdAt: string
}

export interface IssueActivityDto {
  activityId: number
  action: IssueActivityAction
  actor: UserRef
  note: string | null
  createdAt: string
}

// ---------- Body ----------

/** `sprintId`: 'active' | số | 'backlog'; `assigneeId`: 'me' | số. */
export interface IssueListQuery {
  sprintId?: 'active' | 'backlog' | number
  assigneeId?: 'me' | number
  type?: IssueType
  statusId?: number
  reqUid?: string
  reqChanged?: boolean
  search?: string
  parentId?: number
}

export interface CreateIssueBody {
  type: IssueType
  title: string
  description?: string | null
  priority?: IssuePriority
  points?: number | null
  assigneeId?: number | null
  sprintId?: number | null
  parentId?: number | null
  labels?: string[]
  requirementRefs?: RequirementRef[]
  /**
   * Ngoài hợp đồng v1.0 (đề xuất): tạo thẳng ở một trạng thái IsInitial của phase khác (nút "+ Tạo issue" dưới cột).
   * Bỏ trống = trạng thái IsInitial của phase đầu.
   */
  statusId?: number
  phaseId?: string | number
  phaseName?: string
  phaseOrder?: number
  phaseStatusId?: string | number
  phaseStatusName?: string
  status?: IssueStatus
}

export interface UpdateIssueBody {
  title?: string
  description?: string | null
  type?: IssueType
  priority?: IssuePriority
  points?: number | null
  assigneeId?: number | null
  sprintId?: number | null
  labels?: string[]
  dueDate?: string | null
  statusId?: number
  phaseId?: string | number
  phaseName?: string
  phaseOrder?: number
  phaseStatusId?: string | number
  phaseStatusName?: string
  status?: IssueStatus
}

export interface CreateSprintBody {
  name: string
  goal?: string | null
  startDate?: string | null
  endDate?: string | null
  capacityPoints?: number | null
}

export interface UpdateSprintBody extends Partial<CreateSprintBody> {
  status?: 'ACTIVE'
}

export type KanbanIssue = IssueSummaryDto
export type CreateIssueInput = CreateIssueBody
export type UpdateIssuePatch = UpdateIssueBody

