import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { useAuth } from '@/context/AuthContext'
import { Logo } from '@/components/ui/Logo'
import {
  BellIcon,
  BuildingIcon,
  ChevronDownIcon,
  CloseIcon,
  DocumentIcon,
  FolderIcon,
  HomeIcon,
  ListChecksIcon,
  LogoutIcon,
  MenuIcon,
  ShieldIcon,
  UsersIcon,
} from '@/components/ui/icons'
import { PERMISSIONS } from '@/types/rbac'

interface NavItem {
  label: string
  icon: ReactNode
  to?: string
  comingSoon?: boolean
  /** Mục active khi pathname bắt đầu bằng prefix này (mặc định so khớp tuyệt đối với `to`). */
  activePrefix?: string
  /** Chỉ hiện khi người dùng có quyền cấp công ty này. */
  permission?: string
}

// Organization Admin Console — hidden if lacking permission.
const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    label: 'Roles & Permissions',
    icon: <ShieldIcon className="h-5 w-5" />,
    to: '/admin/roles',
    activePrefix: '/admin/roles',
    permission: PERMISSIONS.roleView,
  },
  {
    label: 'Users',
    icon: <UsersIcon className="h-5 w-5" />,
    to: '/admin/users',
    activePrefix: '/admin/users',
    permission: PERMISSIONS.userView,
  },
]

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, currentCompany, workspaces, can } = useAuth()
  const location = useLocation()
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const workspaceMenuRef = useRef<HTMLDivElement>(null)
  const currentCompanyName = currentCompany?.companyName ?? 'Personal Space'
  const adminItems = currentCompany ? ADMIN_NAV_ITEMS.filter((item) => !item.permission || can(item.permission)) : []
  const activeWorkspaceId = Number(location.pathname.match(/^\/workspaces\/(\d+)/)?.[1] ?? NaN)
  const activeWorkspace = workspaces.find((w) => w.workspaceId === activeWorkspaceId)
  const switcherWorkspaces = workspaces.filter((w) => w.status !== 'ARCHIVED')

  // Smart contextual navigation based on active project
  const activeProjectId = Number(location.pathname.match(/\/projects\/(\d+)/)?.[1] ?? NaN)

  const navItems: NavItem[] = useMemo(() => {
    const hasProject = !Number.isNaN(activeProjectId)
    return [
      { label: 'Overview', icon: <HomeIcon className="h-5 w-5" />, to: '/' },
      { label: 'Workspaces', icon: <BuildingIcon className="h-5 w-5" />, to: '/workspaces', activePrefix: '/workspaces' },
      { label: 'Projects', icon: <FolderIcon className="h-5 w-5" />, to: '/projects', activePrefix: '/projects' },
      {
        label: 'Requirements',
        icon: <DocumentIcon className="h-5 w-5" />,
        to: hasProject ? `/projects/${activeProjectId}/documents` : '/documents',
        activePrefix: hasProject ? `/projects/${activeProjectId}/documents` : '/documents',
      },
      {
        label: 'Test Cases',
        icon: <ListChecksIcon className="h-5 w-5" />,
        to: hasProject ? `/projects/${activeProjectId}/testcases` : '/testcases',
        activePrefix: hasProject ? `/projects/${activeProjectId}/testcases` : '/testcases',
      },
    ]
  }, [activeProjectId])

  // Close workspace dropdown on outside click or navigation
  useEffect(() => {
    if (!workspaceMenuOpen) return
    const onClick = (e: MouseEvent) => {
      if (!workspaceMenuRef.current?.contains(e.target as Node)) setWorkspaceMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [workspaceMenuOpen])
  useEffect(() => setWorkspaceMenuOpen(false), [location.pathname])

  const renderNavItem = (item: NavItem) => {
    const isActive =
      item.to !== undefined &&
      (item.activePrefix ? location.pathname.startsWith(item.activePrefix) : item.to === location.pathname)
    const itemClassName = clsx(
      'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
      isActive
        ? 'bg-brand-50 text-brand-700'
        : item.comingSoon
          ? 'cursor-not-allowed text-gray-300'
          : 'text-gray-600 hover:bg-gray-50',
    )

    if (item.comingSoon || !item.to) {
      return (
        <button key={item.label} type="button" disabled title="Coming soon" className={itemClassName}>
          {item.icon}
          <span className="flex-1 text-left">{item.label}</span>
          <span className="rounded-sm bg-gray-100 px-1.5 py-0.5 text-[9px] font-semibold text-gray-400">SOON</span>
        </button>
      )
    }

    return (
      <Link key={item.label} to={item.to} className={itemClassName} onClick={() => setMobileNavOpen(false)}>
        {item.icon}
        <span className="flex-1 text-left">{item.label}</span>
      </Link>
    )
  }

  const nav = (
    <>
      <div className="flex h-16 items-center justify-between border-b border-gray-200 px-5">
        <Logo />
        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          className="rounded-md p-1 text-gray-400 hover:bg-gray-50 lg:hidden"
          aria-label="Close menu"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map(renderNavItem)}

        {adminItems.length > 0 && (
          <>
            <p className="px-3 pb-1 pt-5 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-gray-400">
              Organization Admin
            </p>
            {adminItems.map(renderNavItem)}
          </>
        )}
      </nav>

      <div className="border-t border-gray-200 p-3">
        <div className="flex items-center gap-2 rounded-md px-2 py-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
            {(user?.fullName ?? '?').slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">{user?.fullName}</p>
            <p className="truncate text-xs text-gray-400">{user?.email}</p>
          </div>
        </div>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-gray-50 lg:flex">
      {/* Mobile: drawer + backdrop. Desktop (lg+): fixed sidebar */}
      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-30 bg-gray-950/40 lg:hidden"
        />
      )}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-gray-200 bg-white transition-transform duration-200',
          'lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {nav}
      </aside>

      <div className="flex min-h-screen flex-1 flex-col lg:min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="rounded-md p-2 text-gray-500 hover:bg-gray-50 lg:hidden"
              aria-label="Open menu"
            >
              <MenuIcon className="h-5 w-5" />
            </button>

            <div className="relative" ref={workspaceMenuRef}>
              <button
                type="button"
                onClick={() => setWorkspaceMenuOpen((v) => !v)}
                aria-expanded={workspaceMenuOpen}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <span className="max-w-[9rem] truncate sm:max-w-xs">{currentCompanyName}</span>
                {activeWorkspace && (
                  <span className="hidden max-w-[12rem] truncate text-gray-400 sm:inline">/ {activeWorkspace.workspaceName}</span>
                )}
                <ChevronDownIcon className="h-4 w-4 shrink-0 text-gray-400" />
              </button>
              {workspaceMenuOpen && (
                <div className="absolute left-0 top-full z-20 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-md border border-gray-200 bg-white p-1 text-sm shadow-lg">
                  <p className="px-3 pb-1 pt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-gray-400">
                    Switch workspace
                  </p>
                  {switcherWorkspaces.length === 0 && (
                    <p className="px-3 py-2 text-xs text-gray-400">You haven't joined any workspaces yet.</p>
                  )}
                  {switcherWorkspaces.map((w) => (
                    <Link
                      key={w.workspaceId}
                      to={`/workspaces/${w.workspaceId}`}
                      className={clsx(
                        'flex items-center justify-between gap-2 rounded px-3 py-2 hover:bg-gray-50',
                        w.workspaceId === activeWorkspaceId ? 'font-semibold text-brand-700' : 'text-gray-700',
                      )}
                    >
                      <span className="truncate">{w.workspaceName}</span>
                      {w.role && <span className="shrink-0 text-[11px] text-gray-400">{w.role.name}</span>}
                    </Link>
                  ))}
                  <div className="mt-1 border-t border-gray-100 pt-1">
                    <Link to="/workspaces" className="block rounded px-3 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50">
                      View all workspaces →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-3">
            <button type="button" title="Coming soon" className="rounded-md p-2 text-gray-400 hover:bg-gray-50">
              <BellIcon className="h-5 w-5" />
            </button>
            <LogoutButton />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  )
}

function LogoutButton() {
  const { logout } = useAuth()
  return (
    <button
      type="button"
      onClick={() => void logout()}
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 sm:px-3"
    >
      <LogoutIcon className="h-4 w-4" />
      <span className="hidden sm:inline">Log out</span>
    </button>
  )
}

export function DashboardEmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-gray-200 bg-white px-6 py-10 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-100 text-gray-400">{icon}</span>
      <p className="mt-3 text-sm font-semibold text-gray-700">{title}</p>
      <p className="mt-1 max-w-xs text-xs text-gray-400">{description}</p>
    </div>
  )
}

