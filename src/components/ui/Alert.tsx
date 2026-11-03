import clsx from 'clsx'
import type { ReactNode } from 'react'

type Tone = 'error' | 'success' | 'info' | 'warning'

// Thông báo nằm trong khối liên quan, không phải banner toàn trang. Nền nhạt, không viền.
const toneClasses: Record<Tone, string> = {
  error: 'bg-red-50 text-red-800',
  success: 'bg-success-50 text-success-800',
  info: 'bg-gray-100 text-gray-800',
  warning: 'bg-amber-50 text-amber-900',
}

export function Alert({ tone = 'info', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div className={clsx('rounded-card px-4 py-3 text-sm', toneClasses[tone])} role="alert">
      {children}
    </div>
  )
}
