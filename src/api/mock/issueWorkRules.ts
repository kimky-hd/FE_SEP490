import { PERMISSIONS } from '@/types/rbac'
import type { RoleKind } from '@/types/rbac'
import type { BoardColumnDto, IssueSummaryDto, UserRef } from '@/types/issue'
import type { TestCaseDto, TestPlanDto, TraceRowDto } from '@/types/testing'
import type { WorkItemDto } from '@/types/work'
import { columnStatuses, isReviewStatus } from '@/lib/workflowBoard'
import { retestIn, statusIn } from '@/lib/testplan/status'
import { retestWhy } from '@/lib/testplan/retest'
import { tr } from '@/i18n'

// Mock của GET /me/work-items — phần Kanban / Test cases (doc/BE-Changes-2026-10-28_30-API.md §B.2; Test cases v2 ở
// doc/Issues-Testcases-API-Contract.md "v2 · Việc của tôi"). Hàm thuần, dữ liệu một dự án. Mỗi issue chỉ một dòng (loại
// gấp nhất). Test: chỉ module × môi trường được phân công cho tôi — case cần test lại (từng dòng), chưa test (gộp theo
// module × môi trường); REQ thiếu testcase gộp theo tài liệu.

export interface TestWorkData {
  /** Đợt test hiện tại (đang mở) của dự án. */
  plan: TestPlanDto
  cases: TestCaseDto[]
  /** Đối chiếu REQ ở môi trường đầu (chỉ nạp khi cần cho REQ_WITHOUT_TEST). */
  trace: TraceRowDto[] | null
}

export interface IssueWorkData {
  columns: BoardColumnDto[]
  issues: IssueSummaryDto[]
  tests: TestWorkData | null
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
  const tests = data.tests
  const plan = tests && tests.plan.status === 'OPEN' ? tests.plan : null
  const cases = plan ? tests!.cases.filter((c) => c.status === 'ACTIVE') : []
  const moduleOf = (id: number) => plan?.modules.find((m) => m.moduleId === id)
  const caseKey = (c: TestCaseDto) => `${moduleOf(c.moduleId)?.shortCode ?? ''}·${c.code}`
  const runRef = (c: TestCaseDto, envId: number) => {
    const env = plan!.environments.find((e) => e.envId === envId)
    return {
      runId: c.testCaseId,
      cycleId: plan!.planId,
      cycleName: `${plan!.name} · ${env?.name ?? ''}`,
      testCaseKey: caseKey(c),
      title: c.title,
      planId: plan!.planId,
      envId,
      moduleId: c.moduleId,
      testCaseId: c.testCaseId,
    }
  }

  // Bug của tôi gắn với testcase đang FAIL (ở một môi trường bất kỳ).
  const failedBugs = new Map<number, { c: TestCaseDto; envId: number; at: string }>()
  for (const c of cases) {
    if (!c.bug || failedBugs.has(c.bug.issueId)) continue
    const env = plan!.environments.find((e) => statusIn(c, e.envId) === 'FAIL')
    if (env) failedBugs.set(c.bug.issueId, { c, envId: env.envId, at: c.updatedAt })
  }

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
    const failed = failedBugs.get(i.issueId)
    if (failed) {
      items.push({
        ...base,
        id: `issue-failed-${i.issueId}`,
        kind: 'TEST_FAILED_MINE',
        urgency: 88,
        testRun: runRef(failed.c, failed.envId),
        at: failed.at,
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

  // Testcase của module được giao cho tôi ở từng môi trường: cần test lại (từng dòng), chưa test (gộp module × môi trường).
  if (plan) {
    for (const a of plan.assignments.filter((x) => x.assignee?.userId === me.userId)) {
      const env = plan.environments.find((e) => e.envId === a.envId)
      const mod = moduleOf(a.moduleId)
      if (!env || !mod) continue
      const list = cases.filter((c) => c.moduleId === a.moduleId)
      for (const c of list) {
        const flag = retestIn(c, env.envId)
        if (!flag) continue
        items.push({
          ...empty,
          id: `test-retest-${env.envId}-${c.testCaseId}`,
          kind: 'TEST_RERUN',
          urgency: 72,
          code: caseKey(c),
          title: c.title,
          testRun: runRef(c, env.envId),
          note: retestWhy(flag, tr),
          at: flag.at,
        })
      }
      const todo = list.filter((c) => statusIn(c, env.envId) === 'UNTEST')
      if (!todo.length) continue
      items.push({
        ...empty,
        id: `test-todo-${env.envId}-${mod.moduleId}`,
        kind: 'TEST_NOT_RUN',
        urgency: 55,
        code: caseKey(todo[0]),
        title: todo[0].title,
        testRun: { ...runRef(todo[0], env.envId), cycleName: `${mod.name} · ${env.name}` },
        count: todo.length,
        at: plan.createdAt,
      })
    }
  }

  // QA (quản lý testcase): REQ chưa có testcase, gộp theo tài liệu.
  if (role === 'QA' && has(project.permissions, PERMISSIONS.testCaseManage) && tests?.trace) {
    const byDoc = new Map<number, TraceRowDto[]>()
    for (const r of tests.trace.filter((x) => x.status === 'NO_TESTS'))
      byDoc.set(r.documentId, [...(byDoc.get(r.documentId) ?? []), r])
    for (const [documentId, missing] of byDoc) {
      const first = missing[0]
      items.push({
        ...empty,
        id: `req-notest-doc-${documentId}`,
        kind: 'REQ_WITHOUT_TEST',
        urgency: 45,
        documentId,
        code: first.documentCode,
        title: first.documentTitle,
        requirement: {
          requirementId: null,
          reqUid: first.reqUid,
          reqKey: first.reqKey,
          title: first.title,
          anchorId: first.anchorId,
        },
        note: missing.map((x) => x.reqKey).join(', '),
        count: missing.length,
        at: '',
      })
    }
  }
  return items
}
