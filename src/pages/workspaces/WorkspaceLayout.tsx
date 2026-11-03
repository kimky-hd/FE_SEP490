import { useOutletContext, useParams } from 'react-router-dom'
import { LazyOutlet } from '@/components/layout/LazyOutlet'
import { DashboardLayout, PAGE_BODY } from '@/components/layout/DashboardLayout'
import { ErrorState, ForbiddenState, LoadingBlock, type TabItem } from '@/components/layout/PageParts'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { workspaceApi } from '@/api/workspaceApi'
import { useAsync } from '@/lib/useAsync'
import { apiErrorMessage, isForbidden } from '@/lib/apiErrors'
import { hasPermission } from '@/lib/permissions'
import { PERMISSIONS, type WorkspaceDto } from '@/types/rbac'
import { useI18n } from '@/i18n'
import { formatRelative } from '@/lib/format'
import { CodeChip } from '@/components/ui/listControls'
import { EntityHeader } from '@/components/layout/tabParts'
import { HelpTips } from '@/help/HelpTips'

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
  const { t } = useI18n()
  const {
    data: workspace,
    error,
    isLoading,
    reload,
    setData,
  } = useAsync(() => workspaceApi.get(workspaceId), [workspaceId])

  if (isLoading && !workspace) {
    return (
      <DashboardLayout>
        <div className={PAGE_BODY}>
          <LoadingBlock />
        </div>
      </DashboardLayout>
    )
  }

  if (error || !workspace) {
    return (
      <DashboardLayout>
        <div className={PAGE_BODY}>
          {isForbidden(error) ? (
            <ForbiddenState
              message={t(
                'Workspace không tồn tại hoặc bạn không phải thành viên.',
                'This workspace does not exist or you are not a member.',
              )}
            />
          ) : (
            <ErrorState message={apiErrorMessage(error)} onRetry={reload} />
          )}
        </div>
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

  const tabs: TabItem[] = [
    { label: t('Tổng quan', 'Overview'), to: base, end: true },
    { label: t('Dự án', 'Projects'), to: `${base}/projects`, hidden: isPersonal },
    {
      label: t('Thành viên', 'Members'),
      to: `${base}/members`,
      hidden: isPersonal || !can(PERMISSIONS.workspaceMemberView),
    },
    {
      label: t('Cài đặt', 'Settings'),
      to: `${base}/settings`,
      hidden: !can(PERMISSIONS.workspaceUpdate) && !can(PERMISSIONS.workspaceArchive),
    },
  ]
  // Mã · role · lần cập nhật: tooltip của tên (giống header dự án); mô tả dài nằm ở tab Tổng quan.
  const meta = [
    workspace.code,
    !isPersonal ? (workspace.myRole?.name ?? t('Chỉ xem', 'View only')) : null,
    t(`Cập nhật ${formatRelative(workspace.updatedAt)}`, `Updated ${formatRelative(workspace.updatedAt)}`),
  ]
    .filter(Boolean)
    .join(' · ')

  // Cùng khuôn với header dự án: một dải ngang "Workspace /" · tên · mã · trạng thái · các tab.
  return (
    <DashboardLayout>
      <EntityHeader
        crumb={{ label: 'Workspace', to: '/workspaces' }}
        title={workspace.name}
        titleHint={meta}
        badges={
          <>
            <CodeChip>{workspace.code}</CodeChip>
            {isPersonal && <Badge>{t('Cá nhân', 'Personal')}</Badge>}
            {isArchived ? (
              <Badge tone="amber">{t('Đã lưu trữ', 'Archived')}</Badge>
            ) : (
              !isPersonal && (
                <Badge tone="success" dot>
                  {t('Đang hoạt động', 'Active')}
                </Badge>
              )
            )}
          </>
        }
        tabs={tabs}
        navLabel={t('Mục workspace', 'Workspace sections')}
        trailing={<HelpTips />}
      />

      <div className={PAGE_BODY}>
        {isArchived && (
          <div className="mb-6">
            <Alert tone="warning">
              {t(
                'Workspace đã được lưu trữ — toàn bộ dữ liệu bên trong chỉ đọc. Có thể khôi phục trong tab Cài đặt.',
                'This workspace is archived — everything in it is read-only. You can restore it in the Settings tab.',
              )}
            </Alert>
          </div>
        )}
        <LazyOutlet context={context} />
      </div>
    </DashboardLayout>
  )
}
