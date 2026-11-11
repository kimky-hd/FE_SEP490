import { tr } from '@/i18n'
import { normalizeGates, type GateCriterion } from './phaseGates'
import type { PhaseDto, PhaseLifecycleStatus } from '@/types/project'
import type { DocType, DocumentNodeDto, RequirementItemDto } from '@/types/document'
import type { IssueSummaryDto } from '@/types/issue'
import type { TestCaseDto, TestPlanDto } from '@/types/testing'
import { statusIn } from './testplan/status'

// Kiểm điều kiện hoàn thành giai đoạn (lib/phaseGates.ts) từ dữ liệu FE đã tải được — hàm thuần, không gọi API.
// Nguồn nào không tải được (không có quyền / mô-đun tắt / lỗi) thì điều kiện phụ thuộc là UNKNOWN ("không kiểm được"),
// không đoán. BE sẽ kiểm lại khi chốt phase (§12.6, đề xuất).

export type GateState = 'MET' | 'UNMET' | 'UNKNOWN'

export interface GateResult {
  criterion: GateCriterion
  state: GateState
  /** Câu ngắn cho checklist, vd "3/5 REQ đã gắn issue". */
  detail: string
}

export type SourceUnavailable = 'NO_PERMISSION' | 'DISABLED' | 'ERROR'

/** Một nguồn dữ liệu: có dữ liệu, hoặc lý do không có. */
export type GateSource<T> = { ok: true; data: T } | { ok: false; reason: SourceUnavailable }

export interface GateEvalInput {
  /** Cây tài liệu của dự án (GET /projects/{id}/documents). */
  documents: GateSource<DocumentNodeDto[]>
  /** REQ bản hiện tại của từng tài liệu đặc tả (documentId → REQ). Một trang lỗi → cả nguồn lỗi. */
  requirements: GateSource<Map<number, RequirementItemDto[]>>
  /** Mọi issue của dự án (GET /projects/{id}/issues). */
  issues: GateSource<IssueSummaryDto[]>
  /** Đợt test hiện tại + testcase của đợt (Test cases v2: T1, T3, #47). */
  testCases: GateSource<TestGateData>
}

/** Dữ liệu Test cases cho điều kiện TESTS_PASSED. `plan` null = dự án chưa có đợt test. */
export interface TestGateData {
  plan: Pick<TestPlanDto, 'name' | 'status' | 'environments'> | null
  cases: Pick<TestCaseDto, 'requirements' | 'status' | 'results' | 'retest'>[]
}

/** Tài liệu "đặc tả" = trang có loại URD / BRD / SRS (OTHER và thư mục không tính). */
export const SPEC_DOC_TYPES: readonly DocType[] = ['URD', 'BRD', 'SRS']

export const isSpecDoc = (n: DocumentNodeDto) =>
  n.kind === 'PAGE' && n.docType !== null && SPEC_DOC_TYPES.includes(n.docType)

const isApproved = (n: DocumentNodeDto) => n.isBaselined || n.currentVersion?.status === 'APPROVED'

const reqKey = (documentId: number, reqUid: string) => `${documentId}:${reqUid}`

function unknown(criterion: GateCriterion, reason: SourceUnavailable): GateResult {
  const why =
    reason === 'NO_PERMISSION'
      ? tr('bạn không có quyền xem dữ liệu cần kiểm', 'you cannot view the data needed')
      : reason === 'DISABLED'
        ? tr('mô-đun liên quan chưa bật', 'the related module is not enabled')
        : tr('không tải được dữ liệu', 'could not load the data')
  return { criterion, state: 'UNKNOWN', detail: tr(`Không kiểm được: ${why}.`, `Cannot check: ${why}.`) }
}

const result = (criterion: GateCriterion, met: boolean, detail: string): GateResult => ({
  criterion,
  state: met ? 'MET' : 'UNMET',
  detail,
})

/** Kiểm một điều kiện. `phase` chỉ dùng cho ISSUES_DONE (issue thuộc phase theo trạng thái); các điều kiện khác tính cả dự án. */
export function evaluateGate(criterion: GateCriterion, phase: PhaseDto, input: GateEvalInput): GateResult {
  const { documents, requirements, issues, testCases } = input
  switch (criterion) {
    case 'DOC_APPROVED': {
      if (!documents.ok) return unknown(criterion, documents.reason)
      const specs = documents.data.filter(isSpecDoc)
      const approved = specs.filter(isApproved).length
      if (specs.length === 0)
        return result(
          criterion,
          false,
          tr('Chưa có tài liệu đặc tả (URD/BRD/SRS).', 'No spec document (URD/BRD/SRS) yet.'),
        )
      return result(
        criterion,
        approved > 0,
        tr(
          `${approved}/${specs.length} tài liệu đặc tả đã duyệt`,
          `${approved}/${specs.length} spec documents approved`,
        ),
      )
    }
    case 'REQ_SEGMENTED': {
      if (!documents.ok) return unknown(criterion, documents.reason)
      const specs = documents.data.filter(isSpecDoc)
      if (specs.length === 0)
        return result(
          criterion,
          false,
          tr('Chưa có tài liệu đặc tả (URD/BRD/SRS).', 'No spec document (URD/BRD/SRS) yet.'),
        )
      const segmented = specs.filter((d) => d.reqCount > 0)
      const total = segmented.reduce((n, d) => n + d.reqCount, 0)
      return result(
        criterion,
        segmented.length === specs.length,
        tr(
          `${segmented.length}/${specs.length} tài liệu đặc tả đã tách REQ (${total} REQ)`,
          `${segmented.length}/${specs.length} spec documents split into REQs (${total} REQs)`,
        ),
      )
    }
    case 'REQ_LINKED_ISSUES': {
      if (!requirements.ok) return unknown(criterion, requirements.reason)
      if (!issues.ok) return unknown(criterion, issues.reason)
      const all = new Set<string>()
      for (const [documentId, reqs] of requirements.data) for (const r of reqs) all.add(reqKey(documentId, r.reqUid))
      if (all.size === 0) return result(criterion, false, tr('Chưa có REQ nào.', 'No REQs yet.'))
      const linked = new Set<string>()
      for (const i of issues.data)
        for (const r of i.requirements) {
          const k = reqKey(r.documentId, r.reqUid)
          if (all.has(k)) linked.add(k)
        }
      return result(
        criterion,
        linked.size === all.size,
        tr(`${linked.size}/${all.size} REQ đã gắn issue`, `${linked.size}/${all.size} REQs linked to an issue`),
      )
    }
    case 'ISSUES_DONE': {
      if (!issues.ok) return unknown(criterion, issues.reason)
      const category = new Map(phase.statuses.map((s) => [s.statusId, s.category]))
      const inPhase = issues.data.filter((i) => category.has(i.statusId))
      const done = inPhase.filter((i) => category.get(i.statusId) === 'DONE').length
      if (inPhase.length === 0)
        return result(criterion, true, tr('Giai đoạn chưa có issue nào.', 'This phase has no issues.'))
      return result(
        criterion,
        done === inPhase.length,
        tr(`${done}/${inPhase.length} issue đã xong`, `${done}/${inPhase.length} issues done`),
      )
    }
    case 'TESTS_PASSED': {
      if (!testCases.ok) return unknown(criterion, testCases.reason)
      // Test cases v2: đợt test đã "Hoàn tất & bàn giao" → đạt. Chưa bàn giao: mọi testcase gắn REQ (đang dùng) phải
      // Pass ở môi trường đầu (vd SIT); Fail / N/A / chưa test / cần test lại đều chưa đạt.
      const { plan, cases } = testCases.data
      if (!plan) return result(criterion, false, tr('Chưa có đợt test.', 'No test plan yet.'))
      if (plan.status === 'HANDED_OVER')
        return result(
          criterion,
          true,
          tr(`Đợt test "${plan.name}" đã bàn giao`, `Test plan "${plan.name}" handed over`),
        )
      const env = plan.environments[0]
      const linked = cases.filter((tc) => tc.status === 'ACTIVE' && tc.requirements.length > 0)
      if (!env || linked.length === 0)
        return result(criterion, false, tr('Chưa có testcase nào gắn REQ.', 'No test case is linked to a REQ.'))
      const st = linked.map((tc) => statusIn(tc, env.envId))
      const passed = st.filter((s) => s === 'PASS').length
      const failed = st.filter((s) => s === 'FAIL').length
      const retest = st.filter((s) => s === 'RETEST').length
      const extra = [
        failed > 0 ? tr(`${failed} Fail`, `${failed} failed`) : null,
        retest > 0 ? tr(`${retest} cần test lại`, `${retest} to retest`) : null,
        tr('chưa bàn giao', 'not handed over'),
      ].filter(Boolean)
      return result(
        criterion,
        passed === linked.length,
        tr(
          `${passed}/${linked.length} testcase đạt ở ${env.name}`,
          `${passed}/${linked.length} test cases pass on ${env.name}`,
        ) + ` · ${extra.join(' · ')}`,
      )
    }
    case 'RTM_ZERO_STALE': {
      if (!requirements.ok) return unknown(criterion, requirements.reason)
      let total = 0
      let stale = 0
      for (const reqs of requirements.data.values()) {
        total += reqs.length
        stale += reqs.filter((r) => r.freshness === 'STALE').length
      }
      if (total === 0) return result(criterion, true, tr('Chưa có REQ nào.', 'No REQs yet.'))
      return result(
        criterion,
        stale === 0,
        stale === 0
          ? tr(`Không có REQ lệch (${total} REQ)`, `No stale REQs (${total} REQs)`)
          : tr(`${stale}/${total} REQ đang lệch (Stale)`, `${stale}/${total} REQs stale`),
      )
    }
  }
}

/** Kiểm mọi điều kiện của phase (phase BE chưa trả `exitCriteria` → không có điều kiện). */
export function evaluatePhaseGates(phase: PhaseDto, input: GateEvalInput): GateResult[] {
  return normalizeGates(phase.exitCriteria).map((c) => evaluateGate(c, phase, input))
}

/** Được "Hoàn tất" thẳng khi mọi điều kiện MET; UNKNOWN cũng phải chuyển có lý do (Override). */
export const allGatesMet = (results: readonly GateResult[]) => results.every((r) => r.state === 'MET')

/** Nguồn cần tải cho tập điều kiện (để không gọi API thừa). */
export function neededSources(criteria: readonly GateCriterion[]) {
  const has = (...cs: GateCriterion[]) => cs.some((c) => criteria.includes(c))
  return {
    documents: has('DOC_APPROVED', 'REQ_SEGMENTED', 'REQ_LINKED_ISSUES', 'RTM_ZERO_STALE'),
    requirements: has('REQ_LINKED_ISSUES', 'RTM_ZERO_STALE'),
    issues: has('REQ_LINKED_ISSUES', 'ISSUES_DONE'),
    testCases: has('TESTS_PASSED'),
  }
}

export interface PhaseLifecycle {
  status: PhaseLifecycleStatus
  /** true khi BE chưa trả `lifecycleStatus` và FE suy ra (phase bật đầu tiên = đang chạy). */
  inferred: boolean
}

/**
 * Trạng thái tiến độ của từng phase đang bật (phase đã tắt không có). BE trả `lifecycleStatus` thì dùng nguyên
 * (thiếu ở phase nào → UPCOMING); chưa trả ở phase nào cả thì theo mặc định §12.6: phase bật đầu tiên ACTIVE, còn lại UPCOMING.
 */
export function phaseLifecycles(phases: readonly PhaseDto[]): Map<number, PhaseLifecycle> {
  const enabled = [...phases].filter((p) => p.isActive).sort((a, b) => a.position - b.position)
  const fromBe = enabled.some((p) => p.lifecycleStatus !== undefined)
  return new Map(
    enabled.map((p, i) => [
      p.phaseId,
      fromBe
        ? { status: p.lifecycleStatus ?? 'UPCOMING', inferred: false }
        : { status: i === 0 ? 'ACTIVE' : 'UPCOMING', inferred: true },
    ]),
  )
}

/** Phase mở lại được = phase COMPLETED gần nhất (đứng ngay trước phase đang chạy, hoặc cuối cùng nếu đã xong hết). */
export function reopenablePhaseId(phases: readonly PhaseDto[], lifecycles: Map<number, PhaseLifecycle>): number | null {
  const enabled = [...phases].filter((p) => p.isActive).sort((a, b) => a.position - b.position)
  let last: number | null = null
  for (const p of enabled) {
    const status = lifecycles.get(p.phaseId)?.status
    if (status === 'COMPLETED') last = p.phaseId
    else break
  }
  return last
}
