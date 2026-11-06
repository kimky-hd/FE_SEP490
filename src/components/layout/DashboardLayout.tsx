import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { useAuth } from '@/context/AuthContext'
import { CloseIcon, MenuIcon } from '@/components/ui/icons'
import { useI18n } from '@/i18n'
import { useRecentProjects } from '@/lib/recentProjects'
import { useWorkItems } from '@/lib/useMyWork'
import { documentsSignal } from '@/lib/myWorkRules'
import { AccountMenu } from './sidebar/AccountMenu'
import { AdminNav, MainNav, RailNav } from './sidebar/SidebarNav'
import { WorkspaceSwitcher } from './sidebar/WorkspaceSwitcher'
import { getAdminNavItems, getNavItems, type NavItem } from './sidebar/shared'
import { HelpProvider } from '@/help/HelpProvider'

/**
 * Lề + bề rộng chuẩn của thân mọi trang (trừ tab Tài liệu, vốn tràn sát mép): dùng hết khung trắng,
 * màn rất rộng thì giới hạn 1440px và căn giữa. Header dạng dải (dự án, workspace) tự đặt lề riêng.
 */
export const PAGE_BODY = 'mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8'

const DESKTOP_QUERY = '(min-width: 1024px)'

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(DESKTOP_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY)
    const onChange = () => setIsDesktop(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return isDesktop
}

// Shell "inset": sidebar nằm trên nền xám, nội dung là một tấm trắng bo góc tách riêng.
// Đầu sidebar: bộ chuyển workspace. Đáy: avatar mở menu (ngôn ngữ, quản trị, đăng xuất).
// Ở /admin/* sidebar đổi sang menu quản trị, có nút quay lại.
export function DashboardLayout({
  children,
  workspaceId,
  fullscreen = false,
  projectNav,
  accountHint,
  mobileTitle,
}: {
  children: ReactNode
  /** Workspace đang làm việc khi URL không chứa nó (vd. trang dự án). */
  workspaceId?: number
  /** Chế độ toàn màn hình (tab Tài liệu): ẩn sidebar và thanh trên mobile, nội dung phủ kín cửa sổ. */
  fullscreen?: boolean
  /** Trong dự án: sidebar trở thành menu của dự án (thay ô workspace + menu công ty). */
  projectNav?: ReactNode
  /** Dòng phụ dưới tên ở nút tài khoản (vd "QA · Checkout"), mặc định là email. */
  accountHint?: string
  /** Tiêu đề thanh trên cùng ở mobile. */
  mobileTitle?: string
}) {
  const { user, currentCompany, workspaces, can } = useAuth()
  const { t } = useI18n()
  const { pathname } = useLocation()
  const isDesktop = useIsDesktop()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [railOpen, setRailOpen] = useState(false)
  const closeMobileNav = () => setMobileNavOpen(false)

  const companyName = currentCompany?.companyName ?? t('Không gian cá nhân', 'Personal space')
  const navItems = getNavItems(t)
  const adminItems = currentCompany
    ? getAdminNavItems(t).filter((item) => !item.permission || can(item.permission))
    : []
  const activeWorkspaceId = workspaceId ?? Number(pathname.match(/^\/workspaces\/(\d+)/)?.[1] ?? NaN)
  const activeWorkspace = workspaces.find((w) => w.workspaceId === activeWorkspaceId)
  const inAdmin = pathname.startsWith('/admin')
  // Trang dự án / workspace dùng cả khung trắng, sát mép (layout tự đặt lề): header là một dải ngang.
  const fullWidth =
    /^\/(projects|workspaces)\/\d+(\/|$)/.test(pathname) && !/^\/workspaces\/\d+\/projects\/new/.test(pathname)
  // Tab Tài liệu & Kiểm thử: khung trắng cao đúng cửa sổ (cây trang + trang tự cuộn bên trong), sidebar thu thành dải icon 56px.
  const fill = /^\/projects\/\d+\/(documents|tests)(\/|$)/.test(pathname)
  const currentProjectId = Number(pathname.match(/^\/projects\/(\d+)/)?.[1] ?? NaN)
  const recentProjects = useRecentProjects(user?.id, currentCompany?.companyId ?? null)
  // Trong dự án sidebar đã là menu dự án nên không thu thành dải icon nữa.
  const rail = fill && isDesktop && !fullscreen && !projectNav
  useEffect(() => {
    setRailOpen(false)
    setMobileNavOpen(false)
  }, [pathname])
  // Chấm tín hiệu cạnh "Dự án gần đây": dự án có việc gấp cho tôi (đỏ = bị yêu cầu sửa, cam = cần xem).
  const recentWork = useWorkItems(projectNav ? null : recentProjects)

  useEffect(() => {
    if (!mobileNavOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileNavOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileNavOpen])

  // Dự án đang mở đã sáng ở nhóm "Dự án gần đây" thì mục "Dự án" không sáng nữa.
  const projectShownInRecent = recentProjects.some((p) => p.projectId === currentProjectId)
  const isActive = (item: NavItem) =>
    item.to !== undefined &&
    (item.to === '/projects' && projectShownInRecent
      ? false
      : item.activePrefix
        ? pathname.startsWith(item.activePrefix)
        : item.to === pathname)

  const railNav = (
    <RailNav
      items={navItems}
      isActive={isActive}
      recentProjects={recentProjects}
      currentProjectId={currentProjectId}
      companyName={companyName}
      workspaceName={activeWorkspace?.workspaceName}
      onExpand={() => setRailOpen(true)}
      accountMenu={<AccountMenu compact adminItems={adminItems} accountHint={accountHint} />}
    />
  )

  const sidebar = (
    <>
      {/* Không đặt logo trên sidebar: ô công ty/workspace ở đầu đã là "danh tính" của khung. Mobile chỉ còn nút đóng. */}
      <div className="flex h-14 items-center justify-end px-3 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          className="flex h-11 w-11 items-center justify-center rounded-control text-gray-600 hover:bg-gray-200/60 lg:hidden"
          aria-label={t('Đóng menu', 'Close menu')}
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>
      {projectNav ?? (
        <>
          {!inAdmin && (
            <div className="px-3 pb-2 lg:pt-3">
              <WorkspaceSwitcher
                companyName={companyName}
                workspaces={workspaces.filter((w) => w.status !== 'ARCHIVED')}
                activeWorkspace={activeWorkspace}
              />
            </div>
          )}
          {inAdmin ? (
            <AdminNav items={adminItems} isActive={isActive} companyName={companyName} onNavigate={closeMobileNav} />
          ) : (
            <MainNav
              items={navItems}
              isActive={isActive}
              recentProjects={recentProjects}
              currentProjectId={currentProjectId}
              signalOf={(id) => documentsSignal(recentWork.byProject.get(id) ?? [])}
              onNavigate={closeMobileNav}
            />
          )}
        </>
      )}
      <div className="p-3">
        <AccountMenu compact={false} adminItems={adminItems} accountHint={accountHint} />
      </div>
    </>
  )

  const mainClass = fullscreen
    ? 'flex h-dvh flex-1 flex-col overflow-hidden bg-white'
    : fill
      ? 'flex h-[calc(100dvh-3.5rem)] flex-1 flex-col overflow-hidden bg-white lg:h-[calc(100dvh-1rem)] lg:rounded-card lg:border lg:border-gray-200 lg:shadow-xs'
      : 'flex-1 bg-white lg:min-h-[calc(100dvh-1rem)] lg:rounded-card lg:border lg:border-gray-200 lg:shadow-xs'

  return (
    <div className="min-h-dvh bg-paper lg:flex">
      {mobileNavOpen && !fullscreen && (
        <button
          type="button"
          aria-label={t('Đóng menu', 'Close menu')}
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-30 bg-gray-950/30 lg:hidden"
        />
      )}
      {rail && railOpen && (
        <>
          {/* Giữ chỗ dải 56px để nội dung không nhảy khi sidebar mở dạng lớp phủ. */}
          <div aria-hidden="true" className="w-14 shrink-0" />
          <button
            type="button"
            aria-label={t('Thu gọn thanh bên', 'Collapse sidebar')}
            onClick={() => setRailOpen(false)}
            className="fixed inset-0 z-30 bg-gray-950/10"
          />
        </>
      )}
      {!fullscreen && (
        <aside
          aria-label={t('Điều hướng', 'Navigation')}
          {...(!isDesktop && !mobileNavOpen ? { inert: '' } : {})}
          className={clsx(
            'fixed inset-y-0 left-0 z-40 flex w-[min(18rem,100vw)] shrink-0 flex-col bg-paper transition-transform duration-200 motion-reduce:transition-none',
            rail && !railOpen ? 'lg:w-14' : 'lg:w-60',
            rail && railOpen ? 'lg:fixed lg:h-dvh lg:shadow-float' : 'lg:sticky lg:top-0 lg:h-dvh',
            'lg:translate-x-0',
            mobileNavOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          {rail && !railOpen ? railNav : sidebar}
        </aside>
      )}

      <div className={clsx('flex min-h-dvh flex-1 flex-col lg:min-w-0', !fullscreen && 'lg:py-2 lg:pr-2')}>
        {!fullscreen && (
          <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-gray-200 bg-paper px-2 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-control text-gray-700 hover:bg-gray-200/60"
              aria-label={t('Mở menu', 'Open menu')}
            >
              <MenuIcon className="h-5 w-5" />
            </button>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-950">
              {mobileTitle ?? (activeWorkspace ? activeWorkspace.workspaceName : companyName)}
            </span>
          </header>
        )}

        <main className={mainClass}>
          {/* Phím "?" mở mẹo của trang (một bộ nghe duy nhất cho các nút "?" trong trang). */}
          <HelpProvider>
            {fill || fullscreen ? (
              <div className="flex min-h-0 flex-1 flex-col">{children}</div>
            ) : (
              <div className={clsx(!fullWidth && PAGE_BODY)}>{children}</div>
            )}
          </HelpProvider>
        </main>
      </div>
    </div>
  )
}
