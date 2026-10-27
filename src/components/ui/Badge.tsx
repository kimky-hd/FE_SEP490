import type { ReactNode } from 'react'
import clsx from 'clsx'

type Tone = 'neutral' | 'brand' | 'amber' | 'red' | 'blue'

const toneClasses: Record<Tone, string> = {
  neutral: 'border-gray-200 bg-gray-50 text-gray-600',
  brand: 'border-brand-200 bg-brand-50 text-brand-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  red: 'border-red-200 bg-red-50 text-red-700',
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
}

// Nhãn trạng thái gọn trong bảng/thẻ (Active, Hệ thống, Nhạy cảm…). Khác `Tag` ở chỗ không viết hoa mono.
export function Badge({ children, tone = 'neutral', dot }: { children: ReactNode; tone?: Tone; dot?: boolean }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-sm border px-1.5 py-0.5 text-[11px] font-medium',
        toneClasses[tone],
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}
