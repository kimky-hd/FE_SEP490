import { describe, expect, it } from 'vitest'
import type { BoardColumnDto, IssueSummaryDto } from '@/types/issue'
import type { TestCaseSummaryDto, TestRunDto, TestTreeNodeDto } from '@/types/testing'
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

const tc = (key: string): TestCaseSummaryDto => ({
  testCaseId: Number(key.slice(3)),
  key,
  title: `Test ${key}`,
  type: 'FUNCTIONAL',
  priority: 'HIGH',
  folderId: null,
  requirements: [],
  issues: [],
  stepCount: 1,
  needsReview: false,
  lastResult: null,
  lastRunAt: null,
  lastRunBy: null,
  updatedAt: '2026-10-30T08:00:00Z',
})

const run = (runId: number, patch: Partial<TestRunDto> = {}): TestRunDto => ({
  runId,
  cycleId: 50,
  testCase: tc(`TC-${runId}`),
  assignee: me,
  result: 'NOT_RUN',
  note: null,
  executedAt: null,
  executedBy: null,
  defects: [],
  needsRerun: false,
  ...patch,
})

const data = (patch: Partial<IssueWorkData> = {}): IssueWorkData => ({
  columns: COLUMNS,
  issues: [],
  cycles: [
    {
      cycleId: 50,
      name: 'Sprint 4 · hồi quy',
      sprintId: null,
      status: 'OPEN',
      counts: { pass: 0, fail: 0, blocked: 0, notRun: 0 },
      createdAt: '2026-10-29T08:00:00Z',
    },
  ],
  runs: [],
  tree: null,
  ...patch,
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
          runs: [
            run(9, { assignee: other, result: 'FAIL', defects: [{ issueId: 105, key: 'CORE-105', statusId: 2 }] }),
          ],
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

  it('lượt chạy của tôi: cần chạy lại từng dòng, chưa chạy gộp theo đợt; đợt đóng bỏ qua', () => {
    const items = buildIssueWorkItems(
      {
        project,
        role: 'QA',
        me,
        data: data({
          runs: [
            run(1, { result: 'PASS', needsRerun: true }),
            run(2),
            run(3),
            run(4, { assignee: other }),
            run(5, { cycleId: 60 }),
          ],
        }),
      },
      t,
    )
    expect(kinds(items)).toEqual([
      ['TEST_RERUN', 'TC-1'],
      ['TEST_NOT_RUN', null],
    ])
    expect(items[1]).toMatchObject({
      count: 2,
      title: '2 lượt test chưa chạy',
      action: { href: '/projects/1/tests/cycles/50?run=mine' },
    })
    expect(testsSignal(items)).toBe('red')
  })

  it('REQ chưa có testcase: chỉ QA có testcase.manage, gộp theo tài liệu', () => {
    const tree: TestTreeNodeDto[] = [
      {
        id: 'doc-1',
        kind: 'DOCUMENT',
        parentId: null,
        label: 'SRS-01 · Xác thực',
        requirement: null,
        testCount: 2,
        needsReviewCount: 0,
      },
      {
        id: 'req-1-a',
        kind: 'REQUIREMENT',
        parentId: 'doc-1',
        label: 'REQ-01 · Đăng nhập',
        requirement: {
          documentId: 1,
          documentCode: 'SRS-01',
          reqUid: 'a',
          reqKey: 'REQ-01',
          title: 'Đăng nhập',
          freshness: 'FRESH',
          changedNote: null,
        },
        testCount: 2,
        needsReviewCount: 0,
      },
      {
        id: 'req-1-b',
        kind: 'REQUIREMENT',
        parentId: 'doc-1',
        label: 'REQ-02 · Khoá tạm',
        requirement: {
          documentId: 1,
          documentCode: 'SRS-01',
          reqUid: 'b',
          reqKey: 'REQ-02',
          title: 'Khoá tạm',
          freshness: 'FRESH',
          changedNote: null,
        },
        testCount: 0,
        needsReviewCount: 0,
      },
    ]
    const qa = buildIssueWorkItems({ project, role: 'QA', me, data: data({ tree }) }, t)
    expect(kinds(qa)).toEqual([['REQ_WITHOUT_TEST', 'SRS-01']])
    expect(qa[0]).toMatchObject({
      title: 'REQ-02 · Khoá tạm',
      action: { href: '/projects/1/tests?node=req-1-b&new=1' },
    })
    expect(buildIssueWorkItems({ project, role: 'DEV', me, data: data({ tree }) }, t)).toEqual([])
    expect(
      buildIssueWorkItems(
        { project: { ...project, permissions: ['testcase.view'] }, role: 'QA', me, data: data({ tree }) },
        t,
      ),
    ).toEqual([])
  })
})
