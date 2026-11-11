import { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'

export type ToastTone = 'ok' | 'error'
interface ToastMessage {
  text: string
  tone: ToastTone
}

const TOAST_MS = 3500

export function useToast() {
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const notify = useCallback((text: string, tone: ToastTone = 'ok') => setToast({ text, tone }), [])
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), TOAST_MS)
    return () => clearTimeout(id)
  }, [toast])
  return { toast, notify }
}

/** `raised`: trang có thanh công cụ nổi ở đáy (tài liệu) — đặt toast cao hơn để không đè lên thanh. */
export function Toast({ toast, raised }: { toast: ToastMessage | null; raised?: boolean }) {
  if (!toast) return null
  return (
    <div
      role="status"
      className={clsx(
        'fixed left-1/2 z-50 -translate-x-1/2 rounded-control px-4 py-2.5 text-sm shadow-pop',
        raised ? 'bottom-24' : 'bottom-5',
        toast.tone === 'error' ? 'bg-red-700 text-white' : 'bg-gray-900 text-white',
      )}
    >
      {toast.text}
    </div>
  )
}
