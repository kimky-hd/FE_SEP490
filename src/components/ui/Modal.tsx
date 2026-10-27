import { useEffect, useId, type ReactNode } from 'react'
import clsx from 'clsx'
import { CloseIcon } from './icons'

interface ModalProps {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'md' | 'lg' | 'xl'
  /** Tông "nguy hiểm" cho hộp xác nhận gỡ / lưu trữ. */
  tone?: 'default' | 'danger'
}

export function Modal({ open, title, description, onClose, children, footer, size = 'md', tone = 'default' }: ModalProps) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button type="button" aria-label="Đóng" onClick={onClose} className="absolute inset-0 bg-gray-950/40" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={clsx(
          'relative flex max-h-[92vh] w-full flex-col rounded-t-lg border bg-white shadow-xl sm:rounded-lg',
          size === 'md' ? 'sm:max-w-lg' : size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-6xl',
          tone === 'danger' ? 'border-red-200' : 'border-gray-200',
        )}
      >
        <div
          className={clsx(
            'flex items-start justify-between gap-4 rounded-t-lg border-b px-5 py-4',
            tone === 'danger' ? 'border-red-100 bg-red-50/60' : 'border-gray-100',
          )}
        >
          <div className="min-w-0">
            <h2 id={titleId} className={clsx('text-base font-semibold', tone === 'danger' ? 'text-red-700' : 'text-gray-950')}>
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Đóng"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}
