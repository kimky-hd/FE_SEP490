import { registerCache } from '@/lib/dataEvents'
import { documentApi, documentMockStore } from './documentApi'
import { MOCK } from './mockFlags'
import { browserStorage, currentActor, mockMembers, mockProjectAccess, mockWorkflow } from './mockSupport'
import { loadHttpReqIndex } from './mock/httpReqIndex'
import { projectApi } from './projectApi'
import { extractDocSections } from '@/lib/testplan/sections'
import { IssueMockStore } from './mock/issueMockStore'
import { TestMockStore } from './mock/testMockStore'
import type { DocReqIndex } from './mock/documentMockStore'
import type { WorkMockEnv } from './mock/workMockBase'

// Kho mock Kanban (VITE_MOCK_KANBAN) / Test cases (VITE_MOCK_TESTS) dùng chung một môi trường.
// REQ: tra kho mock tài liệu nếu Tài liệu còn mock; Tài liệu đã chạy BE thật thì đọc REQ qua API (#1, #5, #12).
// Test cases mock cần kho issue (bug từ lượt FAIL, liên kết issue) nên kho issue được tạo khi một trong hai module mock;
// nếu Kanban đã chạy BE thật mà Test còn mock, bug tạo trong mock chỉ nằm ở localStorage (không lên BE).

const REQ_TTL_MS = 10_000
const reqCache = new Map<number, { at: number; value: Promise<DocReqIndex[]> }>()
registerCache(() => reqCache.clear())

function httpReqs(projectId: number): Promise<DocReqIndex[]> {
  const hit = reqCache.get(projectId)
  if (hit && Date.now() - hit.at < REQ_TTL_MS) return hit.value
  const value = loadHttpReqIndex(documentApi, projectId).catch(() => [] as DocReqIndex[])
  reqCache.set(projectId, { at: Date.now(), value })
  return value
}

/** Mục (heading) của tài liệu từ bản baseline (hoặc bản hiện tại nếu chưa duyệt bản nào) — qua API Tài liệu (mock / thật). */
async function docSections(documentId: number) {
  const detail = await documentApi.get(documentId)
  const baseline = detail.node.baselineVersionId
  const content =
    baseline && baseline !== detail.current.versionId
      ? (await documentApi.get(documentId, baseline)).current.content
      : detail.current.content
  return extractDocSections(content)
}

async function memberKinds(projectId: number): Promise<Record<number, string>> {
  const members = await projectApi.listMembers(projectId).catch(() => [])
  return Object.fromEntries(members.map((m) => [m.userId, m.role?.kind ?? resolveKindByName(m.role?.name)]))
}

const resolveKindByName = (name: string | undefined) =>
  name && /(^|\s)(qa|tester|kiểm thử)($|\s)/i.test(name) ? 'QA' : 'OTHER'

const env: WorkMockEnv = {
  actor: currentActor,
  projectAccess: mockProjectAccess,
  workflow: mockWorkflow,
  members: mockMembers,
  reqs: (projectId) => (documentMockStore ? documentMockStore.reqIndex(projectId) : httpReqs(projectId)),
  sections: docSections,
  memberKinds,
  storage: browserStorage(),
}

export const issueMockStore: IssueMockStore | null = MOCK.kanban || MOCK.tests ? new IssueMockStore(env) : null
export const testMockStore: TestMockStore | null =
  MOCK.tests && issueMockStore ? new TestMockStore(env, issueMockStore) : null
