import { Outlet, useOutletContext, useParams } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ErrorState, ForbiddenState, LoadingBlock, PageHeader, PageTabs } from '@/components/layout/PageParts'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { workspaceApi } from '@/api/workspaceApi'
import { useAsync } from '@/lib/useAsync'
import { apiErrorMessage, isForbidden } from '@/lib/apiErrors'
import { hasPermission } from '@/lib/permissions'
import { PERMISSIONS, type WorkspaceDto } from '@/types/rbac'

export interface WorkspaceOutletContext {
  workspace: WorkspaceDto
  /** Quyền hiệu lực của người xem trong workspace này (`myPermissions`). */
  can: (permission: string) => boolean
  isArchived: boolean
  isPersonal: boolean
  reload: () => Promise<void>
  setWorkspace: (workspace: WorkspaceDto) => void
}

export const useWorkspaceContext = () => useOutletContext<WorkspaceOutletContext>()

// Khung chung của /workspaces/:workspaceId/* — tải workspace 1 lần, các tab con nhận qua Outlet context
// (FR §III.4.4: tab Tổng quan / Thành viên / Cài đặt).
export function WorkspaceLayout() {
  const workspaceId = Number(useParams().workspaceId)
  const { data: workspace, error, isLoading, reload, setData } = useAsync(
    () => workspaceApi.get(workspaceId),
    [workspaceId],
  )

  if (isLoading && !workspace) {
    return (
      <DashboardLayout>
        <LoadingBlock />
      </DashboardLayout>
    )
  }

  if (error || !workspace) {
    return (
      <DashboardLayout>
        {isForbidden(error) ? (
          <ForbiddenState message="Workspace does not exist or you are not a member." />
        ) : (
          <ErrorState message={apiErrorMessage(error)} onRetry={reload} />
        )}
      </DashboardLayout>
    )
  }

  const can = (permission: string) => hasPermission(workspace.myPermissions, permission)
  const isPersonal = workspace.companyId === null
  const isArchived = workspace.status === 'ARCHIVED'
  const base = `/workspaces/${workspace.workspaceId}`

  const context: WorkspaceOutletContext = {
    workspace,
    can,
    isArchived,
    isPersonal,
    reload,
    setWorkspace: (next) => setData(() => next),
  }

  return (
    <DashboardLayout>
      <PageHeader
        eyebrow={`// Workspace · ${workspace.code}`}
        title={workspace.name}
        meta={
          <>
            {isPersonal ? (
              <Badge>Personal</Badge>
            ) : (
              <Badge tone={workspace.myRole?.code === 'WORKSPACE_ADMIN' ? 'brand' : 'neutral'}>
                {workspace.myRole?.name ?? 'Viewer'}
              </Badge>
            )}
            {isArchived && <Badge tone="amber">Archived</Badge>}
          </>
        }
        description={workspace.description ?? undefined}
      />

      {isArchived && (
        <div className="mt-4">
          <Alert tone="warning">
            This workspace is archived — all contents are read-only. It can be restored from the Settings tab.
          </Alert>
        </div>
      )}

      <PageTabs
        items={[
          { label: 'Overview', to: base, end: true },
          { label: 'Projects', to: `${base}/projects`, count: workspace.projectCount, hidden: isPersonal },
          {
            label: 'Members',
            to: `${base}/members`,
            count: workspace.memberCount,
            hidden: isPersonal || !can(PERMISSIONS.workspaceMemberView),
          },
          {
            label: 'Settings',
            to: `${base}/settings`,
            hidden: !can(PERMISSIONS.workspaceUpdate) && !can(PERMISSIONS.workspaceArchive),
          },
        ]}
      />

      <div className="mt-6">
        <Outlet context={context} />
      </div>
    </DashboardLayout>
  )
}
