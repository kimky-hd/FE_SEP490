import type { CompanyMembershipDto } from '@/types/auth'

// Quyền hiệu lực cấp công ty lấy từ GET /auth/me (doc/Workspace-RBAC-API-Contract.md §1.1).
// BE cũ chưa trả `permissions` → coi Tenant Admin là toàn quyền, người khác không có quyền quản trị nào,
// để UI không mở nhầm nút mà BE sẽ chặn.
export function companyPermissionSet(company: CompanyMembershipDto | null | undefined): ReadonlySet<string> {
  if (!company) return new Set()
  if (company.permissions) return new Set(company.permissions)
  return new Set(isTenantAdmin(company) ? ['*'] : [])
}

export function isTenantAdmin(company: CompanyMembershipDto | null | undefined) {
  if (!company) return false
  return company.roleCode === 'TENANT_ADMIN' || (company.roleCode === undefined && company.roleName === 'Tenant Admin')
}

export function hasPermission(permissions: ReadonlySet<string> | readonly string[], key: string) {
  const set = permissions instanceof Set ? permissions : new Set(permissions)
  return set.has('*') || set.has(key)
}
