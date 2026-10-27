import { type InputHTMLAttributes, forwardRef, type ReactNode } from 'react'
import clsx from 'clsx'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  icon?: ReactNode
  trailing?: ReactNode
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, hint, error, icon, trailing, className, id, ...rest }, ref) => {
    const inputId = id ?? rest.name
    const errorId = inputId ? `${inputId}-error` : undefined
    return (
      <div className="w-full">
        {label && (
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <label htmlFor={inputId} className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-gray-500">
              {label}
            </label>
            {hint && <span className="text-xs text-gray-400">{hint}</span>}
          </div>
        )}
        <div className="relative">
          {icon && (
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={clsx(
              'h-10 w-full rounded-md border bg-white text-sm text-gray-900 placeholder:text-gray-400',
              'transition-shadow focus:outline-none focus:ring-2 focus:ring-brand-500/25',
              'disabled:bg-gray-50 disabled:text-gray-500',
              icon ? 'pl-9' : 'pl-3',
              trailing ? 'pr-12' : 'pr-3',
              error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : 'border-gray-300 focus:border-brand-600',
              className,
            )}
            {...rest}
          />
          {trailing && <span className="absolute inset-y-0 right-3 flex items-center">{trailing}</span>}
        </div>
        {error && (
          <p id={errorId} className="mt-1.5 text-xs text-red-600">
            {error}
          </p>
        )}
      </div>
    )
  },
)
TextField.displayName = 'TextField'
