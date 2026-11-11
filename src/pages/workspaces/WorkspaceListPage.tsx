import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { DashboardEmptyState, ErrorState, LoadingBlock, PageHeader } from '@/components/layout/PageParts'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { BuildingIcon, PlusIcon } from '@/components/ui/icons'
import { useAuth } from '@/context/AuthContext'
import { workspaceApi } from '@/api/workspaceApi'
import { useAsync } from '@/lib/useAsync'
import { apiErrorMessage } from '@/lib/apiErrors'
import { formatRelative } from '@/lib/format'
import { PERMISSIONS, type WorkspaceDto, type WorkspaceStatus } from '@/types/rbac'
import { CreateWorkspaceModal } from './CreateWorkspaceModal'
import { useI18n } from '@/i18n'
import { CodeChip, SearchInput, Segmented } from '@/components/ui/listControls'

// FR §III.4.1 Workspace List + wireframe "Workspace": workspace của công ty hiện tại (đã bỏ khu "Không gian cá nhân").
export function WorkspaceListPage() {
  const { currentCompany, can, refreshMe } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [status, setStatus] = useState<WorkspaceStatus>('ACTIVE')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const companyId = currentCompany?.companyId ?? null
  const canCreate = companyId !== null && can(PERMISSIONS.workspaceCreate)

  const companyWorkspaces = useAsync(
    () => (companyId === null ? Promise.resolve([]) : workspaceApi.list({ companyId })),
    [companyId],
  )

  const keyword = search.trim().toLowerCase()
  const all = companyWorkspaces.data ?? []
  const visible = all
    .filter((w) => w.status === status)
    .filter((w) => !keyword || w.name.toLowerCase().includes(keyword) || w.code.includes(keyword))
  const archivedCount = all.filter((w) => w.status === 'ARCHIVED').length

  const handleCreated = async (workspace: WorkspaceDto, { inviteNow }: { inviteNow: boolean }) => {
    setCreateOpen(false)
    await refreshMe()
    navigate(inviteNow ? `/workspaces/${workspace.workspaceId}/members?add=1` : `/workspaces/${workspace.workspaceId}`)
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Workspace"
        description={currentCompany ? currentCompany.companyName : t('Không gian làm việc của bạn', 'Your workspaces')}
        actions={
          canCreate && (
            <Button inline onClick={() => setCreateOpen(true)}>
              <PlusIcon className="h-4 w-4" />
              {t('Tạo workspace', 'Create workspace')}
            </Button>
          )
        }
      />

      {companyId !== null && (
        <section className="mt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Segmented
              label={t('Lọc theo trạng thái', 'Filter by status')}
              value={status}
              onChange={setStatus}
              options={[
                { value: 'ACTIVE', label: t('Đang hoạt động', 'Active'), count: all.length - archivedCount },
                { value: 'ARCHIVED', label: t('Đã lưu trữ', 'Archived'), count: archivedCount },
              ]}
            />
            <SearchInput
              className="sm:w-72"
              value={search}
              onChange={setSearch}
              label={t('Tìm workspace', 'Search workspaces')}
              placeholder={t('Tìm theo tên hoặc mã…', 'Search by name or code…')}
            />
          </div>

          <div className="mt-4">
            {companyWorkspaces.isLoading && !companyWorkspaces.data ? (
              <LoadingBlock />
            ) : companyWorkspaces.error ? (
              <ErrorState message={apiErrorMessage(companyWorkspaces.error)} onRetry={companyWorkspaces.reload} />
            ) : (
              <div className={cardGrid}>
                {visible.map((w) => (
                  <WorkspaceCard key={w.workspaceId} workspace={w} />
                ))}
                {/* Ô tạo nhanh chỉ khi chưa có workspace nào; có rồi thì nút ở đầu trang là đủ. */}
                {visible.length === 0 && status === 'ACTIVE' && canCreate && !keyword && (
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="flex min-h-[8.5rem] items-center justify-center gap-2 rounded-card border border-dashed border-gray-300 bg-gray-50 text-sm font-medium text-gray-700 transition-colors hover:border-brand-300 hover:text-brand-700"
                  >
                    <PlusIcon className="h-4 w-4" />
                    {t('Tạo workspace đầu tiên', 'Create your first workspace')}
                  </button>
                )}
                {visible.length === 0 && !(status === 'ACTIVE' && canCreate && !keyword) && (
                  <div className="md:col-span-2 xl:col-span-3">
                    <DashboardEmptyState
                      icon={<BuildingIcon className="h-5 w-5" />}
                      title={
                        keyword
                          ? t('Không có workspace phù hợp', 'No matching workspaces')
                          : status === 'ACTIVE'
                            ? t('Chưa có workspace', 'No workspaces yet')
                            : t('Không có workspace đã lưu trữ', 'No archived workspaces')
                      }
                      description={
                        keyword
                          ? t('Thử từ khoá khác.', 'Try a different keyword.')
                          : status === 'ACTIVE'
                            ? t(
                                'Bạn chưa được thêm vào workspace nào. Liên hệ quản trị viên để được mời.',
                                'You haven’t been added to any workspace. Ask an admin to invite you.',
                              )
                            : t(
                                'Workspace bị lưu trữ sẽ hiện ở đây, có thể khôi phục trong phần Cài đặt.',
                                'Archived workspaces show up here and can be restored in Settings.',
                              )
                      }
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {companyId === null && (
        <div className="mt-6">
          <DashboardEmptyState
            icon={<BuildingIcon className="h-5 w-5" />}
            title={t('Bạn chưa thuộc công ty nào', "You're not in a company yet")}
            description={t(
              'Tạo hoặc tham gia công ty để dùng workspace.',
              'Create or join a company to use workspaces.',
            )}
          />
        </div>
      )}

      {companyId !== null && currentCompany && (
        <CreateWorkspaceModal
          open={createOpen}
          companyId={companyId}
          companyName={currentCompany.companyName}
          onClose={() => setCreateOpen(false)}
          onCreated={(w, options) => void handleCreated(w, options)}
        />
      )}
    </DashboardLayout>
  )
}

// Lưới thẻ bằng nhau: 1 cột (mobile) · 2 cột ≥768px · 3 cột ≥1280px, thẻ giãn hết hàng; `auto-rows-fr` giữ mọi hàng cùng chiều cao.
const cardGrid = 'grid grid-cols-1 gap-4 md:auto-rows-fr md:grid-cols-2 xl:grid-cols-3'

function WorkspaceCard({ workspace: w }: { workspace: WorkspaceDto }) {
  const { t } = useI18n()
  const roleLabel = w.companyId === null ? t('Cá nhân', 'Personal') : (w.myRole?.name ?? t('Chỉ xem', 'View only'))
  return (
    <Link
      to={`/workspaces/${w.workspaceId}`}
      className={clsx(
        'group flex h-full min-h-[9.5rem] flex-col rounded-card border border-gray-200 bg-white p-4 shadow-xs transition-[border-color,box-shadow] hover:border-gray-300 hover:shadow-sm',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100',
        w.status === 'ARCHIVED' && 'opacity-75',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-gray-950 group-hover:text-brand-700">{w.name}</p>
          <CodeChip className="mt-1">{w.code}</CodeChip>
        </div>
        {/* Thẻ đã lưu trữ chỉ hiện ở bộ lọc "Đã lưu trữ" nên không cần nhãn trạng thái riêng. */}
        <Badge>{roleLabel}</Badge>
      </div>
      {/* Luôn giữ chỗ 2 dòng mô tả để các thẻ cao bằng nhau dù có mô tả hay không. */}
      <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm text-gray-600">{w.description}</p>
      <p className="mt-auto pt-3 text-xs text-gray-500">
        {w.projectCount} {t('dự án', w.projectCount === 1 ? 'project' : 'projects')} · {w.memberCount}{' '}
        {t('thành viên', w.memberCount === 1 ? 'member' : 'members')} · {t('cập nhật', 'updated')}{' '}
        {formatRelative(w.updatedAt)}
      </p>
    </Link>
  )
}
