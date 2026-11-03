import type { ReactNode } from 'react'
import clsx from 'clsx'

type Tone = 'neutral' | 'brand' | 'success' | 'amber' | 'red' | 'blue'

// Viên trạng thái: nền nhạt + viền cùng sắc. `brand` giữ nghĩa cũ "ổn / đang hoạt động" (xanh lá); `blue` là xanh thương hiệu.
const toneClasses: Record<Tone, string> = {
  neutral: 'border-gray-200 bg-gray-50 text-gray-700',
  brand: 'border-success-200 bg-success-50 text-success-700',
  success: 'border-success-200 bg-success-50 text-success-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  red: 'border-red-200 bg-red-50 text-red-700',
  blue: 'border-brand-200 bg-brand-50 text-brand-800',
}

// Nhãn trạng thái gọn trong bảng/thẻ (Active, Hệ thống, Nhạy cảm…). Một dấu trạng thái mỗi dòng.
export function Badge({ children, tone = 'neutral', dot }: { children: ReactNode; tone?: Tone; dot?: boolean }) {
  return (
    <span
      className={clsx(
        'inline-flex flex-none items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium',
        toneClasses[tone],
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}
