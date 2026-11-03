import { getLang, tr } from '@/i18n'

const dateFormatters = {
  vi: new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  en: new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : dateFormatters[getLang()].format(date)
}

const timeFormatters = {
  vi: new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }),
  en: new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }),
}

/** "14:05 30/10" — giờ + ngày (vd "X vừa lưu lúc …"). */
export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : timeFormatters[getLang()].format(date)
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
  const ago = (n: number, vi: string, en: string) => tr(`${n} ${vi} trước`, `${n} ${en}${n === 1 ? '' : 's'} ago`)
  if (diff < MINUTE) return tr('vừa xong', 'just now')
  if (diff < HOUR) return ago(Math.floor(diff / MINUTE), 'phút', 'minute')
  if (diff < DAY) return ago(Math.floor(diff / HOUR), 'giờ', 'hour')
  if (diff < 30 * DAY) return ago(Math.floor(diff / DAY), 'ngày', 'day')
  return formatDate(iso)
}

// Getter để mỗi lần đọc (lúc render) trả về đúng ngôn ngữ hiện tại.
export const SCOPE_LABEL = {
  get TENANT() {
    return tr('Cấp công ty', 'Company level')
  },
  get WORKSPACE() {
    return tr('Cấp workspace', 'Workspace level')
  },
  get PROJECT() {
    return tr('Cấp dự án', 'Project level')
  },
} as const
