import { Link, Outlet, useLocation, useOutletContext, useParams } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ErrorState, ForbiddenState, LoadingBlock, PageHeader, PageTabs } from '@/components/layout/PageParts'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { projectApi } from '@/api/projectApi'
import { documentApi } from '@/api/documentApi'
import { issueApi } from '@/api/issueApi'
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
  const issueStats = useAsync(() => issueApi.getProjectIssueStats(projectId), [projectId])
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
          <ForbiddenState message="Project does not exist or you are not a member." />
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
          Projects
        </Link>
        <span className="text-gray-300">/</span>
        <span className="font-medium text-gray-800">
          {project.name} <span className="font-mono text-gray-400">[{project.key}]</span>
        </span>
      </nav>

      <div className="mt-3">
        <PageHeader
          eyebrow={`// Project · ${project.key}`}
          title={project.name}
          meta={
            <>
              {isArchived ? <Badge tone="amber">Archived</Badge> : <Badge tone="brand" dot>Active</Badge>}
              <Badge>{SDLC_LABEL[project.sdlcMethod]}</Badge>
              {project.myRole ? (
                <Badge tone={project.myRole.code === 'PROJECT_MANAGER' ? 'brand' : 'blue'}>{project.myRole.name}</Badge>
              ) : (
                <Badge>Read-only</Badge>
              )}
            </>
          }
          description={`${project.key} · workspace ${project.workspaceName}${project.description ? ` · ${project.description}` : ''}`}
        />
      </div>

      {justCreated && (
        <div className="mt-4">
          <Alert tone="success">
            Project <b>{project.name}</b> has been created with {project.phaseCount} phases and {project.memberCount} members. You are the
            Project Manager of this project.
          </Alert>
        </div>
      )}
      {isArchived && (
        <div className="mt-4">
          <Alert tone="warning">This project is archived — all documents, issues, and configurations are read-only.</Alert>
        </div>
      )}

      <PageTabs
        items={[
          { label: 'Overview', to: base, end: true },
          { label: 'Requirements', to: `${base}/documents`, count: docStats.data?.totalDocs },
          { label: 'Kanban Board', to: `${base}/issues`, count: issueStats.data?.open },
          { label: 'Test Cases', to: `${base}/testcases`, soon: true },
          { label: 'Workflow', to: `${base}/workflow`, count: project.phaseCount },
          { label: 'Members', to: `${base}/members`, count: project.memberCount, hidden: !can(PERMISSIONS.projectView) },
          {
            label: 'Settings',
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
