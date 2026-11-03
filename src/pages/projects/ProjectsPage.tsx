import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ErrorState, LoadingBlock, PageHeader } from '@/components/layout/PageParts'
import { PlusIcon } from '@/components/ui/icons'
import { buttonClasses } from '@/components/ui/Button'
import { PERMISSIONS } from '@/types/rbac'
import { useAuth } from '@/context/AuthContext'
import { projectApi } from '@/api/projectApi'
import { useAsync } from '@/lib/useAsync'
import { apiErrorMessage } from '@/lib/apiErrors'
import { useI18n } from '@/i18n'
import { ProjectTable } from './ProjectTable'
import { SearchInput } from '@/components/ui/listControls'

// Mục "Dự án" ở sidebar: mọi dự án người dùng thấy được trong công ty (§10.2), nhóm theo workspace.
export function ProjectsPage() {
  const { t } = useI18n()
  const { currentCompany, workspaces, can } = useAuth()
  const companyId = currentCompany?.companyId ?? null
  // Dự án luôn thuộc một workspace: một workspace thì vào thẳng wizard, nhiều workspace thì chọn trước.
  const creatable = workspaces.filter(
    (w) =>
      w.status !== 'ARCHIVED' && (can(PERMISSIONS.projectCreate) || w.permissions?.includes(PERMISSIONS.projectCreate)),
  )
  const createHref = creatable.length === 1 ? `/workspaces/${creatable[0].workspaceId}/projects/new` : '/workspaces'
  const [search, setSearch] = useState('')
  const projects = useAsync(() => projectApi.listMine(companyId, { status: 'ACTIVE' }), [companyId])

  const keyword = search.trim().toLowerCase()
  const visible = (projects.data ?? []).filter(
    (p) => !keyword || p.name.toLowerCase().includes(keyword) || p.key.toLowerCase().includes(keyword),
  )

  return (
    <DashboardLayout>
      <PageHeader
        title={t('Dự án', 'Projects')}
        description={
          projects.data
            ? t(
                `${projects.data.length} dự án đang hoạt động trong mọi workspace`,
                `${projects.data.length} active ${projects.data.length === 1 ? 'project' : 'projects'} across all workspaces`,
              )
            : undefined
        }
        actions={
          creatable.length > 0 && (
            <Link to={createHref} className={buttonClasses({ inline: true })}>
              <PlusIcon className="h-4 w-4" />
              {t('Tạo dự án', 'Create project')}
            </Link>
          )
        }
      />
      <SearchInput
        className="mt-6 sm:w-72"
        value={search}
        onChange={setSearch}
        label={t('Tìm dự án', 'Search projects')}
        placeholder={t('Tìm theo tên hoặc mã…', 'Search by name or key…')}
      />
      <div className="mt-4">
        {projects.isLoading && !projects.data ? (
          <LoadingBlock />
        ) : projects.error ? (
          <ErrorState message={apiErrorMessage(projects.error)} onRetry={projects.reload} />
        ) : (
          <ProjectTable
            projects={visible}
            showWorkspace
            emptyText={
              keyword
                ? t('Không có dự án phù hợp.', 'No matching projects.')
                : t('Bạn chưa tham gia dự án nào.', "You haven't joined any projects yet.")
            }
          />
        )}
      </div>
    </DashboardLayout>
  )
}
