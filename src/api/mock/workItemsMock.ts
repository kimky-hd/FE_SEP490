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
import { buildIssueWorkItems, type IssueWorkData } from './issueWorkRules'

// Mock của #23 GET /me/document-work và #24 GET /me/work-items (VITE_MOCK_WORK=true): ghép N+1 từ API từng module
// (Tài liệu #1/#5/#12/#15/#18, Kanban #26/#28, Test #45/#53/#56) rồi chạy đúng luật §B.2 mà BE sẽ chạy.

const can = (permissions: readonly string[], key: string) => permissions.includes('*') || permissions.includes(key)

const EMPTY_WORK: IssueWorkData = { columns: [], issues: [], cycles: [], runs: [], tree: null }

async function loadIssueWork(project: ProjectDto, withTree: boolean): Promise<IssueWorkData> {
  const perms = project.myPermissions
  const kanban = FEATURES.kanban && hasWorkPermission(perms, PERMISSIONS.issueView)
  const tests = FEATURES.testcases && hasWorkPermission(perms, PERMISSIONS.testCaseView)
  const id = project.projectId
  try {
    const [board, issues, cycles, tree] = await Promise.all([
      kanban ? issueApi.board(id).catch(() => null) : null,
      kanban ? issueApi.list(id).catch(() => []) : [],
      tests ? testApi.cycles(id, 'OPEN').catch(() => []) : [],
      tests && withTree ? testApi.tree(id).catch(() => null) : null,
    ])
    const runs = (await Promise.all(cycles.map((c) => testApi.runs(c.cycleId).catch(() => [])))).flat()
    return { columns: board?.columns ?? [], issues, cycles, runs, tree }
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
