import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/apiClient'
import type { TipTapDoc } from '@/types/document'
import type { WorkflowDto } from '@/types/project'
import { DocumentMockStore } from './documentMockStore'
import { h, p, tasks } from './documentSeed'
import { IssueMockStore } from './issueMockStore'
import { TestMockStore } from './testMockStore'

const DOC_PERMS = ['document.view', 'document.edit', 'document.approve', 'document.revise', 'document.delete']
const WORK_PERMS = [
  'issue.view',
  'issue.create',
  'issue.update',
  'issue.assign',
  'issue.change_status',
  'issue.delete',
  'testcase.view',
  'testcase.manage',
  'comment.view',
  'comment.write',
  'activity.view',
  'ai.use',
  'project.workflow.manage',
]
const DEV = 10
const QA = 20

const role = (roleId: number) => ({ roleId, code: null, name: String(roleId), scope: 'PROJECT' as const })
const status = (
  statusId: number,
  name: string,
  category: 'TODO' | 'IN_PROGRESS' | 'DONE',
  position: number,
  isInitial = false,
) => ({
  statusId,
  name,
  category,
  color: null,
  description: null,
  isInitial,
  position,
  isActive: true,
  issueCount: 0,
})
const transition = (id: number, from: number, to: number, roles: number[]) => ({
  transitionId: id,
  fromStatusId: from,
  toStatusId: to,
  allowedRoles: roles.map(role),
  requireComment: false,
  commentHint: null,
  condition: null,
})

const WORKFLOW: WorkflowDto = {
  projectId: 1,
  sdlcMethod: 'SCRUM',
  phasesEditable: true,
  phases: [
    {
      phaseId: 1,
      name: 'Sprint',
      description: null,
      position: 1,
      isActive: true,
      statuses: [
        status(1, 'To Do', 'TODO', 1, true),
        status(2, 'Doing', 'IN_PROGRESS', 2),
        status(3, 'Review / QA', 'IN_PROGRESS', 3),
        status(4, 'Done', 'DONE', 4),
      ],
      transitions: [
        transition(1, 1, 2, [DEV]),
        transition(2, 2, 3, [DEV]),
        transition(3, 3, 4, [QA]),
        transition(4, 3, 2, [QA]),
      ],
    },
  ],
}

const reqDoc = (
  body = 'Thân REQ',
  criteria: [string, boolean][] = [
    ['Tiêu chí một', false],
    ['Tiêu chí hai', false],
  ],
): TipTapDoc => ({
  type: 'doc',
  content: [
    h('r1', 2, 'Webhook ngân hàng', { uid: 'req-a' }),
    p('p1', body),
    tasks('t1', criteria),
    h('r2', 2, 'Hoàn tiền', { uid: 'req-b' }),
    p('p2', 'Hoàn tiền'),
  ],
})

async function setup(opts: { roleId?: number; permissions?: string[] } = {}) {
  let clock = new Date('2026-10-30T08:00:00Z').getTime()
  let i = 0
  const access = { roleId: opts.roleId ?? DEV, permissions: opts.permissions ?? WORK_PERMS }
  const me = { userId: 7, fullName: 'Minh Anh' }
  const docs = new DocumentMockStore({
    actor: async () => me,
    projectAccess: async () => ({ permissions: DOC_PERMS, aiEnabled: true, archived: false }),
    now: () => new Date(clock),
    latency: () => 0,
    uid: () => `uid-${String(++i).padStart(4, '0')}`,
  })
  const env = {
    actor: async () => me,
    projectAccess: async () => ({ ...access, aiEnabled: true, archived: false, projectKey: 'CORE' }),
    workflow: async () => WORKFLOW,
    members: async () => [me, { userId: 8, fullName: 'Trần Hà' }],
    reqs: (projectId: number) => docs.reqIndex(projectId),
    now: () => new Date(clock),
    latency: () => 0,
  }
  const issues = new IssueMockStore(env)
  const tests = new TestMockStore(env, issues)
  // Một trang có 2 REQ, đã duyệt bản 1.0.
  const node = await docs.createNode(1, { kind: 'PAGE', title: 'Thanh toán', docType: 'SRS' })
  const d = await docs.getDocument(node.documentId)
  await docs.saveContent(node.documentId, d.current.versionId, { content: reqDoc(), rowVersion: d.current.rowVersion })
  await docs.submit(node.documentId, d.current.versionId)
  await docs.approve(node.documentId, d.current.versionId)
  const ref = (reqUid = 'req-a') => ({ documentId: node.documentId, reqUid })
  /** Sửa REQ-01, gửi duyệt và duyệt bản mới. */
  const approveRevision = async (content: TipTapDoc) => {
    const rev = await docs.createRevision(node.documentId)
    await docs.saveContent(node.documentId, rev.current.versionId, { content, rowVersion: rev.current.rowVersion })
    await docs.submit(node.documentId, rev.current.versionId)
    await docs.approve(node.documentId, rev.current.versionId)
  }
  return { docs, issues, tests, access, me, node, ref, approveRevision, tick: (ms: number) => (clock += ms) }
}

async function expectCode(promise: Promise<unknown>, status: number, code: string) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  )
  expect(err).toBeInstanceOf(ApiError)
  expect((err as ApiError).code).toBe(code)
  expect((err as ApiError).status).toBe(status)
  return err as ApiError
}

describe('IssueMockStore — issue, trạng thái, WIP', () => {
  it('tạo issue: key CORE-n, trạng thái IsInitial, REQ giải theo baseline', async () => {
    const { issues, ref } = await setup()
    const a = await issues.createIssue(1, { type: 'TASK', title: 'Một', requirementRefs: [ref()] })
    const b = await issues.createIssue(1, { type: 'BUG', title: 'Hai' })
    expect([a.key, b.key]).toEqual(['CORE-1', 'CORE-2'])
    expect(a.statusId).toBe(1)
    expect(a.requirements[0]).toMatchObject({
      documentCode: 'SRS-01',
      reqKey: 'REQ-01',
      title: 'Webhook ngân hàng',
      changedNote: null,
    })
    expect(a.allowedTransitions.map((x) => x.toStatusId)).toEqual([2])
    await expectCode(issues.createIssue(1, { type: 'TASK', title: '  ' }), 400, 'VALIDATION_ERROR')
    await expectCode(
      issues.createIssue(1, { type: 'TASK', title: 'X', requirementRefs: [{ documentId: 999, reqUid: 'nope' }] }),
      400,
      'INVALID_REQUIREMENT',
    )
  })

  it('D13: có project.workflow.manage thì bỏ qua kiểm tra role của transition (vẫn cần luật from → to)', async () => {
    const { issues } = await setup({ roleId: DEV })
    const a = await issues.createIssue(1, { type: 'TASK', title: 'Một' })
    await expectCode(issues.transition(a.issueId, { toStatusId: 3 }), 409, 'TRANSITION_NOT_ALLOWED')
    await issues.transition(a.issueId, { toStatusId: 2 })
    await issues.transition(a.issueId, { toStatusId: 3 })
    expect((await issues.transition(a.issueId, { toStatusId: 4 })).statusId).toBe(4)
  })

  it('transition: theo luật workflow + role; sai → TRANSITION_NOT_ALLOWED', async () => {
    const { issues, access } = await setup({
      roleId: DEV,
      permissions: WORK_PERMS.filter((p) => p !== 'project.workflow.manage'),
    })
    const a = await issues.createIssue(1, { type: 'TASK', title: 'Một' })
    await expectCode(issues.transition(a.issueId, { toStatusId: 3 }), 409, 'TRANSITION_NOT_ALLOWED') // không có 1 → 3
    await issues.transition(a.issueId, { toStatusId: 2 })
    const review = await issues.transition(a.issueId, { toStatusId: 3 })
    expect(review.statusId).toBe(3)
    expect(review.allowedTransitions).toEqual([]) // Dev không được 3 → 4
    await expectCode(issues.transition(a.issueId, { toStatusId: 4 }), 409, 'TRANSITION_NOT_ALLOWED')
    access.roleId = QA
    const done = await issues.transition(a.issueId, { toStatusId: 4 })
    expect(done.statusId).toBe(4)
    const activity = await issues.listActivity(a.issueId)
    expect(activity.items.filter((x) => x.action === 'TRANSITIONED').map((x) => x.note)).toEqual([
      'Review / QA → Done',
      'Doing → Review / QA',
      'To Do → Doing',
    ])
  })

  it('WIP: cột đích đủ giới hạn → WIP_LIMIT_REACHED', async () => {
    const { issues } = await setup()
    await issues.setWip(1, [{ statusId: 2, limit: 1 }])
    const a = await issues.createIssue(1, { type: 'TASK', title: 'A' })
    const b = await issues.createIssue(1, { type: 'TASK', title: 'B' })
    await issues.transition(a.issueId, { toStatusId: 2 })
    const err = await expectCode(issues.transition(b.issueId, { toStatusId: 2 }), 409, 'WIP_LIMIT_REACHED')
    expect(err.errors?.limit).toEqual(['1'])
    expect((await issues.getBoard(1)).columns.find((c) => c.statusId === 2)?.wipLimit).toBe(1)
  })

  it('rank: xếp sau một issue / lên đầu, đổi sprint', async () => {
    const { issues } = await setup()
    const [a, b, c] = [
      await issues.createIssue(1, { type: 'TASK', title: 'A' }),
      await issues.createIssue(1, { type: 'TASK', title: 'B' }),
      await issues.createIssue(1, { type: 'TASK', title: 'C' }),
    ]
    await issues.rank(c.issueId, { afterIssueId: null })
    await issues.rank(a.issueId, { afterIssueId: b.issueId })
    expect((await issues.listIssues(1)).items.map((x) => x.title)).toEqual(['C', 'B', 'A'])
    const s = await issues.createSprint(1, { name: 'Sprint 1' })
    await issues.rank(b.issueId, { afterIssueId: null, sprintId: s.sprintId })
    expect((await issues.listIssues(1, { sprintId: s.sprintId })).items.map((x) => x.title)).toEqual(['B'])
    expect((await issues.listIssues(1, { sprintId: 'backlog' })).items.map((x) => x.title)).toEqual(['C', 'A'])
  })
})

describe('IssueMockStore — sprint', () => {
  it('chỉ 1 sprint ACTIVE; hoàn tất chuyển issue chưa xong', async () => {
    const { issues, access } = await setup()
    const s1 = await issues.createSprint(1, { name: 'Sprint 1', capacityPoints: 10 })
    const s2 = await issues.createSprint(1, { name: 'Sprint 2' })
    await issues.updateSprint(s1.sprintId, { status: 'ACTIVE' })
    await expectCode(issues.updateSprint(s2.sprintId, { status: 'ACTIVE' }), 409, 'ACTIVE_SPRINT_EXISTS')
    const open = await issues.createIssue(1, { type: 'TASK', title: 'Còn dở', points: 3, sprintId: s1.sprintId })
    const done = await issues.createIssue(1, { type: 'TASK', title: 'Xong', points: 5, sprintId: s1.sprintId })
    await issues.transition(done.issueId, { toStatusId: 2 })
    await issues.transition(done.issueId, { toStatusId: 3 })
    access.roleId = QA
    await issues.transition(done.issueId, { toStatusId: 4 })
    const before = (await issues.listSprints(1)).items.find((x) => x.sprintId === s1.sprintId)!
    expect(before).toMatchObject({ status: 'ACTIVE', committedPoints: 8, donePoints: 5, issueCount: 2 })
    const completed = await issues.completeSprint(s1.sprintId, { moveOpenIssuesTo: s2.sprintId })
    expect(completed.status).toBe('COMPLETED')
    expect((await issues.getIssue(open.issueId)).sprintId).toBe(s2.sprintId)
    expect((await issues.getIssue(done.issueId)).sprintId).toBe(s1.sprintId)
    await issues.updateSprint(s2.sprintId, { status: 'ACTIVE' })
    await issues.completeSprint(s2.sprintId, { moveOpenIssuesTo: 'BACKLOG' })
    expect((await issues.getIssue(open.issueId)).sprintId).toBeNull()
  })

  it('sprint.manage: thiếu quyền (và không có project.workflow.manage) → 403', async () => {
    const { issues } = await setup({ permissions: WORK_PERMS.filter((p) => p !== 'project.workflow.manage') })
    await expectCode(issues.createSprint(1, { name: 'S' }), 403, 'FORBIDDEN')
  })
})

describe('Liên kết REQ — REQ đổi sau khi duyệt bản mới (§3)', () => {
  it('issue.reqChanged, testcase.needsReview, run.needsRerun; ack / lưu lại xoá cờ', async () => {
    const { issues, tests, ref, approveRevision } = await setup()
    const issue = await issues.createIssue(1, { type: 'TASK', title: 'Webhook', requirementRefs: [ref('req-a')] })
    const other = await issues.createIssue(1, { type: 'TASK', title: 'Hoàn tiền', requirementRefs: [ref('req-b')] })
    const tc = await tests.createTestCase(1, {
      title: 'Không ghi có trùng',
      type: 'INTEGRATION',
      priority: 'HIGH',
      steps: [{ action: 'Gửi lại', expected: 'Một lần' }],
      requirementRefs: [ref('req-a')],
      issueIds: [issue.issueId],
    })
    const notRun = await tests.createTestCase(1, {
      title: 'Chưa chạy',
      type: 'FUNCTIONAL',
      priority: 'LOW',
      steps: [{ action: 'X', expected: 'Y' }],
      requirementRefs: [ref('req-a')],
    })
    const cycle = await tests.createCycle(1, { name: 'Đợt 1', testCaseIds: [tc.testCaseId, notRun.testCaseId] })
    const [run, run2] = (await tests.listRuns(cycle.cycleId)).items
    await tests.recordResult(run.runId, { result: 'PASS' })

    // Chưa duyệt gì mới: không cờ nào.
    expect((await issues.getIssue(issue.issueId)).reqChanged).toBe(false)

    await approveRevision(reqDoc('Thân REQ đã đổi: lưu mã giao dịch 24 giờ'))

    const changed = await issues.getIssue(issue.issueId)
    expect(changed.reqChanged).toBe(true)
    expect(changed.requirements[0].changedNote).toBe('Đổi trong bản 1.1')
    expect((await issues.getIssue(other.issueId)).reqChanged).toBe(false)
    expect((await issues.listIssues(1, { reqChanged: true })).items.map((x) => x.key)).toEqual([changed.key])
    expect((await issues.listActivity(issue.issueId)).items[0].action).toBe('REQ_CHANGED')
    expect((await tests.getTestCase(tc.testCaseId)).needsReview).toBe(true)
    const runs = await tests.listRuns(cycle.cycleId)
    expect(runs.items.find((r) => r.runId === run.runId)).toMatchObject({ needsRerun: true, result: 'PASS' })
    expect(runs.items.find((r) => r.runId === run2.runId)?.needsRerun).toBe(false) // NOT_RUN không cần chạy lại

    // Đọc lại không đánh dấu lần nữa (idempotent); ack xoá cờ.
    const acked = await issues.ack(issue.issueId)
    expect(acked.reqChanged).toBe(false)
    expect(acked.requirements[0].changedNote).toBeNull()
    expect((await issues.getIssue(issue.issueId)).reqChanged).toBe(false)
    expect((await tests.updateTestCase(tc.testCaseId, { needsReview: false })).needsReview).toBe(false)
    await tests.recordResult(run.runId, { result: 'FAIL' })
    expect((await tests.listRuns(cycle.cycleId, { needsRerun: true })).items).toHaveLength(0)
  })

  it('REQ bị xoá khỏi bản mới: liên kết giữ nguyên, reqKey = null', async () => {
    const { issues, ref, approveRevision } = await setup()
    const issue = await issues.createIssue(1, { type: 'TASK', title: 'Hoàn tiền', requirementRefs: [ref('req-b')] })
    await approveRevision({
      type: 'doc',
      content: [
        h('r1', 2, 'Webhook ngân hàng', { uid: 'req-a' }),
        p('p1', 'Thân REQ'),
        tasks('t1', [
          ['Tiêu chí một', false],
          ['Tiêu chí hai', false],
        ]),
      ],
    })
    const d = await issues.getIssue(issue.issueId)
    expect(d.reqChanged).toBe(true)
    expect(d.requirements[0]).toMatchObject({ reqUid: 'req-b', reqKey: null, title: null })
  })
})

describe('TestMockStore — cây, kết quả, bug, gợi ý', () => {
  it('cây: tài liệu → mọi REQ (kể cả 0 test), thư mục, chưa gắn REQ', async () => {
    const { tests, ref } = await setup()
    const folder = await tests.createFolder(1, { name: 'Hồi quy' })
    await tests.createTestCase(1, {
      title: 'A',
      type: 'FUNCTIONAL',
      priority: 'HIGH',
      steps: [{ action: 'a', expected: 'b' }],
      requirementRefs: [ref('req-a')],
    })
    await tests.createTestCase(1, {
      title: 'B',
      type: 'E2E',
      priority: 'LOW',
      steps: [{ action: 'a', expected: 'b' }],
      folderId: folder.folderId,
    })
    const tree = (await tests.tree(1)).items
    expect(tree.map((n) => [n.kind, n.label, n.testCount])).toEqual([
      ['DOCUMENT', 'SRS-01 · Thanh toán', 1],
      ['REQUIREMENT', 'REQ-01 · Webhook ngân hàng', 1],
      ['REQUIREMENT', 'REQ-02 · Hoàn tiền', 0],
      ['FOLDER', 'Hồi quy', 1],
      ['UNLINKED', 'Chưa gắn REQ', 1],
    ])
    expect(tree[1].parentId).toBe(tree[0].id)
    await expectCode(
      tests.createTestCase(1, { title: 'C', type: 'FUNCTIONAL', priority: 'HIGH', steps: [] }),
      400,
      'VALIDATION_ERROR',
    )
  })

  it('ghi kết quả: lịch sử, LastResult, bug từ lượt FAIL gắn REQ + testcase; đợt đóng → CYCLE_CLOSED', async () => {
    const { issues, tests, ref, me } = await setup()
    const tc = await tests.createTestCase(1, {
      title: 'Không ghi có trùng',
      type: 'INTEGRATION',
      priority: 'HIGH',
      steps: [{ action: 'Gửi lại', expected: 'Một lần' }],
      requirementRefs: [ref('req-a')],
    })
    const cycle = await tests.createCycle(1, {
      name: 'Đợt 1',
      testCaseIds: [tc.testCaseId],
      defaultAssigneeId: me.userId,
    })
    const [run] = (await tests.listRuns(cycle.cycleId, { assigneeId: 'me' })).items
    expect(run).toMatchObject({ result: 'NOT_RUN', assignee: me })
    const failed = await tests.recordResult(run.runId, {
      result: 'FAIL',
      note: 'Ghi có 2 lần',
      createDefect: { title: 'Ghi có trùng', assigneeId: 8 },
    })
    expect(failed.defects).toHaveLength(1)
    const bug = await issues.getIssue(failed.defects[0].issueId)
    expect(bug).toMatchObject({ type: 'BUG', title: 'Ghi có trùng', assignee: { userId: 8 } })
    expect(bug.requirements.map((r) => r.reqUid)).toEqual(['req-a'])
    expect(bug.testCases).toEqual([{ testCaseId: tc.testCaseId, key: tc.key, title: tc.title, lastResult: 'FAIL' }])
    expect(bug.tests).toMatchObject({ total: 1, fail: 1 })
    await tests.recordResult(run.runId, { result: 'PASS' })
    const detail = await tests.getTestCase(tc.testCaseId)
    expect(detail.lastResult).toBe('PASS')
    expect(detail.history.map((x) => x.result)).toEqual(['PASS', 'FAIL'])
    expect(detail.history[1].defects.map((x) => x.key)).toEqual([bug.key])
    expect((await tests.listCycles(1)).items[0].counts).toEqual({ pass: 1, fail: 0, blocked: 0, notRun: 0 })
    await tests.updateCycle(cycle.cycleId, { status: 'CLOSED' })
    await expectCode(tests.recordResult(run.runId, { result: 'PASS' }), 409, 'CYCLE_CLOSED')
  })

  it('gợi ý: mỗi tiêu chí chưa có testcase → 1 đề xuất; AI tắt → AI_DISABLED', async () => {
    const { tests, ref } = await setup()
    await tests.createTestCase(1, {
      title: 'Tiêu chí một',
      type: 'FUNCTIONAL',
      priority: 'HIGH',
      steps: [{ action: 'x', expected: 'y' }],
      requirementRefs: [ref('req-a')],
    })
    const items = await tests.suggest(1, { refs: [ref('req-a'), ref('req-b')] })
    expect(items.items.map((x) => [x.title, x.fromCriterion])).toEqual([
      ['Tiêu chí hai', 'Tiêu chí hai'],
      ['Kiểm tra: Hoàn tiền', null],
    ])
    expect(items.items[0].steps).toEqual([{ action: 'Thực hiện: Tiêu chí hai', expected: 'Tiêu chí hai' }])
    expect(items.items[0].requirementRef).toEqual(ref('req-a'))
  })

  it('dữ liệu mẫu: issue + testcase + đợt chạy theo câu chuyện mockup', async () => {
    const { docs, issues, tests } = await setup()
    await docs.seedDemo(2)
    const keys = await issues.seedDemo(2)
    expect(keys).not.toBeNull()
    expect(await tests.seedDemo(2, keys!)).toBe(true)
    const board = await issues.getBoard(2)
    expect(board.activeSprint?.name).toBe('Sprint 4')
    const webhook = (await issues.listIssues(2, { search: 'webhook' })).items[0]
    expect(webhook).toMatchObject({ key: 'CORE-104', type: 'BUG', reqChanged: true, subtaskCount: 2, subtaskDone: 1 })
    expect(webhook.tests).toMatchObject({ total: 3, pass: 1, fail: 1, notRun: 1 })
    const [cycle] = (await tests.listCycles(2)).items
    expect(cycle.counts).toEqual({ pass: 6, fail: 1, blocked: 1, notRun: 2 })
    const mine = (await tests.listRuns(cycle.cycleId, { assigneeId: 'me' })).items
    expect(mine.filter((r) => r.result === 'NOT_RUN' || r.needsRerun)).toHaveLength(3)
    expect(await issues.seedDemo(2)).toBeNull()
  })
})
