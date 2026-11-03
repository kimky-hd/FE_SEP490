import { useEffect, useId, useRef, type ReactNode } from 'react'
import clsx from 'clsx'
import { CloseIcon } from './icons'
import { useI18n } from '@/i18n'

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

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = 'md',
  tone = 'default',
}: ModalProps) {
  const { t } = useI18n()
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  // onClose thường là hàm mới mỗi lần render: giữ trong ref để effect không chạy lại và giật focus.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const returnTo = document.activeElement as HTMLElement | null
    const dialog = dialogRef.current

    // Focus vào ô nhập đầu tiên (nếu có), không thì vào chính hộp thoại để trình đọc màn hình đọc tiêu đề.
    const firstField = dialog?.querySelector<HTMLElement>('[data-autofocus], input:not([disabled]), select, textarea')
    ;(firstField ?? dialog)?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      // Giữ Tab vòng trong hộp thoại.
      if (e.key !== 'Tab' || !dialog) return
      const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      // Trả focus về nút đã mở hộp thoại.
      if (returnTo && document.contains(returnTo)) returnTo.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-gray-950/40 backdrop-blur-[2px]" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={clsx(
          'relative flex max-h-[92dvh] w-full flex-col rounded-t-card border border-gray-200 bg-white shadow-float focus:outline-none sm:rounded-card',
          size === 'md' ? 'sm:max-w-lg' : size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-6xl',
        )}
      >
        <div className={clsx('flex items-start justify-between gap-4 rounded-t-card px-6 pb-2 pt-5')}>
          <div className="min-w-0">
            <h2
              id={titleId}
              className={clsx('text-lg font-semibold', tone === 'danger' ? 'text-red-800' : 'text-gray-950')}
            >
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-gray-600">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control text-gray-600 hover:bg-gray-100 hover:text-gray-950"
            aria-label={t('Đóng', 'Close')}
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-gray-200 bg-gray-50 px-6 py-3 sm:rounded-b-card">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
