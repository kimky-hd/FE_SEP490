import { api } from '@/lib/apiClient'
import type { ItemsDto, PermissionDto, RoleDto, RoleMemberDto, RoleScope } from '@/types/rbac'

// doc/Workspace-RBAC-API-Contract.md §2 (danh mục quyền) và §3 (Role).

export interface RoleBody {
  name: string
  code?: string
  description?: string
  scope: RoleScope
  permissionKeys: string[]
}

export const permissionApi = {
  list: (scope?: RoleScope) =>
    api.get<ItemsDto<PermissionDto>>('/permissions', { params: { scope } }).then((r) => r.data.items),
}

export const roleApi = {
  list: (companyId: number, params: { scope?: RoleScope; includeInactive?: boolean } = {}) =>
    api.get<ItemsDto<RoleDto>>(`/companies/${companyId}/roles`, { params }).then((r) => r.data.items),

  get: (companyId: number, roleId: number) =>
    api.get<RoleDto>(`/companies/${companyId}/roles/${roleId}`).then((r) => r.data),

  create: (companyId: number, body: RoleBody) =>
    api.post<RoleDto>(`/companies/${companyId}/roles`, body).then((r) => r.data),

  update: (companyId: number, roleId: number, body: Partial<Omit<RoleBody, 'scope' | 'code'>>) =>
    api.patch<RoleDto>(`/companies/${companyId}/roles/${roleId}`, body).then((r) => r.data),

  setActive: (companyId: number, roleId: number, isActive: boolean) =>
    api.patch<RoleDto>(`/companies/${companyId}/roles/${roleId}/status`, { isActive }).then((r) => r.data),

  listMembers: (companyId: number, roleId: number) =>
    api.get<ItemsDto<RoleMemberDto>>(`/companies/${companyId}/roles/${roleId}/members`).then((r) => r.data.items),
}
