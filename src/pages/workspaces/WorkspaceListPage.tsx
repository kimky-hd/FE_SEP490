import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { DashboardEmptyState, DashboardLayout } from '@/components/layout/DashboardLayout'
import { ErrorState, LoadingBlock, PageHeader } from '@/components/layout/PageParts'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { BuildingIcon, PlusIcon, SearchIcon } from '@/components/ui/icons'
import { useAuth } from '@/context/AuthContext'
import { workspaceApi } from '@/api/workspaceApi'
import { useAsync } from '@/lib/useAsync'
import { apiErrorMessage } from '@/lib/apiErrors'
import { formatRelative } from '@/lib/format'
import { PERMISSIONS, type WorkspaceDto, type WorkspaceStatus } from '@/types/rbac'
import { CreateWorkspaceModal } from './CreateWorkspaceModal'

// FR §III.4.1 Workspace List + wireframe "Workspace": workspace của công ty hiện tại + khu "Không gian cá nhân".
export function WorkspaceListPage() {
  const { currentCompany, can, refreshMe } = useAuth()
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
  const personalWorkspaces = useAsync(() => workspaceApi.list({ companyId: null }), [])

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
        eyebrow="// Workspace"
        title="Workspace"
        description={
          currentCompany ? `Các không gian làm việc trong ${currentCompany.companyName}.` : 'Không gian làm việc của bạn.'
        }
        actions={
          canCreate && (
            <Button inline onClick={() => setCreateOpen(true)}>
              <PlusIcon className="h-4 w-4" />
              Tạo Workspace
            </Button>
          )
        }
      />

      {companyId !== null && (
        <section className="mt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex rounded-md border border-gray-200 bg-white p-0.5 text-sm">
              {(
                [
                  ['ACTIVE', 'Đang hoạt động', all.length - archivedCount],
                  ['ARCHIVED', 'Đã lưu trữ', archivedCount],
                ] as const
              ).map(([value, label, count]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatus(value)}
                  className={clsx(
                    'rounded px-3 py-1.5 font-medium transition-colors',
                    status === value ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800',
                  )}
                >
                  {label}
                  <span className={clsx('ml-1.5 text-xs', status === value ? 'text-white/60' : 'text-gray-400')}>
                    {count}
                  </span>
                </button>
              ))}
            </div>
            <label className="relative block sm:w-72">
              <span className="sr-only">Tìm workspace</span>
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên hoặc mã…"
                className="h-9 w-full rounded-md border border-gray-300 bg-white pl-9 pr-3 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
              />
            </label>
          </div>

          <div className="mt-4">
            {companyWorkspaces.isLoading && !companyWorkspaces.data ? (
              <LoadingBlock />
            ) : companyWorkspaces.error ? (
              <ErrorState message={apiErrorMessage(companyWorkspaces.error)} onRetry={companyWorkspaces.reload} />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visible.map((w) => (
                  <WorkspaceCard key={w.workspaceId} workspace={w} />
                ))}
                {status === 'ACTIVE' && canCreate && !keyword && (
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="flex min-h-[9.5rem] items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 bg-white/60 text-sm font-medium text-gray-500 transition-colors hover:border-brand-400 hover:text-brand-700"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Tạo Workspace mới
                  </button>
                )}
                {visible.length === 0 && !(status === 'ACTIVE' && canCreate && !keyword) && (
                  <div className="md:col-span-2 xl:col-span-3">
                    <DashboardEmptyState
                      icon={<BuildingIcon className="h-5 w-5" />}
                      title={keyword ? 'Không có workspace phù hợp' : status === 'ACTIVE' ? 'Chưa có workspace' : 'Không có workspace đã lưu trữ'}
                      description={
                        keyword
                          ? 'Thử từ khoá khác.'
                          : status === 'ACTIVE'
                            ? 'Bạn chưa được thêm vào workspace nào. Liên hệ quản trị viên để được mời.'
                            : 'Workspace bị lưu trữ sẽ hiện ở đây, có thể khôi phục trong phần Cài đặt.'
                      }
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {(personalWorkspaces.data?.length ?? 0) > 0 && (
        <section className="mt-8">
          <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-gray-500">Không gian cá nhân</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {personalWorkspaces.data!.map((w) => (
              <WorkspaceCard key={w.workspaceId} workspace={w} />
            ))}
          </div>
        </section>
      )}

      {companyId === null && personalWorkspaces.data?.length === 0 && (
        <div className="mt-6">
          <DashboardEmptyState
            icon={<BuildingIcon className="h-5 w-5" />}
            title="Chưa có workspace"
            description="Tài khoản cá nhân chỉ có 1 workspace cá nhân, tạo ở bước onboarding."
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

function WorkspaceCard({ workspace: w }: { workspace: WorkspaceDto }) {
  const roleLabel = w.companyId === null ? 'Cá nhân' : w.myRole?.name ?? 'Chỉ xem'
  return (
    <Link
      to={`/workspaces/${w.workspaceId}`}
      className={clsx(
        'group flex min-h-[9.5rem] flex-col rounded-md border bg-white p-4 transition-[border-color,box-shadow] hover:border-brand-300 hover:shadow-sm',
        w.status === 'ARCHIVED' ? 'border-gray-200 opacity-75' : 'border-gray-200',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-gray-950 group-hover:text-brand-700">{w.name}</p>
          <p className="truncate font-mono text-[11px] text-gray-400">{w.code}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone={w.myRole?.code === 'WORKSPACE_ADMIN' ? 'brand' : 'neutral'}>{roleLabel}</Badge>
          {w.status === 'ARCHIVED' && <Badge tone="amber">Đã lưu trữ</Badge>}
        </div>
      </div>
      <p className="mt-2 line-clamp-2 flex-1 text-sm text-gray-500">{w.description || 'Chưa có mô tả.'}</p>
      <p className="mt-3 text-xs text-gray-400">
        {w.projectCount} dự án · {w.memberCount} thành viên · {formatRelative(w.updatedAt)}
      </p>
    </Link>
  )
}
