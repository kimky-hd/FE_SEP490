// Định nghĩa dữ liệu cho phân hệ Quản lý Công việc & Lỗi (Task & Bug Tracking / Issues)
import type { StatusCategory } from './project'
import type { TraceSyncStatus } from './document'

export type IssueType = 'TASK' | 'BUG'
export type IssuePriority = 'HIGHEST' | 'HIGH' | 'MEDIUM' | 'LOW'
export type BugSeverity = 'BLOCKER' | 'CRITICAL' | 'MAJOR' | 'MINOR'
export type TraceabilityStatus = TraceSyncStatus

export type DepartmentLabel =
  | 'Backend Team'
  | 'Frontend Team'
  | 'BA & Product'
  | 'QA / Testing Team'
  | 'DevOps & SecOps'
  | 'UI/UX Design'

export type DataClassification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL_PII' | 'RESTRICTED'

export type EnvironmentType = 'DEV' | 'STAGING' | 'UAT' | 'PRODUCTION'

export interface IssueWatcher {
  name: string
  role: string
}

export interface IssueComment {
  id: string
  authorName: string
  authorRole: string
  authorAvatar?: string
  body: string
  mentions?: string[]
  createdAt: string
}

export interface IssueActivity {
  id: string
  authorName: string
  action: string
  details?: string
  timestamp: string
}

export interface ProjectIssue {
  id: string
  projectId: number
  key: string // VD: 'CORE-101', 'TEST-102'
  type: IssueType
  summary: string
  description: string

  // Dành riêng cho BUG
  severity?: BugSeverity
  stepsToReproduce?: string
  linkedTestCaseCode?: string // VD: 'TC-01'

  // Quy trình 2 tầng (Đồng bộ với Project.phases và Workflow)
  phaseId: number
  phaseName: string
  statusId: number
  statusName: string
  statusCategory: StatusCategory // 'TODO' | 'IN_PROGRESS' | 'DONE'

  // Thuộc tính quản trị & Nhân sự 4 vai trò
  priority: IssuePriority
  storyPoints?: number // 1, 2, 3, 5, 8...
  originalEstimate?: string // '2h', '1d 4h', '3d'
  dueDate?: string // 'YYYY-MM-DD'

  // Nhân sự & Trách nhiệm (4 vai trò)
  assigneeName: string
  assigneeRole: string
  assigneeAvatar?: string
  ownerName: string
  ownerRole: string
  reporterName: string
  reporterRole: string
  watchers: IssueWatcher[]

  // Phân loại Tổ chức, Phân hệ & Bảo mật
  departmentLabel: DepartmentLabel
  component: string
  dataClassification: DataClassification
  environment: EnvironmentType
  labels: string[]

  createdAt: string
  updatedAt: string

  // Cầu nối Truy xuất với Tài liệu Đặc tả (Requirement REQ Link)
  linkedDocumentId?: number
  linkedRequirementItemId?: string
  linkedRequirementKeyCode?: string // VD: 'REQ-01'
  linkedRequirementTitle?: string
  traceabilityStatus: TraceabilityStatus // 'FRESH' | 'UNCONFIRMED_STALE' | 'CONFIRMED_STALE'

  // Bình luận và Nhật ký hoạt động bất biến
  comments: IssueComment[]
  activityLog: IssueActivity[]
}

export interface IssueFilterState {
  search: string
  type: 'ALL' | 'TASK' | 'BUG'
  priority: 'ALL' | IssuePriority
  phaseId: number | 'ALL'
  statusCategory: 'ALL' | StatusCategory
  assignee: string | 'ALL'
  departmentLabel: 'ALL' | DepartmentLabel
  component: 'ALL' | string
  dataClassification: 'ALL' | DataClassification
  onlyMine: boolean
  onlyStale: boolean
}

export interface ProjectIssueStats {
  total: number
  open: number
  done: number
  tasks: number
  bugs: number
  staleCount: number
}
