import { describe, expect, it } from 'vitest'
import { companyPermissionSet, hasPermission, isTenantAdmin } from './permissions'

describe('companyPermissionSet', () => {
  it('dùng đúng danh sách permissions BE trả về', () => {
    const set = companyPermissionSet({
      companyId: 1,
      companyName: 'Acme',
      roleName: 'Trưởng nhóm',
      roleCode: 'TEAM_LEAD',
      permissions: ['workspace.create'],
    })
    expect(hasPermission(set, 'workspace.create')).toBe(true)
    expect(hasPermission(set, 'role.manage')).toBe(false)
  })

  it('BE cũ không trả permissions: Tenant Admin toàn quyền, người khác không có quyền', () => {
    const admin = companyPermissionSet({ companyId: 1, companyName: 'Acme', roleName: 'Tenant Admin' })
    const member = companyPermissionSet({ companyId: 1, companyName: 'Acme', roleName: 'Member' })
    expect(hasPermission(admin, 'role.manage')).toBe(true)
    expect(hasPermission(member, 'user.view')).toBe(false)
  })

  it('không có công ty → không có quyền', () => {
    expect(companyPermissionSet(null).size).toBe(0)
  })
})

describe('isTenantAdmin', () => {
  it('ưu tiên roleCode hơn roleName', () => {
    expect(isTenantAdmin({ companyId: 1, companyName: 'A', roleName: 'Tenant Admin', roleCode: 'MEMBER' })).toBe(false)
    expect(isTenantAdmin({ companyId: 1, companyName: 'A', roleName: 'Quản trị', roleCode: 'TENANT_ADMIN' })).toBe(true)
  })
})
