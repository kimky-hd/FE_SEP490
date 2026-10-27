import { api } from '@/lib/apiClient'
import type { CompanyDto, CompanyMatchDto } from '@/types/auth'
import type { CompanyUserDto, MemberStatus, PageDto } from '@/types/rbac'

export interface CreateCompanyBody {
  name: string
  taxCode: string
  address: string
  emailDomain: string
  adminPhone: string
  workspaceSlug: string
  domainAutoJoinEnabled: boolean
}

export const companyApi = {
  matchByEmail: (email: string) =>
    api.get<CompanyMatchDto>('/companies/match', { params: { email } }).then((r) => r.data),

  create: (body: CreateCompanyBody) =>
    api.post<CompanyDto>('/companies', body).then((r) => r.data),

  joinDirectly: (companyId: number) =>
    api.post<{ companyId: number; status: string }>(`/companies/${companyId}/join`, {}).then((r) => r.data),

  requestToJoin: (companyId: number) =>
    api.post<{ requestId: number; status: string }>(`/companies/${companyId}/join-requests`, {}).then((r) => r.data),

  getJoinRequestStatus: (companyId: number, requestId: number) =>
    api.get<{ status: 'pending' | 'approved' | 'rejected' }>(
      `/companies/${companyId}/join-requests/${requestId}`,
    ).then((r) => r.data),

  // doc/Workspace-RBAC-API-Contract.md §7.1 — role chọn theo id (thay cho roleName tự do).
  invite: (
    companyId: number,
    body: { email: string; roleId?: number; workspaceId?: number; workspaceRoleId?: number },
  ) =>
    api.post<{ invitationId: number; token: string; inviteUrl: string; expiresAt?: string }>(
      `/companies/${companyId}/invitations`,
      body,
    ).then((r) => r.data),

  // doc/Workspace-RBAC-API-Contract.md §6 — người dùng công ty.
  listUsers: (
    companyId: number,
    params: { search?: string; roleId?: number; status?: MemberStatus; page?: number; pageSize?: number } = {},
  ) => api.get<PageDto<CompanyUserDto>>(`/companies/${companyId}/users`, { params }).then((r) => r.data),

  changeUserRole: (companyId: number, userId: number, roleId: number) =>
    api.patch<CompanyUserDto>(`/companies/${companyId}/users/${userId}/role`, { roleId }).then((r) => r.data),
}
