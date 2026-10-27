const dateFormatter = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })

export function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date)
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// "8 phút trước", "2 giờ trước", "3 ngày trước"; quá 30 ngày thì hiện ngày cụ thể.
export function formatRelative(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return '—'
  const time = new Date(iso).getTime()
  if (Number.isNaN(time)) return '—'
  const diff = Math.max(0, now - time)
  if (diff < MINUTE) return 'vừa xong'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} phút trước`
  if (diff < DAY) return `${Math.floor(diff / HOUR)} giờ trước`
  if (diff < 30 * DAY) return `${Math.floor(diff / DAY)} ngày trước`
  return formatDate(iso)
}

export const SCOPE_LABEL = { TENANT: 'Cấp công ty', WORKSPACE: 'Cấp workspace', PROJECT: 'Cấp dự án' } as const
