import type { ReactNode } from 'react'
import clsx from 'clsx'

// Nhãn mono viết hoa dùng mở đầu mọi khối nội dung (Landing + Auth/Onboarding) — thay cho icon tròn
// căn giữa. Giữ "giọng" tài liệu kỹ thuật xuyên suốt app, không riêng gì trang chủ.
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={clsx('font-mono text-xs uppercase tracking-[0.18em] text-gray-500', className)}>{children}</p>
}

export function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'brand' | 'amber' }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em]',
        tone === 'neutral' && 'border-gray-300 text-gray-600',
        tone === 'brand' && 'border-brand-200 bg-brand-50 text-brand-700',
        tone === 'amber' && 'border-amber-200 bg-amber-50 text-amber-800',
      )}
    >
      {children}
    </span>
  )
}
