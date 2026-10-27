import { api } from '@/lib/apiClient'
import type { ItemsDto, WorkspaceDto, WorkspaceMemberDto, WorkspaceStatus, UserRefDto } from '@/types/rbac'

// doc/Workspace-RBAC-API-Contract.md §4 (Workspace) và §5 (Thành viên Workspace).

export interface CreateWorkspaceBody {
  name: string
  code?: string
  description?: string
  companyId: number | null
}

export interface UpdateWorkspaceBody {
  name?: string
  code?: string
  description?: string
}

export const workspaceApi = {
  list: (params: { companyId?: number | null; status?: WorkspaceStatus; search?: string } = {}) =>
    api
      .get<ItemsDto<WorkspaceDto>>('/workspaces', {
        params: { ...params, companyId: params.companyId ?? undefined },
      })
      .then((r) => r.data.items),

  get: (workspaceId: number) => api.get<WorkspaceDto>(`/workspaces/${workspaceId}`).then((r) => r.data),

  checkCode: (companyId: number, code: string) =>
    api
      .get<{ code: string; available: boolean; suggestion: string | null }>('/workspaces/code-availability', {
        params: { companyId, code },
      })
      .then((r) => r.data),

  create: (body: CreateWorkspaceBody) => api.post<WorkspaceDto>('/workspaces', body).then((r) => r.data),

  update: (workspaceId: number, body: UpdateWorkspaceBody) =>
    api.patch<WorkspaceDto>(`/workspaces/${workspaceId}`, body).then((r) => r.data),

  archive: (workspaceId: number) =>
    api.post<WorkspaceDto>(`/workspaces/${workspaceId}/archive`, {}).then((r) => r.data),

  restore: (workspaceId: number) =>
    api.post<WorkspaceDto>(`/workspaces/${workspaceId}/restore`, {}).then((r) => r.data),

  // --- Thành viên ---
  listMembers: (workspaceId: number, params: { search?: string; roleId?: number } = {}) =>
    api
      .get<ItemsDto<WorkspaceMemberDto>>(`/workspaces/${workspaceId}/members`, { params })
      .then((r) => r.data.items),

  listMemberCandidates: (workspaceId: number, search?: string) =>
    api
      .get<ItemsDto<UserRefDto>>(`/workspaces/${workspaceId}/member-candidates`, { params: { search } })
      .then((r) => r.data.items),

  addMembers: (workspaceId: number, members: { userId: number; roleId: number | null }[]) =>
    api
      .post<ItemsDto<WorkspaceMemberDto>>(`/workspaces/${workspaceId}/members`, { members })
      .then((r) => r.data.items),

  changeMemberRole: (workspaceId: number, userId: number, roleId: number) =>
    api.patch<WorkspaceMemberDto>(`/workspaces/${workspaceId}/members/${userId}`, { roleId }).then((r) => r.data),

  removeMember: (workspaceId: number, userId: number) => api.delete(`/workspaces/${workspaceId}/members/${userId}`),
}
