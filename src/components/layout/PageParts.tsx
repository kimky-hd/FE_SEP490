import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import clsx from 'clsx'
import { ShieldIcon } from '@/components/ui/icons'
import { Alert } from '@/components/ui/Alert'
import { useI18n } from '@/i18n'
import { HelpTips } from '@/help/HelpTips'

// Mảnh ghép dùng chung cho các trang bên trong DashboardLayout (Workspace, Quản trị công ty).

export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('space-y-4', className)}>{children}</div>
}

export interface Crumb {
  label: string
  to?: string
}

export function PageHeader({
  eyebrow,
  crumbs,
  title,
  description,
  actions,
  meta,
  help = true,
}: {
  /** Phạm vi của màn ("// Dự án · CORE"). Hiển thị thành breadcrumb, không phải nhãn trang trí. */
  eyebrow?: string
  /** Breadcrumb có link; ưu tiên hơn `eyebrow`. */
  crumbs?: Crumb[]
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  meta?: ReactNode
  /** Nút "?" mẹo của trang (chỉ hiện khi trang có nội dung trợ giúp). Mặc định bật. */
  help?: boolean
}) {
  const trail = crumbs ?? (eyebrow ? eyebrowToCrumbs(eyebrow) : undefined)
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {trail && <Breadcrumb crumbs={trail} />}
        <div className={clsx('flex flex-wrap items-center gap-2', trail && 'mt-1.5')}>
          <h1 className="text-2xl font-bold tracking-tight text-gray-950">{title}</h1>
          {meta}
        </div>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-gray-600">{description}</p>}
      </div>
      {(actions || help) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 empty:hidden">
          {actions}
          {help && <HelpTips />}
        </div>
      )}
    </div>
  )
}

function eyebrowToCrumbs(trail: string): Crumb[] {
  return trail
    .replace(/^\/\/\s*/, '')
    .split(/\s+·\s+/)
    .filter(Boolean)
    .map((label) => ({ label }))
}

function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  const { t } = useI18n()
  return (
    <nav aria-label={t('Vị trí', 'Breadcrumb')} className="text-sm text-gray-600">
      <ol className="flex flex-wrap items-center gap-1.5">
        {crumbs.map((c, i) => (
          <li key={c.label + i} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden="true">/</span>}
            {c.to ? (
              <Link to={c.to} className="rounded-control py-1 hover:text-gray-950 hover:underline">
                {c.label}
              </Link>
            ) : (
              <span
                className={i === crumbs.length - 1 ? 'text-gray-800' : undefined}
                aria-current={i === crumbs.length - 1 ? 'page' : undefined}
              >
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export interface TabItem {
  label: string
  to: string
  end?: boolean
  count?: number
  hidden?: boolean
  /** Module chưa làm — hiện kèm nhãn "Sắp có", không bấm được. */
  soon?: boolean
}

export function PageTabs({ items }: { items: TabItem[] }) {
  const { t } = useI18n()
  return (
    <div className="mt-6 border-b border-gray-200">
      {/* Trên màn hẹp các tab xuống dòng thay vì cuộn ngang: không tab nào bị khuất mà không có dấu hiệu. */}
      <nav className="-mb-px flex flex-wrap gap-x-6">
        {items
          .filter((item) => !item.hidden)
          .map((item) =>
            item.soon ? (
              <span
                key={item.to}
                title={t('Sắp ra mắt', 'Coming soon')}
                className="flex cursor-not-allowed items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-0.5 pb-2.5 text-sm text-gray-500"
              >
                {item.label}
                <span className="rounded-chip border border-gray-200 px-1 py-px text-[11px] text-gray-500">
                  {t('Sắp có', 'Soon')}
                </span>
              </span>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  clsx(
                    'flex min-h-11 items-end whitespace-nowrap border-b-2 px-0.5 pb-2.5 text-sm transition-colors',
                    isActive
                      ? 'border-brand-600 font-medium text-gray-950'
                      : 'border-transparent text-gray-600 hover:text-gray-950',
                  )
                }
              >
                {item.label}
                {item.count !== undefined && <span className="ml-1.5 tabular-nums text-gray-500">{item.count}</span>}
              </NavLink>
            ),
          )}
      </nav>
    </div>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('rounded-card border border-gray-200 bg-white shadow-xs', className)}>{children}</div>
}

export function SectionTitle({ children, description }: { children: ReactNode; description?: ReactNode }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-gray-950">{children}</h2>
      {description && <p className="mt-0.5 text-sm text-gray-600">{description}</p>}
    </div>
  )
}

export function LoadingBlock({ label }: { label?: string }) {
  const { t } = useI18n()
  return (
    <div className="flex items-center justify-center gap-3 rounded-card border border-gray-200 bg-white px-6 py-12 text-sm text-gray-600">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent motion-reduce:animate-none" />
      {label ?? t('Đang tải…', 'Loading…')}
    </div>
  )
}

export function ForbiddenState({ message }: { message?: string }) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
      <ShieldIcon className="h-5 w-5 text-gray-500" />
      <p className="mt-3 text-sm font-semibold text-gray-950">
        {t('Bạn không có quyền truy cập', 'You do not have access')}
      </p>
      <p className="mt-1 max-w-sm text-sm text-gray-600">
        {message ??
          t(
            'Liên hệ Tenant Admin của công ty để được cấp quyền phù hợp.',
            'Contact your company Tenant Admin to get the right permissions.',
          )}
      </p>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useI18n()
  return (
    <Alert tone="error">
      {message}
      {onRetry && (
        <button type="button" onClick={onRetry} className="ml-2 font-semibold underline underline-offset-2">
          {t('Thử lại', 'Try again')}
        </button>
      )}
    </Alert>
  )
}

/** Trạng thái rỗng dạng khung viền đứt (icon + tiêu đề + mô tả). */
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
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-control border border-gray-200 bg-white text-gray-500 shadow-xs">
        {icon}
      </span>
      <p className="mt-3 text-sm font-semibold text-gray-950">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-gray-600">{description}</p>
    </div>
  )
}
