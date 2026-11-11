import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { useAuth } from '@/context/AuthContext'
import {
  ArrowLeftIcon,
  BeakerIcon,
  CheckIcon,
  DocumentIcon,
  FolderIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon,
  WorkflowIcon,
} from '@/components/ui/icons'
import { FEATURES } from '@/lib/features'
import { moduleAllowed, projectMenu, type ProjectModule, type ProjectRoleKind } from '@/lib/projectRole'
import { hasPermission } from '@/lib/permissions'
import { projectColor, projectInitial, useRecentProjects } from '@/lib/recentProjects'
import { actionableCount, documentsSignal, kanbanSignal, testsSignal, type WorkItem } from '@/lib/myWorkRules'
import { PERMISSIONS } from '@/types/rbac'
import type { ProjectDto } from '@/types/project'
import { useI18n } from '@/i18n'
import { CommandPalette } from './CommandPalette'

// Sidebar khi đang ở trong dự án (mock-sidebar-calm.html): ô dự án (⇅ đổi dự án / về công ty) · ô Tìm (Ctrl K) ·
// "Việc của tôi" · các mục theo vai trò · vạch · Thành viên / Cài đặt. Tín hiệu chỉ là MỘT chấm màu.

const ICON = 'h-[18px] w-[18px]'

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l3 3 5-6" />
    </svg>
  )
}

function PulseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </svg>
  )
}

function KanbanIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="5" height="16" rx="1" />
      <rect x="10" y="4" width="5" height="11" rx="1" />
      <rect x="17" y="4" width="4" height="7" rx="1" />
    </svg>
  )
}

const DOT_CLASS = { red: 'bg-red-600', orange: 'bg-[#f79009]' } as const

export function ProjectSidebar({
  project,
  role,
  items,
}: {
  project: ProjectDto
  role: ProjectRoleKind
  items: WorkItem[]
}) {
  const { t } = useI18n()
  const { user, currentCompany } = useAuth()
  const location = useLocation()
  const base = `/projects/${project.projectId}`
  const menu = projectMenu(role, project.myPermissions, FEATURES)
  const count = actionableCount(items)
  const dots: Partial<Record<ProjectModule, 'red' | 'orange' | null>> = {
    documents: documentsSignal(items),
    kanban: kanbanSignal(items),
    testcases: testsSignal(items),
  }
  const [paletteOpen, setPaletteOpen] = useState(false)
  const writable = project.status !== 'ARCHIVED'
  const menuHas = (m: ProjectModule) => moduleAllowed(m, project.myPermissions, FEATURES)
  const canCreate =
    project.status !== 'ARCHIVED' &&
    (project.myPermissions.includes('*') || project.myPermissions.includes(PERMISSIONS.documentEdit))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => setPaletteOpen(false), [location.pathname])

  const META: Record<ProjectModule, { label: string; icon: ReactNode; to: string; end?: boolean }> = {
    myWork: { label: t('Việc của tôi', 'My work'), icon: <CheckCircleIcon className={ICON} />, to: `${base}/my-work` },
    overview: {
      label: t('Tổng quan dự án', 'Project overview'),
      icon: <PulseIcon className={ICON} />,
      to: `${base}/overview`,
    },
    documents: { label: t('Tài liệu', 'Documents'), icon: <DocumentIcon className={ICON} />, to: `${base}/documents` },
    kanban: { label: 'Kanban', icon: <KanbanIcon className={ICON} />, to: `${base}/kanban` },
    testcases: { label: 'Test cases', icon: <BeakerIcon className={ICON} />, to: `${base}/tests` },
    workflow: { label: 'Workflow', icon: <WorkflowIcon className={ICON} />, to: `${base}/workflow` },
    members: { label: t('Thành viên', 'Members'), icon: <UsersIcon className={ICON} />, to: `${base}/members` },
    settings: { label: t('Cài đặt', 'Settings'), icon: <SettingsIcon className={ICON} />, to: `${base}/settings` },
  }

  const dotLabel = (m: ProjectModule, dot: 'red' | 'orange') =>
    m === 'kanban'
      ? t('Issue của bạn có REQ vừa đổi', 'Your issues have changed REQs')
      : m === 'testcases'
        ? t('Có lượt test của bạn cần chạy lại hoặc bị lỗi', 'Some of your test runs need a rerun or failed')
        : dot === 'red'
          ? t('Có tài liệu bị yêu cầu sửa', 'A document has changes requested')
          : t('Có thay đổi cần xem', 'Changes to look at')

  const renderItem = (m: ProjectModule) => {
    const meta = META[m]
    const dot = dots[m] ?? null
    return (
      <NavLink
        key={m}
        to={meta.to}
        end={meta.end}
        className={({ isActive }) =>
          clsx(
            'flex h-11 w-full items-center gap-2.5 rounded-control px-2.5 text-sm transition-colors lg:h-9',
            isActive
              ? 'bg-white font-medium text-gray-950 shadow-xs ring-1 ring-gray-200'
              : 'text-gray-600 hover:bg-gray-200/60 hover:text-gray-950',
          )
        }
      >
        {({ isActive }) => (
          <>
            <span className={isActive ? 'text-brand-600' : 'text-gray-500'}>{meta.icon}</span>
            <span className="min-w-0 flex-1 truncate">{meta.label}</span>
            {m === 'myWork' && count > 0 && (
              <span className="rounded-full bg-brand-600 px-[7px] text-xs font-medium leading-[18px] text-white tabular-nums">
                {count}
              </span>
            )}
            {dot && (
              <span className={clsx('h-[7px] w-[7px] rounded-full', DOT_CLASS[dot])} title={dotLabel(m, dot)}>
                <span className="sr-only">{dotLabel(m, dot)}</span>
              </span>
            )}
          </>
        )}
      </NavLink>
    )
  }

  return (
    <>
      <div className="px-3 pb-1 lg:pt-3">
        <ProjectSwitcher
          project={project}
          userId={user?.id}
          companyId={currentCompany?.companyId ?? null}
          companyName={currentCompany?.companyName ?? t('Chưa có công ty', 'No company')}
        />
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="mt-1.5 flex h-11 w-full items-center gap-2 rounded-control border border-gray-200 bg-white px-2.5 text-[13px] text-gray-500 shadow-xs transition-colors hover:border-gray-300 lg:h-[34px]"
          aria-label={t('Tìm (Ctrl K)', 'Search (Ctrl K)')}
        >
          <SearchIcon className="h-4 w-4 text-gray-400" />
          <span className="flex-1 text-left">{t('Tìm…', 'Search…')}</span>
          <kbd className="hidden rounded-[4px] border border-gray-200 px-1 font-sans text-[11px] text-gray-500 lg:inline">
            Ctrl K
          </kbd>
        </button>
      </div>
      <nav aria-label={t('Mục dự án', 'Project sections')} className="flex-1 space-y-0.5 overflow-y-auto px-3 pt-2">
        {menu.main.map(renderItem)}
        {menu.tail.length > 0 && <div aria-hidden="true" className="mx-2 my-2.5 h-px bg-gray-200" />}
        {menu.tail.map(renderItem)}
      </nav>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        projectId={project.projectId}
        canCreate={canCreate}
        searchIssues={menuHas('kanban')}
        searchTests={menuHas('testcases')}
        canCreateIssue={writable && menuHas('kanban') && hasPermission(project.myPermissions, PERMISSIONS.issueCreate)}
        canCreateTest={
          writable && menuHas('testcases') && hasPermission(project.myPermissions, PERMISSIONS.testCaseManage)
        }
      />
    </>
  )
}

function ProjectSwitcher({
  project,
  userId,
  companyId,
  companyName,
}: {
  project: ProjectDto
  userId: number | undefined
  companyId: number | null
  companyName: string
}) {
  const { t } = useI18n()
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const projects = useRecentProjects(userId, companyId, 8)

  useEffect(() => setOpen(false), [location.pathname])
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const itemClass =
    'flex min-h-11 w-full items-center gap-2.5 rounded-[6px] px-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-950 lg:min-h-9'

  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="project-switcher-list"
        aria-label={`${t('Đổi dự án. Đang ở', 'Switch project. Current')}: ${project.name}`}
        className={clsx(
          'flex min-h-11 w-full items-center gap-2.5 rounded-control border px-2 py-1.5 text-left transition-colors',
          open ? 'border-gray-200 bg-white shadow-xs' : 'border-transparent hover:bg-gray-200/60',
        )}
      >
        <span
          aria-hidden="true"
          style={{ backgroundColor: projectColor(project.projectId) }}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-xs font-bold text-white"
        >
          {projectInitial(project.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium leading-tight text-gray-950">{project.name}</span>
          <span className="block truncate text-xs text-gray-500">{project.key}</span>
        </span>
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-gray-400"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div
          id="project-switcher-list"
          className="absolute left-0 top-full z-30 mt-1 w-full min-w-[15rem] rounded-card border border-gray-200 bg-white p-1.5 shadow-pop"
        >
          <p className="px-2.5 pb-1 pt-1 text-xs text-gray-500">{t('Dự án', 'Projects')}</p>
          {projects.map((p) => {
            const current = p.projectId === project.projectId
            return (
              <Link
                key={p.projectId}
                to={`/projects/${p.projectId}`}
                className={clsx(itemClass, current && 'bg-gray-100 text-gray-950')}
              >
                <span
                  aria-hidden="true"
                  style={{ backgroundColor: projectColor(p.projectId) }}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] text-[10px] font-bold text-white"
                >
                  {projectInitial(p.name)}
                </span>
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                {current && <CheckIcon className="h-4 w-4 shrink-0 text-brand-600" />}
              </Link>
            )
          })}
          <div className="mt-1 border-t border-gray-100 pt-1">
            <Link to="/projects" className={itemClass}>
              <FolderIcon className="h-4 w-4 text-gray-500" />
              {t('Tất cả dự án', 'All projects')}
            </Link>
            <Link to="/" className={itemClass}>
              <ArrowLeftIcon className="h-4 w-4 text-gray-500" />
              <span className="min-w-0 flex-1 truncate">{t(`Về ${companyName}`, `Back to ${companyName}`)}</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
