// Mock API trong app cho toàn bộ màn hình Auth / Onboarding / Workspace / RBAC / Project & Workflow — bật bằng VITE_USE_MOCK=true.
// Chặn request ngay trên instance axios `api`; có state (lưu localStorage) + kiểm tra quyền giống BE.
// Reset dữ liệu: gõ `__ssamMock.reset()` trong console trình duyệt.

import MockAdapter from 'axios-mock-adapter'
import type { AxiosRequestConfig } from 'axios'
import { api } from '@/lib/apiClient'
import { slugify, toRoleCode, ROLE_CODE_PATTERN, WORKSPACE_CODE_PATTERN } from '@/lib/slug'
import type {
  CompanyUserDto,
  RoleDto,
  RoleRefDto,
  RoleScope,
  WorkspaceDto,
  WorkspaceMemberDto,
} from '@/types/rbac'
import type {
  CreateProjectBody,
  PhaseDto,
  ProjectDto,
  ProjectMemberDto,
  SdlcMethod,
  StatusInput,
  TransitionInput,
  WorkflowDto,
  WorkflowIssue,
} from '@/types/project'
import { validatePhaseWorkflow } from '@/lib/workflowValidation'
import {
  PERMISSION_CATALOG,
  createSeed,
  keysOfScope,
  type MockDb,
  type MockProject,
  type MockRole,
  type MockUser,
  type MockWorkspace,
} from './data'
import { SDLC_TEMPLATES } from './sdlcTemplates'

const STORAGE_KEY = 'ssam.mockdb.v3'
const TOKEN_PREFIX = 'mock-token-'

type Reply = [number, unknown?]

class HttpError extends Error {
  workflowIssues?: WorkflowIssue[]
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly errors?: Record<string, string[]>,
  ) {
    super(message)
  }
}

const forbidden = (permission?: string) =>
  new HttpError(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.' + (permission ? ` (${permission})` : ''))
const notFound = () => new HttpError(404, 'NOT_FOUND', 'Không tìm thấy dữ liệu.')
const validation = (errors: Record<string, string[]>) =>
  new HttpError(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ.', errors)

// ---------- state ----------

function loadDb(): MockDb {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as MockDb
  } catch {
    // dữ liệu hỏng → seed lại
  }
  return createSeed()
}

let db = loadDb()
const save = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    // storage đầy / bị chặn: vẫn chạy được trong phiên hiện tại
  }
}
const nextId = () => ++db.seq
const now = () => new Date().toISOString()

// ---------- truy vấn ----------

const userById = (id: number) => db.users.find((u) => u.id === id)
const roleById = (id: number) => db.roles.find((r) => r.id === id)
const companyMember = (companyId: number, userId: number) =>
  db.companyMembers.find((m) => m.companyId === companyId && m.userId === userId && m.status === 'ACTIVE')
const activeWorkspaceMembers = (workspaceId: number) =>
  db.workspaceMembers.filter((m) => m.workspaceId === workspaceId && m.isActive)
const workspaceMember = (workspaceId: number, userId: number) =>
  activeWorkspaceMembers(workspaceId).find((m) => m.userId === userId)

const roleRef = (r: MockRole): RoleRefDto => ({ roleId: r.id, code: r.code, name: r.name, scope: r.scope })

// §0.4 — quyền cấp công ty. null = không phải thành viên.
function tenantPermissions(userId: number, companyId: number): Set<string> | null {
  const member = companyMember(companyId, userId)
  if (!member) return null
  const role = roleById(member.roleId)
  if (!role) return new Set()
  if (role.code === 'TENANT_ADMIN') return new Set(keysOfScope('TENANT'))
  return role.isActive ? new Set(role.permissionKeys) : new Set()
}

// §0.4 — quyền trong workspace. null = không thấy workspace.
function workspacePermissions(userId: number, ws: MockWorkspace): Set<string> | null {
  if (ws.companyId === null) return ws.createdBy === userId ? new Set(keysOfScope('WORKSPACE')) : null
  const tenant = tenantPermissions(userId, ws.companyId)
  if (!tenant) return null
  const tenantRole = roleById(companyMember(ws.companyId, userId)!.roleId)
  if (tenantRole?.code === 'TENANT_ADMIN') return new Set(keysOfScope('WORKSPACE'))
  const member = workspaceMember(ws.id, userId)
  if (member) {
    const role = roleById(member.roleId)
    return role?.isActive ? new Set(role.permissionKeys) : new Set()
  }
  if (tenant.has('workspace.view_all')) return new Set(['workspace.view', 'workspace.member.view', 'project.inherit_access'])
  return null
}

function requireTenant(userId: number, companyId: number, permission?: string) {
  const perms = tenantPermissions(userId, companyId)
  if (!perms) throw new HttpError(403, 'NOT_COMPANY_MEMBER', 'Bạn không thuộc công ty này.')
  if (permission && !perms.has(permission)) throw forbidden(permission)
  return perms
}

function requireWorkspace(userId: number, workspaceId: number, permission?: string) {
  const ws = db.workspaces.find((w) => w.id === workspaceId)
  if (!ws) throw notFound()
  const perms = workspacePermissions(userId, ws)
  if (!perms) throw notFound()
  if (permission && !perms.has(permission)) throw forbidden(permission)
  return { ws, perms }
}

function requireCompanyWorkspace(ws: MockWorkspace): number {
  if (ws.companyId === null) {
    throw new HttpError(400, 'PERSONAL_WORKSPACE', 'Workspace cá nhân không có thành viên khác.')
  }
  return ws.companyId
}

function ensureNotArchived(ws: MockWorkspace) {
  if (ws.status === 'ARCHIVED') {
    throw new HttpError(409, 'WORKSPACE_ARCHIVED', 'Workspace đã được lưu trữ, dữ liệu chỉ đọc.')
  }
}

function roleMemberCount(role: MockRole) {
  if (role.scope === 'TENANT') return db.companyMembers.filter((m) => m.roleId === role.id && m.status === 'ACTIVE').length
  if (role.scope === 'PROJECT') return db.projectMembers.filter((m) => m.roleId === role.id && m.isActive).length
  const activeWs = new Set(db.workspaces.map((w) => w.id))
  return db.workspaceMembers.filter((m) => m.roleId === role.id && m.isActive && activeWs.has(m.workspaceId)).length
}

function toRoleDto(role: MockRole): RoleDto {
  return {
    roleId: role.id,
    code: role.code,
    name: role.name,
    description: role.description,
    scope: role.scope,
    isSystem: role.isSystem,
    isLocked: role.isLocked,
    isActive: role.isActive,
    permissionKeys: role.code === 'TENANT_ADMIN' ? keysOfScope('TENANT') : [...role.permissionKeys],
    memberCount: roleMemberCount(role),
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  }
}

function toWorkspaceDto(ws: MockWorkspace, viewerId: number): WorkspaceDto & { workspaceName: string } {
  const creator = userById(ws.createdBy)!
  const member = workspaceMember(ws.id, viewerId)
  const myRole = ws.companyId !== null && member ? roleById(member.roleId) : undefined
  return {
    workspaceId: ws.id,
    workspaceName: ws.name,
    name: ws.name,
    code: ws.code,
    description: ws.description,
    companyId: ws.companyId,
    status: ws.status,
    myRole: myRole ? roleRef(myRole) : null,
    myPermissions: [...(workspacePermissions(viewerId, ws) ?? [])],
    projectCount: db.projects.filter((p) => p.workspaceId === ws.id && p.status === 'ACTIVE').length,
    memberCount: ws.companyId === null ? 1 : activeWorkspaceMembers(ws.id).length,
    createdBy: { userId: creator.id, fullName: creator.fullName, email: creator.email, avatarUrl: null },
    createdAt: ws.createdAt,
    updatedAt: ws.updatedAt,
    archivedAt: ws.archivedAt,
  }
}

function toWorkspaceMemberDto(ws: MockWorkspace, userId: number): WorkspaceMemberDto {
  const user = userById(userId)!
  const member = workspaceMember(ws.id, userId)!
  const companyRole = roleById(companyMember(ws.companyId!, userId)?.roleId ?? 0)
  return {
    userId: user.id,
    fullName: user.fullName,
    email: user.email,
    avatarUrl: null,
    role: roleRef(roleById(member.roleId)!),
    companyRole: companyRole ? roleRef(companyRole) : { roleId: 0, code: null, name: '—', scope: 'TENANT' },
    joinedAt: member.joinedAt,
  }
}

function toCompanyUserDto(companyId: number, userId: number): CompanyUserDto {
  const user = userById(userId)!
  const member = db.companyMembers.find((m) => m.companyId === companyId && m.userId === userId)!
  const companyWs = new Set(db.workspaces.filter((w) => w.companyId === companyId).map((w) => w.id))
  return {
    userId: user.id,
    fullName: user.fullName,
    email: user.email,
    avatarUrl: null,
    role: roleRef(roleById(member.roleId)!),
    status: member.status,
    workspaceCount: db.workspaceMembers.filter((m) => m.userId === userId && m.isActive && companyWs.has(m.workspaceId))
      .length,
    joinedAt: member.joinedAt,
  }
}

function assignableRole(companyId: number, roleId: number, scope: RoleScope): MockRole {
  const role = roleById(roleId)
  if (!role || role.companyId !== companyId) throw notFound()
  if (role.scope !== scope) {
    throw new HttpError(400, 'ROLE_SCOPE_MISMATCH', `Role này thuộc phạm vi ${role.scope}, không gán ở đây được.`)
  }
  if (!role.isActive) throw new HttpError(400, 'ROLE_INACTIVE', 'Role đang tắt, không gán được.')
  return role
}

const systemRole = (companyId: number, code: string) => db.roles.find((r) => r.companyId === companyId && r.code === code)!

function countWorkspaceAdmins(workspaceId: number) {
  const admin = db.roles.find((r) => r.code === 'WORKSPACE_ADMIN')
  return activeWorkspaceMembers(workspaceId).filter((m) => m.roleId === admin?.id).length
}

function validatePermissionKeys(keys: unknown, scope: RoleScope): string[] {
  if (!Array.isArray(keys)) throw validation({ permissionKeys: ['Danh sách quyền không hợp lệ'] })
  const unique = [...new Set(keys as string[])]
  for (const key of unique) {
    const permission = PERMISSION_CATALOG.find((p) => p.key === key)
    if (!permission) throw new HttpError(400, 'UNKNOWN_PERMISSION', `Quyền "${key}" không tồn tại.`)
    if (permission.scope !== scope) {
      throw new HttpError(400, 'PERMISSION_SCOPE_MISMATCH', `Quyền "${key}" không thuộc phạm vi ${scope}.`)
    }
  }
  return unique
}

function ensureUniqueRoleName(companyId: number, name: string, exceptId?: number) {
  const taken = db.roles.some(
    (r) => r.companyId === companyId && r.id !== exceptId && r.name.trim().toLowerCase() === name.trim().toLowerCase(),
  )
  if (taken) throw new HttpError(409, 'ROLE_NAME_TAKEN', 'Tên role đã tồn tại trong công ty.')
}

function uniqueWorkspaceCode(companyId: number | null, base: string, exceptId?: number) {
  const taken = (code: string) =>
    companyId !== null && db.workspaces.some((w) => w.companyId === companyId && w.code === code && w.id !== exceptId)
  if (!taken(base)) return base
  for (let i = 2; ; i++) {
    const candidate = `${base.slice(0, 46)}-${i}`
    if (!taken(candidate)) return candidate
  }
}

// ---------- routing ----------

interface Ctx {
  match: RegExpMatchArray
  body: Record<string, unknown>
  params: Record<string, string | undefined>
  userId: number
}

type Handler = (ctx: Ctx) => Reply

interface Route {
  method: 'get' | 'post' | 'patch' | 'put' | 'delete'
  pattern: RegExp
  handler: Handler
  public?: boolean
}

const routes: Route[] = []
const on = (method: Route['method'], path: string, handler: Handler, isPublic = false) =>
  routes.push({ method, pattern: new RegExp(`${path}$`), handler, public: isPublic })

const num = (value: string | undefined) => Number(value)
const str = (value: unknown) => (typeof value === 'string' ? value : undefined)

// --- Auth & Onboarding & Invitations ---

function session(user: MockUser) {
  return {
    accessToken: `${TOKEN_PREFIX}${user.id}`,
    refreshToken: `${TOKEN_PREFIX}${user.id}-refresh`,
    expiresIn: 86400,
    user: { id: user.id, fullName: user.fullName, email: user.email, avatarUrl: null, emailVerified: true },
  }
}

on(
  'post',
  '/auth/login',
  ({ body }) => {
    const email = str(body.email)?.trim().toLowerCase()
    const user = db.users.find((u) => u.email === email)
    if (!user || user.password !== body.password) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Email hoặc mật khẩu không đúng.')
    }
    const membership = db.companyMembers.find((m) => m.userId === user.id)
    if (membership?.status === 'DEACTIVATED') {
      throw new HttpError(403, 'ACCOUNT_DISABLED', 'Tài khoản đã bị vô hiệu hoá.')
    }
    return [200, session(user)]
  },
  true,
)

on(
  'post',
  '/auth/register',
  ({ body }) => {
    const email = str(body.email)?.trim().toLowerCase() ?? 'new@fintechcorp.com'
    const fullName = str(body.fullName)?.trim() ?? 'Người dùng mới'
    const password = str(body.password) ?? 'Password@123'
    let user = db.users.find((u) => u.email === email)
    if (!user) {
      user = { id: nextId(), fullName, email, password }
      db.users.push(user)
      save()
    }
    return [201, { accountId: user.id, email: user.email, emailVerified: false }]
  },
  true,
)

on(
  'post',
  '/auth/google',
  () => [200, { ...session(db.users[0]), isNewAccount: false }],
  true,
)

on('post', '/auth/logout', () => [204], true)

on('post', '/auth/email/verify', () => [200, { verified: true }], true)
on('post', '/auth/email/resend', () => [204], true)
on('post', '/auth/password/forgot', () => [204], true)
on('post', '/auth/password/reset', () => [200, { success: true }], true)

on('get', '/auth/me', ({ userId }) => {
  const user = userById(userId) ?? db.users[0]
  const uid = user.id
  const companies = db.companyMembers
    .filter((m) => m.userId === uid && m.status === 'ACTIVE')
    .map((m) => {
      const role = roleById(m.roleId)!
      return {
        companyId: m.companyId,
        companyName: db.companies.find((c) => c.id === m.companyId)!.name,
        roleName: role.name,
        roleId: role.id,
        roleCode: role.code,
        permissions: [...(tenantPermissions(uid, m.companyId) ?? [])],
      }
    })
  const workspaces = db.workspaces
    .filter((w) => (w.companyId === null ? w.createdBy === uid : !!workspaceMember(w.id, uid) || tenantPermissions(uid, w.companyId)?.has('workspace.view_all')))
    .filter((w) => w.companyId === null || !!companyMember(w.companyId, uid))
    .map((w) => {
      const dto = toWorkspaceDto(w, uid)
      return {
        workspaceId: w.id,
        workspaceName: w.name,
        code: w.code,
        companyId: w.companyId,
        status: w.status,
        role: dto.myRole,
        permissions: dto.myPermissions,
      }
    })
  return [
    200,
    {
      user: { id: user.id, fullName: user.fullName, email: user.email, avatarUrl: null, emailVerified: true },
      companies,
      workspaces,
    },
  ]
})

// --- Onboarding & Invitations mock ---

on('get', '/companies/match', () => [
  200,
  {
    matched: true,
    company: {
      id: 1,
      name: 'Acme Fintech Corp',
      domain: 'fintechcorp.com',
      logoUrl: null,
      autoJoinEnabled: true,
    },
  },
])

on('post', '/companies', ({ body }) => {
  const name = str(body.name)?.trim() || 'Acme Fintech Corp'
  return [
    201,
    {
      id: 1,
      name,
      code: slugify(name) || 'acme-fintech',
      emailDomain: str(body.emailDomain) || 'fintechcorp.com',
      domainAutoJoinEnabled: Boolean(body.domainAutoJoinEnabled),
      taxCode: str(body.taxCode) || '0101234567',
      address: str(body.address) || 'Hà Nội, Việt Nam',
      logoUrl: null,
    },
  ]
})

on('post', '/companies/(\\d+)/join', ({ match }) => [
  200,
  { companyId: num(match[1]), status: 'joined' },
])

on('post', '/companies/(\\d+)/join-requests', () => [
  201,
  { requestId: 101, status: 'pending' },
])

on('get', '/companies/(\\d+)/join-requests/(\\d+)', () => [
  200,
  { status: 'approved' },
])

on(
  'get',
  '/invitations/([^/]+)',
  () => [
    200,
    {
      valid: true,
      email: 'invited.member@fintechcorp.com',
      companyName: 'Acme Fintech Corp',
      workspaceName: 'Mobile Banking Revamp',
      roleName: 'Member',
      workspaceRoleName: 'Workspace Member',
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    },
  ],
  true,
)

on(
  'post',
  '/invitations/([^/]+)/accept',
  () => [
    200,
    {
      ...session(db.users[0]),
      companyId: 1,
      workspaceId: 10,
    },
  ],
  true,
)

// --- §2 Danh mục quyền ---

on('get', '/permissions', ({ params }) => {
  const scope = params.scope as RoleScope | undefined
  return [200, { items: PERMISSION_CATALOG.filter((p) => !scope || p.scope === scope) }]
})

// --- §3 Role ---

on('get', '/companies/(\\d+)/roles', ({ match, params, userId }) => {
  const companyId = num(match[1])
  const includeInactive = params.includeInactive !== 'false'
  requireTenant(userId, companyId, includeInactive ? 'role.view' : undefined)
  const items = db.roles
    .filter((r) => r.companyId === companyId)
    .filter((r) => !params.scope || r.scope === params.scope)
    .filter((r) => includeInactive || r.isActive)
    .sort((a, b) => Number(b.isSystem) - Number(a.isSystem) || a.name.localeCompare(b.name, 'vi'))
    .map(toRoleDto)
  return [200, { items }]
})

on('get', '/companies/(\\d+)/roles/(\\d+)', ({ match, userId }) => {
  const companyId = num(match[1])
  requireTenant(userId, companyId, 'role.view')
  const role = roleById(num(match[2]))
  if (!role || role.companyId !== companyId) throw notFound()
  return [200, toRoleDto(role)]
})

on('get', '/companies/(\\d+)/roles/(\\d+)/members', ({ match, userId }) => {
  const companyId = num(match[1])
  requireTenant(userId, companyId, 'role.view')
  const role = roleById(num(match[2]))
  if (!role || role.companyId !== companyId) throw notFound()
  const items =
    role.scope === 'TENANT'
      ? db.companyMembers
          .filter((m) => m.roleId === role.id && m.status === 'ACTIVE')
          .map((m) => {
            const u = userById(m.userId)!
            return { userId: u.id, fullName: u.fullName, email: u.email, workspace: null }
          })
      : role.scope === 'PROJECT'
      ? db.projectMembers
          .filter((m) => m.roleId === role.id && m.isActive)
          .map((m) => {
            const u = userById(m.userId)!
            const p = db.projects.find((x) => x.id === m.projectId)!
            const ws = db.workspaces.find((w) => w.id === p.workspaceId)!
            return {
              userId: u.id,
              fullName: u.fullName,
              email: u.email,
              workspace: { workspaceId: ws.id, name: ws.name },
              project: { projectId: p.id, key: p.key, name: p.name },
            }
          })
      : db.workspaceMembers
          .filter((m) => m.roleId === role.id && m.isActive)
          .map((m) => {
            const u = userById(m.userId)!
            const ws = db.workspaces.find((w) => w.id === m.workspaceId)!
            return { userId: u.id, fullName: u.fullName, email: u.email, workspace: { workspaceId: ws.id, name: ws.name } }
          })
  return [200, { items }]
})

on('post', '/companies/(\\d+)/roles', ({ match, body, userId }) => {
  const companyId = num(match[1])
  requireTenant(userId, companyId, 'role.manage')
  const name = str(body.name)?.trim() ?? ''
  const scope = body.scope as RoleScope
  const errors: Record<string, string[]> = {}
  if (name.length < 2 || name.length > 100) errors.name = ['Tên role từ 2 đến 100 ký tự']
  if (scope !== 'TENANT' && scope !== 'WORKSPACE' && scope !== 'PROJECT') errors.scope = ['Chọn phạm vi áp dụng']
  let code = str(body.code)?.trim() || ''
  if (code && !ROLE_CODE_PATTERN.test(code)) errors.code = ['Mã viết HOA, bắt đầu bằng chữ, chỉ gồm A-Z 0-9 _']
  if (Object.keys(errors).length) throw validation(errors)

  ensureUniqueRoleName(companyId, name)
  const codeTaken = (c: string) => db.roles.some((r) => r.companyId === companyId && r.code === c)
  if (code) {
    if (codeTaken(code)) throw new HttpError(409, 'ROLE_CODE_TAKEN', 'Mã role đã tồn tại trong công ty.')
  } else {
    const base = toRoleCode(name) || 'ROLE'
    code = base
    for (let i = 2; codeTaken(code); i++) code = `${base.slice(0, 46)}_${i}`
  }
  const permissionKeys = validatePermissionKeys(body.permissionKeys ?? [], scope)
  const role: MockRole = {
    id: nextId(),
    companyId,
    code,
    name,
    description: str(body.description)?.trim() || null,
    scope,
    isSystem: false,
    isLocked: false,
    isActive: true,
    permissionKeys,
    createdAt: now(),
    updatedAt: now(),
  }
  db.roles.push(role)
  save()
  return [201, toRoleDto(role)]
})

on('patch', '/companies/(\\d+)/roles/(\\d+)', ({ match, body, userId }) => {
  const companyId = num(match[1])
  requireTenant(userId, companyId, 'role.manage')
  const role = roleById(num(match[2]))
  if (!role || role.companyId !== companyId) throw notFound()
  if (role.isLocked) throw new HttpError(403, 'ROLE_LOCKED', 'Role hệ thống này được khoá, không chỉnh sửa được.')

  if (body.name !== undefined) {
    const name = str(body.name)?.trim() ?? ''
    if (name.length < 2 || name.length > 100) throw validation({ name: ['Tên role từ 2 đến 100 ký tự'] })
    ensureUniqueRoleName(companyId, name, role.id)
    role.name = name
  }
  if (body.description !== undefined) role.description = str(body.description)?.trim() || null
  if (body.permissionKeys !== undefined) role.permissionKeys = validatePermissionKeys(body.permissionKeys, role.scope)
  role.updatedAt = now()
  save()
  return [200, toRoleDto(role)]
})

on('patch', '/companies/(\\d+)/roles/(\\d+)/status', ({ match, body, userId }) => {
  const companyId = num(match[1])
  requireTenant(userId, companyId, 'role.manage')
  const role = roleById(num(match[2]))
  if (!role || role.companyId !== companyId) throw notFound()
  if (role.isSystem) throw new HttpError(403, 'ROLE_LOCKED', 'Không thể tắt role hệ thống.')
  const isActive = body.isActive === true
  if (!isActive && roleMemberCount(role) > 0) {
    throw new HttpError(409, 'ROLE_IN_USE', 'Role đang được gán cho người dùng — chuyển họ sang role khác trước khi tắt.')
  }
  role.isActive = isActive
  role.updatedAt = now()
  save()
  return [200, toRoleDto(role)]
})

// --- §4 Workspace ---

on('get', '/workspaces/code-availability', ({ params, userId }) => {
  const companyId = num(params.companyId)
  requireTenant(userId, companyId)
  const code = params.code ?? ''
  const available = WORKSPACE_CODE_PATTERN.test(code) && uniqueWorkspaceCode(companyId, code) === code
  return [200, { code, available, suggestion: available ? null : uniqueWorkspaceCode(companyId, slugify(code) || 'workspace') }]
})

on('get', '/workspaces', ({ params, userId }) => {
  const companyId = params.companyId ? num(params.companyId) : null
  let visible: MockWorkspace[]
  if (companyId === null) {
    visible = db.workspaces.filter((w) => w.companyId === null && w.createdBy === userId)
  } else {
    requireTenant(userId, companyId)
    visible = db.workspaces.filter((w) => w.companyId === companyId && workspacePermissions(userId, w) !== null)
  }
  const search = params.search?.trim().toLowerCase()
  const items = visible
    .filter((w) => !params.status || w.status === params.status)
    .filter((w) => !search || w.name.toLowerCase().includes(search) || w.code.includes(search))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((w) => toWorkspaceDto(w, userId))
  return [200, { items }]
})

on('get', '/workspaces/(\\d+)', ({ match, userId }) => {
  const { ws } = requireWorkspace(userId, num(match[1]))
  return [200, toWorkspaceDto(ws, userId)]
})

on('post', '/workspaces', ({ body, userId }) => {
  const companyId = typeof body.companyId === 'number' ? body.companyId : null
  const name = str(body.name)?.trim() ?? ''
  const description = str(body.description)?.trim() || null
  const errors: Record<string, string[]> = {}
  if (name.length < 2 || name.length > 255) errors.name = ['Tên workspace từ 2 đến 255 ký tự']
  const rawCode = str(body.code)?.trim()
  if (rawCode && (!WORKSPACE_CODE_PATTERN.test(rawCode) || rawCode.length < 2 || rawCode.length > 50)) {
    errors.code = ['Mã chỉ gồm chữ thường, số và dấu "-" (2–50 ký tự)']
  }
  if (description && description.length > 1000) errors.description = ['Mô tả tối đa 1000 ký tự']
  if (Object.keys(errors).length) throw validation(errors)

  if (companyId === null) {
    if (db.workspaces.some((w) => w.companyId === null && w.createdBy === userId)) {
      throw new HttpError(409, 'CONFLICT', 'Bạn đã có workspace cá nhân.')
    }
  } else {
    requireTenant(userId, companyId, 'workspace.create')
  }

  let code: string
  if (rawCode) {
    if (uniqueWorkspaceCode(companyId, rawCode) !== rawCode) {
      throw new HttpError(409, 'WORKSPACE_CODE_TAKEN', 'Mã workspace đã được dùng trong công ty.')
    }
    code = rawCode
  } else {
    code = uniqueWorkspaceCode(companyId, slugify(name) || 'workspace')
  }

  const ws: MockWorkspace = {
    id: nextId(),
    companyId,
    name,
    code,
    description,
    createdBy: userId,
    status: 'ACTIVE',
    createdAt: now(),
    updatedAt: now(),
    archivedAt: null,
  }
  db.workspaces.push(ws)
  if (companyId !== null) {
    db.workspaceMembers.push({
      workspaceId: ws.id,
      userId,
      roleId: systemRole(companyId, 'WORKSPACE_ADMIN').id,
      isActive: true,
      joinedAt: now(),
    })
  }
  save()
  return [201, toWorkspaceDto(ws, userId)]
})

on('patch', '/workspaces/(\\d+)', ({ match, body, userId }) => {
  const { ws } = requireWorkspace(userId, num(match[1]), 'workspace.update')
  ensureNotArchived(ws)
  const errors: Record<string, string[]> = {}
  const name = body.name !== undefined ? str(body.name)?.trim() ?? '' : undefined
  const code = body.code !== undefined ? str(body.code)?.trim() ?? '' : undefined
  if (name !== undefined && (name.length < 2 || name.length > 255)) errors.name = ['Tên workspace từ 2 đến 255 ký tự']
  if (code !== undefined && (!WORKSPACE_CODE_PATTERN.test(code) || code.length < 2 || code.length > 50)) {
    errors.code = ['Mã chỉ gồm chữ thường, số và dấu "-" (2–50 ký tự)']
  }
  if (Object.keys(errors).length) throw validation(errors)
  if (code !== undefined && code !== ws.code && uniqueWorkspaceCode(ws.companyId, code, ws.id) !== code) {
    throw new HttpError(409, 'WORKSPACE_CODE_TAKEN', 'Mã workspace đã được dùng trong công ty.')
  }
  if (name !== undefined) ws.name = name
  if (code !== undefined) ws.code = code
  if (body.description !== undefined) ws.description = str(body.description)?.trim() || null
  ws.updatedAt = now()
  save()
  return [200, toWorkspaceDto(ws, userId)]
})

on('post', '/workspaces/(\\d+)/archive', ({ match, userId }) => {
  const { ws } = requireWorkspace(userId, num(match[1]), 'workspace.archive')
  ensureNotArchived(ws)
  ws.status = 'ARCHIVED'
  ws.archivedAt = now()
  ws.updatedAt = now()
  save()
  return [200, toWorkspaceDto(ws, userId)]
})

on('post', '/workspaces/(\\d+)/restore', ({ match, userId }) => {
  const { ws } = requireWorkspace(userId, num(match[1]), 'workspace.archive')
  ws.status = 'ACTIVE'
  ws.archivedAt = null
  ws.updatedAt = now()
  save()
  return [200, toWorkspaceDto(ws, userId)]
})

// --- §5 Thành viên Workspace ---

on('get', '/workspaces/(\\d+)/members', ({ match, params, userId }) => {
  const { ws } = requireWorkspace(userId, num(match[1]), 'workspace.member.view')
  requireCompanyWorkspace(ws)
  const search = params.search?.trim().toLowerCase()
  const items = activeWorkspaceMembers(ws.id)
    .filter((m) => !params.roleId || m.roleId === num(params.roleId))
    .map((m) => toWorkspaceMemberDto(ws, m.userId))
    .filter((m) => !search || m.fullName.toLowerCase().includes(search) || m.email.includes(search))
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
  return [200, { items }]
})

on('get', '/workspaces/(\\d+)/member-candidates', ({ match, params, userId }) => {
  const { ws } = requireWorkspace(userId, num(match[1]), 'workspace.member.manage')
  const companyId = requireCompanyWorkspace(ws)
  const search = params.search?.trim().toLowerCase()
  const items = db.companyMembers
    .filter((m) => m.companyId === companyId && m.status === 'ACTIVE' && !workspaceMember(ws.id, m.userId))
    .map((m) => userById(m.userId)!)
    .filter((u) => !search || u.fullName.toLowerCase().includes(search) || u.email.includes(search))
    .slice(0, 20)
    .map((u) => ({ userId: u.id, fullName: u.fullName, email: u.email, avatarUrl: null }))
  return [200, { items }]
})

on('post', '/workspaces/(\\d+)/members', ({ match, body, userId }) => {
  const { ws } = requireWorkspace(userId, num(match[1]), 'workspace.member.manage')
  const companyId = requireCompanyWorkspace(ws)
  ensureNotArchived(ws)
  const members = Array.isArray(body.members) ? (body.members as { userId: number; roleId: number | null }[]) : []
  if (members.length === 0) throw validation({ members: ['Chọn ít nhất 1 thành viên'] })

  const resolved = members.map((m) => {
    if (!companyMember(companyId, m.userId)) {
      throw new HttpError(403, 'NOT_COMPANY_MEMBER', 'Người dùng không thuộc công ty.')
    }
    if (workspaceMember(ws.id, m.userId)) throw new HttpError(409, 'ALREADY_MEMBER', 'Người dùng đã là thành viên.')
    const role =
      m.roleId === null || m.roleId === undefined
        ? systemRole(companyId, 'WORKSPACE_MEMBER')
        : assignableRole(companyId, m.roleId, 'WORKSPACE')
    return { userId: m.userId, roleId: role.id }
  })

  for (const m of resolved) {
    const previous = db.workspaceMembers.find((x) => x.workspaceId === ws.id && x.userId === m.userId)
    if (previous) {
      previous.isActive = true
      previous.roleId = m.roleId
      previous.joinedAt = now()
    } else {
      db.workspaceMembers.push({ workspaceId: ws.id, userId: m.userId, roleId: m.roleId, isActive: true, joinedAt: now() })
    }
  }
  ws.updatedAt = now()
  save()
  return [201, { items: resolved.map((m) => toWorkspaceMemberDto(ws, m.userId)) }]
})

on('patch', '/workspaces/(\\d+)/members/(\\d+)', ({ match, body, userId }) => {
  const { ws } = requireWorkspace(userId, num(match[1]), 'workspace.member.manage')
  const companyId = requireCompanyWorkspace(ws)
  ensureNotArchived(ws)
  const member = workspaceMember(ws.id, num(match[2]))
  if (!member) throw notFound()
  const role = assignableRole(companyId, num(String(body.roleId)), 'WORKSPACE')
  const adminRoleId = systemRole(companyId, 'WORKSPACE_ADMIN').id
  if (member.roleId === adminRoleId && role.id !== adminRoleId && countWorkspaceAdmins(ws.id) <= 1) {
    throw new HttpError(409, 'LAST_WORKSPACE_ADMIN', 'Workspace phải còn ít nhất 1 Workspace Admin.')
  }
  member.roleId = role.id
  save()
  return [200, toWorkspaceMemberDto(ws, member.userId)]
})

on('delete', '/workspaces/(\\d+)/members/(\\d+)', ({ match, userId }) => {
  const targetId = num(match[2])
  const { ws } = requireWorkspace(userId, num(match[1]), targetId === userId ? undefined : 'workspace.member.manage')
  const companyId = requireCompanyWorkspace(ws)
  ensureNotArchived(ws)
  const member = workspaceMember(ws.id, targetId)
  if (!member) throw notFound()
  if (member.roleId === systemRole(companyId, 'WORKSPACE_ADMIN').id && countWorkspaceAdmins(ws.id) <= 1) {
    throw new HttpError(409, 'LAST_WORKSPACE_ADMIN', 'Workspace phải còn ít nhất 1 Workspace Admin.')
  }
  const pmRoleId = systemRole(companyId, 'PROJECT_MANAGER').id
  const ownProjects = db.projects.filter((p) => p.workspaceId === ws.id)
  const projectMemberships = db.projectMembers.filter(
    (m) => m.userId === targetId && m.isActive && ownProjects.some((p) => p.id === m.projectId),
  )
  const soleManagerOf = projectMemberships.find(
    (m) =>
      m.roleId === pmRoleId &&
      db.projectMembers.filter((x) => x.projectId === m.projectId && x.isActive && x.roleId === pmRoleId).length <= 1,
  )
  if (soleManagerOf) {
    const p = ownProjects.find((x) => x.id === soleManagerOf.projectId)!
    throw new HttpError(409, 'LAST_PROJECT_MANAGER', `Người này là Project Manager duy nhất của dự án ${p.key} — chuyển PM trước khi gỡ.`)
  }
  for (const m of projectMemberships) m.isActive = false
  member.isActive = false
  ws.updatedAt = now()
  save()
  return [204]
})

// --- §6 Người dùng công ty ---

on('get', '/companies/(\\d+)/users', ({ match, params, userId }) => {
  const companyId = num(match[1])
  requireTenant(userId, companyId, 'user.view')
  const search = params.search?.trim().toLowerCase()
  const page = Math.max(1, num(params.page) || 1)
  const pageSize = Math.min(100, num(params.pageSize) || 20)
  const all = db.companyMembers
    .filter((m) => m.companyId === companyId)
    .filter((m) => !params.status || m.status === params.status)
    .filter((m) => !params.roleId || m.roleId === num(params.roleId))
    .map((m) => toCompanyUserDto(companyId, m.userId))
    .filter((u) => !search || u.fullName.toLowerCase().includes(search) || u.email.includes(search))
  return [200, { items: all.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: all.length }]
})

on('patch', '/companies/(\\d+)/users/(\\d+)/role', ({ match, body, userId }) => {
  const companyId = num(match[1])
  requireTenant(userId, companyId, 'user.assign_role')
  const member = db.companyMembers.find((m) => m.companyId === companyId && m.userId === num(match[2]))
  if (!member) throw notFound()
  const role = assignableRole(companyId, num(String(body.roleId)), 'TENANT')
  const adminId = systemRole(companyId, 'TENANT_ADMIN').id
  const adminCount = db.companyMembers.filter((m) => m.companyId === companyId && m.roleId === adminId && m.status === 'ACTIVE')
    .length
  if (member.roleId === adminId && role.id !== adminId && adminCount <= 1) {
    throw new HttpError(409, 'LAST_TENANT_ADMIN', 'Công ty phải còn ít nhất 1 Tenant Admin.')
  }
  member.roleId = role.id
  save()
  return [200, toCompanyUserDto(companyId, member.userId)]
})

// --- §7 Lời mời ---

on('post', '/companies/(\\d+)/invitations', ({ match, body, userId }) => {
  const companyId = num(match[1])
  requireTenant(userId, companyId, 'user.invite')
  const email = str(body.email)?.trim().toLowerCase() ?? ''
  if (!email.includes('@')) throw validation({ email: ['Email không hợp lệ'] })
  if (body.roleId !== undefined) assignableRole(companyId, num(String(body.roleId)), 'TENANT')
  if (body.workspaceId !== undefined) {
    requireWorkspace(userId, num(String(body.workspaceId)), 'workspace.member.manage')
    if (body.workspaceRoleId !== undefined) assignableRole(companyId, num(String(body.workspaceRoleId)), 'WORKSPACE')
  }
  const existing = db.users.find((u) => u.email === email)
  if (existing && companyMember(companyId, existing.id)) {
    throw new HttpError(409, 'ALREADY_MEMBER', 'Email này đã là thành viên công ty.')
  }
  const id = nextId()
  save()
  const token = `inv_mock_${id}`
  return [
    201,
    {
      invitationId: id,
      token,
      inviteUrl: `${window.location.origin}/invite/${token}`,
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    },
  ]
})

// --- §9–§12 Dự án & Workflow ---

const projectById = (id: number) => db.projects.find((p) => p.id === id)
const projectMember = (projectId: number, userId: number) =>
  db.projectMembers.find((m) => m.projectId === projectId && m.userId === userId && m.isActive)
const activeProjectMembers = (projectId: number) => db.projectMembers.filter((m) => m.projectId === projectId && m.isActive)

// §0.4 projectPermissions. null = không thấy dự án.
function projectPermissions(userId: number, project: MockProject): Set<string> | null {
  const ws = db.workspaces.find((w) => w.id === project.workspaceId)!
  const wsPerms = workspacePermissions(userId, ws)
  if (!wsPerms) return null
  const tenantRole = ws.companyId !== null ? roleById(companyMember(ws.companyId, userId)?.roleId ?? 0) : undefined
  const wsRole = roleById(workspaceMember(ws.id, userId)?.roleId ?? 0)
  const isPersonalOwner = ws.companyId === null && ws.createdBy === userId
  if (isPersonalOwner || tenantRole?.code === 'TENANT_ADMIN' || wsRole?.code === 'WORKSPACE_ADMIN') {
    return new Set(keysOfScope('PROJECT'))
  }
  const pm = projectMember(project.id, userId)
  if (pm) {
    const role = roleById(pm.roleId)
    return role?.isActive ? new Set(role.permissionKeys) : new Set()
  }
  if (wsPerms.has('project.inherit_access') || wsPerms.has('project.view_all')) {
    return new Set(['project.view', 'project.workflow.view'])
  }
  return null
}

function requireProject(userId: number, projectId: number, permission?: string) {
  const project = projectById(projectId)
  if (!project) throw notFound()
  const perms = projectPermissions(userId, project)
  if (!perms) throw notFound()
  if (permission && !perms.has(permission)) throw forbidden(permission)
  return { project, perms }
}

function ensureProjectWritable(project: MockProject) {
  const ws = db.workspaces.find((w) => w.id === project.workspaceId)!
  ensureNotArchived(ws)
  if (project.status === 'ARCHIVED') throw new HttpError(409, 'PROJECT_ARCHIVED', 'Dự án đã được lưu trữ, dữ liệu chỉ đọc.')
}

const companyIdOfProject = (project: MockProject) => db.workspaces.find((w) => w.id === project.workspaceId)!.companyId ?? 1

function projectManagerCount(projectId: number) {
  const pmRole = db.roles.find((r) => r.code === 'PROJECT_MANAGER')
  return activeProjectMembers(projectId).filter((m) => m.roleId === pmRole?.id).length
}

const userRef = (id: number) => {
  const u = userById(id)!
  return { userId: u.id, fullName: u.fullName, email: u.email, avatarUrl: null }
}

function toProjectDto(project: MockProject, viewerId: number): ProjectDto {
  const ws = db.workspaces.find((w) => w.id === project.workspaceId)!
  const pmRole = db.roles.find((r) => r.code === 'PROJECT_MANAGER')
  const lead = activeProjectMembers(project.id).find((m) => m.roleId === pmRole?.id)
  const mine = projectMember(project.id, viewerId)
  const myRole = mine ? roleById(mine.roleId) : undefined
  return {
    projectId: project.id,
    workspaceId: ws.id,
    workspaceName: ws.name,
    companyId: ws.companyId,
    key: project.key,
    name: project.name,
    description: project.description,
    sdlcMethod: project.sdlcMethod,
    aiEnabled: project.aiEnabled,
    status: ws.status === 'ARCHIVED' ? 'ARCHIVED' : project.status,
    lead: lead ? userRef(lead.userId) : null,
    myRole: myRole ? roleRef(myRole) : null,
    myPermissions: [...(projectPermissions(viewerId, project) ?? [])],
    memberCount: activeProjectMembers(project.id).length,
    phaseCount: db.phases.filter((ph) => ph.projectId === project.id && ph.isActive).length,
    openIssueCount: 0,
    doneIssueCount: 0,
    documentCount: 0,
    createdBy: userRef(project.createdBy),
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    archivedAt: project.archivedAt,
  }
}

function toProjectMemberDto(project: MockProject, userId: number): ProjectMemberDto {
  const member = projectMember(project.id, userId)!
  const wsRole = roleById(workspaceMember(project.workspaceId, userId)?.roleId ?? 0)
  return {
    ...userRef(userId),
    role: roleRef(roleById(member.roleId)!),
    workspaceRole: wsRole ? roleRef(wsRole) : { roleId: 0, code: null, name: '—', scope: 'WORKSPACE' },
    joinedAt: member.joinedAt,
  }
}

function toPhaseDto(phaseId: number): PhaseDto {
  const phase = db.phases.find((ph) => ph.id === phaseId)!
  return {
    phaseId: phase.id,
    name: phase.name,
    description: phase.description,
    position: phase.position,
    isActive: phase.isActive,
    statuses: db.statuses
      .filter((s) => s.phaseId === phase.id)
      .sort((a, b) => a.position - b.position)
      .map((s) => ({
        statusId: s.id,
        name: s.name,
        category: s.category,
        color: s.color,
        description: s.description,
        isInitial: s.isInitial,
        position: s.position,
        isActive: s.isActive,
        issueCount: 0,
      })),
    transitions: db.transitions
      .filter((t) => t.phaseId === phase.id)
      .map((t) => ({
        transitionId: t.id,
        fromStatusId: t.fromStatusId,
        toStatusId: t.toStatusId,
        allowedRoles: t.allowedRoleIds.map((id) => roleById(id)).filter((r): r is MockRole => !!r).map(roleRef),
        requireComment: t.requireComment,
        commentHint: t.commentHint,
        condition: t.condition,
      })),
  }
}

function toWorkflowDto(project: MockProject): WorkflowDto {
  return {
    projectId: project.id,
    sdlcMethod: project.sdlcMethod,
    phasesEditable: project.sdlcMethod === 'CUSTOM',
    phases: db.phases
      .filter((ph) => ph.projectId === project.id)
      .sort((a, b) => a.position - b.position)
      .map((ph) => toPhaseDto(ph.id)),
  }
}

function projectRole(companyId: number, roleId: number) {
  return assignableRole(companyId, roleId, 'PROJECT')
}

const PROJECT_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,9}$/

function uniqueProjectKey(workspaceId: number, base: string) {
  const taken = (k: string) => db.projects.some((p) => p.workspaceId === workspaceId && p.key === k)
  if (!taken(base)) return base
  for (let i = 2; ; i++) {
    const candidate = `${base.slice(0, 9)}${i}`.slice(0, 10)
    if (!taken(candidate)) return candidate
  }
}

function checkPhaseBody(
  body: { statuses?: StatusInput[]; transitions?: TransitionInput[] },
  phaseIndex: number,
  companyId: number,
): WorkflowIssue[] {
  const statuses = Array.isArray(body.statuses) ? body.statuses : []
  const transitions = Array.isArray(body.transitions) ? body.transitions : []
  for (const t of transitions) {
    for (const roleId of t.allowedRoleIds ?? []) projectRole(companyId, roleId)
  }
  return validatePhaseWorkflow(
    statuses.map((s) => ({
      key: String(s.statusId ?? s.key),
      name: s.name ?? '',
      category: s.category,
      isInitial: !!s.isInitial,
      isActive: s.isActive !== false,
    })),
    transitions.map((t) => ({ from: String(t.from), to: String(t.to), allowedRoleIds: t.allowedRoleIds ?? [] })),
    phaseIndex,
  )
}

function workflowInvalid(issues: WorkflowIssue[]): never {
  throw Object.assign(new HttpError(400, 'WORKFLOW_INVALID', 'Cấu hình workflow chưa hợp lệ.'), { workflowIssues: issues })
}

function writePhaseWorkflow(projectId: number, phaseId: number, body: { statuses: StatusInput[]; transitions: TransitionInput[] }) {
  const keep = new Set(body.statuses.filter((s) => s.statusId !== undefined).map((s) => s.statusId!))
  db.statuses = db.statuses.filter((s) => s.phaseId !== phaseId || keep.has(s.id))
  const idOf = new Map<string, number>()
  body.statuses.forEach((s, i) => {
    const existing = s.statusId !== undefined ? db.statuses.find((x) => x.id === s.statusId && x.phaseId === phaseId) : undefined
    const fields = {
      name: s.name.trim(),
      category: s.category,
      color: s.color,
      description: s.description?.trim() || null,
      isInitial: !!s.isInitial,
      position: i + 1,
      isActive: s.isActive !== false,
    }
    if (existing) {
      Object.assign(existing, fields)
      idOf.set(String(existing.id), existing.id)
    } else {
      const id = nextId()
      db.statuses.push({ id, projectId, phaseId, ...fields })
      idOf.set(String(s.key), id)
    }
  })
  db.transitions = db.transitions.filter((t) => t.phaseId !== phaseId)
  for (const t of body.transitions) {
    db.transitions.push({
      id: nextId(),
      projectId,
      phaseId,
      fromStatusId: idOf.get(String(t.from))!,
      toStatusId: idOf.get(String(t.to))!,
      allowedRoleIds: [...new Set(t.allowedRoleIds)],
      requireComment: !!t.requireComment,
      commentHint: t.requireComment ? t.commentHint?.trim() || null : null,
      condition: t.condition?.trim() || null,
    })
  }
}

on('get', '/sdlc-templates', () => [200, { items: SDLC_TEMPLATES }])

function visibleProjects(userId: number, workspaceIds: number[]) {
  return db.projects
    .filter((p) => workspaceIds.includes(p.workspaceId))
    .filter((p) => projectPermissions(userId, p) !== null)
}

function filterProjects(items: MockProject[], params: Record<string, string | undefined>, userId: number) {
  const search = params.search?.trim().toLowerCase()
  return items
    .map((p) => toProjectDto(p, userId))
    .filter((p) => !params.status || p.status === params.status)
    .filter((p) => !search || p.name.toLowerCase().includes(search) || p.key.toLowerCase().includes(search))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

on('get', '/workspaces/(\\d+)/projects', ({ match, params, userId }) => {
  const { ws } = requireWorkspace(userId, num(match[1]))
  return [200, { items: filterProjects(visibleProjects(userId, [ws.id]), params, userId) }]
})

on('get', '/projects', ({ params, userId }) => {
  const companyId = params.companyId ? num(params.companyId) : null
  if (companyId !== null) requireTenant(userId, companyId)
  const workspaceIds = db.workspaces
    .filter((w) => (companyId === null ? w.companyId === null && w.createdBy === userId : w.companyId === companyId))
    .filter((w) => workspacePermissions(userId, w) !== null)
    .map((w) => w.id)
  return [200, { items: filterProjects(visibleProjects(userId, workspaceIds), params, userId) }]
})

on('get', '/workspaces/(\\d+)/projects/key-availability', ({ match, params, userId }) => {
  const { ws } = requireWorkspace(userId, num(match[1]), 'project.create')
  const key = (params.key ?? '').toUpperCase()
  const available = PROJECT_KEY_PATTERN.test(key) && uniqueProjectKey(ws.id, key) === key
  const base = key.replace(/[^A-Z0-9]/g, '').replace(/^[0-9]+/, '').slice(0, 10) || 'PRJ'
  return [200, { key, available, suggestion: available ? null : uniqueProjectKey(ws.id, base.length >= 2 ? base : 'PRJ') }]
})

on('post', '/workspaces/(\\d+)/projects', ({ match, body, userId }) => {
  const { ws } = requireWorkspace(userId, num(match[1]), 'project.create')
  ensureNotArchived(ws)
  const companyId = ws.companyId ?? 1
  const name = str(body.name)?.trim() ?? ''
  const key = str(body.key)?.trim().toUpperCase() ?? ''
  const description = str(body.description)?.trim() || null
  const sdlcMethod = body.sdlcMethod as SdlcMethod
  const errors: Record<string, string[]> = {}
  if (name.length < 2 || name.length > 100) errors.name = ['Tên dự án từ 2 đến 100 ký tự']
  if (!PROJECT_KEY_PATTERN.test(key)) errors.key = ['Key 2–10 ký tự, chữ HOA và số, bắt đầu bằng chữ']
  if (description && description.length > 500) errors.description = ['Mô tả tối đa 500 ký tự']
  if (!['SCRUM', 'WATERFALL', 'ITERATIVE', 'V_MODEL', 'KANBAN', 'SPIRAL', 'RAD', 'CUSTOM'].includes(sdlcMethod)) errors.sdlcMethod = ['Chọn phương pháp SDLC']
  const phases = Array.isArray(body.phases) ? (body.phases as CreateProjectBody['phases']) : []
  if (phases.length === 0 || phases.length > 10) errors.phases = ['Dự án cần 1–10 phase']
  if (phases.some((ph) => !ph.name?.trim())) errors.phases = ['Phase phải có tên']
  if (new Set(phases.map((ph) => ph.name?.trim().toLowerCase())).size !== phases.length) errors.phases = ['Tên phase bị trùng']
  if (Object.keys(errors).length) throw validation(errors)
  if (uniqueProjectKey(ws.id, key) !== key) throw new HttpError(409, 'PROJECT_KEY_TAKEN', 'Project Key đã được dùng trong workspace.')

  const issues = phases.flatMap((ph, i) => checkPhaseBody(ph, i, companyId))
  if (issues.length) workflowInvalid(issues)

  const members = Array.isArray(body.members) ? (body.members as { userId: number; roleId: number }[]) : []
  for (const m of members) {
    if (m.userId === userId) continue
    if (!workspaceMember(ws.id, m.userId)) {
      throw new HttpError(400, 'NOT_WORKSPACE_MEMBER', 'Có người chưa là thành viên workspace.')
    }
    projectRole(companyId, m.roleId)
  }

  const project: MockProject = {
    id: nextId(),
    workspaceId: ws.id,
    key,
    name,
    description,
    sdlcMethod,
    aiEnabled: body.aiEnabled !== false,
    status: 'ACTIVE',
    createdBy: userId,
    createdAt: now(),
    updatedAt: now(),
    archivedAt: null,
  }
  db.projects.push(project)
  phases.forEach((ph, i) => {
    const phaseId = nextId()
    db.phases.push({ id: phaseId, projectId: project.id, name: ph.name.trim(), description: ph.description?.trim() || null, position: i + 1, isActive: true })
    writePhaseWorkflow(project.id, phaseId, { statuses: ph.statuses, transitions: ph.transitions })
  })
  const pmRoleId = systemRole(companyId, 'PROJECT_MANAGER').id
  db.projectMembers.push({ projectId: project.id, userId, roleId: pmRoleId, isActive: true, joinedAt: now() })
  for (const m of members) {
    if (m.userId === userId || projectMember(project.id, m.userId)) continue
    db.projectMembers.push({ projectId: project.id, userId: m.userId, roleId: m.roleId, isActive: true, joinedAt: now() })
  }
  ws.updatedAt = now()
  save()
  return [201, toProjectDto(project, userId)]
})

on('get', '/projects/(\\d+)', ({ match, userId }) => {
  const { project } = requireProject(userId, num(match[1]))
  return [200, toProjectDto(project, userId)]
})

on('patch', '/projects/(\\d+)', ({ match, body, userId }) => {
  const { project, perms } = requireProject(userId, num(match[1]))
  ensureProjectWritable(project)
  if ((body.name !== undefined || body.description !== undefined || body.aiEnabled !== undefined) && !perms.has('project.update')) {
    throw forbidden('project.update')
  }
  if (body.name !== undefined) {
    const name = str(body.name)?.trim() ?? ''
    if (name.length < 2 || name.length > 100) throw validation({ name: ['Tên dự án từ 2 đến 100 ký tự'] })
    project.name = name
  }
  if (body.description !== undefined) {
    const description = str(body.description)?.trim() ?? ''
    if (description.length > 500) throw validation({ description: ['Mô tả tối đa 500 ký tự'] })
    project.description = description || null
  }
  if (body.aiEnabled !== undefined) project.aiEnabled = body.aiEnabled === true
  project.updatedAt = now()
  save()
  return [200, toProjectDto(project, userId)]
})

on('post', '/projects/(\\d+)/archive', ({ match, userId }) => {
  const { project } = requireProject(userId, num(match[1]), 'project.archive')
  ensureProjectWritable(project)
  project.status = 'ARCHIVED'
  project.archivedAt = now()
  project.updatedAt = now()
  save()
  return [200, toProjectDto(project, userId)]
})

on('post', '/projects/(\\d+)/restore', ({ match, userId }) => {
  const { project } = requireProject(userId, num(match[1]), 'project.archive')
  ensureNotArchived(db.workspaces.find((w) => w.id === project.workspaceId)!)
  project.status = 'ACTIVE'
  project.archivedAt = null
  project.updatedAt = now()
  save()
  return [200, toProjectDto(project, userId)]
})

// --- §11 Thành viên dự án ---

on('get', '/projects/(\\d+)/members', ({ match, userId }) => {
  const { project } = requireProject(userId, num(match[1]), 'project.view')
  const items = activeProjectMembers(project.id)
    .map((m) => toProjectMemberDto(project, m.userId))
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
  return [200, { items }]
})

on('get', '/projects/(\\d+)/member-candidates', ({ match, params, userId }) => {
  const { project } = requireProject(userId, num(match[1]), 'project.member.manage')
  const search = params.search?.trim().toLowerCase()
  const items = activeWorkspaceMembers(project.workspaceId)
    .filter((m) => !projectMember(project.id, m.userId))
    .map((m) => ({ ...userRef(m.userId), workspaceRole: roleRef(roleById(m.roleId)!) }))
    .filter((u) => !search || u.fullName.toLowerCase().includes(search) || u.email.includes(search))
    .slice(0, 20)
  return [200, { items }]
})

on('post', '/projects/(\\d+)/members', ({ match, body, userId }) => {
  const { project } = requireProject(userId, num(match[1]), 'project.member.manage')
  ensureProjectWritable(project)
  const companyId = companyIdOfProject(project)
  const members = Array.isArray(body.members) ? (body.members as { userId: number; roleId: number }[]) : []
  if (members.length === 0) throw validation({ members: ['Chọn ít nhất 1 thành viên'] })
  for (const m of members) {
    if (!workspaceMember(project.workspaceId, m.userId)) {
      throw new HttpError(400, 'NOT_WORKSPACE_MEMBER', 'Người dùng chưa là thành viên workspace.')
    }
    if (projectMember(project.id, m.userId)) throw new HttpError(409, 'ALREADY_MEMBER', 'Người dùng đã là thành viên dự án.')
    projectRole(companyId, m.roleId)
  }
  for (const m of members) {
    const previous = db.projectMembers.find((x) => x.projectId === project.id && x.userId === m.userId)
    if (previous) Object.assign(previous, { isActive: true, roleId: m.roleId, joinedAt: now() })
    else db.projectMembers.push({ projectId: project.id, userId: m.userId, roleId: m.roleId, isActive: true, joinedAt: now() })
  }
  project.updatedAt = now()
  save()
  return [201, { items: members.map((m) => toProjectMemberDto(project, m.userId)) }]
})

on('patch', '/projects/(\\d+)/members/(\\d+)', ({ match, body, userId }) => {
  const { project } = requireProject(userId, num(match[1]), 'project.member.manage')
  ensureProjectWritable(project)
  const member = projectMember(project.id, num(match[2]))
  if (!member) throw notFound()
  const role = projectRole(companyIdOfProject(project), num(String(body.roleId)))
  const pmId = systemRole(companyIdOfProject(project), 'PROJECT_MANAGER').id
  if (member.roleId === pmId && role.id !== pmId && projectManagerCount(project.id) <= 1) {
    throw new HttpError(409, 'LAST_PROJECT_MANAGER', 'Dự án phải còn ít nhất 1 Project Manager.')
  }
  member.roleId = role.id
  save()
  return [200, toProjectMemberDto(project, member.userId)]
})

on('delete', '/projects/(\\d+)/members/(\\d+)', ({ match, userId }) => {
  const targetId = num(match[2])
  const { project } = requireProject(userId, num(match[1]), targetId === userId ? undefined : 'project.member.manage')
  ensureProjectWritable(project)
  const member = projectMember(project.id, targetId)
  if (!member) throw notFound()
  if (member.roleId === systemRole(companyIdOfProject(project), 'PROJECT_MANAGER').id && projectManagerCount(project.id) <= 1) {
    throw new HttpError(409, 'LAST_PROJECT_MANAGER', 'Dự án phải còn ít nhất 1 Project Manager.')
  }
  member.isActive = false
  project.updatedAt = now()
  save()
  return [204]
})

// --- §12 Workflow ---

on('get', '/projects/(\\d+)/workflow', ({ match, userId }) => {
  const { project } = requireProject(userId, num(match[1]))
  return [200, toWorkflowDto(project)]
})

on('post', '/projects/(\\d+)/phases', ({ match, body, userId }) => {
  const { project } = requireProject(userId, num(match[1]), 'project.workflow.manage')
  ensureProjectWritable(project)
  if (project.sdlcMethod !== 'CUSTOM') throw forbidden('phase cố định theo mẫu SDLC')
  const name = str(body.name)?.trim() ?? ''
  const phases = db.phases.filter((ph) => ph.projectId === project.id)
  if (name.length < 1 || name.length > 100) throw validation({ name: ['Tên phase từ 1 đến 100 ký tự'] })
  if (phases.some((ph) => ph.isActive && ph.name.toLowerCase() === name.toLowerCase())) throw validation({ name: ['Tên phase đã tồn tại'] })
  if (phases.length >= 10) throw validation({ name: ['Dự án tối đa 10 phase'] })
  const phaseId = nextId()
  db.phases.push({ id: phaseId, projectId: project.id, name, description: str(body.description)?.trim() || null, position: phases.length + 1, isActive: true })
  const roleIds = db.roles.filter((r) => r.scope === 'PROJECT' && r.isActive && r.companyId === companyIdOfProject(project)).map((r) => r.id)
  writePhaseWorkflow(project.id, phaseId, {
    statuses: [
      { key: 'todo', name: 'To Do', category: 'TODO', color: '#78716c', description: null, isInitial: true },
      { key: 'doing', name: 'In Progress', category: 'IN_PROGRESS', color: '#2563eb', description: null, isInitial: false },
      { key: 'done', name: 'Done', category: 'DONE', color: '#079455', description: null, isInitial: false },
    ],
    transitions: [
      { from: 'todo', to: 'doing', allowedRoleIds: roleIds, requireComment: false, commentHint: null, condition: null },
      { from: 'doing', to: 'done', allowedRoleIds: roleIds, requireComment: false, commentHint: null, condition: null },
    ],
  })
  project.updatedAt = now()
  save()
  return [201, toPhaseDto(phaseId)]
})

on('patch', '/projects/(\\d+)/phases/(\\d+)', ({ match, body, userId }) => {
  const { project } = requireProject(userId, num(match[1]), 'project.workflow.manage')
  ensureProjectWritable(project)
  const phase = db.phases.find((ph) => ph.id === num(match[2]) && ph.projectId === project.id)
  if (!phase) throw notFound()
  const editable = project.sdlcMethod === 'CUSTOM'
  if (!editable && (body.name !== undefined || body.position !== undefined || body.isActive !== undefined)) {
    throw forbidden('phase cố định theo mẫu SDLC')
  }
  const siblings = db.phases.filter((ph) => ph.projectId === project.id).sort((a, b) => a.position - b.position)
  if (body.name !== undefined) {
    const name = str(body.name)?.trim() ?? ''
    if (!name || name.length > 100) throw validation({ name: ['Tên phase từ 1 đến 100 ký tự'] })
    if (siblings.some((ph) => ph.id !== phase.id && ph.isActive && ph.name.toLowerCase() === name.toLowerCase())) {
      throw validation({ name: ['Tên phase đã tồn tại'] })
    }
    phase.name = name
  }
  if (body.description !== undefined) phase.description = str(body.description)?.trim() || null
  if (body.isActive !== undefined) {
    const isActive = body.isActive === true
    if (!isActive && siblings.filter((ph) => ph.isActive && ph.id !== phase.id).length === 0) {
      throw new HttpError(409, 'PHASE_REQUIRED', 'Dự án phải còn ít nhất 1 phase đang hoạt động.')
    }
    phase.isActive = isActive
  }
  if (body.position !== undefined) {
    const target = Math.min(Math.max(1, num(String(body.position))), siblings.length)
    const ordered = siblings.filter((ph) => ph.id !== phase.id)
    ordered.splice(target - 1, 0, phase)
    ordered.forEach((ph, i) => (ph.position = i + 1))
  }
  project.updatedAt = now()
  save()
  return [200, toWorkflowDto(project)]
})

on('put', '/projects/(\\d+)/phases/(\\d+)/workflow', ({ match, body, userId }) => {
  const { project } = requireProject(userId, num(match[1]), 'project.workflow.manage')
  ensureProjectWritable(project)
  const phase = db.phases.find((ph) => ph.id === num(match[2]) && ph.projectId === project.id)
  if (!phase) throw notFound()
  const statuses = Array.isArray(body.statuses) ? (body.statuses as StatusInput[]) : []
  const transitions = Array.isArray(body.transitions) ? (body.transitions as TransitionInput[]) : []
  for (const s of statuses) {
    if (s.statusId !== undefined && !db.statuses.some((x) => x.id === s.statusId && x.phaseId === phase.id)) throw notFound()
  }
  const issues = checkPhaseBody({ statuses, transitions }, 0, companyIdOfProject(project))
  if (issues.length) workflowInvalid(issues)
  writePhaseWorkflow(project.id, phase.id, { statuses, transitions })
  project.updatedAt = now()
  save()
  return [200, toPhaseDto(phase.id)]
})

// ---------- gắn vào axios ----------

function currentUserId(config: AxiosRequestConfig): number | null {
  const header = config.headers?.Authorization ?? config.headers?.authorization
  const token = typeof header === 'string' ? header.replace(/^Bearer\s+/i, '') : ''
  if (!token.startsWith(TOKEN_PREFIX)) return null
  const id = Number.parseInt(token.slice(TOKEN_PREFIX.length), 10)
  return userById(id) ? id : null
}

function toReply(route: Route, config: AxiosRequestConfig): Reply {
  const url = (config.url ?? '').split('?')[0]
  const match = url.match(route.pattern)!
  const userId = currentUserId(config)
  if (!route.public && userId === null) {
    return [401, { code: 'UNAUTHORIZED', message: 'Phiên đăng nhập không hợp lệ (mock).' }]
  }
  let body: Record<string, unknown> = {}
  try {
    body = typeof config.data === 'string' && config.data ? JSON.parse(config.data) : {}
  } catch {
    body = {}
  }
  const params = Object.fromEntries(
    Object.entries((config.params ?? {}) as Record<string, unknown>)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => [k, String(v)]),
  )
  try {
    return route.handler({ match, body, params, userId: userId ?? 0 })
  } catch (error) {
    if (error instanceof HttpError) {
      return [error.status, { code: error.code, message: error.message, errors: error.errors, workflowIssues: error.workflowIssues }]
    }
    console.error('[mock] lỗi xử lý', error)
    return [500, { code: 'INTERNAL_ERROR', message: 'Lỗi mock.' }]
  }
}

export function enableMocks() {
  const mock = new MockAdapter(api, { delayResponse: 150, onNoMatch: 'passthrough' })
  const register = {
    get: mock.onGet.bind(mock),
    post: mock.onPost.bind(mock),
    patch: mock.onPatch.bind(mock),
    put: mock.onPut.bind(mock),
    delete: mock.onDelete.bind(mock),
  }
  for (const route of routes) {
    register[route.method](route.pattern).reply((config) => toReply(route, config))
  }

  const tools = {
    reset: () => {
      db = createSeed()
      save()
      console.info('[mock] đã reset dữ liệu — tải lại trang để thấy thay đổi.')
    },
    accounts: () => console.table(db.users.map((u) => ({ email: u.email, password: u.password, name: u.fullName }))),
  }
  ;(window as unknown as { __ssamMock: typeof tools }).__ssamMock = tools
  console.info(
    '%c[SSAM mock] Đang bật mock toàn bộ màn hình FE. Tài khoản mặc định: sarah@fintechcorp.com (mật khẩu Password@123), xem danh sách: __ssamMock.accounts()',
    'color:#079455;font-weight:600',
  )
}
