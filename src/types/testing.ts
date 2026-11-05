// Khớp 1-1 với doc/Issues-Testcases-API-Contract.md §2 (Test cases: kho, đợt chạy, lượt chạy).

import type { ReqRefDto, RequirementRef, UserRef } from './issue'

export type TestType =
  | 'FUNCTIONAL'
  | 'BOUNDARY'
  | 'NEGATIVE'
  | 'UI_UX'
  | 'SECURITY'
  | 'PERFORMANCE'
  | 'INTEGRATION'
  | 'E2E'
  | 'UNIT'
  | 'REGRESSION'
export type TestPriority = 'HIGH' | 'MEDIUM' | 'LOW'
export type TestEnvironment = 'SIT' | 'UAT' | 'STAGING' | 'PROD'
export type TestApprovalStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED'

export const RUN_RESULTS = ['NOT_RUN', 'PASS', 'FAIL', 'BLOCKED'] as const
export type RunResult = (typeof RUN_RESULTS)[number]
export const CYCLE_STATUSES = ['OPEN', 'CLOSED'] as const
export type CycleStatus = (typeof CYCLE_STATUSES)[number]

export const TEST_TYPES: TestType[] = [
  'FUNCTIONAL',
  'BOUNDARY',
  'NEGATIVE',
  'UI_UX',
  'SECURITY',
  'PERFORMANCE',
  'INTEGRATION',
  'E2E',
  'UNIT',
  'REGRESSION',
]
export const TEST_PRIORITIES: TestPriority[] = ['HIGH', 'MEDIUM', 'LOW']
export const TEST_ENVIRONMENTS: TestEnvironment[] = ['SIT', 'UAT', 'STAGING', 'PROD']
export const TEST_APPROVAL_STATUSES: TestApprovalStatus[] = ['DRAFT', 'IN_REVIEW', 'APPROVED']

export interface TestStep {
  action: string
  expected: string
}

export interface TestTreeNodeDto {
  /** 'doc-12' | 'req-12-<reqUid>' | 'folder-5' | 'unlinked' */
  id: string
  kind: 'DOCUMENT' | 'REQUIREMENT' | 'FOLDER' | 'UNLINKED'
  parentId: string | null
  label: string
  requirement: ReqRefDto | null
  testCount: number
  needsReviewCount: number
}

export interface TestCaseSummaryDto {
  testCaseId: number
  key: string
  title: string
  type: TestType
  priority: TestPriority
  folderId: number | null
  requirements: ReqRefDto[]
  issues: { issueId: number; key: string }[]
  stepCount: number
  needsReview: boolean
  lastResult: RunResult | null
  lastRunAt: string | null
  lastRunBy: UserRef | null
  updatedAt: string
  preconditions?: string | null
  steps?: TestStep[]
  moduleName?: string
  testType?: TestType
  testData?: string
  expectedSummary?: string
  actualResult?: string
  environment?: TestEnvironment
  approvalStatus?: TestApprovalStatus
  linkedBugId?: string
}

export type TestCase = TestCaseSummaryDto

export interface TestRunHistoryDto {
  runId: number
  cycleName: string
  result: RunResult
  note: string | null
  executedBy: UserRef
  executedAt: string
  defects: { issueId: number; key: string }[]
}

export interface TestCaseDetailDto extends TestCaseSummaryDto {
  preconditions: string | null
  steps: TestStep[]
  history: TestRunHistoryDto[]
  can: { edit: boolean; delete: boolean; execute: boolean }
}

export interface TestCycleDto {
  cycleId: number
  name: string
  sprintId: number | null
  status: CycleStatus
  counts: { pass: number; fail: number; blocked: number; notRun: number }
  createdAt: string
}

export interface TestRunDto {
  runId: number
  cycleId: number
  testCase: TestCaseSummaryDto
  assignee: UserRef | null
  result: RunResult
  note: string | null
  executedAt: string | null
  executedBy: UserRef | null
  defects: { issueId: number; key: string; statusId: number }[]
  /** Đã chạy nhưng REQ / testcase đổi sau lần chạy. */
  needsRerun: boolean
}

export interface SuggestedTestCase {
  tempId: string
  title: string
  type: TestType
  priority: TestPriority
  steps: TestStep[]
  requirementRef: RequirementRef
  fromCriterion: string | null
}

// ---------- Body ----------

export interface TestCaseQuery {
  reqUid?: string
  documentId?: number
  folderId?: number
  unlinked?: boolean
  needsReview?: boolean
  lastResult?: RunResult
  issueId?: number
  search?: string
}

export interface CreateTestCaseBody {
  title: string
  type: TestType
  priority: TestPriority
  preconditions?: string | null
  steps: TestStep[]
  folderId?: number | null
  requirementRefs?: RequirementRef[]
  issueIds?: number[]
  moduleName?: string
  testType?: TestType
  testData?: string
  expectedSummary?: string
  actualResult?: string
  environment?: TestEnvironment
  approvalStatus?: TestApprovalStatus
  linkedBugId?: string
}

export type CreateTestCaseInput = CreateTestCaseBody

export interface UpdateTestCaseBody extends Partial<CreateTestCaseBody> {
  needsReview?: boolean
  lastResult?: RunResult | null
}

export type UpdateTestCasePatch = UpdateTestCaseBody

export interface CreateCycleBody {
  name: string
  sprintId?: number | null
  testCaseIds: number[]
  defaultAssigneeId?: number | null
}

export interface RunQuery {
  assigneeId?: 'me' | number
  result?: RunResult
  needsRerun?: boolean
}

export interface RecordResultBody {
  result: 'PASS' | 'FAIL' | 'BLOCKED'
  note?: string | null
  createDefect?: { title: string; priority?: 'HIGHEST' | 'HIGH' | 'MEDIUM' | 'LOW'; assigneeId?: number | null } | null
}
