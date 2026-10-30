import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import clsx from 'clsx'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ErrorState, ForbiddenState, LoadingBlock } from '@/components/layout/PageParts'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { projectApi } from '@/api/projectApi'
import { documentApi } from '@/api/documentApi'
import { issueApi } from '@/api/issueApi'
import { useAuth } from '@/context/AuthContext'
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

/**
 * Unified Full-Screen Project Workspace Shell (100vw x 100vh)
 * Row 1: Stationary Master Project Header (shared across all 7 tabs: Overview, Specs, Kanban, Test Cases, Workflow, Members, Settings)
 * Row 2: Contextual Module Sub-Toolbar
 * Row 3: Module Viewport (<Outlet />)
 */
export function ProjectLayout() {
  const projectId = Number(useParams().projectId)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, currentCompany } = useAuth()

  const { data: project, error, isLoading, reload, setData } = useAsync(() => projectApi.get(projectId), [projectId])
  const docStats = useAsync(() => documentApi.getProjectStats(projectId), [projectId])
  const issueStats = useAsync(() => issueApi.getProjectIssueStats(projectId), [projectId])
  const allProjectsAsync = useAsync(() => projectApi.listMine(currentCompany?.companyId ?? null), [currentCompany?.companyId])

  const [switcherOpen, setSwitcherOpen] = useState(false)
  const switcherRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!switcherOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (!switcherRef.current?.contains(e.target as Node)) {
        setSwitcherOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [switcherOpen])

  useEffect(() => {
    setSwitcherOpen(false)
  }, [location.pathname])

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
  const context: ProjectOutletContext = {
    project,
    can,
    isArchived,
    reload,
    setProject: (next) => setData(() => next),
  }

  // Determine active module tab
  const pathname = location.pathname
  const getActiveTab = () => {
    if (pathname.includes('/documents')) return 'documents'
    if (pathname.includes('/issues') || pathname.includes('/kanban')) return 'issues'
    if (pathname.includes('/testcases')) return 'testcases'
    if (pathname.includes('/workflow')) return 'workflow'
    if (pathname.includes('/members')) return 'members'
    if (pathname.includes('/settings')) return 'settings'
    return 'overview'
  }
  const activeTab = getActiveTab()

  // Switch project while keeping the current active sub-tab
  const handleSwitchProject = (targetProjectId: number) => {
    setSwitcherOpen(false)
    const subPath = activeTab === 'overview' ? '' : `/${activeTab}`
    navigate(`/projects/${targetProjectId}${subPath}`)
  }

  const isFullCanvasTab =
    activeTab === 'documents' || activeTab === 'issues' || activeTab === 'testcases'

  const navTabs = [
    { key: 'overview', icon: '📊', label: 'Overview', to: base, count: undefined, hidden: false },
    {
      key: 'documents',
      icon: '📄',
      label: 'Documents',
      to: `${base}/documents`,
      count: docStats.data?.totalDocs,
      hidden: false,
    },
    {
      key: 'issues',
      icon: '📋',
      label: 'Issues',
      to: `${base}/issues`,
      count: issueStats.data?.open,
      hidden: false,
    },
    {
      key: 'testcases',
      icon: '🧪',
      label: 'Test Cases',
      to: `${base}/testcases`,
      count: undefined,
      hidden: false,
    },
    {
      key: 'workflow',
      icon: '🔄',
      label: 'Workflow',
      to: `${base}/workflow`,
      count: project.phaseCount,
      hidden: false,
    },
    {
      key: 'members',
      icon: '👥',
      label: 'Members',
      to: `${base}/members`,
      count: project.memberCount,
      hidden: !can(PERMISSIONS.projectView),
    },
    {
      key: 'settings',
      icon: '⚙️',
      label: 'Settings',
      to: `${base}/settings`,
      count: undefined,
      hidden: !can(PERMISSIONS.projectUpdate) && !can(PERMISSIONS.projectArchive),
    },
  ].filter((t) => !t.hidden)

  const projectList = allProjectsAsync.data ?? []

  return (
    <div className="fixed inset-0 z-40 flex h-screen w-screen flex-col bg-slate-50 text-slate-900 overflow-hidden">
      {/* =================================================================== */}
      {/* ROW 1: MASTER PROJECT HEADER (56PX — 100% IDENTICAL ACROSS ALL TABS) */}
      {/* =================================================================== */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between gap-3 shrink-0 shadow-2xs z-30">
        {/* LEFT ZONE: PORTAL EXIT + PROJECT SPACE SWITCHER + NEW TAB BUTTON */}
        <div className="flex items-center gap-2 shrink-0 min-w-0">
          <Link
            to={`/workspaces/${project.workspaceId}/projects`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-700 transition-colors shrink-0"
            title="Exit Project Space and return to Organization Portal"
          >
            <span>← Portal</span>
          </Link>

          <span className="h-4 w-px bg-slate-200 shrink-0" />

          {/* Project Space Switcher Dropdown */}
          <div className="relative" ref={switcherRef}>
            <button
              type="button"
              onClick={() => setSwitcherOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200/90 bg-white hover:bg-slate-50 px-2.5 py-1 text-left transition-colors shadow-2xs"
              title="Switch to another Project Space"
            >
              <span className="rounded bg-blue-600 px-1.5 py-0.5 font-mono text-[11px] font-bold text-white shrink-0">
                {project.key}
              </span>
              <span className="font-extrabold text-sm text-slate-900 truncate max-w-[140px] xl:max-w-[200px]">
                {project.name}
              </span>
              <span className="text-[10px] text-slate-400">▾</span>
            </button>

            {switcherOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-80 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl z-50">
                <div className="px-2.5 py-1.5 border-b border-slate-100 flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Switch Project Space
                  </span>
                  <span className="text-[10px] text-slate-400">{projectList.length} projects</span>
                </div>
                <div className="max-h-64 overflow-y-auto py-1 space-y-0.5">
                  {projectList.map((p) => {
                    const isCurrent = p.projectId === project.projectId
                    const subPath = activeTab === 'overview' ? '' : `/${activeTab}`
                    const targetHref = `/projects/${p.projectId}${subPath}`
                    return (
                      <div
                        key={p.projectId}
                        className={clsx(
                          'flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors',
                          isCurrent ? 'bg-blue-50 text-blue-900 font-bold' : 'hover:bg-slate-50 text-slate-700',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => handleSwitchProject(p.projectId)}
                          className="flex items-center gap-2 min-w-0 flex-1 text-left"
                        >
                          <span className="rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700 shrink-0">
                            {p.key}
                          </span>
                          <span className="truncate">{p.name}</span>
                        </button>
                        <a
                          href={targetHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title={`Open ${p.name} in a new browser tab`}
                          className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 shrink-0"
                        >
                          ↗
                        </a>
                      </div>
                    )
                  })}
                </div>
                <div className="border-t border-slate-100 pt-1 mt-1 flex items-center justify-between px-2 py-1">
                  <Link
                    to="/projects"
                    className="text-xs font-semibold text-blue-600 hover:underline"
                  >
                    📁 View all projects in Portal →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Open Current Project Space in New Browser Tab */}
          <a
            href={location.pathname}
            target="_blank"
            rel="noopener noreferrer"
            title="Open this Project Space in a new browser tab"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors shrink-0"
          >
            ↗
          </a>
        </div>

        {/* CENTER ZONE: STATIONARY 7-TAB PROJECT NAVIGATION BAR */}
        <nav
          aria-label="Project space modules"
          className="flex items-center gap-1 rounded-xl border border-slate-200/90 bg-slate-100/90 p-1 text-xs font-semibold shadow-2xs overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden shrink-0"
        >
          {navTabs.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <Link
                key={tab.key}
                to={tab.to}
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-all whitespace-nowrap shrink-0',
                  isActive
                    ? 'bg-white text-blue-700 font-bold shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60',
                )}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={clsx(
                      'rounded-full px-1.5 py-0.2 font-mono text-[10px] font-bold',
                      isActive ? 'bg-blue-50 text-blue-700' : 'bg-slate-200/80 text-slate-600',
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* RIGHT ZONE: PROJECT STATUS & USER IDENTITY */}
        <div className="hidden xl:flex items-center gap-2 shrink-0">
          {isArchived ? (
            <Badge tone="amber">Archived</Badge>
          ) : (
            <Badge tone="brand" dot>
              Active
            </Badge>
          )}
          <Badge>{SDLC_LABEL[project.sdlcMethod]}</Badge>
          {project.myRole && (
            <Badge tone={project.myRole.code === 'PROJECT_MANAGER' ? 'brand' : 'blue'}>
              {project.myRole.name}
            </Badge>
          )}
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 border border-blue-200 shrink-0"
            title={user?.fullName || 'Current User'}
          >
            {(user?.fullName ?? 'U').slice(0, 1).toUpperCase()}
          </div>
        </div>
      </header>

      {/* =================================================================== */}
      {/* ROW 2 & 3: DYNAMIC MODULE VIEWPORT                                  */}
      {/* =================================================================== */}
      {isFullCanvasTab ? (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
          <Outlet context={context} />
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* ROW 2: CONTEXTUAL SUB-TOOLBAR FOR OVERVIEW / WORKFLOW / MEMBERS / SETTINGS */}
          <div className="h-10 bg-slate-100/90 border-b border-slate-200/80 px-6 flex items-center justify-between gap-4 text-xs text-slate-600 shrink-0">
            <div className="flex items-center gap-2 min-w-0 truncate">
              <span className="font-semibold text-slate-700">🏢 {project.workspaceName}</span>
              {project.description && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="truncate text-slate-500">{project.description}</span>
                </>
              )}
            </div>
            <div className="hidden sm:flex items-center gap-3 shrink-0 font-mono text-[11px] text-slate-500">
              <span>📄 {docStats.data?.totalDocs ?? 0} Documents</span>
              <span>·</span>
              <span>📋 {issueStats.data?.open ?? 0} Open Issues</span>
              <span>·</span>
              <span>👥 {project.memberCount} Members</span>
            </div>
          </div>

          {/* ROW 3: SCROLLABLE STANDARD PAGE BODY */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mx-auto max-w-7xl space-y-4">
              {justCreated && (
                <Alert tone="success">
                  Project <b>{project.name}</b> has been created with {project.phaseCount} phases and{' '}
                  {project.memberCount} members. You are the Project Manager of this project.
                </Alert>
              )}
              {isArchived && (
                <Alert tone="warning">
                  This project is archived — all documents, issues, and configurations are read-only.
                </Alert>
              )}
              <Outlet context={context} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
