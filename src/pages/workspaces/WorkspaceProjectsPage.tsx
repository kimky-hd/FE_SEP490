import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ErrorState, LoadingBlock } from '@/components/layout/PageParts'
import { Button } from '@/components/ui/Button'
import { PlusIcon } from '@/components/ui/icons'
import { useAuth } from '@/context/AuthContext'
import { projectApi } from '@/api/projectApi'
import { useAsync } from '@/lib/useAsync'
import { apiErrorMessage } from '@/lib/apiErrors'
import { PERMISSIONS } from '@/types/rbac'
import type { ProjectStatus } from '@/types/project'
import { ProjectTable } from '../projects/ProjectTable'
import { AccessDeniedModal } from '../projects/AccessDeniedModal'
import { useWorkspaceContext } from './WorkspaceLayout'
import { useI18n } from '@/i18n'
import { SearchInput, Segmented } from '@/components/ui/listControls'
import { SectionBar } from '@/components/layout/tabParts'

// Tab "Dự án" của workspace — mockup "Dự án" + Figma hàng 2 frame 01 (nút Create Project luôn hiện; thiếu quyền thì
// bấm vào nhận modal Access Denied thay vì ẩn nút).
export function WorkspaceProjectsPage() {
  const { workspace, can, isArchived, isPersonal } = useWorkspaceContext()
  const { user } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [status, setStatus] = useState<ProjectStatus>('ACTIVE')
  const [search, setSearch] = useState('')
  const [deniedOpen, setDeniedOpen] = useState(false)
  const projects = useAsync(() => projectApi.listByWorkspace(workspace.workspaceId), [workspace.workspaceId])

  const all = projects.data ?? []
  const keyword = search.trim().toLowerCase()
  const visible = all
    .filter((p) => p.status === status)
    .filter((p) => !keyword || p.name.toLowerCase().includes(keyword) || p.key.toLowerCase().includes(keyword))

  const onCreate = () => {
    if (can(PERMISSIONS.projectCreate)) navigate(`/workspaces/${workspace.workspaceId}/projects/new`)
    else setDeniedOpen(true)
  }

  return (
    <div>
      <SectionBar
        title={t('Dự án', 'Projects')}
        caption={projects.data ? String(all.length) : undefined}
        actions={
          <>
            <Segmented
              label={t('Lọc theo trạng thái', 'Filter by status')}
              value={status}
              onChange={setStatus}
              options={[
                {
                  value: 'ACTIVE',
                  label: t('Đang hoạt động', 'Active'),
                  count: all.filter((p) => p.status === 'ACTIVE').length,
                },
                {
                  value: 'ARCHIVED',
                  label: t('Đã lưu trữ', 'Archived'),
                  count: all.filter((p) => p.status === 'ARCHIVED').length,
                },
              ]}
            />
            <SearchInput
              className="w-full sm:w-64"
              value={search}
              onChange={setSearch}
              label={t('Tìm dự án', 'Search projects')}
              placeholder={t('Tìm theo tên hoặc mã…', 'Search by name or key…')}
            />
            {!isArchived && !isPersonal && (
              <Button inline onClick={onCreate}>
                <PlusIcon className="h-4 w-4" /> {t('Tạo dự án', 'Create project')}
              </Button>
            )}
          </>
        }
      />

      <div className="mt-4">
        {projects.isLoading && !projects.data ? (
          <LoadingBlock />
        ) : projects.error ? (
          <ErrorState message={apiErrorMessage(projects.error)} onRetry={projects.reload} />
        ) : (
          <ProjectTable
            projects={visible}
            emptyText={
              keyword
                ? t('Không có dự án phù hợp.', 'No matching projects.')
                : status === 'ACTIVE'
                  ? t(
                      'Chưa có dự án nào — bấm “Tạo dự án” để bắt đầu.',
                      'No projects yet — click “Create project” to start.',
                    )
                  : t('Không có dự án đã lưu trữ.', 'No archived projects.')
            }
          />
        )}
      </div>

      <AccessDeniedModal
        open={deniedOpen}
        onClose={() => setDeniedOpen(false)}
        workspace={workspace}
        email={user?.email ?? ''}
      />
    </div>
  )
}
