import { type TextareaHTMLAttributes, forwardRef } from 'react'
import clsx from 'clsx'

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  ({ label, hint, error, className, id, rows = 3, ...rest }, ref) => {
    const inputId = id ?? rest.name
    return (
      <div className="w-full">
        {label && (
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <label htmlFor={inputId} className="text-sm font-medium text-gray-900">
              {label}
            </label>
            {hint && <span className="text-xs text-gray-500">{hint}</span>}
          </div>
        )}
        <textarea
          ref={ref}
          id={inputId}
          rows={rows}
          aria-invalid={error ? true : undefined}
          className={clsx(
            'w-full resize-y rounded-control border bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500',
            'transition-shadow focus:outline-none focus:ring-2 focus:ring-gray-950/10',
            'disabled:bg-gray-50 disabled:text-gray-500',
            error ? 'border-red-400 focus:border-red-500' : 'border-gray-300 focus:border-gray-900',
            className,
          )}
          {...rest}
        />
        {error && <p className="mt-1.5 text-sm text-red-700">{error}</p>}
      </div>
    )
  },
)
TextAreaField.displayName = 'TextAreaField'
