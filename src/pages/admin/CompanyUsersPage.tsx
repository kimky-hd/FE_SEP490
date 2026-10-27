import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, ErrorState, ForbiddenState, LoadingBlock, PageHeader } from '@/components/layout/PageParts'
import { buttonClasses } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Alert } from '@/components/ui/Alert'
import { SelectField } from '@/components/ui/SelectField'
import { MailIcon, SearchIcon } from '@/components/ui/icons'
import { useAuth } from '@/context/AuthContext'
import { companyApi } from '@/api/companyApi'
import { roleApi } from '@/api/roleApi'
import { useAsync } from '@/lib/useAsync'
import { apiErrorMessage } from '@/lib/apiErrors'
import { formatDate } from '@/lib/format'
import { PERMISSIONS, type CompanyUserDto, type MemberStatus } from '@/types/rbac'

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 300

// Figma B "Quản lý người dùng" (bản gọn) · FR §III.3.2.2 · UC-15: đổi role cấp công ty của từng người.
export function CompanyUsersPage() {
  const { currentCompany, can, user, refreshMe } = useAuth()
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

  if (!canView) {
    return (
      <DashboardLayout>
        <ForbiddenState message="Cần quyền “Xem danh sách người dùng” (user.view)." />
      </DashboardLayout>
    )
  }

  const changeRole = async (target: CompanyUserDto, nextRoleId: number) => {
    setNotice(null)
    setSavingUserId(target.userId)
    try {
      const updated = await companyApi.changeUserRole(companyId!, target.userId, nextRoleId)
      users.setData((prev) => prev && { ...prev, items: prev.items.map((u) => (u.userId === updated.userId ? updated : u)) })
      setNotice({ tone: 'success', text: `Đã đổi role của ${target.fullName} thành ${updated.role.name}.` })
      if (target.userId === user?.id) await refreshMe()
    } catch (err) {
      setNotice({ tone: 'error', text: apiErrorMessage(err) })
    } finally {
      setSavingUserId(null)
    }
  }

  const data = users.data
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <DashboardLayout>
      <PageHeader
        eyebrow="// Quản trị công ty"
        title="Người dùng"
        description={`Nhân sự của ${currentCompany!.companyName} và role cấp công ty của từng người.`}
        actions={
          can(PERMISSIONS.userInvite) && (
            <Link to="/members/invite" className={buttonClasses({ inline: true })}>
              <MailIcon className="h-4 w-4" />
              Mời thành viên
            </Link>
          )
        }
      />

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative block lg:w-72">
          <span className="sr-only">Tìm người dùng</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Tìm theo tên hoặc email…"
            className="h-9 w-full rounded-md border border-gray-300 bg-white pl-9 pr-3 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
          />
        </label>
        <div className="flex gap-3">
          <SelectField
            compact
            aria-label="Lọc theo role"
            value={roleId}
            onChange={(e) => {
              setRoleId(e.target.value ? Number(e.target.value) : '')
              setPage(1)
            }}
            className="!h-9 min-w-[10rem] text-sm"
          >
            <option value="">Mọi role</option>
            {(tenantRoles.data ?? []).map((r) => (
              <option key={r.roleId} value={r.roleId}>
                {r.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            compact
            aria-label="Lọc theo trạng thái"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as MemberStatus | '')
              setPage(1)
            }}
            className="!h-9 min-w-[9rem] text-sm"
          >
            <option value="">Mọi trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="DEACTIVATED">Đã vô hiệu hoá</option>
          </SelectField>
        </div>
      </div>

      {notice && (
        <div className="mt-4">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}

      <div className="mt-4">
        {users.isLoading && !data ? (
          <LoadingBlock />
        ) : users.error ? (
          <ErrorState message={apiErrorMessage(users.error)} onRetry={users.reload} />
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-gray-500">
                  <th className="px-4 py-3 font-medium">Người dùng</th>
                  <th className="px-4 py-3 font-medium">Role công ty</th>
                  <th className="px-4 py-3 font-medium">Workspace</th>
                  <th className="px-4 py-3 font-medium">Trạng thái</th>
                  <th className="px-4 py-3 font-medium">Tham gia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data!.items.map((u) => (
                  <tr key={u.userId}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.fullName} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-gray-900">
                            {u.fullName}
                            {u.userId === user?.id && <span className="ml-1.5 text-xs font-normal text-gray-400">(bạn)</span>}
                          </p>
                          <p className="truncate text-xs text-gray-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {canAssign && u.status === 'ACTIVE' && tenantRoles.data ? (
                        <SelectField
                          compact
                          aria-label={`Role của ${u.fullName}`}
                          value={u.role.roleId}
                          disabled={savingUserId === u.userId}
                          onChange={(e) => void changeRole(u, Number(e.target.value))}
                          className="min-w-[11rem]"
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
                        <Badge tone={u.role.code === 'TENANT_ADMIN' ? 'brand' : 'neutral'}>{u.role.name}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{u.workspaceCount}</td>
                    <td className="px-4 py-3">
                      <Badge tone={u.status === 'ACTIVE' ? 'brand' : 'neutral'} dot>
                        {u.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã vô hiệu hoá'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(u.joinedAt)}</td>
                  </tr>
                ))}
                {data!.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">
                      Không có người dùng phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {data!.total > PAGE_SIZE && (
              <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
                <span>
                  {data!.total} người · trang {page}/{totalPages}
                </span>
                <div className="flex gap-2">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-gray-200 px-2.5 py-1 disabled:opacity-40">
                    Trang trước
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded border border-gray-200 px-2.5 py-1 disabled:opacity-40"
                  >
                    Trang sau
                  </button>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
