import { api } from '@/lib/apiClient'
import type { ItemsDto } from '@/types/rbac'
import type {
  CreateProjectBody,
  PhaseDto,
  ProjectDto,
  ProjectMemberCandidateDto,
  ProjectMemberDto,
  ProjectStatus,
  SdlcTemplateDto,
  StatusInput,
  TransitionInput,
  WorkflowDto,
} from '@/types/project'

// doc/Workspace-RBAC-API-Contract.md §9 (mẫu SDLC), §10 (dự án), §11 (thành viên), §12 (workflow).

type ListParams = { status?: ProjectStatus; search?: string }

export const projectApi = {
  templates: () => api.get<ItemsDto<SdlcTemplateDto>>('/sdlc-templates').then((r) => r.data.items),

  listByWorkspace: (workspaceId: number, params: ListParams = {}) =>
    api.get<ItemsDto<ProjectDto>>(`/workspaces/${workspaceId}/projects`, { params }).then((r) => r.data.items),

  listMine: (companyId: number | null, params: ListParams = {}) =>
    api
      .get<ItemsDto<ProjectDto>>('/projects', { params: { ...params, companyId: companyId ?? undefined } })
      .then((r) => r.data.items),

  checkKey: (workspaceId: number, key: string) =>
    api
      .get<{ key: string; available: boolean; suggestion: string | null }>(
        `/workspaces/${workspaceId}/projects/key-availability`,
        { params: { key } },
      )
      .then((r) => r.data),

  create: (workspaceId: number, body: CreateProjectBody) =>
    api.post<ProjectDto>(`/workspaces/${workspaceId}/projects`, body).then((r) => r.data),

  get: (projectId: number) => api.get<ProjectDto>(`/projects/${projectId}`).then((r) => r.data),

  update: (projectId: number, body: { name?: string; description?: string; aiEnabled?: boolean }) =>
    api.patch<ProjectDto>(`/projects/${projectId}`, body).then((r) => r.data),

  archive: (projectId: number) => api.post<ProjectDto>(`/projects/${projectId}/archive`, {}).then((r) => r.data),
  restore: (projectId: number) => api.post<ProjectDto>(`/projects/${projectId}/restore`, {}).then((r) => r.data),

  // --- Thành viên ---
  listMembers: (projectId: number) =>
    api.get<ItemsDto<ProjectMemberDto>>(`/projects/${projectId}/members`).then((r) => r.data.items),

  listMemberCandidates: (projectId: number, search?: string) =>
    api
      .get<ItemsDto<ProjectMemberCandidateDto>>(`/projects/${projectId}/member-candidates`, { params: { search } })
      .then((r) => r.data.items),

  addMembers: (projectId: number, members: { userId: number; roleId: number }[]) =>
    api.post<ItemsDto<ProjectMemberDto>>(`/projects/${projectId}/members`, { members }).then((r) => r.data.items),

  changeMemberRole: (projectId: number, userId: number, roleId: number) =>
    api.patch<ProjectMemberDto>(`/projects/${projectId}/members/${userId}`, { roleId }).then((r) => r.data),

  removeMember: (projectId: number, userId: number) => api.delete(`/projects/${projectId}/members/${userId}`),

  // --- Workflow ---
  workflow: (projectId: number) => api.get<WorkflowDto>(`/projects/${projectId}/workflow`).then((r) => r.data),

  addPhase: (projectId: number, body: { name: string; description?: string }) =>
    api.post<PhaseDto>(`/projects/${projectId}/phases`, body).then((r) => r.data),

  updatePhase: (
    projectId: number,
    phaseId: number,
    body: { name?: string; description?: string; position?: number; isActive?: boolean },
  ) => api.patch<WorkflowDto>(`/projects/${projectId}/phases/${phaseId}`, body).then((r) => r.data),

  savePhaseWorkflow: (
    projectId: number,
    phaseId: number,
    body: { statuses: StatusInput[]; transitions: TransitionInput[] },
  ) => api.put<PhaseDto>(`/projects/${projectId}/phases/${phaseId}/workflow`, body).then((r) => r.data),
}
