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
