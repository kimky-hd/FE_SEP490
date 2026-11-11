import { documentApi } from '@/api/documentApi'
import { issueApi } from '@/api/issueApi'
import { testApi } from '@/api/testApi'
import { ApiError } from '@/lib/apiClient'
import { FEATURES } from '@/lib/features'
import { useAsync } from '@/lib/useAsync'
import type { GateCriterion } from '@/lib/phaseGates'
import { isSpecDoc, neededSources, type GateEvalInput, type GateSource, type TestGateData } from '@/lib/phaseGateEval'
import { PERMISSIONS } from '@/types/rbac'

// Tải dữ liệu để kiểm điều kiện hoàn thành giai đoạn bằng các API FE đã có (Documents §7, Issues §4.2, Testcases).
// Chỉ tải nguồn mà tập điều kiện cần; nguồn không có quyền / mô-đun tắt / lỗi → điều kiện "không kiểm được".
// REQ từng trang đặc tả là N request (chưa có endpoint gộp) — chấp nhận được vì chỉ tải khi có điều kiện cần REQ.

const NOT_NEEDED = { ok: false, reason: 'DISABLED' } as const

/** Đợt test hiện tại (đang mở, không có thì mới nhất) + testcase của đợt — cho điều kiện TESTS_PASSED. */
async function loadTestGate(projectId: number): Promise<TestGateData> {
  const plans = await testApi.plans(projectId)
  const current = plans.find((p) => p.status === 'OPEN') ?? plans[0]
  if (!current) return { plan: null, cases: [] }
  const [plan, cases] = await Promise.all([
    testApi.plan(current.planId),
    testApi.list(projectId, { planId: current.planId }),
  ])
  return { plan, cases }
}

async function load<T>(allowed: boolean, enabled: boolean, fn: () => Promise<T>): Promise<GateSource<T>> {
  if (!enabled) return NOT_NEEDED
  if (!allowed) return { ok: false, reason: 'NO_PERMISSION' }
  try {
    return { ok: true, data: await fn() }
  } catch (err) {
    return { ok: false, reason: err instanceof ApiError && err.status === 403 ? 'NO_PERMISSION' : 'ERROR' }
  }
}

export function usePhaseGateInput(
  projectId: number,
  criteria: readonly GateCriterion[],
  can: (permission: string) => boolean,
) {
  const need = neededSources(criteria)
  const canDocs = can(PERMISSIONS.documentView)
  const canIssues = can(PERMISSIONS.issueView)
  const canTests = can(PERMISSIONS.testCaseView)

  return useAsync<GateEvalInput>(async () => {
    const [documents, issues, testCases] = await Promise.all([
      load(canDocs, need.documents, () => documentApi.listTree(projectId)),
      load(canIssues, need.issues && FEATURES.kanban, () => issueApi.list(projectId)),
      load(canTests, need.testCases && FEATURES.testcases, () => loadTestGate(projectId)),
    ])
    const requirements: GateEvalInput['requirements'] = !need.requirements
      ? NOT_NEEDED
      : !documents.ok
        ? documents
        : await load(true, true, async () => {
            const specs = documents.data.filter(isSpecDoc)
            const lists = await Promise.all(specs.map((d) => documentApi.listRequirements(d.documentId)))
            return new Map(specs.map((d, i) => [d.documentId, lists[i]]))
          })
    return { documents, requirements, issues, testCases }
  }, [projectId, canDocs, canIssues, canTests, need.documents, need.requirements, need.issues, need.testCases])
}
