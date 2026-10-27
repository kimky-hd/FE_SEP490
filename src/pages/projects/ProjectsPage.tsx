import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ErrorState, LoadingBlock, PageHeader } from '@/components/layout/PageParts'
import { SearchIcon } from '@/components/ui/icons'
import { useAuth } from '@/context/AuthContext'
import { projectApi } from '@/api/projectApi'
import { useAsync } from '@/lib/useAsync'
import { apiErrorMessage } from '@/lib/apiErrors'
import { ProjectTable } from './ProjectTable'

// Mục "Dự án" ở sidebar: mọi dự án người dùng thấy được trong công ty (§10.2), nhóm theo workspace.
export function ProjectsPage() {
  const { currentCompany } = useAuth()
  const companyId = currentCompany?.companyId ?? null
  const [search, setSearch] = useState('')
  const projects = useAsync(() => projectApi.listMine(companyId, { status: 'ACTIVE' }), [companyId])

  const keyword = search.trim().toLowerCase()
  const visible = (projects.data ?? []).filter(
    (p) => !keyword || p.name.toLowerCase().includes(keyword) || p.key.toLowerCase().includes(keyword),
  )

  return (
    <DashboardLayout>
      <PageHeader
        eyebrow="// Dự án"
        title="Dự án"
        description={
          <>
            Dự án đang chạy bạn tham gia hoặc được xem. Tạo dự án mới trong trang{' '}
            <Link to="/workspaces" className="font-medium text-brand-700 hover:underline">
              Workspace
            </Link>{' '}
            → tab Dự án.
          </>
        }
      />
      <label className="relative mt-6 block sm:w-72">
        <span className="sr-only">Tìm dự án</span>
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên hoặc mã…"
          className="h-9 w-full rounded-md border border-gray-300 bg-white pl-9 pr-3 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
        />
      </label>
      <div className="mt-4">
        {projects.isLoading && !projects.data ? (
          <LoadingBlock />
        ) : projects.error ? (
          <ErrorState message={apiErrorMessage(projects.error)} onRetry={projects.reload} />
        ) : (
          <ProjectTable projects={visible} showWorkspace emptyText="Bạn chưa tham gia dự án nào." />
        )}
      </div>
    </DashboardLayout>
  )
}
