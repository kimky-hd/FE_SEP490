// Test cases v2 — đợt test, môi trường, kết quả theo build (doc/Issues-Testcases-API-Contract.md, mục "v2").
// Khớp 1-1 với DTO trong tài liệu. Bản v1 (kho + đợt chạy / lượt chạy, #45–#58) đã bỏ.

import type { ReqRefDto, RequirementRef, UserRef } from './issue'

export const TEST_RESULTS = ['PASS', 'FAIL', 'NA', 'UNTEST'] as const
/** Kết quả một lần ghi. UNTEST = đặt lại "chưa test". */
export type TestResult = (typeof TEST_RESULTS)[number]
/** Trạng thái hiển thị của một case ở một môi trường: kết quả mới nhất, hoặc RETEST khi đang có cờ test lại. */
export type TestStatus = TestResult | 'RETEST'

export const RETEST_REASONS = ['BUG_FIXED', 'REQ_CHANGED', 'REGRESSION'] as const
export type RetestReason = (typeof RETEST_REASONS)[number]

export const TEST_PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'] as const
export type TestPriority = (typeof TEST_PRIORITIES)[number]

export const TESTCASE_STATUSES = ['ACTIVE', 'DELETED'] as const
export type TestCaseStatus = (typeof TESTCASE_STATUSES)[number]

export const TEST_PLAN_STATUSES = ['OPEN', 'HANDED_OVER'] as const
export type TestPlanStatus = (typeof TEST_PLAN_STATUSES)[number]

export const COLUMN_KINDS = ['TEXT', 'MULTILINE', 'SELECT', 'NUMBER', 'DATE', 'PERSON'] as const
export type ColumnKind = (typeof COLUMN_KINDS)[number]

export const TEST_ACTIVITY_TYPES = ['RESULT', 'ASSIGN', 'BUG', 'REQ', 'TESTCASE', 'BUILD', 'SETUP', 'HANDOVER'] as const
export type TestActivityType = (typeof TEST_ACTIVITY_TYPES)[number]

/** Loại test gợi ý cho nhóm con ("nhóm") — người dùng gõ tự do được. */
export const TEST_CATEGORIES = ['Flow', 'Giao diện', 'Chức năng', 'Validate', 'Phân quyền'] as const

export const BUG_SEVERITIES = ['HIGHEST', 'HIGH', 'MEDIUM', 'LOW'] as const
export type BugSeverity = (typeof BUG_SEVERITIES)[number]

export interface TestStep {
  action: string
  expected: string
}

// ---------- Đợt test ----------

export interface TestBuildDto {
  buildId: number
  version: string
  deployedAt: string
  deployedBy: UserRef | null
  /** Bug đã fix trong build này (issue BUG trên Kanban). */
  fixedBugs: { issueId: number; key: string }[]
  /** Số lần ghi kết quả trên build này. */
  resultCount: number
}

export interface TestEnvironmentDto {
  envId: number
  name: string
  url: string | null
  note: string | null
  position: number
  /** Build hiện tại (mới nhất); null khi chưa deploy lần nào. */
  currentBuild: string | null
  builds: TestBuildDto[]
}

export interface TestSectionDto {
  sectionId: number
  moduleId: number
  /** null = mục lớn (theo mục tài liệu); số = nhóm con (loại test) của mục lớn đó. */
  parentId: number | null
  /** '1.' cho mục lớn, '1.2' cho nhóm con. */
  code: string
  title: string
  /** Mục lớn theo một heading của tài liệu (anchor). null = không theo mục nào / nhóm con. */
  anchorId: string | null
  /** Mục tài liệu có REQ đổi sau khi tạo (chỉ để hiển thị). */
  reqChanged: boolean
  position: number
}

export interface TestModuleDto {
  moduleId: number
  documentId: number
  documentCode: string
  documentTitle: string
  name: string
  /** Mã ngắn để ghép với mã testcase, vd "PHI" → PHI·TC_5. */
  shortCode: string
  position: number
  sections: TestSectionDto[]
}

export interface TestAssignmentDto {
  moduleId: number
  envId: number
  assignee: UserRef | null
}

export interface SelectOptionDto {
  /** Id ổn định của giá trị — `customFields` lưu id này (đổi tên giá trị không mất dữ liệu). */
  optionId: string
  label: string
  /** Chỉ số bảng màu (0–6). */
  color: number
}

export interface CustomColumnDto {
  columnId: string
  label: string
  kind: ColumnKind
  options?: SelectOptionDto[]
  multiple?: boolean
  min?: number | null
  max?: number | null
  unit?: string | null
  defaultValue?: string | null
  defaultToday?: boolean
  maxLength?: number | null
  personScope?: 'QA' | 'ALL'
}

export interface SheetLayoutDto {
  /** Thứ tự cột (id cột có sẵn hoặc columnId cột riêng). */
  order: string[]
  /** Tên cột đã đổi (cột có sẵn). */
  labels: Record<string, string>
  widths: Record<string, number>
  customColumns: CustomColumnDto[]
}

export interface TestHandoverDto {
  by: UserRef
  at: string
  note: string | null
}

export interface TestPlanSummaryDto {
  planId: number
  name: string
  startDate: string | null
  endDate: string | null
  status: TestPlanStatus
  createdAt: string
}

export interface TestPlanDto extends TestPlanSummaryDto {
  projectId: number
  handover: TestHandoverDto | null
  environments: TestEnvironmentDto[]
  modules: TestModuleDto[]
  assignments: TestAssignmentDto[]
  layout: SheetLayoutDto
  /** Người được phân công (QA của dự án) — để chọn trong ô "người" và ma trận phân công. */
  people: (UserRef & { qa: boolean })[]
}

// ---------- Testcase ----------

export interface RetestFlagDto {
  envId: number
  reason: RetestReason
  /** BUG_FIXED: bug đã fix + build mới. */
  bug: { issueId: number; key: string } | null
  build: string | null
  /** REQ_CHANGED: REQ nào đổi. */
  reqKey: string | null
  at: string
}

export interface TestResultDto {
  resultId: number
  envId: number
  build: string | null
  result: TestResult
  by: UserRef
  at: string
  /** Người được phân công module ở môi trường đó, khi người ghi là người khác ("ghi thay"). */
  behalfOf: UserRef | null
}

export interface TestBugRefDto {
  issueId: number
  key: string
  title: string
  priority: BugSeverity
  statusName: string
  statusCategory: 'TODO' | 'IN_PROGRESS' | 'DONE'
}

export type CustomValue = string | number | string[] | null

export interface TestCaseDto {
  testCaseId: number
  planId: number
  moduleId: number
  sectionId: number
  /** TC_n, tăng dần theo module (không tái sử dụng). */
  code: string
  /** Mã ngắn của module (hiển thị "PHI·TC_5"). */
  moduleCode: string
  title: string
  preconditions: string | null
  /** Hợp đồng giữ dạng bước (action, expected); FE hiển thị / sửa dạng chữ "1. …\n2. …" (lib/testplan/steps.ts). */
  steps: TestStep[]
  actual: string | null
  requirements: ReqRefDto[]
  /** REQ do AI gắn khi sinh testcase, chưa ai xác nhận (✦). */
  aiSuggestedReqs: boolean
  priority: TestPriority
  category: string | null
  browser: string | null
  customFields: Record<string, CustomValue>
  status: TestCaseStatus
  position: number
  bug: TestBugRefDto | null
  /** Mọi lần ghi kết quả, mọi môi trường, cũ → mới. */
  results: TestResultDto[]
  retest: RetestFlagDto[]
  updatedAt: string
}

// ---------- Lịch sử ----------

export interface TestActivityDto {
  activityId: number
  planId: number
  type: TestActivityType
  at: string
  actor: UserRef
  envId: number | null
  moduleId: number | null
  testCaseId: number | null
  /** RESULT: kết quả cũ → mới (trạng thái hiển thị trước khi ghi). */
  from: TestStatus | null
  to: TestResult | null
  build: string | null
  behalfOf: UserRef | null
  /** Mô tả ngắn (tiếng Việt / theo Accept-Language). */
  text: string
}

// ---------- Đối chiếu REQ ----------

export const TRACE_STATUSES = ['PASSED', 'FAILING', 'IN_PROGRESS', 'NO_TESTS'] as const
export type TraceStatus = (typeof TRACE_STATUSES)[number]

export interface TraceRowDto {
  documentId: number
  documentCode: string
  documentTitle: string
  reqUid: string
  reqKey: string
  title: string
  anchorId: string | null
  /** REQ đổi sau baseline mà case gắn REQ chưa test lại. */
  changed: boolean
  status: TraceStatus
  cases: { testCaseId: number; moduleId: number; code: string; title: string; status: TestStatus; ai: boolean }[]
  bugs: { issueId: number; key: string }[]
}

// ---------- Tài liệu: mục (heading) ----------

export interface DocSectionDto {
  anchorId: string
  title: string
  level: number
  /** REQ nằm dưới heading này (tới heading cùng / cao hơn cấp). */
  reqUids: string[]
}

// ---------- AI ----------

export interface TestPlacementDto {
  moduleId: number | null
  sectionId: number | null
  groupId: number | null
  documentId: number
  /** Heading tài liệu chứa REQ (mục lớn sẽ tạo theo heading này nếu chưa có). */
  anchorId: string | null
  sectionTitle: string
  category: string
}

export interface SuggestedTestCaseDto {
  tempId: string
  title: string
  preconditions: string | null
  priority: TestPriority
  category: string
  steps: TestStep[]
  requirementRef: RequirementRef
  fromCriterion: string | null
  placement: TestPlacementDto
}

// ---------- Body ----------

export interface CreateTestPlanBody {
  name: string
  startDate?: string | null
  endDate?: string | null
  /** Tạo môi trường mặc định (SIT) khi không chép đợt cũ. */
  environments?: string[]
}

export interface UpdateTestPlanBody {
  name?: string
  startDate?: string | null
  endDate?: string | null
}

export interface EnvironmentBody {
  name?: string
  url?: string | null
  note?: string | null
}

export interface DeployBuildBody {
  version: string
  /** Bug đã fix trong build; không gửi = mọi bug gắn testcase của đợt đang ở trạng thái DONE. */
  fixedIssueIds?: number[]
}

export interface CreateModuleBody {
  documentId: number
  name?: string
  /** Heading tài liệu thành mục lớn; không gửi = mọi heading có REQ. */
  anchorIds?: string[]
}

export interface SectionBody {
  parentId?: number | null
  title: string
  anchorId?: string | null
}

export interface AssignmentBody {
  items: { moduleId: number; envId: number; assigneeId: number | null }[]
}

export interface TestCaseQuery {
  planId?: number
  moduleId?: number
  documentId?: number
  reqUid?: string
  search?: string
  includeDeleted?: boolean
}

export interface CreateTestCaseBody {
  sectionId: number
  title: string
  preconditions?: string | null
  steps?: TestStep[]
  actual?: string | null
  requirementRefs?: RequirementRef[]
  aiSuggestedReqs?: boolean
  priority?: TestPriority
  category?: string | null
  browser?: string | null
  customFields?: Record<string, CustomValue>
  /** Chèn sau testcase này trong cùng nhóm; không gửi = cuối nhóm. */
  afterTestCaseId?: number | null
}

export interface UpdateTestCaseBody {
  title?: string
  preconditions?: string | null
  steps?: TestStep[]
  actual?: string | null
  requirementRefs?: RequirementRef[]
  /** false = đã xác nhận REQ do AI gắn. */
  aiSuggestedReqs?: false
  priority?: TestPriority
  category?: string | null
  browser?: string | null
  /** Gộp vào giá trị cũ; null = xoá giá trị cột đó. */
  customFields?: Record<string, CustomValue>
  status?: TestCaseStatus
  sectionId?: number
}

export interface BulkUpdateBody {
  items: { testCaseId: number; changes: UpdateTestCaseBody }[]
}

export interface RecordResultsBody {
  envId: number
  testCaseIds: number[]
  result: TestResult
}

export interface RecordResultsResult {
  items: TestCaseDto[]
  /** Case vừa FAIL mà chưa có bug → FE mở hộp "ghi bug trên Kanban". */
  needBug: number[]
  /** Bug đã Done bị mở lại vì FAIL lại. */
  reopened: { issueId: number; key: string }[]
}

export interface CreateBugBody {
  envId: number
  testCaseIds: number[]
  title: string
  priority: BugSeverity
  /** Mô tả; không gửi = BE tự ghép bước, mong đợi, kết quả thực tế, môi trường + build. */
  description?: string | null
}

export interface ActivityQuery {
  testCaseId?: number
  actorId?: number
  type?: TestActivityType
  moduleId?: number
}

export interface AiApplyItem {
  title: string
  preconditions?: string | null
  steps: TestStep[]
  priority: TestPriority
  category: string
  requirementRef: RequirementRef
}
