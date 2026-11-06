import { useEffect, useMemo, useState } from 'react'
import { useLocation, useOutletContext, useParams } from 'react-router-dom'
import { LazyOutlet } from '@/components/layout/LazyOutlet'
import { DashboardLayout, PAGE_BODY } from '@/components/layout/DashboardLayout'
import { ErrorState, ForbiddenState, LoadingBlock } from '@/components/layout/PageParts'
import { ProjectSidebar } from '@/components/layout/ProjectSidebar'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { useAuth } from '@/context/AuthContext'
import { projectApi } from '@/api/projectApi'
import { useAsync } from '@/lib/useAsync'
import { apiErrorMessage, isForbidden } from '@/lib/apiErrors'
import { hasPermission } from '@/lib/permissions'
import { rememberProject } from '@/lib/recentProjects'
import { rememberItem } from '@/lib/recentItems'
import { resolveProjectRole, ROLE_SHORT, type ProjectRoleKind } from '@/lib/projectRole'
import { useWorkItems } from '@/lib/useMyWork'
import type { WorkItem } from '@/lib/myWorkRules'
import type { ProjectDto } from '@/types/project'
import { useI18n } from '@/i18n'
import { ExpandIcon, IconButton } from '../documents/docUi'
import { EntityHeader } from '@/components/layout/tabParts'
import { HelpTips } from '@/help/HelpTips'

export interface ProjectOutletContext {
  project: ProjectDto
  can: (permission: string) => boolean
  isArchived: boolean
  reload: () => Promise<void>
  setProject: (project: ProjectDto) => void
  /** Chế độ toàn màn hình của tab Tài liệu (ẩn sidebar app và header dự án). */
  fullscreen: boolean
  setFullscreen: (value: boolean) => void
  /** Vai trò làm việc trong dự án (BA, QA, Dev…), quyết định menu và "Việc của tôi". */
  role: ProjectRoleKind
  /** "Việc của tôi" trong dự án (dùng chung với sidebar). */
  work: { items: WorkItem[]; loading: boolean; error: unknown; reload: () => void }
}

export const useProjectContext = () => useOutletContext<ProjectOutletContext>()

/** Lề thân tab (trừ tab Tài liệu, vốn tràn sát mép khung trắng). */
export const PROJECT_TAB_PAD = PAGE_BODY

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  (el.isContentEditable || !!el.closest('input, textarea, select, [contenteditable="true"]'))

// Khung /projects/:projectId/* — sidebar trái trở thành menu của dự án (ProjectSidebar, sắp theo vai trò), không còn
// thanh tab ngang. Trong khung trắng chỉ còn một header mảnh: tên trang + hành động của trang (⤢ ở tab Tài liệu).
// Tab Tài liệu: thân tab chiếm phần còn lại của khung trắng, có chế độ toàn màn hình (⤢ / phím F, Esc thoát).
export function ProjectLayout() {
  const { t } = useI18n()
  const { user } = useAuth()
  const projectId = Number(useParams().projectId)
  const location = useLocation()
  const { data: project, error, isLoading, reload, setData } = useAsync(() => projectApi.get(projectId), [projectId])
  const justCreated = (location.state as { created?: boolean } | null)?.created === true
  const isFullBleed = /^\/projects\/\d+\/(documents|tests)(\/|$)/.test(location.pathname)
  const [fullscreen, setFullscreen] = useState(false)
  const loadedId = project?.projectId
  const projectList = useMemo(() => (project ? [project] : null), [project])
  const work = useWorkItems(projectList)
  const section = location.pathname.match(/^\/projects\/\d+\/([^/]+)/)?.[1] ?? ''

  // Dự án vừa mở lên đầu nhóm "Dự án gần đây" ở sidebar.
  useEffect(() => {
    if (user && loadedId) rememberProject(user.id, loadedId)
  }, [user, loadedId])

  // "Tiếp tục" trong Ctrl K: các trang dự án đã mở (trừ Việc của tôi; tài liệu do tab Tài liệu tự ghi).
  const pageTitle = sectionTitle(section, t)
  useEffect(() => {
    if (!user || !project || isFullBleed || section === 'my-work' || !pageTitle) return
    rememberItem(user.id, { href: location.pathname, title: `${pageTitle} · ${project.name}`, code: project.key })
  }, [user, project, isFullBleed, section, pageTitle, location.pathname])

  useEffect(() => {
    if (!isFullBleed) setFullscreen(false)
  }, [isFullBleed])

  useEffect(() => {
    if (!isFullBleed) return
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
      if (document.querySelector('[aria-modal="true"]')) return
      if (e.key === 'Escape' && fullscreen) {
        setFullscreen(false)
        return
      }
      if ((e.key === 'f' || e.key === 'F') && !e.repeat && !isTyping(e.target)) {
        e.preventDefault()
        setFullscreen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isFullBleed, fullscreen])

  if (isLoading && !project) {
    return (
      <DashboardLayout>
        <div className={PROJECT_TAB_PAD}>
          <LoadingBlock />
        </div>
      </DashboardLayout>
    )
  }
  if (error || !project) {
    return (
      <DashboardLayout>
        <div className={PROJECT_TAB_PAD}>
          {isForbidden(error) ? (
            <ForbiddenState
              message={t(
                'Dự án không tồn tại hoặc bạn không phải thành viên.',
                "The project doesn't exist or you're not a member.",
              )}
            />
          ) : (
            <ErrorState message={apiErrorMessage(error)} onRetry={reload} />
          )}
        </div>
      </DashboardLayout>
    )
  }

  const can = (permission: string) => hasPermission(project.myPermissions, permission)
  const isArchived = project.status === 'ARCHIVED'
  const role = resolveProjectRole(project)
  const items = work.byProject.get(project.projectId) ?? []
  const context: ProjectOutletContext = {
    project,
    can,
    isArchived,
    reload,
    setProject: (next) => setData(() => next),
    fullscreen: isFullBleed && fullscreen,
    setFullscreen,
    role,
    work: {
      items,
      loading: work.loading && !work.byProject.has(project.projectId),
      error: work.error,
      reload: work.reload,
    },
  }

  const hasAlerts = justCreated || isArchived
  const alerts = hasAlerts && (
    <div className="space-y-3">
      {justCreated && (
        <Alert tone="success">
          {t('Đã khởi tạo dự án ', 'Created project ')}
          <b>{project.name}</b>
          {t(
            ` với ${project.phaseCount} giai đoạn và ${project.memberCount} thành viên. Bạn là Project Manager của dự án này.`,
            ` with ${project.phaseCount} ${project.phaseCount === 1 ? 'phase' : 'phases'} and ${project.memberCount} ${project.memberCount === 1 ? 'member' : 'members'}. You're the Project Manager.`,
          )}
        </Alert>
      )}
      {isArchived && (
        <Alert tone="warning">
          {t(
            'Dự án đã được lưu trữ: mọi tài liệu, issue và cấu hình đều chỉ đọc.',
            'This project is archived: all documents, issues and settings are read-only.',
          )}
        </Alert>
      )}
    </div>
  )

  const header = (
    <EntityHeader
      title={pageTitle || project.name}
      titleHint={`${project.name} · ${project.myRole?.name ?? t('Chỉ xem', 'View only')}`}
      badges={isArchived && <Badge tone="amber">{t('Đã lưu trữ', 'Archived')}</Badge>}
      tabs={[]}
      navLabel={t('Mục dự án', 'Project sections')}
      trailing={
        <>
          {isFullBleed ? (
            <IconButton
              label={t('Toàn màn hình (F)', 'Full screen (F)')}
              onClick={() => setFullscreen(true)}
              className="border border-gray-200 text-gray-600"
            >
              <ExpandIcon />
            </IconButton>
          ) : (
            section === 'my-work' && (
              <span className="hidden text-[13px] text-gray-500 sm:inline">
                {t('Sắp theo mức gấp', 'Sorted by urgency')}
              </span>
            )
          )}
          <HelpTips role={role} />
        </>
      }
    />
  )

  const shortRole = ROLE_SHORT[role]

  return (
    <DashboardLayout
      workspaceId={project.workspaceId}
      fullscreen={context.fullscreen}
      projectNav={<ProjectSidebar project={project} role={role} items={items} />}
      accountHint={shortRole ? `${shortRole} · ${project.name}` : (project.myRole?.name ?? undefined)}
      mobileTitle={project.name}
    >
      {!context.fullscreen && header}
      {isFullBleed ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {alerts && !context.fullscreen && <div className="shrink-0 px-4 pt-3 sm:px-5">{alerts}</div>}
          <LazyOutlet context={context} />
        </div>
      ) : (
        <div className={PROJECT_TAB_PAD}>
          {alerts && <div className="mb-6">{alerts}</div>}
          <LazyOutlet context={context} />
        </div>
      )}
    </DashboardLayout>
  )
}

function sectionTitle(section: string, t: (vi: string, en: string) => string): string {
  switch (section) {
    case 'my-work':
      return t('Việc của tôi', 'My work')
    case 'overview':
      return t('Tổng quan dự án', 'Project overview')
    case 'documents':
      return t('Tài liệu', 'Documents')
    case 'kanban':
      return 'Kanban'
    case 'tests':
      return 'Test cases'
    case 'workflow':
      return 'Workflow'
    case 'members':
      return t('Thành viên', 'Members')
    case 'settings':
      return t('Cài đặt', 'Settings')
    default:
      return ''
  }
}
