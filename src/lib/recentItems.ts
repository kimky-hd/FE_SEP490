// "Tiếp tục" trong Ctrl K: các tài liệu / trang dự án người dùng mở gần nhất (localStorage, theo người dùng).

export interface RecentItem {
  href: string
  title: string
  /** Mã tài liệu (SRS-02) hoặc mã dự án, hiện dạng chip. */
  code: string | null
  at: string
}

const KEY = (userId: number) => `ssam.recentItems.${userId}`
const MAX = 12

export function readRecentItems(userId: number): RecentItem[] {
  try {
    const raw = window.localStorage.getItem(KEY(userId))
    const list = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(list)
      ? list.filter(
          (x): x is RecentItem =>
            !!x && typeof x.href === 'string' && typeof x.title === 'string' && typeof x.at === 'string',
        )
      : []
  } catch {
    return []
  }
}

export function rememberItem(userId: number, item: Omit<RecentItem, 'at'>, now = new Date()) {
  const list = readRecentItems(userId)
  if (list[0]?.href === item.href && list[0]?.title === item.title) return
  const next = [{ ...item, at: now.toISOString() }, ...list.filter((x) => x.href !== item.href)].slice(0, MAX)
  try {
    window.localStorage.setItem(KEY(userId), JSON.stringify(next))
  } catch {
    // Storage bị chặn: Ctrl K chỉ còn lệnh nhanh.
  }
}
