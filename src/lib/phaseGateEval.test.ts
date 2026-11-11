import { describe, expect, it } from 'vitest'
import {
  allGatesMet,
  evaluateGate,
  evaluatePhaseGates,
  neededSources,
  phaseLifecycles,
  reopenablePhaseId,
  type GateEvalInput,
} from './phaseGateEval'
import type { PhaseDto, WorkflowStatusDto } from '@/types/project'
import type { DocumentNodeDto, RequirementItemDto } from '@/types/document'
import type { IssueSummaryDto } from '@/types/issue'
import type { TestCaseDto, TestResult } from '@/types/testing'

const status = (statusId: number, category: WorkflowStatusDto['category']): WorkflowStatusDto => ({
  statusId,
  name: `S${statusId}`,
  category,
  color: null,
  description: null,
  isInitial: category === 'TODO',
  position: statusId,
  isActive: true,
  issueCount: 0,
})

const phase = (phaseId: number, extra: Partial<PhaseDto> = {}): PhaseDto => ({
  phaseId,
  name: `P${phaseId}`,
  description: null,
  position: phaseId,
  isActive: true,
  statuses: [status(phaseId * 10 + 1, 'TODO'), status(phaseId * 10 + 2, 'DONE')],
  transitions: [],
  ...extra,
})

const doc = (documentId: number, extra: Partial<DocumentNodeDto> = {}): DocumentNodeDto => ({
  documentId,
  projectId: 1,
  parentId: null,
  kind: 'PAGE',
  title: `Doc ${documentId}`,
  docType: 'SRS',
  code: null,
  sortOrder: documentId,
  currentVersion: { versionId: documentId * 100, label: '1.0', status: 'DRAFT' },
  isBaselined: false,
  baselineVersionId: null,
  reqCount: 0,
  updatedAt: '2026-11-01T00:00:00Z',
  ...extra,
})

const req = (reqUid: string, freshness: 'FRESH' | 'STALE' = 'FRESH') =>
  ({ reqUid, reqKey: reqUid, freshness }) as RequirementItemDto

const issue = (issueId: number, statusId: number, reqs: { documentId: number; reqUid: string }[] = []) =>
  ({
    issueId,
    statusId,
    requirements: reqs.map((r) => ({
      ...r,
      documentCode: '',
      reqKey: null,
      title: null,
      freshness: null,
      changedNote: null,
    })),
  }) as unknown as IssueSummaryDto

const tc = (result: TestResult | null, retest = false, linked = true, deleted = false) =>
  ({
    status: deleted ? 'DELETED' : 'ACTIVE',
    requirements: linked ? [{ documentId: 1, reqUid: 'a' }] : [],
    results: result ? [{ envId: 1, result }] : [],
    retest: retest ? [{ envId: 1, reason: 'REGRESSION' }] : [],
  }) as unknown as TestCaseDto

const plan = (status: 'OPEN' | 'HANDED_OVER' = 'OPEN') => ({
  name: 'SIT – R3',
  status,
  environments: [{ envId: 1, name: 'SIT' }] as never,
})

const ok = <T>(data: T) => ({ ok: true as const, data })

const input = (over: Partial<GateEvalInput> = {}): GateEvalInput => ({
  documents: ok([]),
  requirements: ok(new Map()),
  issues: ok([]),
  testCases: ok({ plan: plan(), cases: [] }),
  ...over,
})

const P = phase(1)

describe('Kiểm điều kiện hoàn thành giai đoạn', () => {
  it('DOC_APPROVED: cần ≥ 1 trang đặc tả đã duyệt; OTHER / thư mục không tính', () => {
    expect(evaluateGate('DOC_APPROVED', P, input()).state).toBe('UNMET')
    const docs = [
      doc(1),
      doc(2, { isBaselined: true }),
      doc(3, { docType: 'OTHER', isBaselined: true }),
      doc(4, { kind: 'FOLDER', docType: null }),
    ]
    const r = evaluateGate('DOC_APPROVED', P, input({ documents: ok(docs) }))
    expect(r.state).toBe('MET')
    expect(r.detail).toContain('1/2')
  })

  it('REQ_SEGMENTED: mọi trang đặc tả có REQ', () => {
    const docs = [doc(1, { reqCount: 3 }), doc(2)]
    expect(evaluateGate('REQ_SEGMENTED', P, input({ documents: ok(docs) }))).toMatchObject({ state: 'UNMET' })
    expect(evaluateGate('REQ_SEGMENTED', P, input({ documents: ok([doc(1, { reqCount: 3 })]) })).state).toBe('MET')
  })

  it('REQ_LINKED_ISSUES: đếm REQ có issue gắn, theo cặp (documentId, reqUid)', () => {
    const requirements = ok(new Map([[1, [req('a'), req('b'), req('c')]]]))
    const issues = ok([issue(1, 11, [{ documentId: 1, reqUid: 'a' }]), issue(2, 11, [{ documentId: 2, reqUid: 'b' }])])
    const r = evaluateGate('REQ_LINKED_ISSUES', P, input({ requirements, issues }))
    expect(r.state).toBe('UNMET')
    expect(r.detail).toContain('1/3')
  })

  it('ISSUES_DONE: chỉ tính issue ở trạng thái của phase đang xét', () => {
    const issues = ok([issue(1, 12), issue(2, 11), issue(3, 21)])
    const r = evaluateGate('ISSUES_DONE', P, input({ issues }))
    expect(r.state).toBe('UNMET')
    expect(r.detail).toContain('1/2')
    expect(evaluateGate('ISSUES_DONE', phase(3), input({ issues })).state).toBe('MET')
  })

  it('TESTS_PASSED: bàn giao → đạt; chưa bàn giao thì mọi case gắn REQ phải Pass ở môi trường đầu', () => {
    const run = (cases: TestCaseDto[], status: 'OPEN' | 'HANDED_OVER' = 'OPEN') =>
      evaluateGate('TESTS_PASSED', P, input({ testCases: ok({ plan: plan(status), cases }) }))
    expect(run([tc('PASS'), tc('FAIL')]).state).toBe('UNMET')
    expect(run([tc('PASS'), tc('NA')]).state).toBe('UNMET')
    expect(run([tc('PASS'), tc(null)]).state).toBe('UNMET')
    expect(run([tc('PASS', true)]).state).toBe('UNMET')
    expect(run([tc('PASS'), tc('FAIL', false, false), tc('FAIL', false, true, true)]).state).toBe('MET')
    expect(run([]).state).toBe('UNMET')
    expect(run([tc('FAIL')], 'HANDED_OVER').state).toBe('MET')
    expect(evaluateGate('TESTS_PASSED', P, input({ testCases: ok({ plan: null, cases: [] }) })).state).toBe('UNMET')
  })

  it('RTM_ZERO_STALE: theo freshness của REQ', () => {
    const run = (reqs: RequirementItemDto[]) =>
      evaluateGate('RTM_ZERO_STALE', P, input({ requirements: ok(new Map([[1, reqs]])) }))
    expect(run([req('a'), req('b', 'STALE')]).state).toBe('UNMET')
    expect(run([req('a')]).state).toBe('MET')
  })

  it('nguồn không có → UNKNOWN, không đoán; UNKNOWN chặn "Hoàn tất" thẳng', () => {
    const results = evaluatePhaseGates(
      phase(1, { exitCriteria: ['ISSUES_DONE', 'TESTS_PASSED', 'BOGUS'] }),
      input({ testCases: { ok: false, reason: 'NO_PERMISSION' } }),
    )
    expect(results.map((r) => [r.criterion, r.state])).toEqual([
      ['ISSUES_DONE', 'MET'],
      ['TESTS_PASSED', 'UNKNOWN'],
    ])
    expect(allGatesMet(results)).toBe(false)
    expect(allGatesMet(evaluatePhaseGates(phase(1), input()))).toBe(true)
  })

  it('neededSources chỉ tải nguồn cần', () => {
    expect(neededSources(['ISSUES_DONE'])).toEqual({
      documents: false,
      requirements: false,
      issues: true,
      testCases: false,
    })
  })
})

describe('Tiến độ giai đoạn', () => {
  it('BE chưa trả lifecycleStatus → phase bật đầu tiên đang chạy (suy ra), phase tắt bỏ qua', () => {
    const map = phaseLifecycles([phase(2), phase(1, { isActive: false }), phase(3)])
    expect(map.get(1)).toBeUndefined()
    expect(map.get(2)).toEqual({ status: 'ACTIVE', inferred: true })
    expect(map.get(3)).toEqual({ status: 'UPCOMING', inferred: true })
  })

  it('BE có lifecycleStatus → dùng nguyên; chỉ mở lại được phase xong gần nhất', () => {
    const phases = [
      phase(1, { lifecycleStatus: 'COMPLETED' }),
      phase(2, { lifecycleStatus: 'COMPLETED' }),
      phase(3, { lifecycleStatus: 'ACTIVE' }),
      phase(4),
    ]
    const map = phaseLifecycles(phases)
    expect(map.get(4)).toEqual({ status: 'UPCOMING', inferred: false })
    expect(reopenablePhaseId(phases, map)).toBe(2)
    expect(reopenablePhaseId([phase(1)], phaseLifecycles([phase(1)]))).toBeNull()
  })
})
