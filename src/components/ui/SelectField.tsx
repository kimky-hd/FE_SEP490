import { type SelectHTMLAttributes, forwardRef } from 'react'
import clsx from 'clsx'
import { ChevronDownIcon } from './icons'

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: string
  error?: string
  /** Bản gọn đặt trong ô bảng (không label, cao 8). */
  compact?: boolean
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, hint, error, compact, className, id, children, ...rest }, ref) => {
    const selectId = id ?? rest.name
    return (
      <div className={compact ? undefined : 'w-full'}>
        {label && (
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <label htmlFor={selectId} className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-gray-500">
              {label}
            </label>
            {hint && <span className="text-xs text-gray-400">{hint}</span>}
          </div>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={error ? true : undefined}
            className={clsx(
              'w-full appearance-none rounded-md border bg-white pl-3 pr-8 text-gray-900',
              'transition-shadow focus:outline-none focus:ring-2 focus:ring-brand-500/25',
              'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
              compact ? 'h-8 text-xs' : 'h-10 text-sm',
              error ? 'border-red-400 focus:border-red-500' : 'border-gray-300 focus:border-brand-600',
              className,
            )}
            {...rest}
          >
            {children}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>
        {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
      </div>
    )
  },
)
SelectField.displayName = 'SelectField'
