import clsx from 'clsx'
import type { ReactNode } from 'react'

type Tone = 'error' | 'success' | 'info' | 'warning'

const toneClasses: Record<Tone, string> = {
  error: 'bg-red-50 text-red-700 border-red-200',
  success: 'bg-brand-50 text-brand-700 border-brand-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
}

export function Alert({ tone = 'info', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div className={clsx('rounded-md border px-4 py-3 text-sm', toneClasses[tone])} role="alert">
      {children}
    </div>
  )
}
