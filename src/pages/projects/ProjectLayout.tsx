import { Link, Outlet, useLocation, useOutletContext, useParams } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ErrorState, ForbiddenState, LoadingBlock, PageHeader, PageTabs } from '@/components/layout/PageParts'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { projectApi } from '@/api/projectApi'
import { documentApi } from '@/api/documentApi'
import { useAsync } from '@/lib/useAsync'
import { apiErrorMessage, isForbidden } from '@/lib/apiErrors'
import { hasPermission } from '@/lib/permissions'
import { PERMISSIONS } from '@/types/rbac'
import type { ProjectDto } from '@/types/project'
import { SDLC_LABEL } from './ProjectTable'

export interface ProjectOutletContext {
  project: ProjectDto
  can: (permission: string) => boolean
  isArchived: boolean
  reload: () => Promise<void>
  setProject: (project: ProjectDto) => void
}

export const useProjectContext = () => useOutletContext<ProjectOutletContext>()

// Khung /projects/:projectId/* — mockup "Chi tiết Dự án": tab Tổng quan · Tài liệu yêu cầu · Kanban · Testcase · Cài đặt
// (+ Workflow, Thành viên theo Screen List #18–#21). Tài liệu / Kanban / Testcase thuộc module sau → "SỚM".
export function ProjectLayout() {
  const projectId = Number(useParams().projectId)
  const location = useLocation()
  const { data: project, error, isLoading, reload, setData } = useAsync(() => projectApi.get(projectId), [projectId])
  const docStats = useAsync(() => documentApi.getProjectStats(projectId), [projectId])
  const justCreated = (location.state as { created?: boolean } | null)?.created === true

  if (isLoading && !project) {
    return (
      <DashboardLayout>
        <LoadingBlock />
      </DashboardLayout>
    )
  }
  if (error || !project) {
    return (
      <DashboardLayout>
        {isForbidden(error) ? (
          <ForbiddenState message="Dự án không tồn tại hoặc bạn không phải thành viên." />
        ) : (
          <ErrorState message={apiErrorMessage(error)} onRetry={reload} />
        )}
      </DashboardLayout>
    )
  }

  const can = (permission: string) => hasPermission(project.myPermissions, permission)
  const isArchived = project.status === 'ARCHIVED'
  const base = `/projects/${project.projectId}`
  const context: ProjectOutletContext = { project, can, isArchived, reload, setProject: (next) => setData(() => next) }

  return (
    <DashboardLayout>
      <nav className="flex flex-wrap items-center gap-1.5 text-sm text-gray-500">
        <Link to={`/workspaces/${project.workspaceId}/projects`} className="hover:text-gray-800 hover:underline">
          {project.workspaceName}
        </Link>
        <span className="text-gray-300">/</span>
        <Link to={`/workspaces/${project.workspaceId}/projects`} className="hover:text-gray-800 hover:underline">
          Dự án
        </Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-800">
          {project.name} <span className="font-mono text-gray-400">[{project.key}]</span>
        </span>
      </nav>

      <div className="mt-3">
        <PageHeader
          eyebrow={`// Dự án · ${project.key}`}
          title={project.name}
          meta={
            <>
              {isArchived ? <Badge tone="amber">Lưu trữ</Badge> : <Badge tone="brand" dot>Đang chạy</Badge>}
              <Badge>{SDLC_LABEL[project.sdlcMethod]}</Badge>
              {project.myRole ? (
                <Badge tone={project.myRole.code === 'PROJECT_MANAGER' ? 'brand' : 'blue'}>{project.myRole.name}</Badge>
              ) : (
                <Badge>Chỉ xem</Badge>
              )}
            </>
          }
          description={`${project.key} · workspace ${project.workspaceName}${project.description ? ` · ${project.description}` : ''}`}
        />
      </div>

      {justCreated && (
        <div className="mt-4">
          <Alert tone="success">
            Đã khởi tạo dự án <b>{project.name}</b> với {project.phaseCount} phase và {project.memberCount} thành viên. Bạn là Project
            Manager của dự án này.
          </Alert>
        </div>
      )}
      {isArchived && (
        <div className="mt-4">
          <Alert tone="warning">Dự án đã được lưu trữ — mọi tài liệu, issue và cấu hình chỉ đọc.</Alert>
        </div>
      )}

      <PageTabs
        items={[
          { label: 'Tổng quan', to: base, end: true },
          { label: 'Tài liệu yêu cầu', to: `${base}/documents`, count: docStats.data?.totalDocs },
          { label: 'Kanban', to: `${base}/kanban`, soon: true },
          { label: 'Testcase', to: `${base}/testcases`, soon: true },
          { label: 'Workflow', to: `${base}/workflow`, count: project.phaseCount },
          { label: 'Thành viên', to: `${base}/members`, count: project.memberCount, hidden: !can(PERMISSIONS.projectView) },
          {
            label: 'Cài đặt',
            to: `${base}/settings`,
            hidden: !can(PERMISSIONS.projectUpdate) && !can(PERMISSIONS.projectArchive),
          },
        ]}
      />

      <div className="mt-6">
        <Outlet context={context} />
      </div>
    </DashboardLayout>
  )
}
