import type { ReactNode } from 'react'
import clsx from 'clsx'

// Không còn "eyebrow" (nhãn nhỏ phía trên tiêu đề). Giữ export để các chỗ cũ không vỡ, nhưng render
// thành một dòng chữ thường cỡ đọc được — chỉ dùng khi nó mang thông tin thật (vd. chân trang).
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={clsx('text-sm font-medium text-gray-500', className)}>{children}</p>
}

// Chip trong dòng dữ liệu: nền nhạt + chữ đậm cùng sắc, viết thường, không bao giờ đặt phía trên tiêu đề.
export function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'brand' | 'amber' }) {
  return (
    <span
      className={clsx(
        'inline-flex flex-none items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium',
        tone === 'neutral' && 'border-gray-200 bg-gray-50 text-gray-700',
        tone === 'brand' && 'border-brand-200 bg-brand-50 text-brand-800',
        tone === 'amber' && 'border-amber-200 bg-amber-50 text-amber-800',
      )}
    >
      {children}
    </span>
  )
}
