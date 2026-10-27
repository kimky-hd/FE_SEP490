import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { ShieldIcon } from '@/components/ui/icons'
import { Alert } from '@/components/ui/Alert'

// Mảnh ghép dùng chung cho các trang bên trong DashboardLayout (Workspace, Quản trị công ty).

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
}: {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  meta?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-950">{title}</h1>
          {meta}
        </div>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export interface TabItem {
  label: string
  to: string
  end?: boolean
  count?: number
  hidden?: boolean
  /** Module chưa làm — hiện mờ kèm nhãn "SỚM", không bấm được. */
  soon?: boolean
}

export function PageTabs({ items }: { items: TabItem[] }) {
  return (
    <div className="mt-6 overflow-x-auto border-b border-gray-200">
      <nav className="-mb-px flex gap-5">
        {items
          .filter((item) => !item.hidden)
          .map((item) =>
            item.soon ? (
              <span
                key={item.to}
                title="Sắp ra mắt"
                className="flex cursor-not-allowed items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-0.5 pb-2.5 text-sm font-medium text-gray-300"
              >
                {item.label}
                <span className="rounded-sm bg-gray-100 px-1 py-0.5 text-[9px] font-semibold text-gray-400">SỚM</span>
              </span>
            ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  'whitespace-nowrap border-b-2 px-0.5 pb-2.5 text-sm font-medium transition-colors',
                  isActive ? 'border-brand-600 text-gray-950' : 'border-transparent text-gray-500 hover:text-gray-800',
                )
              }
            >
              {item.label}
              {item.count !== undefined && <span className="ml-1.5 text-xs text-gray-400">{item.count}</span>}
            </NavLink>
            ),
          )}
      </nav>
    </div>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('rounded-md border border-gray-200 bg-white', className)}>{children}</div>
}

export function SectionTitle({ children, description }: { children: ReactNode; description?: ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-900">{children}</h2>
      {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
    </div>
  )
}

export function LoadingBlock({ label = 'Đang tải…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-md border border-gray-200 bg-white px-6 py-12 text-sm text-gray-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      {label}
    </div>
  )
}

export function ForbiddenState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-gray-200 bg-white px-6 py-12 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-red-50 text-red-500">
        <ShieldIcon className="h-5 w-5" />
      </span>
      <p className="mt-3 text-sm font-semibold text-gray-700">Bạn không có quyền truy cập</p>
      <p className="mt-1 max-w-sm text-xs text-gray-400">
        {message ?? 'Liên hệ Tenant Admin của công ty để được cấp quyền phù hợp.'}
      </p>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert tone="error">
      {message}
      {onRetry && (
        <button type="button" onClick={onRetry} className="ml-2 font-semibold underline underline-offset-2">
          Thử lại
        </button>
      )}
    </Alert>
  )
}
