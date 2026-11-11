import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/apiClient'
import type { TipTapDoc } from '@/types/document'
import type { WorkflowDto } from '@/types/project'
import { DocumentMockStore } from './documentMockStore'
import { h, p, tasks } from './documentSeed'
import { IssueMockStore } from './issueMockStore'
import { TestMockStore } from './testMockStore'
import { extractDocSections } from '@/lib/testplan/sections'
import { retestIn, statsIn, statusIn } from '@/lib/testplan/status'

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
    h('s1', 1, '2. Yêu cầu thanh toán'),
    h('r1', 2, 'Webhook ngân hàng', { uid: 'req-a' }),
    p('p1', body),
    tasks('t1', criteria),
    h('r2', 2, 'Hoàn tiền', { uid: 'req-b' }),
    p('p2', 'Hoàn tiền'),
  ],
})

async function setup(opts: { roleId?: number; permissions?: string[]; aiEnabled?: boolean } = {}) {
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
    projectAccess: async () => ({ ...access, aiEnabled: opts.aiEnabled ?? true, archived: false, projectKey: 'CORE' }),
    workflow: async () => WORKFLOW,
    members: async () => [me, { userId: 8, fullName: 'Trần Hà' }],
    reqs: (projectId: number) => docs.reqIndex(projectId),
    sections: async (documentId: number) => extractDocSections((await docs.getDocument(documentId)).current.content),
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
  it('issue.reqChanged; testcase → Retest REQ_CHANGED ở môi trường đã có kết quả; ack / ghi kết quả xoá cờ', async () => {
    const { issues, tests, ref, approveRevision, node } = await setup()
    const issue = await issues.createIssue(1, { type: 'TASK', title: 'Webhook', requirementRefs: [ref('req-a')] })
    const other = await issues.createIssue(1, { type: 'TASK', title: 'Hoàn tiền', requirementRefs: [ref('req-b')] })
    const { plan, group } = await planWithModule(tests, node.documentId)
    const [sit, uat] = plan.environments
    const tc = await tests.create(1, {
      sectionId: group.sectionId,
      title: 'Không ghi có trùng',
      requirementRefs: [ref('req-a')],
    })
    const untested = await tests.create(1, {
      sectionId: group.sectionId,
      title: 'Chưa test',
      requirementRefs: [ref('req-a')],
    })
    await tests.recordResult(tc.testCaseId, { envId: sit.envId, result: 'PASS' })

    // Chưa duyệt gì mới: không cờ nào.
    expect((await issues.getIssue(issue.issueId)).reqChanged).toBe(false)

    await approveRevision(reqDoc('Thân REQ đã đổi: lưu mã giao dịch 24 giờ'))

    const changed = await issues.getIssue(issue.issueId)
    expect(changed.reqChanged).toBe(true)
    expect(changed.requirements[0].changedNote).toBe('Đổi trong bản 1.1')
    expect((await issues.getIssue(other.issueId)).reqChanged).toBe(false)
    expect((await issues.listIssues(1, { reqChanged: true })).items.map((x) => x.key)).toEqual([changed.key])
    expect((await issues.listActivity(issue.issueId)).items[0].action).toBe('REQ_CHANGED')

    const after = await tests.get(tc.testCaseId)
    expect(statusIn(after, sit.envId)).toBe('RETEST')
    expect(retestIn(after, sit.envId)).toMatchObject({ reason: 'REQ_CHANGED', reqKey: 'REQ-01' })
    expect(statusIn(after, uat.envId)).toBe('UNTEST') // chưa test ở UAT → không cần test lại
    expect(statusIn(await tests.get(untested.testCaseId), sit.envId)).toBe('UNTEST')
    expect(after.requirements[0].changedNote).toBe('Đổi trong bản 1.1')
    const log = await tests.activity(plan.planId, { testCaseId: tc.testCaseId, type: 'REQ' })
    expect(log[0].text).toContain('REQ-01 đổi')

    // Đọc lại không đánh dấu lần nữa; ack issue / ghi kết quả mới xoá cờ.
    const acked = await issues.ack(issue.issueId)
    expect(acked.reqChanged).toBe(false)
    expect((await issues.getIssue(issue.issueId)).reqChanged).toBe(false)
    const res = await tests.recordResult(tc.testCaseId, { envId: sit.envId, result: 'PASS' })
    expect(statusIn(res.items[0], sit.envId)).toBe('PASS')
    expect(res.items[0].retest).toHaveLength(0)
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

/** Đợt test 2 môi trường (SIT, UAT), module từ tài liệu, một nhóm "Chức năng" trong mục đầu. */
async function planWithModule(tests: TestMockStore, documentId: number) {
  const created = await tests.createPlan(1, { name: 'SIT – R1', environments: ['SIT', 'UAT'] })
  const m = await tests.addModule(created.planId, { documentId })
  const top = m.sections[0]
  const group = await tests.addSection(m.moduleId, { parentId: top.sectionId, title: 'Chức năng' })
  const plan = await tests.plan(created.planId)
  return { plan, module: m, top, group }
}

describe('TestMockStore v2 — đợt test, môi trường, module, phân công', () => {
  it('tạo đợt + môi trường; module từ tài liệu (mục theo heading); mã TC_n theo module; phân công ghi lịch sử', async () => {
    const { tests, node, me } = await setup()
    const { plan, module, top, group } = await planWithModule(tests, node.documentId)
    expect(plan.environments.map((e) => e.name)).toEqual(['SIT', 'UAT'])
    expect(module).toMatchObject({ name: 'Thanh toán', documentCode: 'SRS-01' })
    expect(top).toMatchObject({ code: '1.', title: 'Yêu cầu thanh toán', anchorId: 's1', parentId: null })
    expect(group).toMatchObject({ code: '1.1', title: 'Chức năng', parentId: top.sectionId })
    await expectCode(tests.addModule(plan.planId, { documentId: node.documentId }), 409, 'MODULE_EXISTS')

    const a = await tests.create(1, {
      sectionId: group.sectionId,
      title: 'A',
      steps: [{ action: 'Mở', expected: 'Hiện' }],
    })
    const b = await tests.create(1, { sectionId: group.sectionId, title: 'B' })
    expect([a.code, b.code]).toEqual(['TC_1', 'TC_2'])
    expect(a.category).toBe('Chức năng')

    const list = await tests.setAssignments(plan.planId, {
      items: [{ moduleId: module.moduleId, envId: plan.environments[0].envId, assigneeId: me.userId }],
    })
    expect(list).toEqual([{ moduleId: module.moduleId, envId: plan.environments[0].envId, assignee: me }])
    const log = await tests.activity(plan.planId, { type: 'ASSIGN' })
    expect(log[0].text).toContain('giao cho Minh Anh')
    await expectCode(
      tests
        .removeEnvironment(plan.environments[0].envId)
        .then(() => tests.removeEnvironment(plan.environments[1].envId)),
      409,
      'LAST_ENVIRONMENT',
    )
  })

  it('quyền: thiếu testcase.plan (và project.workflow.manage) → 403; chỉ xem → không sửa được', async () => {
    const { tests, node, access } = await setup()
    const { plan, group } = await planWithModule(tests, node.documentId)
    access.permissions = WORK_PERMS.filter((k) => k !== 'project.workflow.manage')
    await expectCode(tests.addEnvironment(plan.planId, { name: 'Staging' }), 403, 'FORBIDDEN')
    access.permissions = ['testcase.view']
    await expectCode(tests.create(1, { sectionId: group.sectionId, title: 'X' }), 403, 'FORBIDDEN')
    await expectCode(
      tests.recordResults(plan.planId, { envId: plan.environments[0].envId, testCaseIds: [1], result: 'PASS' }),
      403,
      'FORBIDDEN',
    )
    expect((await tests.plans(1)).length).toBe(1)
  })
})

describe('TestMockStore v2 — kết quả theo môi trường, bug trên Kanban, retest', () => {
  it('ghi thay; Fail → cần bug; tạo bug gắn REQ; deploy build có fix → Retest; Fail lại bug Done → mở lại', async () => {
    const { tests, issues, node, ref } = await setup()
    const { plan, module, group } = await planWithModule(tests, node.documentId)
    const [sit, uat] = plan.environments
    await tests.setAssignments(plan.planId, { items: [{ moduleId: module.moduleId, envId: sit.envId, assigneeId: 8 }] })
    await tests.deployBuild(sit.envId, { version: 'v1.0.1' })
    const tc = await tests.create(1, {
      sectionId: group.sectionId,
      title: 'Không ghi có trùng',
      steps: [{ action: 'Gửi lại webhook', expected: 'Ghi có 1 lần' }],
      actual: 'Ghi có 2 lần',
      requirementRefs: [ref('req-a')],
    })

    const r1 = await tests.recordResult(tc.testCaseId, { envId: sit.envId, result: 'FAIL' })
    expect(r1.needBug).toEqual([tc.testCaseId])
    expect(r1.items[0].results[0]).toMatchObject({ result: 'FAIL', build: 'v1.0.1', behalfOf: { userId: 8 } })
    expect(statusIn(r1.items[0], uat.envId)).toBe('UNTEST') // kết quả riêng từng môi trường

    const bug = await tests.createBug(plan.planId, {
      envId: sit.envId,
      testCaseIds: [tc.testCaseId],
      title: 'Ghi có trùng',
      priority: 'HIGH',
    })
    expect(bug.items[0].bug).toMatchObject({ key: bug.issue.key, statusCategory: 'TODO' })
    const issue = await issues.getIssue(bug.issue.issueId)
    expect(issue).toMatchObject({ type: 'BUG', priority: 'HIGH' })
    expect(issue.requirements.map((r) => r.reqUid)).toEqual(['req-a'])
    expect(String(issue.description)).toContain('Ghi có 2 lần')
    expect(issue.testCases[0]).toMatchObject({ testCaseId: tc.testCaseId, lastResult: 'FAIL' })

    // Dev fix, deploy build mới có fix lên SIT → case Fail ở SIT chuyển Retest; UAT không đổi.
    const deploy = await tests.deployBuild(sit.envId, { version: 'v1.0.2', fixedIssueIds: [bug.issue.issueId] })
    expect(deploy.retestCount).toBe(1)
    const flagged = await tests.get(tc.testCaseId)
    expect(retestIn(flagged, sit.envId)).toMatchObject({
      reason: 'BUG_FIXED',
      build: 'v1.0.2',
      bug: { key: bug.issue.key },
    })
    expect(statusIn(flagged, uat.envId)).toBe('UNTEST')

    // Bug Done trên Kanban, test lại vẫn Fail → bug mở lại.
    for (const to of [2, 3, 4]) await issues.transition(bug.issue.issueId, { toStatusId: to })
    const again = await tests.recordResult(tc.testCaseId, { envId: sit.envId, result: 'FAIL' })
    expect(again.reopened).toEqual([bug.issue])
    expect(again.needBug).toEqual([])
    expect((await issues.getIssue(bug.issue.issueId)).statusId).toBe(1)
    expect(retestIn(again.items[0], sit.envId)).toBeNull()
    const log = await tests.activity(plan.planId, { testCaseId: tc.testCaseId, type: 'BUG' })
    expect(log.map((x) => x.text).join(' | ')).toContain('mở lại trên Kanban')
  })

  it('regression; bàn giao cần ghi chú khi còn cảnh báo; sau bàn giao chỉ xem; mở lại', async () => {
    const { tests, node } = await setup()
    const { plan, group } = await planWithModule(tests, node.documentId)
    const [sit] = plan.environments
    const a = await tests.create(1, { sectionId: group.sectionId, title: 'A' })
    await tests.recordResult(a.testCaseId, { envId: sit.envId, result: 'PASS' })
    expect((await tests.regression(sit.envId, {})).retestCount).toBe(1)
    expect(retestIn(await tests.get(a.testCaseId), sit.envId)?.reason).toBe('REGRESSION')

    const err = await expectCode(tests.handover(plan.planId, { note: null }), 400, 'VALIDATION_ERROR')
    expect(err.errors?.note).toBeTruthy()
    const handed = await tests.handover(plan.planId, { note: 'UAT để Release 4' })
    expect(handed).toMatchObject({ status: 'HANDED_OVER', handover: { note: 'UAT để Release 4' } })
    await expectCode(tests.recordResult(a.testCaseId, { envId: sit.envId, result: 'PASS' }), 409, 'PLAN_HANDED_OVER')
    await expectCode(tests.update(a.testCaseId, { title: 'B' }), 409, 'PLAN_HANDED_OVER')
    expect((await tests.reopen(plan.planId)).status).toBe('OPEN')
    expect((await tests.activity(plan.planId, { type: 'HANDOVER' })).map((x) => x.text)[0]).toBe('Mở lại đợt test')
  })

  it('sửa nhiều dòng một lần; Delete / khôi phục; danh sách mặc định bỏ case đã Delete', async () => {
    const { tests, node, ref } = await setup()
    const { plan, group } = await planWithModule(tests, node.documentId)
    const a = await tests.create(1, {
      sectionId: group.sectionId,
      title: 'A',
      aiSuggestedReqs: true,
      requirementRefs: [ref('req-a')],
    })
    const b = await tests.create(1, { sectionId: group.sectionId, title: 'B' })
    const list = await tests.bulkUpdate(plan.planId, {
      items: [a, b].map((c) => ({
        testCaseId: c.testCaseId,
        changes: { priority: 'HIGH' as const, requirementRefs: [ref('req-b')], aiSuggestedReqs: false as const },
      })),
    })
    expect(list.map((c) => [c.priority, c.aiSuggestedReqs, c.requirements[0].reqUid])).toEqual([
      ['HIGH', false, 'req-b'],
      ['HIGH', false, 'req-b'],
    ])
    await tests.remove(b.testCaseId)
    expect((await tests.list(1)).map((c) => c.code)).toEqual(['TC_1'])
    expect((await tests.list(1, { includeDeleted: true })).find((c) => c.code === 'TC_2')?.status).toBe('DELETED')
    expect((await tests.update(b.testCaseId, { status: 'ACTIVE' })).status).toBe('ACTIVE')
  })

  it('bố cục bảng dùng chung: lưu thứ tự / tên / cột riêng; cột chọn không có giá trị → VALIDATION_ERROR', async () => {
    const { tests, node } = await setup()
    const { plan } = await planWithModule(tests, node.documentId)
    const saved = await tests.saveLayout(plan.planId, {
      order: ['title', 'code'],
      labels: { title: ' Tên ' },
      widths: { title: 9999 },
      customColumns: [
        { columnId: 'c1', label: 'Thiết bị', kind: 'SELECT', options: [{ optionId: 'o1', label: 'iOS', color: 0 }] },
      ],
    })
    expect(saved).toMatchObject({ order: ['title', 'code'], labels: { title: 'Tên' }, widths: { title: 600 } })
    await expectCode(
      tests.saveLayout(plan.planId, {
        ...saved,
        customColumns: [{ columnId: 'c2', label: 'Rỗng', kind: 'SELECT', options: [] }],
      }),
      400,
      'VALIDATION_ERROR',
    )
    expect((await tests.plan(plan.planId)).layout.customColumns).toHaveLength(1)
  })
})

describe('TestMockStore v2 — đối chiếu REQ, AI, dữ liệu mẫu', () => {
  it('đối chiếu theo môi trường: một tình trạng cho mỗi REQ', async () => {
    const { tests, node, ref } = await setup()
    const { plan, group } = await planWithModule(tests, node.documentId)
    const [sit, uat] = plan.environments
    const a = await tests.create(1, { sectionId: group.sectionId, title: 'A', requirementRefs: [ref('req-a')] })
    await tests.recordResult(a.testCaseId, { envId: sit.envId, result: 'PASS' })
    const rows = await tests.traceability(plan.planId, sit.envId)
    expect(rows.map((r) => [r.reqKey, r.status])).toEqual([
      ['REQ-01', 'PASSED'],
      ['REQ-02', 'NO_TESTS'],
    ])
    expect((await tests.traceability(plan.planId, uat.envId))[0].status).toBe('IN_PROGRESS')
  })

  it('AI: đề xuất có chỗ đặt; áp dụng tạo nhóm còn thiếu + case ✦; AI tắt → AI_DISABLED', async () => {
    const { tests, node, ref } = await setup()
    const { plan, module, top } = await planWithModule(tests, node.documentId)
    const items = await tests.suggest(1, { planId: plan.planId, refs: [ref('req-a')] })
    expect(items.map((x) => [x.title, x.category])).toEqual([
      ['Tiêu chí một', 'Chức năng'],
      ['Tiêu chí hai', 'Chức năng'],
      ['Webhook ngân hàng — dữ liệu không hợp lệ', 'Validate'],
    ])
    expect(items[0].placement).toMatchObject({
      moduleId: module.moduleId,
      sectionId: top.sectionId,
      category: 'Chức năng',
    })
    expect(items[0].placement.groupId).not.toBeNull()
    expect(items[2].placement.groupId).toBeNull() // nhóm Validate sẽ tạo mới

    const created = await tests.aiApply(plan.planId, {
      items: items.map((x) => ({
        title: x.title,
        steps: x.steps,
        priority: x.priority,
        category: x.category,
        requirementRef: x.requirementRef,
      })),
    })
    expect(created.every((c) => c.aiSuggestedReqs)).toBe(true)
    const after = await tests.plan(plan.planId)
    expect(after.modules[0].sections.map((s) => `${s.code} ${s.title}`)).toEqual([
      '1. Yêu cầu thanh toán',
      '1.1 Chức năng',
      '1.2 Validate',
    ])
  })

  it('AI tắt → AI_DISABLED; thiếu ai.use → FORBIDDEN', async () => {
    const { tests, node, ref, access } = await setup({ aiEnabled: false })
    const { plan } = await planWithModule(tests, node.documentId)
    await expectCode(tests.suggest(1, { planId: plan.planId, refs: [ref('req-a')] }), 409, 'AI_DISABLED')
    access.permissions = WORK_PERMS.filter((k) => k !== 'ai.use')
    await expectCode(tests.suggest(1, { planId: plan.planId, refs: [ref('req-a')] }), 403, 'FORBIDDEN')
  })

  it('dữ liệu mẫu: 3 môi trường, 3 module từ SRS-014 / URD-014 / SRS-020, 2 bug, kết quả ở SIT', async () => {
    const { docs, issues, tests } = await setup()
    await docs.seedDemo(2)
    expect(await docs.seedTestSpecs(2)).toBe(true)
    expect(await docs.seedTestSpecs(2)).toBe(false)
    await issues.seedDemo(2)
    expect(await tests.seedDemo(2)).toBe(true)
    const [summary] = await tests.plans(2)
    const plan = await tests.plan(summary.planId)
    expect(plan.environments.map((e) => `${e.name} ${e.currentBuild}`)).toEqual([
      'SIT v1.0.1',
      'UAT v1.0.0',
      'Staging v1.0.1',
    ])
    expect(plan.modules.map((m) => `${m.shortCode} ${m.documentCode}`)).toEqual([
      'PHI SRS-014',
      'QR URD-014',
      'BC SRS-020',
    ])
    const cases = await tests.list(2, { planId: plan.planId, includeDeleted: true })
    expect(cases).toHaveLength(15)
    const sit = plan.environments[0].envId
    const st = statsIn(cases, sit)
    expect([st.PASS, st.FAIL, st.NA, st.UNTEST, st.DELETED]).toEqual([7, 2, 1, 4, 1])
    expect(new Set(cases.filter((c) => c.bug).map((c) => c.bug!.key)).size).toBe(2)
    expect(cases.filter((c) => c.aiSuggestedReqs).map((c) => c.code)).toEqual(['TC_5', 'TC_6'])
    expect(await tests.seedDemo(2)).toBe(false)
  })
})

describe('TestMockStore v2 — sửa sau review', () => {
  it('mã TC không tái sử dụng sau khi xoá nhóm; sửa nhiều dòng nguyên khối (một lỗi → không ghi gì)', async () => {
    const { tests, node } = await setup()
    const { plan, module, top, group } = await planWithModule(tests, node.documentId)
    const g2 = await tests.addSection(module.moduleId, { parentId: top.sectionId, title: 'Flow' })
    const g3 = await tests.addSection(module.moduleId, { parentId: top.sectionId, title: 'UI' })
    const a = await tests.create(1, { sectionId: g2.sectionId, title: 'A' })
    await tests.remove(a.testCaseId)
    await tests.removeSection(g2.sectionId) // xoá hẳn case A (đã Delete) cùng nhóm 1.2
    const b = await tests.create(1, { sectionId: group.sectionId, title: 'B' })
    expect([a.code, b.code]).toEqual(['TC_1', 'TC_2'])
    // Còn 1.1 và 1.3: nhóm mới là 1.4 (đếm số lượng + 1 sẽ ra 1.3 trùng).
    expect(g3.code).toBe('1.3')
    expect((await tests.addSection(module.moduleId, { parentId: top.sectionId, title: 'Validate' })).code).toBe('1.4')
    await expectCode(
      tests.bulkUpdate(plan.planId, {
        items: [
          { testCaseId: b.testCaseId, changes: { title: 'B đổi' } },
          { testCaseId: b.testCaseId, changes: { title: ' ' } },
        ],
      }),
      400,
      'VALIDATION_ERROR',
    )
    expect((await tests.get(b.testCaseId)).title).toBe('B')
  })

  it('Fail nhiều case cùng bug đã Done: mở lại bug đúng một lần; gắn bug có sẵn phải là BUG', async () => {
    const { tests, issues, node } = await setup()
    const { plan, group } = await planWithModule(tests, node.documentId)
    const [sit] = plan.environments
    const a = await tests.create(1, { sectionId: group.sectionId, title: 'A' })
    const b = await tests.create(1, { sectionId: group.sectionId, title: 'B' })
    await tests.recordResults(plan.planId, {
      envId: sit.envId,
      testCaseIds: [a.testCaseId, b.testCaseId],
      result: 'FAIL',
    })
    const bug = await tests.createBug(plan.planId, {
      envId: sit.envId,
      testCaseIds: [a.testCaseId, b.testCaseId],
      title: 'Lỗi chung',
      priority: 'HIGH',
    })
    for (const to of [2, 3, 4]) await issues.transition(bug.issue.issueId, { toStatusId: to })
    const res = await tests.recordResults(plan.planId, {
      envId: sit.envId,
      testCaseIds: [a.testCaseId, b.testCaseId],
      result: 'FAIL',
    })
    expect(res.reopened).toEqual([bug.issue])
    const log = (await issues.listActivity(bug.issue.issueId)).items.filter(
      (x) => x.action === 'TRANSITIONED' && x.note?.includes('mở lại'),
    )
    expect(log).toHaveLength(1)
    const task = await issues.createIssue(1, { type: 'TASK', title: 'Không phải bug' })
    await expectCode(tests.linkBug(plan.planId, task.issueId, { testCaseIds: [a.testCaseId] }), 404, 'ISSUE_NOT_FOUND')
  })

  it('Kanban thấy kết quả xấu nhất qua các môi trường (Pass SIT + Fail UAT = FAIL)', async () => {
    const { tests, issues, node } = await setup()
    const { plan, group } = await planWithModule(tests, node.documentId)
    const [sit, uat] = plan.environments
    const a = await tests.create(1, { sectionId: group.sectionId, title: 'A' })
    await tests.recordResult(a.testCaseId, { envId: uat.envId, result: 'FAIL' })
    const bug = await tests.createBug(plan.planId, {
      envId: uat.envId,
      testCaseIds: [a.testCaseId],
      title: 'X',
      priority: 'LOW',
    })
    await tests.recordResult(a.testCaseId, { envId: sit.envId, result: 'PASS' })
    const tcs = (await issues.getIssue(bug.issue.issueId)).testCases
    expect(tcs[0]).toMatchObject({ lastResult: 'FAIL', planId: plan.planId, envId: uat.envId })
  })
})
