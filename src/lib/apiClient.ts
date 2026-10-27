import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { tokenStorage } from './storage'
import type { ApiErrorBody } from '@/types/auth'

export class ApiError extends Error {
  code: string
  errors?: Record<string, string[]>
  workflowIssues?: ApiErrorBody['workflowIssues']
  status: number

  constructor(status: number, body: ApiErrorBody) {
    super(body.message)
    this.status = status
    this.code = body.code
    this.errors = body.errors
    this.workflowIssues = body.workflowIssues
  }
}

declare module 'axios' {
  interface AxiosRequestConfig {
    skipAuth?: boolean
  }
  interface InternalAxiosRequestConfig {
    _retry?: boolean
  }
}

const REQUEST_TIMEOUT_MS = 15000

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
})

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (!config.skipAuth) {
    const token = tokenStorage.getAccessToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

function toApiError(error: AxiosError<ApiErrorBody>): ApiError {
  if (error.response?.data) {
    return new ApiError(error.response.status, error.response.data)
  }
  return new ApiError(0, { code: 'NETWORK_ERROR', message: 'Không thể kết nối tới máy chủ.' })
}

// Phân biệt 2 kiểu refresh thất bại:
// - sessionDead = true: không có refresh token, hoặc BE trả 4xx (token hết hạn / đã thu hồi / response sai shape)
//   → phiên chết hẳn, buộc đăng xuất.
// - sessionDead = false: mạng rớt, timeout, 5xx → lỗi tạm thời, KHÔNG xoá token; request gốc nhận lỗi,
//   lần gọi sau sẽ thử refresh lại. Tránh việc 1 cú mất mạng thoáng qua đá người dùng ra màn đăng nhập.
class RefreshFailure extends Error {
  constructor(readonly sessionDead: boolean) {
    super(sessionDead ? 'SESSION_DEAD' : 'REFRESH_TRANSIENT_FAILURE')
  }
}

let refreshPromise: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  const refreshToken = tokenStorage.getRefreshToken()
  if (!refreshToken) throw new RefreshFailure(true)

  let data: { accessToken?: unknown; refreshToken?: unknown }
  try {
    // Dùng axios gốc (không phải `api`) để không đi qua interceptor 401 của chính nó.
    const res = await axios.post<typeof data>(
      `${import.meta.env.VITE_API_BASE_URL}/auth/refresh`,
      { refreshToken },
      { timeout: REQUEST_TIMEOUT_MS },
    )
    data = res.data
  } catch (err) {
    const status = axios.isAxiosError(err) ? err.response?.status : undefined
    throw new RefreshFailure(status !== undefined && status >= 400 && status < 500)
  }

  if (typeof data?.accessToken !== 'string' || data.accessToken.length === 0) {
    // 200 nhưng body không đúng contract → không được ghi "undefined" vào storage.
    throw new RefreshFailure(true)
  }
  // Contract nói BE rotate cả refresh token; phòng khi BE không trả thì giữ token cũ thay vì ghi đè rỗng.
  const nextRefreshToken =
    typeof data.refreshToken === 'string' && data.refreshToken.length > 0 ? data.refreshToken : refreshToken
  tokenStorage.setTokens(data.accessToken, nextRefreshToken)
  return data.accessToken
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig | undefined

    // Request có skipAuth là endpoint công khai (login/register/verify/invitations/...) — 401 ở đó là lỗi
    // nghiệp vụ thật, không phải access token hết hạn, nên không được kích hoạt refresh (nếu cố refresh mà
    // không có refresh token sẽ bị đá về /login giữa chừng luồng công khai).
    const shouldTryRefresh =
      error.response?.status === 401
      && originalRequest !== undefined
      && !originalRequest._retry
      && !originalRequest.skipAuth
      && !originalRequest.url?.includes('/auth/refresh')

    if (shouldTryRefresh) {
      originalRequest._retry = true
      try {
        refreshPromise ??= refreshAccessToken().finally(() => {
          refreshPromise = null
        })
        const newToken = await refreshPromise
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return api.request(originalRequest)
      } catch (refreshError) {
        if (refreshError instanceof RefreshFailure && !refreshError.sessionDead) {
          return Promise.reject(toApiError(error))
        }
        tokenStorage.clear()
        window.location.href = '/login'
        return Promise.reject(toApiError(error))
      }
    }

    return Promise.reject(toApiError(error))
  },
)
