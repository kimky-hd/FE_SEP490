// Đơn vị hành chính Việt Nam 2 cấp (Tỉnh/Thành phố → Phường/Xã, áp dụng từ 01/07/2025) lấy từ API công khai
// provinces.open-api.vn bản v2. Gọi thẳng từ trình duyệt (API trả `Access-Control-Allow-Origin: *`), không qua BE.
// Dữ liệu gần như không đổi nên giữ trong bộ nhớ suốt phiên.

const BASE = 'https://provinces.open-api.vn/api/v2'
const TIMEOUT_MS = 10_000

export interface AdminUnit {
  code: number
  name: string
}

interface ProvinceRaw {
  code: number
  name: string
  wards?: { code: number; name: string }[]
}

async function getJson<T>(path: string): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${BASE}${path}`, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

let provincesCache: Promise<AdminUnit[]> | null = null
const wardsCache = new Map<number, Promise<AdminUnit[]>>()

const pick = (u: { code: number; name: string }): AdminUnit => ({ code: u.code, name: u.name })

export const addressApi = {
  provinces(): Promise<AdminUnit[]> {
    provincesCache ??= getJson<ProvinceRaw[]>('/p/').then((list) => list.map(pick))
    // Lỗi thì bỏ cache để lần sau thử lại được.
    provincesCache.catch(() => (provincesCache = null))
    return provincesCache
  },
  wards(provinceCode: number): Promise<AdminUnit[]> {
    let hit = wardsCache.get(provinceCode)
    if (!hit) {
      hit = getJson<ProvinceRaw>(`/p/${provinceCode}?depth=2`).then((p) => (p.wards ?? []).map(pick))
      hit.catch(() => wardsCache.delete(provinceCode))
      wardsCache.set(provinceCode, hit)
    }
    return hit
  },
}
