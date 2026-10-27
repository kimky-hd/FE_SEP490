import { Link } from 'react-router-dom'
import { DashboardEmptyState, DashboardLayout } from '@/components/layout/DashboardLayout'
import { useAuth } from '@/context/AuthContext'
import { DocumentIcon, FolderIcon, ListChecksIcon } from '@/components/ui/icons'
import { projectApi } from '@/api/projectApi'
import { useAsync } from '@/lib/useAsync'

export function DashboardHomePage() {
  const { user, companies, workspaces, currentCompany } = useAuth()
  const companyId = currentCompany?.companyId ?? null
  const projects = useAsync(() => projectApi.listMine(companyId, { status: 'ACTIVE' }), [companyId])
  const projectList = projects.data ?? []

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-semibold tracking-tight text-gray-950">Chào {user?.fullName}!</h1>
      <p className="mt-1 text-sm text-gray-500">
        {companies[0]
          ? `Đây là không gian làm việc của ${companies[0].companyName}.`
          : 'Đây là không gian làm việc cá nhân của bạn.'}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projectList.length > 0 ? (
          <div className="flex flex-col justify-between rounded-md border border-gray-200 bg-white p-5">
            <div>
              <div className="flex items-center justify-between">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-brand-50 text-brand-700">
                  <FolderIcon className="h-5 w-5" />
                </span>
                <Link to="/projects" className="text-xs font-medium text-brand-700 hover:underline">
                  Xem tất cả ({projectList.length}) →
                </Link>
              </div>
              <h2 className="mt-3 text-sm font-semibold text-gray-900">Dự án đang hoạt động</h2>
              <ul className="mt-2 space-y-1.5 text-sm">
                {projectList.slice(0, 3).map((p) => (
                  <li key={p.projectId} className="flex items-center justify-between gap-2 truncate">
                    <Link
                      to={`/projects/${p.projectId}`}
                      className="truncate font-medium text-gray-800 hover:text-brand-700 hover:underline"
                    >
                      <span className="mr-1.5 font-mono text-xs text-gray-500">[{p.key}]</span>
                      {p.name}
                    </Link>
                    <span className="shrink-0 text-xs text-gray-400">{p.sdlcMethod}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <DashboardEmptyState
            icon={<FolderIcon className="h-5 w-5" />}
            title="Chưa có dự án"
            description="Tạo dự án đầu tiên để bắt đầu theo dõi công việc."
          />
        )}
        <DashboardEmptyState
          icon={<DocumentIcon className="h-5 w-5" />}
          title="Chưa có tài liệu yêu cầu"
          description="Module AI sinh URD từ ghi chú thô đang được phát triển."
        />
        <DashboardEmptyState
          icon={<ListChecksIcon className="h-5 w-5" />}
          title="Chưa có testcase"
          description="Module AI sinh testcase & truy xuất nguồn gốc đang được phát triển."
        />
      </div>

      {(companies.length > 0 || workspaces.length > 0) && (
        <div className="mt-6 rounded-md border border-gray-200 bg-white p-4 text-sm">
          <p className="font-semibold text-gray-700">Thông tin tài khoản</p>
          <dl className="mt-2 space-y-1 text-gray-500">
            {companies.map((c) => (
              <div key={c.companyId} className="flex justify-between">
                <dt>Công ty</dt>
                <dd className="font-medium text-gray-700">
                  {c.companyName} · {c.roleName}
                </dd>
              </div>
            ))}
            {workspaces.map((w) => (
              <div key={w.workspaceId} className="flex justify-between">
                <dt>Workspace</dt>
                <dd className="font-medium text-gray-700">
                  <Link to={`/workspaces/${w.workspaceId}`} className="hover:text-brand-700 hover:underline">
                    {w.workspaceName}
                  </Link>
                  {w.role && <span className="font-normal text-gray-400"> · {w.role.name}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </DashboardLayout>
  )
}
