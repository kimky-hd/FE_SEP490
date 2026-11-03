import { PERMISSIONS } from '@/types/rbac'
import type { RoleKind } from '@/types/rbac'
import type { BoardColumnDto, IssueSummaryDto, UserRef } from '@/types/issue'
import type { TestCycleDto, TestRunDto, TestTreeNodeDto } from '@/types/testing'
import type { WorkItemDto } from '@/types/work'
import { columnStatuses, isReviewStatus } from '@/lib/workflowBoard'

// Mock của GET /me/work-items — phần Kanban / Test cases (doc/BE-Changes-2026-10-28_30-API.md §B.2). Hàm thuần, dữ
// liệu một dự án. Mỗi issue chỉ một dòng (loại gấp nhất); lượt chưa chạy gộp theo đợt; REQ thiếu test gộp theo tài liệu.

export interface IssueWorkData {
  columns: BoardColumnDto[]
  issues: IssueSummaryDto[]
  /** Đợt chạy OPEN và các lượt của chúng. */
  cycles: TestCycleDto[]
  runs: TestRunDto[]
  /** Cây kho testcase (chỉ nạp khi cần cho REQ_WITHOUT_TEST). */
  tree: TestTreeNodeDto[] | null
}

export interface IssueWorkInput {
  project: { projectId: number; name: string; key: string; permissions: readonly string[] }
  role: RoleKind
  me: UserRef
  data: IssueWorkData
}

const has = (permissions: readonly string[], key: string) => permissions.includes('*') || permissions.includes(key)

export function buildIssueWorkItems(input: IssueWorkInput): WorkItemDto[] {
  const { project, role, me, data } = input
  const empty = {
    projectId: project.projectId,
    projectName: project.name,
    projectKey: project.key,
    roleKind: role,
    documentId: null,
    versionId: null,
    versionLabel: null,
    compareToVersionId: null,
    requirement: null,
    comment: null,
    actor: null,
    note: null,
    count: null,
    issue: null,
    testRun: null,
    activity: null,
  } satisfies Partial<WorkItemDto>
  const statuses = columnStatuses(data.columns)
  const statusOf = (id: number) => data.columns.find((c) => c.statusId === id)
  const done = (i: IssueSummaryDto) => statusOf(i.statusId)?.category === 'DONE'
  const items: WorkItemDto[] = []
  const mine = data.issues.filter((i) => i.assignee?.userId === me.userId && !done(i))
  const openCycles = new Map(data.cycles.filter((c) => c.status === 'OPEN').map((c) => [c.cycleId, c]))
  const runs = data.runs.filter((r) => openCycles.has(r.cycleId))
  const runRef = (r: TestRunDto) => ({
    runId: r.runId,
    cycleId: r.cycleId,
    cycleName: openCycles.get(r.cycleId)?.name ?? '',
    testCaseKey: r.testCase.key,
    title: r.testCase.title,
  })

  // Bug của tôi sinh từ lượt chạy FAIL.
  const failedBugs = new Map<number, TestRunDto>()
  for (const r of runs.filter((x) => x.result === 'FAIL'))
    for (const d of r.defects) if (!failedBugs.has(d.issueId)) failedBugs.set(d.issueId, r)

  for (const i of mine) {
    const base = {
      ...empty,
      code: i.key,
      title: i.title,
      at: i.updatedAt,
      issue: {
        issueId: i.issueId,
        key: i.key,
        title: i.title,
        statusName: statusOf(i.statusId)?.name ?? '',
        points: i.points,
        reqChanged: i.reqChanged,
        testTotal: i.tests.total,
      },
    }
    const run = failedBugs.get(i.issueId)
    if (run) {
      items.push({
        ...base,
        id: `issue-failed-${i.issueId}`,
        kind: 'TEST_FAILED_MINE',
        urgency: 88,
        testRun: runRef(run),
        at: run.executedAt ?? i.updatedAt,
      })
      continue
    }
    if (i.reqChanged) {
      const changed = i.requirements.filter((r) => r.changedNote)
      items.push({
        ...base,
        id: `issue-req-${i.issueId}`,
        kind: 'ISSUE_REQ_CHANGED',
        urgency: 85,
        note: changed.map((r) => `${r.reqKey ?? r.reqUid.slice(0, 6)} · ${r.changedNote}`).join(', ') || null,
      })
      continue
    }
    if (isReviewStatus(statuses, i.statusId) && i.tests.total > 0 && i.tests.pass === i.tests.total) {
      items.push({ ...base, id: `issue-ready-${i.issueId}`, kind: 'ISSUE_READY_TO_CLOSE', urgency: 65 })
      continue
    }
    items.push({ ...base, id: `issue-${i.issueId}`, kind: 'ISSUE_ASSIGNED', urgency: 35 })
  }

  // Lượt chạy của tôi: cần chạy lại (từng dòng), chưa chạy (gộp theo đợt).
  const myRuns = runs.filter((r) => r.assignee?.userId === me.userId)
  for (const r of myRuns.filter((x) => x.needsRerun)) {
    const cycle = openCycles.get(r.cycleId)!
    const changed = r.testCase.requirements.find((x) => x.changedNote)
    items.push({
      ...empty,
      id: `run-rerun-${r.runId}`,
      kind: 'TEST_RERUN',
      urgency: 72,
      code: r.testCase.key,
      title: r.testCase.title,
      testRun: runRef(r),
      note: changed ? `${changed.reqKey ?? ''} ${changed.changedNote ?? ''}`.trim() : null,
      at: r.executedAt ?? cycle.createdAt,
    })
  }
  for (const cycle of openCycles.values()) {
    const todo = myRuns.filter((r) => r.cycleId === cycle.cycleId && r.result === 'NOT_RUN' && !r.needsRerun)
    if (!todo.length) continue
    items.push({
      ...empty,
      id: `run-todo-${cycle.cycleId}`,
      kind: 'TEST_NOT_RUN',
      urgency: 55,
      code: todo[0].testCase.key,
      title: todo[0].testCase.title,
      testRun: runRef(todo[0]),
      count: todo.length,
      at: cycle.createdAt,
    })
  }

  // QA (quản lý testcase): REQ chưa có testcase, gộp theo tài liệu.
  if (role === 'QA' && has(project.permissions, PERMISSIONS.testCaseManage) && data.tree) {
    for (const doc of data.tree.filter((n) => n.kind === 'DOCUMENT')) {
      const missing = data.tree.filter(
        (n) => n.parentId === doc.id && n.kind === 'REQUIREMENT' && n.testCount === 0 && n.requirement?.reqKey,
      )
      if (!missing.length) continue
      const [code, ...rest] = doc.label.split(' · ')
      const first = missing[0].requirement!
      items.push({
        ...empty,
        id: `req-notest-${doc.id}`,
        kind: 'REQ_WITHOUT_TEST',
        urgency: 45,
        documentId: first.documentId,
        code,
        title: rest.join(' · ') || code,
        requirement: {
          requirementId: null,
          reqUid: first.reqUid,
          reqKey: first.reqKey ?? '',
          title: first.title ?? '',
          anchorId: null,
        },
        note: missing.map((x) => x.requirement?.reqKey).join(', '),
        count: missing.length,
        at: '',
      })
    }
  }
  return items
}
