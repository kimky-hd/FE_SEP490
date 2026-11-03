import { useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ErrorState, ForbiddenState, LoadingBlock, PageHeader } from '@/components/layout/PageParts'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { LockIcon, PlusIcon } from '@/components/ui/icons'
import { useAuth } from '@/context/AuthContext'
import { roleApi } from '@/api/roleApi'
import { useAsync } from '@/lib/useAsync'
import { apiErrorMessage } from '@/lib/apiErrors'
import { useI18n } from '@/i18n'
import { scopeLabel } from '@/i18n/permissions'
import { PERMISSIONS, type RoleDto, type RoleScope } from '@/types/rbac'
import { RoleMembersModal } from './RoleMembersModal'
import { CodeChip, SearchInput, tableWrap, th, theadRow } from '@/components/ui/listControls'

type ScopeFilter = 'ALL' | RoleScope

// Figma C "Role Catalog" (bản gọn) · UC-11~14 · FR §III.3.2.1.
export function RoleListPage() {
  const { currentCompany, can } = useAuth()
  const { t } = useI18n()
  const companyId = currentCompany?.companyId
  const canView = companyId !== undefined && can(PERMISSIONS.roleView)
  const canManage = canView && can(PERMISSIONS.roleManage)
  const [scope, setScope] = useState<ScopeFilter>('ALL')
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [membersOf, setMembersOf] = useState<RoleDto | null>(null)

  const roles = useAsync(() => (canView ? roleApi.list(companyId!) : Promise.resolve([])), [canView, companyId])

  if (!canView) {
    return (
      <DashboardLayout>
        <ForbiddenState
          message={t('Cần quyền “Xem danh mục role” (role.view).', 'Requires the “View roles” permission (role.view).')}
        />
      </DashboardLayout>
    )
  }

  const all = roles.data ?? []
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
      setNotice({
        tone: 'success',
        text: updated.isActive
          ? t(`Đã bật role ${updated.name}.`, `Role ${updated.name} enabled.`)
          : t(`Đã tắt role ${updated.name}.`, `Role ${updated.name} disabled.`),
      })
    } catch (err) {
      setNotice({ tone: 'error', text: apiErrorMessage(err) })
    } finally {
      setTogglingId(null)
    }
  }

  const customCount = all.filter((r) => !r.isSystem).length

  return (
    <DashboardLayout>
      <PageHeader
        title={t('Vai trò & quyền', 'Roles & permissions')}
        description={
          roles.data
            ? t(`${all.length} role · ${customCount} tự tạo`, `${all.length} roles · ${customCount} custom`)
            : undefined
        }
        actions={
          canManage && (
            <Link to="/admin/roles/new" className={buttonClasses({ inline: true })}>
              <PlusIcon className="h-4 w-4" />
              {t('Tạo role mới', 'New role')}
            </Link>
          )
        }
      />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          label={t('Tìm role', 'Search roles')}
          placeholder={t('Tìm theo tên hoặc mã role…', 'Search by role name or key…')}
          className="sm:w-72"
        />
        {/* Thanh lọc phạm vi: một hàng, cuộn ngang trên màn hẹp. */}
        <div
          role="group"
          aria-label={t('Lọc theo phạm vi', 'Filter by scope')}
          className="-mx-4 flex overflow-x-auto px-4 sm:mx-0 sm:px-0"
        >
          <div className="inline-flex shrink-0 rounded-control border border-gray-200 bg-gray-50 p-0.5 text-sm">
            {(
              [
                ['ALL', t('Tất cả', 'All'), all.length],
                ['TENANT', scopeLabel('TENANT'), all.filter((r) => r.scope === 'TENANT').length],
                ['WORKSPACE', scopeLabel('WORKSPACE'), all.filter((r) => r.scope === 'WORKSPACE').length],
                ['PROJECT', scopeLabel('PROJECT'), all.filter((r) => r.scope === 'PROJECT').length],
              ] as const
            ).map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                aria-pressed={scope === value}
                onClick={() => setScope(value)}
                className={clsx(
                  'flex min-h-10 items-center whitespace-nowrap rounded-[6px] px-3 font-medium transition-colors lg:min-h-8',
                  scope === value
                    ? 'bg-white text-gray-950 shadow-xs ring-1 ring-gray-200'
                    : 'text-gray-600 hover:text-gray-950',
                )}
              >
                {label}
                <span className="ml-1.5 tabular-nums text-xs text-gray-500">{count}</span>
              </button>
            ))}
          </div>
        </div>
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
          // Dưới md: mỗi role là một thẻ (tên + mô tả, rồi phạm vi / số người / thao tác), không cuộn ngang.
          <div className={tableWrap}>
            <table className="w-full text-sm">
              <thead className="hidden md:table-header-group">
                <tr className={theadRow}>
                  <th className={th}>{t('Vai trò', 'Role')}</th>
                  <th className={th}>{t('Phạm vi', 'Scope')}</th>
                  <th className={th}>{t('Người dùng', 'Users')}</th>
                  <th className={th}>
                    <span className="sr-only">{t('Thao tác', 'Actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {visible.map((r) => (
                  <tr
                    key={r.roleId}
                    className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 transition-colors hover:bg-gray-50 md:table-row md:p-0"
                  >
                    <td className="block w-full md:table-cell md:w-auto md:px-4 md:py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/admin/roles/${r.roleId}`}
                          className={clsx(
                            'font-medium hover:underline',
                            r.isActive ? 'text-gray-900' : 'text-gray-500',
                          )}
                        >
                          {r.name}
                        </Link>
                        {r.isLocked && (
                          <LockIcon
                            className="h-3.5 w-3.5 text-gray-500"
                            aria-label={t('Role có sẵn, không sửa được', 'Built-in role, cannot be edited')}
                          />
                        )}
                        {/* Chỉ đánh dấu role tự tạo / đang tắt; role có sẵn, đang bật là mặc định. */}
                        {!r.isSystem && <Badge tone="blue">{t('Tự tạo', 'Custom')}</Badge>}
                        {!r.isActive && <Badge tone="amber">{t('Đang tắt', 'Disabled')}</Badge>}
                      </div>
                      <p className="mt-0.5 line-clamp-1 max-w-xl text-sm text-gray-500">
                        {r.description || (r.code ? <CodeChip>{r.code}</CodeChip> : '—')}
                      </p>
                    </td>
                    <td className="block md:table-cell md:px-4 md:py-3">
                      <Badge>{scopeLabel(r.scope)}</Badge>
                    </td>
                    <td className="block md:table-cell md:px-4 md:py-3">
                      <button
                        type="button"
                        onClick={() => setMembersOf(r)}
                        className="inline-flex min-h-11 items-center whitespace-nowrap tabular-nums text-gray-700 underline-offset-2 hover:text-brand-700 hover:underline md:min-h-0"
                      >
                        {r.memberCount} {t('người', r.memberCount === 1 ? 'user' : 'users')}
                      </button>
                    </td>
                    <td className="ml-auto block md:table-cell md:px-4 md:py-3">
                      <div className="flex justify-end gap-1">
                        <Link
                          to={`/admin/roles/${r.roleId}`}
                          className="inline-flex min-h-11 items-center rounded-control px-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-950 lg:min-h-8"
                        >
                          {canManage && !r.isLocked ? t('Sửa', 'Edit') : t('Xem', 'View')}
                        </Link>
                        {canManage && !r.isSystem && (
                          <Button
                            variant="ghost"
                            inline
                            className="!px-2.5 text-sm lg:!h-8"
                            isLoading={togglingId === r.roleId}
                            onClick={() => void toggleActive(r)}
                          >
                            {r.isActive ? t('Tắt', 'Disable') : t('Bật', 'Enable')}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={4} className="block px-4 py-12 text-center text-sm text-gray-500 md:table-cell">
                      {t('Không có role phù hợp.', 'No matching roles.')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <RoleMembersModal companyId={companyId!} role={membersOf} onClose={() => setMembersOf(null)} />
    </DashboardLayout>
  )
}
