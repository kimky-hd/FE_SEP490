import type { ReactNode } from 'react'
import clsx from 'clsx'
import { SearchIcon } from '@/components/ui/icons'

// Mảnh ghép nhỏ dùng chung cho các trang Workspace / Dự án / Dashboard / Quản trị (cùng một kiểu bảng, ô tìm kiếm, ô số liệu).

/** Khung bảng: viền mảnh, bo 12px, header nền xám nhạt (STYLE.md §Tables). */
export const tableWrap = 'overflow-hidden rounded-card border border-gray-200 bg-white shadow-xs'
export const theadRow = 'border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500'
export const th = 'px-4 py-2.5 font-medium'

/** Mã ngắn (key dự án, mã workspace) hiển thị dạng chip xám cạnh tên. */
export function CodeChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <code
      className={clsx(
        'inline-flex shrink-0 items-center rounded-[5px] border border-gray-200 bg-gray-50 px-1.5 font-sans text-xs font-medium tabular-nums text-gray-500',
        className,
      )}
    >
      {children}
    </code>
  )
}

export function SearchInput({
  value,
  onChange,
  label,
  placeholder,
  className,
  autoFocus,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder: string
  className?: string
  autoFocus?: boolean
}) {
  return (
    <label className={clsx('relative block', className)}>
      <span className="sr-only">{label}</span>
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-control border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-900 shadow-xs placeholder:text-gray-500 focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-100 lg:h-9"
      />
    </label>
  )
}

/** Bộ lọc 2–3 lựa chọn (Đang hoạt động / Đã lưu trữ). Mục đang chọn là nền trắng nổi trên rãnh xám. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string; count?: number }[]
  label: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex self-start rounded-control border border-gray-200 bg-gray-50 p-0.5 text-sm"
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={clsx(
              'min-h-10 rounded-[6px] px-3 font-medium transition-colors lg:min-h-8',
              active ? 'bg-white text-gray-950 shadow-xs ring-1 ring-gray-200' : 'text-gray-600 hover:text-gray-950',
            )}
          >
            {o.label}
            {o.count !== undefined && <span className="ml-1.5 tabular-nums text-gray-500">{o.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** Ô số liệu đơn giản như bản mẫu: nhãn xám, số lớn, một dòng phụ. */
export function StatBox({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-card border border-gray-200 bg-white px-4 py-3.5 shadow-xs">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-0.5 truncate text-2xl font-semibold tracking-tight text-gray-950">{value}</p>
      {sub && <div className="mt-0.5 truncate text-xs text-gray-500">{sub}</div>}
    </div>
  )
}

/** Vùng nguy hiểm ở cuối trang Cài đặt: viền đỏ, mô tả bên trái, nút bên phải. */
export function DangerZone({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-red-200 bg-white shadow-xs">
      <h2 className="border-b border-red-100 px-5 py-3 text-base font-semibold text-red-700">{title}</h2>
      <div className="divide-y divide-red-100">{children}</div>
    </section>
  )
}

export function DangerRow({ title, description, action }: { title: string; description: string; action: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-950">{title}</p>
        <p className="mt-0.5 text-sm text-gray-600">{description}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  )
}

/** Nút viền đỏ cho hành động phá huỷ / lưu trữ (dùng cùng `buttonClasses({ variant: 'secondary' })`). */
export const dangerOutline = '!border-red-300 !text-red-700 hover:!bg-red-50'

/** Dòng nhãn – giá trị trong thẻ thông tin. */
export function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-gray-500">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-gray-900">{children}</dd>
    </div>
  )
}
