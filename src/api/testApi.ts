import { api } from '@/lib/apiClient'
import { withInvalidation } from '@/lib/dataEvents'
import { testMockStore } from './workMockStores'
import type { TestMockStore } from './mock/testMockStore'
import type { ItemsDto } from '@/types/rbac'
import type { RequirementRef } from '@/types/issue'
import type {
  CreateCycleBody,
  CreateTestCaseBody,
  CycleStatus,
  RecordResultBody,
  RunQuery,
  SuggestedTestCase,
  TestCaseDetailDto,
  TestCaseQuery,
  TestCaseSummaryDto,
  TestCycleDto,
  TestRunDto,
  TestTreeNodeDto,
  UpdateTestCaseBody,
} from '@/types/testing'

// doc/BE-Changes-2026-10-28_30-API.md §D (#45–#58) — một hàm cho mỗi endpoint, path / body đúng tài liệu.
// Mock trong trình duyệt khi VITE_MOCK_TESTS=true (src/api/mockFlags.ts).

export interface TestApi {
  // 5.1 Cây
  tree: (projectId: number) => Promise<TestTreeNodeDto[]>
  createFolder: (
    projectId: number,
    body: { name: string; parentId?: number | null },
  ) => Promise<{ folderId: number; name: string; parentId: number | null }>
  // 5.2 Testcase
  list: (projectId: number, query?: TestCaseQuery) => Promise<TestCaseSummaryDto[]>
  create: (projectId: number, body: CreateTestCaseBody) => Promise<TestCaseDetailDto>
  bulkCreate: (projectId: number, items: CreateTestCaseBody[]) => Promise<TestCaseDetailDto[]>
  bulkApprove: (projectId: number, testCaseIds: number[]) => Promise<{ updatedCount: number }>
  aiRefreshStale: (projectId: number, testCaseId: number) => Promise<TestCaseDetailDto>
  get: (testCaseId: number) => Promise<TestCaseDetailDto>
  update: (testCaseId: number, body: UpdateTestCaseBody) => Promise<TestCaseDetailDto>
  markFresh: (testCaseId: number) => Promise<TestCaseDetailDto>
  remove: (testCaseId: number) => Promise<void>
  // 5.3 Gợi ý
  suggest: (projectId: number, refs: RequirementRef[]) => Promise<SuggestedTestCase[]>
  // 5.4 Đợt chạy
  cycles: (projectId: number, status?: CycleStatus) => Promise<TestCycleDto[]>
  createCycle: (projectId: number, body: CreateCycleBody) => Promise<TestCycleDto>
  updateCycle: (cycleId: number, body: { name?: string; status?: CycleStatus }) => Promise<TestCycleDto>
  runs: (cycleId: number, query?: RunQuery) => Promise<TestRunDto[]>
  updateRun: (runId: number, body: { assigneeId: number | null }) => Promise<TestRunDto>
  // 5.5 Ghi kết quả
  recordResult: (runId: number, body: RecordResultBody) => Promise<TestRunDto>
}

export const httpTestApi: TestApi = {
  tree: (projectId) => api.get<ItemsDto<TestTreeNodeDto>>(`/projects/${projectId}/test-tree`).then((r) => r.data.items),
  createFolder: (projectId, body) =>
    api
      .post<{ folderId: number; name: string; parentId: number | null }>(`/projects/${projectId}/test-folders`, body)
      .then((r) => r.data),
  list: (projectId, query = {}) =>
    api
      .get<ItemsDto<TestCaseSummaryDto>>(`/projects/${projectId}/testcases`, { params: query })
      .then((r) => r.data.items),
  create: (projectId, body) =>
    api.post<TestCaseDetailDto>(`/projects/${projectId}/testcases`, body).then((r) => r.data),
  bulkCreate: async (projectId, items) => {
    const out: TestCaseDetailDto[] = []
    for (const item of items) {
      out.push(await api.post<TestCaseDetailDto>(`/projects/${projectId}/testcases`, item).then((r) => r.data))
    }
    return out
  },
  bulkApprove: async (_projectId, testCaseIds) => {
    for (const id of testCaseIds) {
      await api.patch<TestCaseDetailDto>(`/testcases/${id}`, { approvalStatus: 'APPROVED', needsReview: false })
    }
    return { updatedCount: testCaseIds.length }
  },
  aiRefreshStale: (_projectId, testCaseId) =>
    api
      .patch<TestCaseDetailDto>(`/testcases/${testCaseId}`, { approvalStatus: 'APPROVED', needsReview: false })
      .then((r) => r.data),
  get: (testCaseId) => api.get<TestCaseDetailDto>(`/testcases/${testCaseId}`).then((r) => r.data),
  update: (testCaseId, body) => api.patch<TestCaseDetailDto>(`/testcases/${testCaseId}`, body).then((r) => r.data),
  markFresh: (testCaseId) =>
    api.patch<TestCaseDetailDto>(`/testcases/${testCaseId}`, { needsReview: false, approvalStatus: 'APPROVED' }).then((r) => r.data),
  remove: (testCaseId) => api.delete(`/testcases/${testCaseId}`).then(() => undefined),
  suggest: (projectId, refs) =>
    api
      .post<ItemsDto<SuggestedTestCase>>(`/projects/${projectId}/testcases/suggest`, { refs })
      .then((r) => r.data.items),
  cycles: (projectId, status) =>
    api
      .get<ItemsDto<TestCycleDto>>(`/projects/${projectId}/test-cycles`, { params: { status } })
      .then((r) => r.data.items),
  createCycle: (projectId, body) =>
    api.post<TestCycleDto>(`/projects/${projectId}/test-cycles`, body).then((r) => r.data),
  updateCycle: (cycleId, body) => api.patch<TestCycleDto>(`/test-cycles/${cycleId}`, body).then((r) => r.data),
  runs: (cycleId, query = {}) =>
    api.get<ItemsDto<TestRunDto>>(`/test-cycles/${cycleId}/runs`, { params: query }).then((r) => r.data.items),
  updateRun: (runId, body) => api.patch<TestRunDto>(`/test-runs/${runId}`, body).then((r) => r.data),
  recordResult: (runId, body) => api.post<TestRunDto>(`/test-runs/${runId}/result`, body).then((r) => r.data),
}

function createMockTestApi(store: TestMockStore): TestApi {
  return {
    tree: (projectId) => store.tree(projectId).then((r) => r.items),
    createFolder: (projectId, body) => store.createFolder(projectId, body),
    list: (projectId, query) => store.listTestCases(projectId, query).then((r) => r.items),
    create: (projectId, body) => store.createTestCase(projectId, body),
    bulkCreate: (projectId, items) => store.bulkCreateTestCases(projectId, items),
    bulkApprove: (projectId, testCaseIds) => store.bulkApproveTestCases(projectId, testCaseIds),
    aiRefreshStale: (projectId, testCaseId) => store.aiRefreshStaleTestCase(projectId, testCaseId),
    get: (testCaseId) => store.getTestCase(testCaseId),
    update: (testCaseId, body) => store.updateTestCase(testCaseId, body),
    markFresh: (testCaseId) => store.markFresh(testCaseId),
    remove: (testCaseId) => store.deleteTestCase(testCaseId),
    suggest: (projectId, refs) => store.suggest(projectId, { refs }).then((r) => r.items),
    cycles: (projectId, status) => store.listCycles(projectId, status).then((r) => r.items),
    createCycle: (projectId, body) => store.createCycle(projectId, body),
    updateCycle: (cycleId, body) => store.updateCycle(cycleId, body),
    runs: (cycleId, query) => store.listRuns(cycleId, query).then((r) => r.items),
    updateRun: (runId, body) => store.updateRun(runId, body),
    recordResult: (runId, body) => store.recordResult(runId, body),
  }
}

const MOCK_MUTATIONS = [
  'createFolder',
  'create',
  'bulkCreate',
  'bulkApprove',
  'aiRefreshStale',
  'update',
  'markFresh',
  'remove',
  'createCycle',
  'updateCycle',
  'updateRun',
  'recordResult',
] as const satisfies readonly (keyof TestApi)[]

export const testApi: TestApi = testMockStore
  ? withInvalidation(createMockTestApi(testMockStore), MOCK_MUTATIONS)
  : httpTestApi
