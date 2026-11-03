import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import clsx from 'clsx'
import type { TabItem } from '@/components/layout/PageParts'

// Khung dùng chung cho mọi tab dự án (Tổng quan · Tài liệu · Workflow · Thành viên · Cài đặt) để các tab hiển thị
// giống hệt nhau: thân tab nhịp `space-y-6`, mỗi phần mở đầu bằng một SectionBar cùng chiều cao.

/** Thân một tab: nhịp dọc chuẩn giữa các phần. */
export function TabBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('space-y-6', className)}>{children}</div>
}

/**
 * Hàng công cụ đầu mỗi phần: trái là tiêu đề (`text-base font-semibold`) + chú thích/số đếm mờ,
 * phải là các nút (secondary/primary, cùng chiều cao). Luôn cao tối thiểu 36px để baseline các tab khớp nhau.
 */
export function SectionBar({
  title,
  caption,
  help,
  actions,
  as: Heading = 'h2',
  className,
}: {
  title: ReactNode
  caption?: ReactNode
  /** Giải thích ngắn hiện khi rê/focus vào dấu "?" — thay cho đoạn văn giải thích đặt đầu tab. */
  help?: string
  actions?: ReactNode
  as?: 'h2' | 'h3'
  className?: string
}) {
  return (
    <div className={clsx('flex min-h-9 flex-wrap items-center justify-between gap-x-3 gap-y-2', className)}>
      <div className="flex min-w-0 items-baseline gap-2">
        <Heading className="truncate text-base font-semibold text-gray-950">{title}</Heading>
        {caption !== undefined && caption !== null && <span className="truncate text-sm text-gray-500">{caption}</span>}
        {help && (
          <span
            tabIndex={0}
            role="img"
            title={help}
            aria-label={help}
            className="flex h-4 w-4 shrink-0 cursor-help items-center justify-center self-center rounded-full border border-gray-300 text-[10px] font-semibold text-gray-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
          >
            ?
          </span>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Một phần của tab: SectionBar + nội dung ngay dưới (cách 12px). */
export function TabSection({
  title,
  caption,
  actions,
  children,
  className,
}: {
  title: ReactNode
  caption?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={clsx('space-y-3', className)}>
      <SectionBar title={title} caption={caption} actions={actions} />
      {children}
    </section>
  )
}

/**
 * Header dạng MỘT dải ngang dùng chung cho dự án và workspace: "Cha /" (crumb nhỏ) · tên · huy hiệu · các tab
 * (· nút phụ bên phải). Màn hẹp: các tab xuống hàng dưới, cuộn ngang nếu thiếu chỗ.
 */
export function EntityHeader({
  crumb,
  title,
  titleHint,
  badges,
  tabs,
  navLabel,
  trailing,
}: {
  crumb?: { label: string; to: string }
  title: string
  /** Tooltip của tên (vd. phương pháp · vai trò). */
  titleHint?: string
  badges?: ReactNode
  tabs: TabItem[]
  navLabel: string
  trailing?: ReactNode
}) {
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-3 border-b border-gray-200 px-4 sm:px-6 lg:h-[52px] lg:flex-nowrap lg:px-5">
      <div className="flex min-w-0 items-center gap-2 py-3 lg:py-0">
        {crumb && (
          <Link
            to={crumb.to}
            className="hidden max-w-[12rem] shrink-0 truncate text-[13px] text-gray-500 hover:text-gray-900 hover:underline sm:inline"
          >
            {crumb.label} /
          </Link>
        )}
        <h1 title={titleHint} className="min-w-0 truncate text-[15px] font-semibold tracking-tight text-gray-950">
          {title}
        </h1>
        {badges}
      </div>
      <nav
        aria-label={navLabel}
        className="order-last -mb-px flex w-full gap-x-5 overflow-x-auto lg:order-none lg:ml-4 lg:w-auto lg:self-stretch"
      >
        {tabs
          .filter((tab) => !tab.hidden)
          .map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                clsx(
                  'flex min-h-11 shrink-0 items-center whitespace-nowrap border-b-2 px-0.5 text-sm transition-colors lg:min-h-0',
                  isActive
                    ? 'border-brand-600 font-medium text-gray-950'
                    : 'border-transparent text-gray-600 hover:text-gray-950',
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
      </nav>
      <span className="flex-1" />
      {trailing}
    </header>
  )
}
