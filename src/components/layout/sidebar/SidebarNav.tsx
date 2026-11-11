import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { ArrowLeftIcon, MenuIcon } from '@/components/ui/icons'
import { ProjectSquare } from '@/components/ui/ProjectSquare'
import { useI18n } from '@/i18n'
import type { SignalDot } from '@/lib/myWorkRules'
import type { ProjectDto } from '@/types/project'
import { ICON, initialsOf, type NavItem } from './shared'

const itemClass = (active: boolean, disabled = false) =>
  clsx(
    'flex h-11 w-full items-center gap-2.5 rounded-control px-2.5 text-sm transition-colors lg:h-9',
    active
      ? 'bg-white font-medium text-gray-950 shadow-xs ring-1 ring-gray-200'
      : disabled
        ? 'cursor-not-allowed text-gray-500'
        : 'text-gray-600 hover:bg-gray-200/60 hover:text-gray-950',
  )

function NavLinkItem({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate: () => void }) {
  const { t } = useI18n()
  if (item.comingSoon || !item.to) {
    return (
      <button type="button" disabled title={t('Sắp ra mắt', 'Coming soon')} className={itemClass(active, true)}>
        <span className="text-gray-400">{item.icon}</span>
        <span className="flex-1 text-left">{item.label}</span>
        <span className="rounded-[4px] border border-gray-300 px-1 text-[11px] leading-4 text-gray-500">
          {t('Sắp có', 'Soon')}
        </span>
      </button>
    )
  }
  return (
    <Link to={item.to} aria-current={active ? 'page' : undefined} className={itemClass(active)} onClick={onNavigate}>
      <span className={active ? 'text-brand-600' : 'text-gray-500'}>{item.icon}</span>
      <span className="flex-1 truncate text-left">{item.label}</span>
    </Link>
  )
}

interface MainNavProps {
  items: NavItem[]
  /** Nhóm "Quản trị công ty" — đã lọc theo quyền; rỗng thì không hiện. */
  adminItems: NavItem[]
  isActive: (item: NavItem) => boolean
  recentProjects: ProjectDto[]
  currentProjectId: number
  signalOf: (projectId: number) => SignalDot
  onNavigate: () => void
}

export function MainNav({
  items,
  adminItems,
  isActive,
  recentProjects,
  currentProjectId,
  signalOf,
  onNavigate,
}: MainNavProps) {
  const { t } = useI18n()
  return (
    <nav aria-label={t('Điều hướng chính', 'Main navigation')} className="flex-1 space-y-0.5 overflow-y-auto px-3 pt-2">
      {items.map((item) => (
        <NavLinkItem key={item.label} item={item} active={isActive(item)} onNavigate={onNavigate} />
      ))}
      {adminItems.length > 0 && (
        <div className="pt-5">
          <p className="px-2.5 pb-1.5 text-xs font-medium text-gray-500">{t('Quản trị công ty', 'Company admin')}</p>
          <div className="space-y-0.5">
            {adminItems.map((item) => (
              <NavLinkItem key={item.label} item={item} active={isActive(item)} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      )}
      {recentProjects.length > 0 && (
        <div className="pt-5">
          <p className="px-2.5 pb-1.5 text-xs font-medium text-gray-500">{t('Dự án gần đây', 'Recent projects')}</p>
          <ul className="space-y-0.5">
            {recentProjects.map((p) => {
              const active = p.projectId === currentProjectId
              return (
                <li key={p.projectId}>
                  <Link
                    to={`/projects/${p.projectId}`}
                    aria-current={active ? 'page' : undefined}
                    onClick={onNavigate}
                    className={itemClass(active)}
                  >
                    <ProjectSquare projectId={p.projectId} name={p.name} />
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <RecentDot signal={signalOf(p.projectId)} />
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </nav>
  )
}

export function AdminNav({
  items,
  isActive,
  companyName,
  onNavigate,
}: {
  items: NavItem[]
  isActive: (item: NavItem) => boolean
  companyName: string
  onNavigate: () => void
}) {
  const { t } = useI18n()
  return (
    <nav aria-label={t('Quản trị', 'Admin')} className="flex-1 space-y-0.5 overflow-y-auto px-3 pt-1 lg:pt-3">
      <Link
        to="/"
        className="mb-2 flex h-11 items-center gap-2 rounded-control px-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200/60 hover:text-gray-950 lg:h-9"
        onClick={onNavigate}
      >
        <ArrowLeftIcon className="h-4 w-4" />
        {t('Quay lại', 'Back')}
      </Link>
      <p className="truncate px-2.5 pb-1.5 text-xs text-gray-500">
        {t('Công ty', 'Company')} · {companyName}
      </p>
      {items.map((item) => (
        <NavLinkItem key={item.label} item={item} active={isActive(item)} onNavigate={onNavigate} />
      ))}
    </nav>
  )
}

const railIcon = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-control transition-colors'

/** Dải icon 56px (tab Tài liệu trên desktop): ☰ mở lại sidebar đầy đủ dạng lớp phủ. */
export function RailNav({
  items,
  isActive,
  recentProjects,
  currentProjectId,
  companyName,
  workspaceName,
  onExpand,
  accountMenu,
}: {
  items: NavItem[]
  isActive: (item: NavItem) => boolean
  recentProjects: ProjectDto[]
  currentProjectId: number
  companyName: string
  workspaceName: string | undefined
  onExpand: () => void
  accountMenu: ReactNode
}) {
  const { t } = useI18n()
  return (
    <div className="flex h-full flex-col items-center gap-1 py-2">
      <button
        type="button"
        onClick={onExpand}
        title={t('Mở rộng thanh bên', 'Expand sidebar')}
        aria-label={t('Mở rộng thanh bên', 'Expand sidebar')}
        aria-expanded={false}
        className={clsx(railIcon, 'text-gray-600 hover:bg-gray-200/60 hover:text-gray-950')}
      >
        <MenuIcon className={ICON} />
      </button>
      <span
        title={workspaceName ? `${companyName} · ${workspaceName}` : companyName}
        className="mb-1.5 mt-1 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[7px] bg-brand-600 text-xs font-bold text-white"
      >
        {initialsOf(companyName)}
      </span>
      <nav
        aria-label={t('Điều hướng chính', 'Main navigation')}
        className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto"
      >
        {items.map((item) => {
          if (item.comingSoon || !item.to) {
            return (
              <span
                key={item.label}
                title={`${item.label} · ${t('Sắp có', 'Soon')}`}
                aria-disabled="true"
                className={clsx(railIcon, 'cursor-not-allowed text-gray-400')}
              >
                {item.icon}
                <span className="sr-only">{item.label}</span>
              </span>
            )
          }
          const active = isActive(item)
          return (
            <Link
              key={item.label}
              to={item.to}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                railIcon,
                active
                  ? 'bg-white text-brand-600 shadow-xs ring-1 ring-gray-200'
                  : 'text-gray-500 hover:bg-gray-200/60 hover:text-gray-950',
              )}
            >
              {item.icon}
            </Link>
          )
        })}
        {recentProjects.length > 0 && <span aria-hidden="true" className="my-1.5 w-6 border-t border-gray-300" />}
        {recentProjects.map((p) => {
          const active = p.projectId === currentProjectId
          return (
            <Link
              key={p.projectId}
              to={`/projects/${p.projectId}`}
              title={p.name}
              aria-label={p.name}
              aria-current={active ? 'page' : undefined}
              className={clsx(railIcon, 'hover:bg-gray-200/60')}
            >
              <ProjectSquare projectId={p.projectId} name={p.name} size="md" active={active} />
            </Link>
          )
        })}
      </nav>
      <div className="pt-1">{accountMenu}</div>
    </div>
  )
}

function RecentDot({ signal }: { signal: SignalDot }) {
  const { t } = useI18n()
  if (!signal) return null
  const label =
    signal === 'red'
      ? t('Có tài liệu bị yêu cầu sửa', 'A document has changes requested')
      : t('Có việc cần bạn', 'Has work for you')
  return (
    <span
      title={label}
      className={clsx('h-[7px] w-[7px] shrink-0 rounded-full', signal === 'red' ? 'bg-red-600' : 'bg-[#f79009]')}
    >
      <span className="sr-only">{label}</span>
    </span>
  )
}
