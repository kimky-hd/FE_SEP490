import { documentApi } from '@/api/documentApi'
import { buildMyWork, loadPageInfos, type PageInfo } from '@/api/documentWork'
import { issueApi } from '@/api/issueApi'
import { currentActor } from '@/api/mockSupport'
import { projectApi } from '@/api/projectApi'
import { testApi } from '@/api/testApi'
import { FEATURES } from '@/lib/features'
import { resolveProjectRole } from '@/lib/projectRole'
import { hasWorkPermission } from '@/lib/workPermissions'
import { PERMISSIONS } from '@/types/rbac'
import type { MyDocumentWorkDto, UserRef } from '@/types/document'
import type { ProjectDto } from '@/types/project'
import { sortWorkItems, type WorkItemDto, type WorkItemsQuery } from '@/types/work'
import { buildDocumentWorkItems } from './docWorkRules'
import { buildIssueWorkItems, type IssueWorkData, type TestWorkData } from './issueWorkRules'

// Mock của #23 GET /me/document-work và #24 GET /me/work-items (VITE_MOCK_WORK=true): ghép N+1 từ API từng module
// (Tài liệu #1/#5/#12/#15/#18, Kanban #26/#28, Test cases v2 T1/T3/T18/T32) rồi chạy đúng luật §B.2 mà BE sẽ chạy.

const can = (permissions: readonly string[], key: string) => permissions.includes('*') || permissions.includes(key)

const EMPTY_WORK: IssueWorkData = { columns: [], issues: [], tests: null }

/** Đợt test đang mở của dự án + testcase (+ đối chiếu REQ ở môi trường đầu khi cần REQ_WITHOUT_TEST). */
async function loadTestWork(projectId: number, withTrace: boolean): Promise<TestWorkData | null> {
  const plans = await testApi.plans(projectId)
  const open = plans.find((p) => p.status === 'OPEN')
  if (!open) return null
  const plan = await testApi.plan(open.planId)
  const firstEnv = plan.environments[0]
  const [cases, trace] = await Promise.all([
    testApi.list(projectId, { planId: plan.planId }),
    withTrace && firstEnv ? testApi.traceability(plan.planId, firstEnv.envId).catch(() => null) : null,
  ])
  return { plan, cases, trace }
}

async function loadIssueWork(project: ProjectDto, withTree: boolean): Promise<IssueWorkData> {
  const perms = project.myPermissions
  const kanban = FEATURES.kanban && hasWorkPermission(perms, PERMISSIONS.issueView)
  const tests = FEATURES.testcases && hasWorkPermission(perms, PERMISSIONS.testCaseView)
  const id = project.projectId
  try {
    const [board, issues, testWork] = await Promise.all([
      kanban ? issueApi.board(id).catch(() => null) : null,
      kanban ? issueApi.list(id).catch(() => []) : [],
      tests ? loadTestWork(id, withTree).catch(() => null) : null,
    ])
    return { columns: board?.columns ?? [], issues, tests: testWork }
  } catch {
    return EMPTY_WORK
  }
}

/** Việc của tôi trong một dự án (mỗi dự án dùng vai trò của người gọi TRONG dự án đó). */
export async function projectWorkItems(project: ProjectDto, me: UserRef): Promise<WorkItemDto[]> {
  const role = resolveProjectRole(project)
  const ref = { projectId: project.projectId, name: project.name, key: project.key, permissions: project.myPermissions }
  const [pages, work] = await Promise.all([
    can(project.myPermissions, PERMISSIONS.documentView)
      ? loadPageInfos(documentApi, project.projectId, { comments: true }).then((r) => r.pages)
      : Promise.resolve([] as PageInfo[]),
    loadIssueWork(project, role === 'QA'),
  ])
  return sortWorkItems([
    ...buildDocumentWorkItems({ project: ref, role, me, pages }),
    ...buildIssueWorkItems({ project: ref, role, me, data: work }),
  ])
}

export async function mockWorkItems(query: WorkItemsQuery): Promise<WorkItemDto[]> {
  const me = await currentActor()
  const projects =
    query.projectId !== undefined
      ? [await projectApi.get(query.projectId)]
      : await projectApi.listMine(query.companyId ?? null, { status: 'ACTIVE' })
  const lists = await Promise.all(projects.map((p) => projectWorkItems(p, me)))
  return sortWorkItems(lists.flat())
}

export async function mockDocumentWork(companyId: number | null): Promise<MyDocumentWorkDto> {
  const [projects, me] = await Promise.all([projectApi.listMine(companyId, { status: 'ACTIVE' }), currentActor()])
  return buildMyWork(
    documentApi,
    projects.map((p) => ({ projectId: p.projectId, name: p.name, key: p.key, permissions: p.myPermissions })),
    me,
  )
}
