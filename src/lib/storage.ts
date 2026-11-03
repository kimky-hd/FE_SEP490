// Lưu access/refresh token. localStorage đủ dùng cho scope hiện tại (chưa cần
// cân nhắc XSS/httpOnly cookie ở giai đoạn FE-only này — BE khi làm thật nên
// cân nhắc chuyển refreshToken sang httpOnly cookie).

const ACCESS_TOKEN_KEY = 'ssam.accessToken'
const REFRESH_TOKEN_KEY = 'ssam.refreshToken'

export const tokenStorage = {
  getAccessToken: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  setTokens: (accessToken: string, refreshToken: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  },
  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  },
}

/** Key ngôn ngữ (src/i18n/index.tsx) — là tuỳ chọn của trình duyệt, không phải dữ liệu người dùng nên giữ lại. */
const KEEP_KEYS = new Set(['ssam.lang'])

/**
 * Xoá mọi dữ liệu cục bộ của người dùng (mọi key `ssam.*` trong localStorage trừ ngôn ngữ): token, nháp
 * wizard tạo dự án, mục/dự án gần đây, trạng thái cây tài liệu, tài liệu mở gần nhất, cờ lời mời, gợi ý đã
 * xem, dữ liệu mock tài liệu… Gọi khi đăng xuất và khi phiên chết để người sau dùng chung máy không thấy lại.
 */
export function clearUserLocalData() {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('ssam.') && !KEEP_KEYS.has(key)) keys.push(key)
    }
    keys.forEach((key) => localStorage.removeItem(key))
  } catch {
    // storage bị chặn (chế độ riêng tư…) — không có gì để xoá
  }
}
