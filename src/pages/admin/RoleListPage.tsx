import { useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, ErrorState, ForbiddenState, LoadingBlock, PageHeader } from '@/components/layout/PageParts'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { LockIcon, PlusIcon, SearchIcon } from '@/components/ui/icons'
import { useAuth } from '@/context/AuthContext'
import { permissionApi, roleApi } from '@/api/roleApi'
import { useAsync } from '@/lib/useAsync'
import { apiErrorMessage } from '@/lib/apiErrors'
import { SCOPE_LABEL, formatDate } from '@/lib/format'
import { PERMISSIONS, type RoleDto, type RoleScope } from '@/types/rbac'
import { RoleMembersModal } from './RoleMembersModal'

type ScopeFilter = 'ALL' | RoleScope

// Figma C "Role Catalog" (bản gọn) · UC-11~14 · FR §III.3.2.1.
export function RoleListPage() {
  const { currentCompany, can } = useAuth()
  const companyId = currentCompany?.companyId
  const canView = companyId !== undefined && can(PERMISSIONS.roleView)
  const canManage = canView && can(PERMISSIONS.roleManage)
  const [scope, setScope] = useState<ScopeFilter>('ALL')
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [membersOf, setMembersOf] = useState<RoleDto | null>(null)

  const roles = useAsync(() => (canView ? roleApi.list(companyId!) : Promise.resolve([])), [canView, companyId])
  const catalog = useAsync(() => (canView ? permissionApi.list() : Promise.resolve([])), [canView])

  if (!canView) {
    return (
      <DashboardLayout>
        <ForbiddenState message="Requires “View roles” permission (role.view)." />
      </DashboardLayout>
    )
  }

  const all = roles.data ?? []
  const totalOfScope = (s: RoleScope) => (catalog.data ?? []).filter((p) => p.scope === s).length
  const sensitiveKeys = new Set((catalog.data ?? []).filter((p) => p.isSensitive).map((p) => p.key))
  const keyword = search.trim().toLowerCase()
  const visible = all
    .filter((r) => scope === 'ALL' || r.scope === scope)
    .filter((r) => !keyword || r.name.toLowerCase().includes(keyword) || (r.code ?? '').toLowerCase().includes(keyword))

  const toggleActive = async (role: RoleDto) => {
    setNotice(null)
    setTogglingId(role.roleId)
    try {
      const updated = await roleApi.setActive(companyId!, role.roleId, !role.isActive)
      roles.setData((prev) => prev?.map((r) => (r.roleId === updated.roleId ? updated : r)))
      setNotice({ tone: 'success', text: `${updated.isActive ? 'Enabled' : 'Disabled'} role ${updated.name}.` })
    } catch (err) {
      setNotice({ tone: 'error', text: apiErrorMessage(err) })
    } finally {
      setTogglingId(null)
    }
  }

  const stats = [
    { label: 'Total Roles', value: all.length, sub: `${all.filter((r) => r.isSystem).length} system · ${all.filter((r) => !r.isSystem).length} custom · ${all.filter((r) => !r.isActive).length} disabled` },
    { label: 'Company Level', value: all.filter((r) => r.scope === 'TENANT').length, sub: 'Assigned 1 role per user in company' },
    { label: 'Workspace Level', value: all.filter((r) => r.scope === 'WORKSPACE').length, sub: 'Assigned per workspace' },
    { label: 'Project Level', value: all.filter((r) => r.scope === 'PROJECT').length, sub: 'Assigned in project · used for workflow transitions' },
  ]

  return (
    <DashboardLayout>
      <PageHeader
        eyebrow="// Organization Admin"
        title="Roles & Permissions"
        description="Define roles and grant permissions for each role. Company-level roles are assigned to company users; workspace-level roles are assigned per workspace."
        actions={
          canManage && (
            <Link to="/admin/roles/new" className={buttonClasses({ inline: true })}>
              <PlusIcon className="h-4 w-4" />
              Create New Role
            </Link>
          )
        }
      />

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-gray-400">{s.label}</p>
            <p className="mt-2 text-2xl font-semibold text-gray-950">{roles.data ? s.value : '—'}</p>
            <p className="mt-0.5 text-[11px] text-gray-400">{s.sub}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-md border border-gray-200 bg-white p-0.5 text-sm">
          {(
            [
              ['ALL', 'All', all.length],
              ['TENANT', SCOPE_LABEL.TENANT, all.filter((r) => r.scope === 'TENANT').length],
              ['WORKSPACE', SCOPE_LABEL.WORKSPACE, all.filter((r) => r.scope === 'WORKSPACE').length],
              ['PROJECT', SCOPE_LABEL.PROJECT, all.filter((r) => r.scope === 'PROJECT').length],
            ] as const
          ).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              onClick={() => setScope(value)}
              className={clsx(
                'rounded px-3 py-1.5 font-medium transition-colors',
                scope === value ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800',
              )}
            >
              {label}
              <span className={clsx('ml-1.5 text-xs', scope === value ? 'text-white/60' : 'text-gray-400')}>{count}</span>
            </button>
          ))}
        </div>
        <label className="relative block sm:w-72">
          <span className="sr-only">Search roles</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by role name or code…"
            className="h-9 w-full rounded-md border border-gray-300 bg-white pl-9 pr-3 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
          />
        </label>
      </div>

      {notice && (
        <div className="mt-4">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}

      <div className="mt-4">
        {roles.isLoading && !roles.data ? (
          <LoadingBlock />
        ) : roles.error ? (
          <ErrorState message={apiErrorMessage(roles.error)} onRetry={roles.reload} />
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500">
                  <th className="px-4 py-3 font-medium">Role Name</th>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Scope</th>
                  <th className="px-4 py-3 font-medium">Permissions</th>
                  <th className="px-4 py-3 font-medium">Members</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map((r) => {
                  const sensitive = r.permissionKeys.filter((k) => sensitiveKeys.has(k)).length
                  return (
                    <tr key={r.roleId} className={clsx('align-top', !r.isActive && 'bg-gray-50/60')}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link to={`/admin/roles/${r.roleId}`} className="font-medium text-gray-900 hover:text-brand-700">
                            {r.name}
                          </Link>
                          {r.isLocked && <LockIcon className="h-3.5 w-3.5 text-gray-400" aria-label="Role is locked" />}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge tone={r.isSystem ? 'neutral' : 'blue'}>{r.isSystem ? 'System' : 'Custom'}</Badge>
                          {r.description && <span className="line-clamp-1 max-w-xs text-xs text-gray-400">{r.description}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.code ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Badge tone={r.scope === 'TENANT' ? 'brand' : r.scope === 'PROJECT' ? 'blue' : 'neutral'}>{SCOPE_LABEL[r.scope]}</Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        <span className="font-medium">{r.permissionKeys.length}</span>
                        <span className="text-gray-400">/{totalOfScope(r.scope) || '—'}</span>
                        {r.code === 'TENANT_ADMIN' && <p className="text-[11px] text-gray-400">Full access</p>}
                        {sensitive > 0 && r.code !== 'TENANT_ADMIN' && (
                          <p className="text-[11px] text-amber-700">{sensitive} sensitive permissions</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setMembersOf(r)}
                          className="font-medium text-gray-700 underline-offset-2 hover:text-brand-700 hover:underline"
                        >
                          {r.memberCount} members
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={r.isActive ? 'brand' : 'neutral'} dot>
                          {r.isActive ? 'Active' : 'Disabled'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{formatDate(r.updatedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Link
                            to={`/admin/roles/${r.roleId}`}
                            className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                          >
                            {canManage && !r.isLocked ? 'Edit' : 'View'}
                          </Link>
                          {canManage && !r.isSystem && (
                            <Button
                              variant="ghost"
                              inline
                              className="!h-auto !px-2 !py-1 text-xs"
                              isLoading={togglingId === r.roleId}
                              onClick={() => void toggleActive(r)}
                            >
                              {r.isActive ? 'Disable' : 'Enable'}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">
                      No matching roles found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      <RoleMembersModal companyId={companyId!} role={membersOf} onClose={() => setMembersOf(null)} />
    </DashboardLayout>
  )
}
