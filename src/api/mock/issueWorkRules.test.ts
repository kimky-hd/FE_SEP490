import { describe, expect, it } from 'vitest'
import type { BoardColumnDto, IssueSummaryDto } from '@/types/issue'
import type { TestCaseDto, TestPlanDto, TestResult, TraceRowDto } from '@/types/testing'
import { kanbanSignal, testsSignal, toWorkItem, type WorkItem } from '@/lib/myWorkRules'
import { buildIssueWorkItems as buildDtos, type IssueWorkInput, type IssueWorkData } from './issueWorkRules'

const t = (vi: string) => vi
// Luật chọn việc (mock của GET /me/work-items) + trình bày phía FE.
const buildIssueWorkItems = (input: IssueWorkInput, tr: typeof t): WorkItem[] =>
  buildDtos(input).map((d) => toWorkItem(d, tr))
const me = { userId: 7, fullName: 'Minh Anh' }
const other = { userId: 8, fullName: 'Trần Hà' }
const project = {
  projectId: 1,
  name: 'Checkout',
  key: 'CORE',
  permissions: ['issue.view', 'testcase.view', 'testcase.manage'],
}

const col = (statusId: number, name: string, category: BoardColumnDto['category']): BoardColumnDto => ({
  statusId,
  name,
  category,
  color: null,
  phaseId: 1,
  phaseName: 'Sprint',
  position: statusId,
  isInitial: statusId === 1,
  wipLimit: null,
})
const COLUMNS = [
  col(1, 'Cần làm', 'TODO'),
  col(2, 'Đang làm', 'IN_PROGRESS'),
  col(3, 'Review / QA', 'IN_PROGRESS'),
  col(4, 'Xong', 'DONE'),
]

const issue = (issueId: number, patch: Partial<IssueSummaryDto> = {}): IssueSummaryDto => ({
  issueId,
  key: `CORE-${issueId}`,
  type: 'TASK',
  title: `Issue ${issueId}`,
  statusId: 2,
  priority: 'MEDIUM',
  points: 3,
  assignee: me,
  sprintId: 1,
  parentId: null,
  rank: '1',
  labels: [],
  requirements: [],
  reqChanged: false,
  tests: { total: 0, pass: 0, fail: 0, blocked: 0, notRun: 0 },
  subtaskCount: 0,
  subtaskDone: 0,
  updatedAt: '2026-10-30T08:00:00Z',
  ...patch,
})

// Đợt test: 2 môi trường (SIT 1, UAT 2), 2 module; tôi được giao module 10 ở SIT.
const PLAN = {
  planId: 50,
  name: 'SIT – R3',
  status: 'OPEN',
  createdAt: '2026-10-29T08:00:00Z',
  environments: [
    { envId: 1, name: 'SIT' },
    { envId: 2, name: 'UAT' },
  ],
  modules: [
    { moduleId: 10, name: 'Cấu hình phí', shortCode: 'PHI' },
    { moduleId: 11, name: 'Thanh toán QR', shortCode: 'QR' },
  ],
  assignments: [
    { moduleId: 10, envId: 1, assignee: me },
    { moduleId: 11, envId: 1, assignee: other },
  ],
} as unknown as TestPlanDto

const tc = (
  testCaseId: number,
  patch: { moduleId?: number; result?: TestResult; retest?: boolean; bug?: number } = {},
): TestCaseDto =>
  ({
    testCaseId,
    planId: 50,
    moduleId: patch.moduleId ?? 10,
    sectionId: 1,
    code: `TC_${testCaseId}`,
    title: `Test ${testCaseId}`,
    status: 'ACTIVE',
    requirements: [],
    bug: patch.bug
      ? {
          issueId: patch.bug,
          key: `CORE-${patch.bug}`,
          title: 'Bug',
          priority: 'HIGH',
          statusName: 'Đang làm',
          statusCategory: 'IN_PROGRESS',
        }
      : null,
    results: patch.result
      ? [
          {
            resultId: 1,
            envId: 1,
            build: 'v1',
            result: patch.result,
            by: me,
            at: '2026-10-30T08:00:00Z',
            behalfOf: null,
          },
        ]
      : [],
    retest: patch.retest
      ? [
          {
            envId: 1,
            reason: 'BUG_FIXED',
            bug: { issueId: 9, key: 'CORE-9' },
            build: 'v1.0.2',
            reqKey: null,
            at: '2026-10-31T08:00:00Z',
          },
        ]
      : [],
    updatedAt: '2026-10-30T08:00:00Z',
  }) as unknown as TestCaseDto

const data = (
  patch: Partial<Omit<IssueWorkData, 'tests'>> & { cases?: TestCaseDto[]; trace?: TraceRowDto[] | null } = {},
): IssueWorkData => ({
  columns: COLUMNS,
  issues: patch.issues ?? [],
  tests: { plan: PLAN, cases: patch.cases ?? [], trace: patch.trace ?? null },
})

const kinds = (items: ReturnType<typeof buildIssueWorkItems>) => items.map((x) => [x.kind, x.code])

describe('buildIssueWorkItems', () => {
  it('issue của tôi: mỗi issue một dòng, loại gấp nhất; bỏ issue xong / của người khác', () => {
    const items = buildIssueWorkItems(
      {
        project,
        role: 'DEV',
        me,
        data: data({
          issues: [
            issue(101, { statusId: 3, tests: { total: 2, pass: 2, fail: 0, blocked: 0, notRun: 0 } }),
            issue(104, {
              type: 'BUG',
              reqChanged: true,
              requirements: [
                {
                  documentId: 1,
                  documentCode: 'SRS-02',
                  reqUid: 'u',
                  reqKey: 'REQ-02',
                  title: 'Webhook',
                  freshness: 'STALE',
                  changedNote: 'Đổi trong bản 1.2',
                },
              ],
            }),
            issue(105, { type: 'BUG' }),
            issue(103),
            issue(106, { statusId: 4 }),
            issue(107, { assignee: other }),
          ],
          cases: [tc(9, { moduleId: 11, result: 'FAIL', bug: 105 })],
        }),
      },
      t,
    )
    expect(kinds(items)).toEqual([
      ['ISSUE_READY_TO_CLOSE', 'CORE-101'],
      ['ISSUE_REQ_CHANGED', 'CORE-104'],
      ['TEST_FAILED_MINE', 'CORE-105'],
      ['ISSUE_ASSIGNED', 'CORE-103'],
    ])
    expect(items[1].sub).toBe('REQ-02 · Đổi trong bản 1.2')
    expect(items[2]).toMatchObject({
      tone: 'bad',
      category: 'changes',
      action: { href: '/projects/1/kanban?issue=CORE-105' },
    })
    expect(kanbanSignal(items)).toBe('orange')
    expect(testsSignal(items)).toBe('red')
  })

  it('testcase của tôi (module được giao ở môi trường): cần test lại từng dòng, chưa test gộp theo module × môi trường', () => {
    const items = buildIssueWorkItems(
      {
        project,
        role: 'QA',
        me,
        data: data({
          cases: [
            tc(1, { result: 'FAIL', retest: true }),
            tc(2),
            tc(3),
            tc(4, { moduleId: 11 }),
            tc(5, { result: 'PASS' }),
          ],
        }),
      },
      t,
    )
    expect(kinds(items)).toEqual([
      ['TEST_RERUN', 'PHI·TC_1'],
      ['TEST_NOT_RUN', null],
    ])
    expect(items[0]).toMatchObject({
      sub: 'SIT – R3 · SIT · CORE-9 đã fix ở v1.0.2',
      action: { href: '/projects/1/tests?tab=sheet&filter=retest&env=1&module=10&tc=1' },
    })
    expect(items[1]).toMatchObject({
      count: 2,
      title: '2 testcase chưa test',
      sub: 'Cấu hình phí · SIT',
      action: { href: '/projects/1/tests?tab=sheet&filter=untest&env=1&module=10' },
    })
    expect(testsSignal(items)).toBe('red')
    // Đợt test đã bàn giao: không còn việc test.
    const handed = {
      ...data({ cases: [tc(2)] }),
      tests: { plan: { ...PLAN, status: 'HANDED_OVER' as const }, cases: [tc(2)], trace: null },
    }
    expect(buildIssueWorkItems({ project, role: 'QA', me, data: handed }, t)).toEqual([])
  })

  it('REQ chưa có testcase: chỉ QA có testcase.manage, gộp theo tài liệu', () => {
    const row = (reqUid: string, reqKey: string, title: string, status: TraceRowDto['status']): TraceRowDto => ({
      documentId: 1,
      documentCode: 'SRS-01',
      documentTitle: 'Xác thực',
      reqUid,
      reqKey,
      title,
      anchorId: null,
      changed: false,
      status,
      cases: [],
      bugs: [],
    })
    const trace = [row('a', 'REQ-01', 'Đăng nhập', 'PASSED'), row('b', 'REQ-02', 'Khoá tạm', 'NO_TESTS')]
    const qa = buildIssueWorkItems({ project, role: 'QA', me, data: data({ trace }) }, t)
    expect(kinds(qa)).toEqual([['REQ_WITHOUT_TEST', 'SRS-01']])
    expect(qa[0]).toMatchObject({
      title: 'REQ-02 · Khoá tạm',
      action: { href: '/projects/1/tests?tab=trace&trace=NO_TESTS&doc=1' },
    })
    expect(buildIssueWorkItems({ project, role: 'DEV', me, data: data({ trace }) }, t)).toEqual([])
    expect(
      buildIssueWorkItems(
        { project: { ...project, permissions: ['testcase.view'] }, role: 'QA', me, data: data({ trace }) },
        t,
      ),
    ).toEqual([])
  })
})
