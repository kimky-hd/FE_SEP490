import { api } from '@/lib/apiClient'
import type { AuthSessionDto, MeResponseDto } from '@/types/auth'

export const authApi = {
  register: (body: { fullName: string; email: string; password: string }) =>
    api.post<{ accountId: number; email: string; emailVerified: boolean }>(
      '/auth/register',
      body,
      { skipAuth: true },
    ).then((r) => r.data),

  loginWithGoogle: (idToken: string) =>
    api.post<AuthSessionDto & { isNewAccount: boolean }>(
      '/auth/google',
      { idToken },
      { skipAuth: true },
    ).then((r) => r.data),

  login: (body: { email: string; password: string }) =>
    api.post<AuthSessionDto>('/auth/login', body, { skipAuth: true }).then((r) => r.data),

  // AuthContext xoá token khỏi storage TRƯỚC khi gọi (đăng xuất cục bộ tức thì), nên interceptor không còn gì
  // để gắn → truyền tay access token. skipAuth: true để 401 ở đây (token đã hết hạn) không kích hoạt refresh
  // rồi hard-redirect về /login ngay trong lúc đang đăng xuất.
  logout: (refreshToken: string, accessToken?: string) =>
    api.post('/auth/logout', { refreshToken }, {
      skipAuth: true,
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    }),

  me: () => api.get<MeResponseDto>('/auth/me').then((r) => r.data),

  verifyEmail: (token: string) =>
    api.post<{ verified: boolean }>('/auth/email/verify', { token }, { skipAuth: true }).then((r) => r.data),

  resendVerification: (email: string) =>
    api.post('/auth/email/resend', { email }, { skipAuth: true }),

  forgotPassword: (email: string) =>
    api.post('/auth/password/forgot', { email }, { skipAuth: true }),

  resetPassword: (token: string, newPassword: string) =>
    api.post<{ success: boolean }>(
      '/auth/password/reset',
      { token, newPassword },
      { skipAuth: true },
    ).then((r) => r.data),
}
