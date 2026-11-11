import { api } from '@/lib/apiClient'
import { withInvalidation } from '@/lib/dataEvents'
import { testMockStore } from './workMockStores'
import type { ItemsDto } from '@/types/rbac'
import type { RequirementRef } from '@/types/issue'
import type {
  ActivityQuery,
  AiApplyItem,
  AssignmentBody,
  BulkUpdateBody,
  CreateBugBody,
  CreateModuleBody,
  CreateTestCaseBody,
  CreateTestPlanBody,
  DeployBuildBody,
  DocSectionDto,
  EnvironmentBody,
  RecordResultsBody,
  RecordResultsResult,
  SectionBody,
  SheetLayoutDto,
  SuggestedTestCaseDto,
  TestActivityDto,
  TestAssignmentDto,
  TestBuildDto,
  TestCaseDto,
  TestCaseQuery,
  TestEnvironmentDto,
  TestModuleDto,
  TestPlanDto,
  TestPlanSummaryDto,
  TestResult,
  TestSectionDto,
  TraceRowDto,
  UpdateTestCaseBody,
  UpdateTestPlanBody,
} from '@/types/testing'

// Test cases v2 — doc/Issues-Testcases-API-Contract.md mục "v2" (T1–T34). Một hàm cho mỗi endpoint, path / body đúng
// tài liệu. Mock trong trình duyệt khi VITE_MOCK_TESTS=true (src/api/mockFlags.ts).

export interface TestApi {
  // Đợt test
  plans: (projectId: number) => Promise<TestPlanSummaryDto[]>
  createPlan: (projectId: number, body: CreateTestPlanBody) => Promise<TestPlanDto>
  plan: (planId: number) => Promise<TestPlanDto>
  updatePlan: (planId: number, body: UpdateTestPlanBody) => Promise<TestPlanDto>
  // Môi trường & build
  addEnvironment: (planId: number, body: EnvironmentBody & { name: string }) => Promise<TestEnvironmentDto>
  updateEnvironment: (envId: number, body: EnvironmentBody) => Promise<TestEnvironmentDto>
  removeEnvironment: (envId: number) => Promise<void>
  deployBuild: (envId: number, body: DeployBuildBody) => Promise<{ build: TestBuildDto; retestCount: number }>
  regression: (envId: number, body: { moduleIds?: number[] }) => Promise<{ retestCount: number }>
  // Module = tài liệu, mục, nhóm
  documentSections: (documentId: number) => Promise<DocSectionDto[]>
  addModule: (planId: number, body: CreateModuleBody) => Promise<TestModuleDto>
  updateModule: (moduleId: number, body: { name?: string; position?: number }) => Promise<TestModuleDto>
  removeModule: (moduleId: number) => Promise<void>
  addSection: (moduleId: number, body: SectionBody) => Promise<TestSectionDto>
  updateSection: (sectionId: number, body: { title?: string; position?: number }) => Promise<TestSectionDto>
  removeSection: (sectionId: number) => Promise<void>
  // Phân công
  setAssignments: (planId: number, body: AssignmentBody) => Promise<TestAssignmentDto[]>
  // Testcase (#47–#51 đổi)
  list: (projectId: number, query?: TestCaseQuery) => Promise<TestCaseDto[]>
  create: (projectId: number, body: CreateTestCaseBody) => Promise<TestCaseDto>
  get: (testCaseId: number) => Promise<TestCaseDto>
  update: (testCaseId: number, body: UpdateTestCaseBody) => Promise<TestCaseDto>
  remove: (testCaseId: number) => Promise<void>
  bulkUpdate: (planId: number, body: BulkUpdateBody) => Promise<TestCaseDto[]>
  // Kết quả & bug
  recordResult: (testCaseId: number, body: { envId: number; result: TestResult }) => Promise<RecordResultsResult>
  recordResults: (planId: number, body: RecordResultsBody) => Promise<RecordResultsResult>
  createBug: (
    planId: number,
    body: CreateBugBody,
  ) => Promise<{ issue: { issueId: number; key: string }; items: TestCaseDto[] }>
  linkBug: (planId: number, issueId: number, body: { testCaseIds: number[] }) => Promise<TestCaseDto[]>
  // Bàn giao
  handover: (planId: number, body: { note: string | null }) => Promise<TestPlanDto>
  reopen: (planId: number) => Promise<TestPlanDto>
  // Bố cục bảng, lịch sử, đối chiếu
  saveLayout: (planId: number, body: SheetLayoutDto) => Promise<SheetLayoutDto>
  activity: (planId: number, query?: ActivityQuery) => Promise<TestActivityDto[]>
  traceability: (planId: number, envId: number) => Promise<TraceRowDto[]>
  // AI (#52 đổi + áp dụng)
  suggest: (projectId: number, body: { planId: number; refs: RequirementRef[] }) => Promise<SuggestedTestCaseDto[]>
  aiApply: (planId: number, body: { items: AiApplyItem[] }) => Promise<TestCaseDto[]>
}

const items = <T>(p: Promise<{ data: ItemsDto<T> }>) => p.then((r) => r.data.items)
const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data)
const none = (p: Promise<unknown>) => p.then(() => undefined)

export const httpTestApi: TestApi = {
  plans: (projectId) => items(api.get<ItemsDto<TestPlanSummaryDto>>(`/projects/${projectId}/test-plans`)),
  createPlan: (projectId, body) => data(api.post<TestPlanDto>(`/projects/${projectId}/test-plans`, body)),
  plan: (planId) => data(api.get<TestPlanDto>(`/test-plans/${planId}`)),
  updatePlan: (planId, body) => data(api.patch<TestPlanDto>(`/test-plans/${planId}`, body)),
  addEnvironment: (planId, body) => data(api.post<TestEnvironmentDto>(`/test-plans/${planId}/environments`, body)),
  updateEnvironment: (envId, body) => data(api.patch<TestEnvironmentDto>(`/test-environments/${envId}`, body)),
  removeEnvironment: (envId) => none(api.delete(`/test-environments/${envId}`)),
  deployBuild: (envId, body) =>
    data(api.post<{ build: TestBuildDto; retestCount: number }>(`/test-environments/${envId}/builds`, body)),
  regression: (envId, body) => data(api.post<{ retestCount: number }>(`/test-environments/${envId}/regression`, body)),
  documentSections: (documentId) => items(api.get<ItemsDto<DocSectionDto>>(`/documents/${documentId}/sections`)),
  addModule: (planId, body) => data(api.post<TestModuleDto>(`/test-plans/${planId}/modules`, body)),
  updateModule: (moduleId, body) => data(api.patch<TestModuleDto>(`/test-modules/${moduleId}`, body)),
  removeModule: (moduleId) => none(api.delete(`/test-modules/${moduleId}`)),
  addSection: (moduleId, body) => data(api.post<TestSectionDto>(`/test-modules/${moduleId}/sections`, body)),
  updateSection: (sectionId, body) => data(api.patch<TestSectionDto>(`/test-sections/${sectionId}`, body)),
  removeSection: (sectionId) => none(api.delete(`/test-sections/${sectionId}`)),
  setAssignments: (planId, body) =>
    items(api.put<ItemsDto<TestAssignmentDto>>(`/test-plans/${planId}/assignments`, body)),
  list: (projectId, query = {}) =>
    items(api.get<ItemsDto<TestCaseDto>>(`/projects/${projectId}/testcases`, { params: query })),
  create: (projectId, body) => data(api.post<TestCaseDto>(`/projects/${projectId}/testcases`, body)),
  get: (testCaseId) => data(api.get<TestCaseDto>(`/testcases/${testCaseId}`)),
  update: (testCaseId, body) => data(api.patch<TestCaseDto>(`/testcases/${testCaseId}`, body)),
  remove: (testCaseId) => none(api.delete(`/testcases/${testCaseId}`)),
  bulkUpdate: (planId, body) =>
    items(api.post<ItemsDto<TestCaseDto>>(`/test-plans/${planId}/testcases/bulk-update`, body)),
  recordResult: (testCaseId, body) => data(api.post<RecordResultsResult>(`/testcases/${testCaseId}/results`, body)),
  recordResults: (planId, body) => data(api.post<RecordResultsResult>(`/test-plans/${planId}/results`, body)),
  createBug: (planId, body) =>
    data(
      api.post<{ issue: { issueId: number; key: string }; items: TestCaseDto[] }>(`/test-plans/${planId}/bugs`, body),
    ),
  linkBug: (planId, issueId, body) =>
    items(api.post<ItemsDto<TestCaseDto>>(`/test-plans/${planId}/bugs/${issueId}/links`, body)),
  handover: (planId, body) => data(api.post<TestPlanDto>(`/test-plans/${planId}/handover`, body)),
  reopen: (planId) => data(api.post<TestPlanDto>(`/test-plans/${planId}/reopen`, {})),
  saveLayout: (planId, body) => data(api.put<SheetLayoutDto>(`/test-plans/${planId}/sheet-layout`, body)),
  activity: (planId, query = {}) =>
    items(api.get<ItemsDto<TestActivityDto>>(`/test-plans/${planId}/activity`, { params: query })),
  traceability: (planId, envId) =>
    items(api.get<ItemsDto<TraceRowDto>>(`/test-plans/${planId}/traceability`, { params: { envId } })),
  suggest: (projectId, body) =>
    items(api.post<ItemsDto<SuggestedTestCaseDto>>(`/projects/${projectId}/testcases/suggest`, body)),
  aiApply: (planId, body) => items(api.post<ItemsDto<TestCaseDto>>(`/test-plans/${planId}/testcases/ai-apply`, body)),
}

/** Hàm đọc (không làm mới dữ liệu khác khi gọi). Mọi hàm còn lại là ghi. */
const READS = [
  'plans',
  'plan',
  'documentSections',
  'list',
  'get',
  'activity',
  'traceability',
  'suggest',
] as const satisfies readonly (keyof TestApi)[]

function bindMock(store: TestApi): TestApi {
  const out = {} as Record<keyof TestApi, unknown>
  for (const key of Object.keys(httpTestApi) as (keyof TestApi)[]) {
    const fn = store[key] as (...a: unknown[]) => unknown
    out[key] = (...args: unknown[]) => fn.apply(store, args)
  }
  return out as unknown as TestApi
}

const MUTATIONS = (Object.keys(httpTestApi) as (keyof TestApi)[]).filter(
  (k) => !(READS as readonly string[]).includes(k),
)

export const testApi: TestApi = testMockStore ? withInvalidation(bindMock(testMockStore), MUTATIONS) : httpTestApi
