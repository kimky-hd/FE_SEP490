import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ErrorState, ForbiddenState, LoadingBlock, PageHeader } from '@/components/layout/PageParts'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Alert } from '@/components/ui/Alert'
import { SelectField } from '@/components/ui/SelectField'
import { MailIcon } from '@/components/ui/icons'
import { useAuth } from '@/context/AuthContext'
import { companyApi } from '@/api/companyApi'
import { roleApi } from '@/api/roleApi'
import { useAsync } from '@/lib/useAsync'
import { apiErrorMessage } from '@/lib/apiErrors'
import { formatDate } from '@/lib/format'
import { useI18n } from '@/i18n'
import { useRoleChangeGuard } from '@/lib/useRoleChangeGuard'
import { PERMISSIONS, type CompanyUserDto, type MemberStatus } from '@/types/rbac'
import { SearchInput, tableWrap, th, theadRow } from '@/components/ui/listControls'

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 300

// Figma B "Quản lý người dùng" (bản gọn) · FR §III.3.2.2 · UC-15: đổi role cấp công ty của từng người.
export function CompanyUsersPage() {
  const { currentCompany, can, user, refreshMe } = useAuth()
  const { t } = useI18n()
  const companyId = currentCompany?.companyId
  const canView = companyId !== undefined && can(PERMISSIONS.userView)
  const canAssign = canView && can(PERMISSIONS.userAssignRole)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [roleId, setRoleId] = useState<number | ''>('')
  const [status, setStatus] = useState<MemberStatus | ''>('ACTIVE')
  const [page, setPage] = useState(1)
  const [savingUserId, setSavingUserId] = useState<number | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchInput])

  const users = useAsync(
    () =>
      canView
        ? companyApi.listUsers(companyId!, {
            search: search || undefined,
            roleId: roleId === '' ? undefined : roleId,
            status: status || undefined,
            page,
            pageSize: PAGE_SIZE,
          })
        : Promise.resolve({ items: [], page: 1, pageSize: PAGE_SIZE, total: 0 }),
    [canView, companyId, search, roleId, status, page],
  )
  // Dropdown đổi role chỉ liệt kê role cấp công ty đang bật (không cần role.view — contract §3.1).
  const tenantRoles = useAsync(
    () => (canView ? roleApi.list(companyId!, { scope: 'TENANT', includeInactive: false }) : Promise.resolve([])),
    [canView, companyId],
  )

  // Gọi trước return sớm (luật hooks); apply bọc lại vì changeRole khai báo phía dưới.
  const roleGuard = useRoleChangeGuard<CompanyUserDto>({
    selfId: user?.id,
    scopeLabel: t('công ty', 'the company'),
    apply: (u, nextRoleId) => changeRole(u, nextRoleId),
  })

  if (!canView) {
    return (
      <DashboardLayout>
        <ForbiddenState
          message={t(
            'Bạn cần quyền xem danh sách người dùng. Liên hệ Tenant Admin của công ty.',
            'You need permission to view users. Contact your company’s Tenant Admin.',
          )}
        />
      </DashboardLayout>
    )
  }

  async function changeRole(target: CompanyUserDto, nextRoleId: number): Promise<boolean> {
    setNotice(null)
    setSavingUserId(target.userId)
    try {
      const updated = await companyApi.changeUserRole(companyId!, target.userId, nextRoleId)
      users.setData(
        (prev) => prev && { ...prev, items: prev.items.map((u) => (u.userId === updated.userId ? updated : u)) },
      )
      setNotice({
        tone: 'success',
        text: t(
          `Đã đổi role của ${target.fullName} thành ${updated.role.name}.`,
          `Changed ${target.fullName}’s role to ${updated.role.name}.`,
        ),
      })
      if (target.userId === user?.id) await refreshMe()
      return true
    } catch (err) {
      setNotice({ tone: 'error', text: apiErrorMessage(err) })
      return false
    } finally {
      setSavingUserId(null)
    }
  }

  const data = users.data
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1
  const statusLabel = (s: MemberStatus) =>
    s === 'ACTIVE' ? t('Hoạt động', 'Active') : t('Đã vô hiệu hoá', 'Deactivated')

  return (
    <DashboardLayout>
      <PageHeader
        title={t('Người dùng', 'Users')}
        description={
          data
            ? t(
                `${data.total} người trong ${currentCompany!.companyName}`,
                `${data.total} people in ${currentCompany!.companyName}`,
              )
            : currentCompany!.companyName
        }
        actions={
          can(PERMISSIONS.userInvite) && (
            <Link to="/members/invite" className={buttonClasses({ inline: true })}>
              <MailIcon className="h-4 w-4" />
              {t('Mời thành viên', 'Invite members')}
            </Link>
          )
        }
      />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={searchInput}
          onChange={setSearchInput}
          label={t('Tìm người dùng', 'Search users')}
          placeholder={t('Tìm theo tên hoặc email…', 'Search by name or email…')}
          className="sm:w-72"
        />
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <SelectField
            compact
            aria-label={t('Lọc theo role', 'Filter by role')}
            value={roleId}
            onChange={(e) => {
              setRoleId(e.target.value ? Number(e.target.value) : '')
              setPage(1)
            }}
            className="lg:!h-9 lg:!text-sm sm:min-w-[10rem]"
          >
            <option value="">{t('Tất cả vai trò', 'All roles')}</option>
            {(tenantRoles.data ?? []).map((r) => (
              <option key={r.roleId} value={r.roleId}>
                {r.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            compact
            aria-label={t('Lọc theo trạng thái', 'Filter by status')}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as MemberStatus | '')
              setPage(1)
            }}
            className="lg:!h-9 lg:!text-sm sm:min-w-[9rem]"
          >
            <option value="">{t('Mọi trạng thái', 'All statuses')}</option>
            <option value="ACTIVE">{t('Hoạt động', 'Active')}</option>
            <option value="DEACTIVATED">{t('Đã vô hiệu hoá', 'Deactivated')}</option>
          </SelectField>
        </div>
      </div>

      {notice && (
        <div className="mt-4">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}
      {roleGuard.undoBar}

      <div className="mt-4">
        {users.isLoading && !data ? (
          <LoadingBlock />
        ) : users.error ? (
          <ErrorState message={apiErrorMessage(users.error)} onRetry={users.reload} />
        ) : (
          <div className={tableWrap}>
            {/* Dưới md: mỗi người là một thẻ (tên + email, rồi role và trạng thái), không cuộn ngang. */}
            <table className="w-full text-sm">
              <thead className="hidden md:table-header-group">
                <tr className={theadRow}>
                  <th className={th}>{t('Người dùng', 'User')}</th>
                  <th className={th}>{t('Vai trò', 'Role')}</th>
                  <th className={th}>{t('Trạng thái', 'Status')}</th>
                  <th className={th}>{t('Tham gia', 'Joined')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data!.items.map((u) => (
                  <tr
                    key={u.userId}
                    className="flex flex-wrap items-center gap-x-3 gap-y-2.5 px-4 py-3 transition-colors hover:bg-gray-50 md:table-row md:p-0"
                  >
                    <td className="block w-full md:table-cell md:w-auto md:px-4 md:py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.fullName} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-gray-900">
                            {u.fullName}
                            {u.userId === user?.id && (
                              <span className="ml-1.5 text-xs font-normal text-gray-500">{t('(bạn)', '(you)')}</span>
                            )}
                          </p>
                          <p className="truncate text-sm text-gray-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="block md:table-cell md:px-4 md:py-3">
                      {canAssign && u.status === 'ACTIVE' && tenantRoles.data ? (
                        <SelectField
                          compact
                          aria-label={t(`Role của ${u.fullName}`, `Role of ${u.fullName}`)}
                          value={roleGuard.valueFor(u)}
                          disabled={savingUserId === u.userId}
                          onChange={(e) =>
                            roleGuard.request(u, Number(e.target.value), e.target.selectedOptions[0]?.text ?? '')
                          }
                          className="min-w-[11rem] lg:!h-9 lg:!text-sm"
                        >
                          {!tenantRoles.data.some((r) => r.roleId === u.role.roleId) && (
                            <option value={u.role.roleId}>{u.role.name}</option>
                          )}
                          {tenantRoles.data.map((r) => (
                            <option key={r.roleId} value={r.roleId}>
                              {r.name}
                            </option>
                          ))}
                        </SelectField>
                      ) : (
                        <span className="text-gray-700">{u.role.name}</span>
                      )}
                    </td>
                    <td className="block md:table-cell md:px-4 md:py-3">
                      <Badge tone={u.status === 'ACTIVE' ? 'success' : 'neutral'}>{statusLabel(u.status)}</Badge>
                    </td>
                    <td className="ml-auto block tabular-nums text-gray-500 md:ml-0 md:table-cell md:px-4 md:py-3">
                      {formatDate(u.joinedAt)}
                    </td>
                  </tr>
                ))}
                {data!.items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="block px-4 py-12 text-center text-sm text-gray-500 md:table-cell">
                      {t('Không có người dùng phù hợp.', 'No matching users.')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {data!.total > PAGE_SIZE && (
              <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 text-sm text-gray-500">
                <span className="tabular-nums">
                  {t('Trang', 'Page')} {page}/{totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    inline
                    className="lg:!h-8"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    {t('Trang trước', 'Previous')}
                  </Button>
                  <Button
                    variant="secondary"
                    inline
                    className="lg:!h-8"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {t('Trang sau', 'Next')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {roleGuard.confirm}
    </DashboardLayout>
  )
}
