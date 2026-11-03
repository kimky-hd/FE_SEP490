import { api } from '@/lib/apiClient'
import { withInvalidation } from '@/lib/dataEvents'
import { projectApi } from './projectApi'
import { issueMockStore } from './workMockStores'
import { MOCK } from './mockFlags'
import type { IssueMockStore } from './mock/issueMockStore'
import type { ItemsDto } from '@/types/rbac'
import type {
  BoardDto,
  CreateIssueBody,
  CreateSprintBody,
  IssueActivityDto,
  IssueCommentDto,
  IssueDetailDto,
  IssueListQuery,
  IssueSummaryDto,
  IssueType,
  RequirementRef,
  SprintDto,
  SprintStatus,
  UpdateIssueBody,
  UpdateSprintBody,
  UserRef,
} from '@/types/issue'

// doc/BE-Changes-2026-10-28_30-API.md §C (#26–#44) — một hàm cho mỗi endpoint, path / body đúng tài liệu.
// Mock trong trình duyệt khi VITE_MOCK_KANBAN=true (src/api/mockFlags.ts).

/** D12: BE trả danh sách đã sắp theo `rank`; FE vẫn sắp lại (so sánh chuỗi, ổn định) cho chắc. */
export function sortByRank<T extends { rank: string; issueId: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : a.issueId - b.issueId))
}

export interface IssueApi {
  // 4.1 Board
  board: (projectId: number) => Promise<BoardDto>
  setWip: (projectId: number, limits: { statusId: number; limit: number | null }[]) => Promise<BoardDto>
  // 4.2 Issue
  list: (projectId: number, query?: IssueListQuery) => Promise<IssueSummaryDto[]>
  create: (projectId: number, body: CreateIssueBody) => Promise<IssueDetailDto>
  get: (issueId: number) => Promise<IssueDetailDto>
  update: (issueId: number, body: UpdateIssueBody) => Promise<IssueDetailDto>
  remove: (issueId: number) => Promise<void>
  // 4.3 Trạng thái & thứ tự
  transition: (
    issueId: number,
    body: { toStatusId: number; rankAfterIssueId?: number | null },
  ) => Promise<IssueDetailDto>
  rank: (issueId: number, body: { afterIssueId: number | null; sprintId?: number | null }) => Promise<IssueSummaryDto>
  // 4.4 REQ
  fromRequirements: (
    projectId: number,
    body: { refs: RequirementRef[]; type?: IssueType; sprintId?: number | null },
  ) => Promise<IssueDetailDto[]>
  setRequirements: (issueId: number, refs: RequirementRef[]) => Promise<IssueDetailDto>
  ackRequirements: (issueId: number) => Promise<IssueDetailDto>
  // 4.5 Bình luận & lịch sử
  comments: (issueId: number) => Promise<IssueCommentDto[]>
  addComment: (
    issueId: number,
    body: { body: string; parentId?: number | null; mentionUserIds?: number[] },
  ) => Promise<IssueCommentDto>
  activity: (issueId: number) => Promise<IssueActivityDto[]>
  // 4.6 Sprint
  sprints: (projectId: number, status?: SprintStatus) => Promise<SprintDto[]>
  createSprint: (projectId: number, body: CreateSprintBody) => Promise<SprintDto>
  updateSprint: (sprintId: number, body: UpdateSprintBody) => Promise<SprintDto>
  completeSprint: (sprintId: number, body: { moveOpenIssuesTo: 'BACKLOG' | number }) => Promise<SprintDto>
  /** Người giao việc được (thành viên dự án; mock thêm người mẫu). Không phải endpoint mới: HTTP dùng GET /members. */
  assignees: (projectId: number) => Promise<UserRef[]>
}

export const httpIssueApi: IssueApi = {
  board: (projectId) => api.get<BoardDto>(`/projects/${projectId}/board`).then((r) => r.data),
  setWip: (projectId, limits) => api.put<BoardDto>(`/projects/${projectId}/board/wip`, { limits }).then((r) => r.data),
  list: (projectId, query = {}) =>
    api
      .get<ItemsDto<IssueSummaryDto>>(`/projects/${projectId}/issues`, { params: query })
      .then((r) => sortByRank(r.data.items)),
  create: (projectId, body) => api.post<IssueDetailDto>(`/projects/${projectId}/issues`, body).then((r) => r.data),
  get: (issueId) => api.get<IssueDetailDto>(`/issues/${issueId}`).then((r) => r.data),
  update: (issueId, body) => api.patch<IssueDetailDto>(`/issues/${issueId}`, body).then((r) => r.data),
  remove: (issueId) => api.delete(`/issues/${issueId}`).then(() => undefined),
  transition: (issueId, body) => api.post<IssueDetailDto>(`/issues/${issueId}/transition`, body).then((r) => r.data),
  rank: (issueId, body) => api.post<IssueSummaryDto>(`/issues/${issueId}/rank`, body).then((r) => r.data),
  fromRequirements: (projectId, body) =>
    api
      .post<ItemsDto<IssueDetailDto>>(`/projects/${projectId}/issues/from-requirements`, body)
      .then((r) => r.data.items),
  setRequirements: (issueId, refs) =>
    api.put<IssueDetailDto>(`/issues/${issueId}/requirements`, { refs }).then((r) => r.data),
  ackRequirements: (issueId) => api.post<IssueDetailDto>(`/issues/${issueId}/requirements/ack`, {}).then((r) => r.data),
  comments: (issueId) => api.get<ItemsDto<IssueCommentDto>>(`/issues/${issueId}/comments`).then((r) => r.data.items),
  addComment: (issueId, body) => api.post<IssueCommentDto>(`/issues/${issueId}/comments`, body).then((r) => r.data),
  activity: (issueId) => api.get<ItemsDto<IssueActivityDto>>(`/issues/${issueId}/activity`).then((r) => r.data.items),
  sprints: (projectId, status) =>
    api.get<ItemsDto<SprintDto>>(`/projects/${projectId}/sprints`, { params: { status } }).then((r) => r.data.items),
  createSprint: (projectId, body) => api.post<SprintDto>(`/projects/${projectId}/sprints`, body).then((r) => r.data),
  updateSprint: (sprintId, body) => api.patch<SprintDto>(`/sprints/${sprintId}`, body).then((r) => r.data),
  completeSprint: (sprintId, body) => api.post<SprintDto>(`/sprints/${sprintId}/complete`, body).then((r) => r.data),
  assignees: (projectId) =>
    projectApi.listMembers(projectId).then((items) => items.map((m) => ({ userId: m.userId, fullName: m.fullName }))),
}

function createMockIssueApi(store: IssueMockStore): IssueApi {
  return {
    board: (projectId) => store.getBoard(projectId),
    setWip: (projectId, limits) => store.setWip(projectId, limits),
    list: (projectId, query) => store.listIssues(projectId, query).then((r) => sortByRank(r.items)),
    create: (projectId, body) => store.createIssue(projectId, body),
    get: (issueId) => store.getIssue(issueId),
    update: (issueId, body) => store.updateIssue(issueId, body),
    remove: (issueId) => store.deleteIssue(issueId),
    transition: (issueId, body) => store.transition(issueId, body),
    rank: (issueId, body) => store.rank(issueId, body),
    fromRequirements: (projectId, body) => store.fromRequirements(projectId, body).then((r) => r.items),
    setRequirements: (issueId, refs) => store.setRequirements(issueId, refs),
    ackRequirements: (issueId) => store.ack(issueId),
    comments: (issueId) => store.listComments(issueId).then((r) => r.items),
    addComment: (issueId, body) => store.addComment(issueId, body),
    activity: (issueId) => store.listActivity(issueId).then((r) => r.items),
    sprints: (projectId, status) => store.listSprints(projectId, status).then((r) => r.items),
    createSprint: (projectId, body) => store.createSprint(projectId, body),
    updateSprint: (sprintId, body) => store.updateSprint(sprintId, body),
    completeSprint: (sprintId, body) => store.completeSprint(sprintId, body),
    assignees: (projectId) => store.people(projectId),
  }
}

// Thao tác ghi của mock không qua apiClient nên tự báo "dữ liệu đổi".
const MOCK_MUTATIONS = [
  'setWip',
  'create',
  'update',
  'remove',
  'transition',
  'rank',
  'fromRequirements',
  'setRequirements',
  'ackRequirements',
  'addComment',
  'createSprint',
  'updateSprint',
  'completeSprint',
] as const satisfies readonly (keyof IssueApi)[]

export const issueApi: IssueApi =
  MOCK.kanban && issueMockStore ? withInvalidation(createMockIssueApi(issueMockStore), MOCK_MUTATIONS) : httpIssueApi
