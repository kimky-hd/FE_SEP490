import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { clearUserLocalData, tokenStorage } from './storage'
import { clearCachedData, invalidateData } from './dataEvents'
import type { ApiErrorBody } from '@/types/auth'

export class ApiError extends Error {
  code: string
  errors?: Record<string, string[]>
  workflowIssues?: ApiErrorBody['workflowIssues']
  /** D19: `current` của 409 VERSION_CONFLICT (người / lúc lưu bản trên máy chủ), nếu BE gửi. */
  current?: ApiErrorBody['current']
  /** Toàn bộ body lỗi (giữ các trường thêm ngoài code / message / errors). */
  body: ApiErrorBody
  status: number

  constructor(status: number, body: ApiErrorBody) {
    super(body.message)
    this.status = status
    this.code = body.code
    this.errors = body.errors
    this.workflowIssues = body.workflowIssues
    this.current = body.current ?? undefined
    this.body = body
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
    // 429 (bị giới hạn tần suất) là lỗi tạm thời, không phải phiên chết: không đá người dùng ra màn đăng nhập.
    throw new RefreshFailure(status !== undefined && status >= 400 && status < 500 && status !== 429)
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

// Thao tác ghi thành công → báo dữ liệu đổi để cache + các màn đang mở tự tải lại (trừ đăng nhập / refresh / đăng xuất).
const WRITE_METHODS = new Set(['post', 'put', 'patch', 'delete'])
const NON_DATA_PATHS = /\/auth\/(login|refresh|logout|google|register|verify-email|forgot-password|reset-password)/
// Ghi "lặng" chỉ xoá cache: tự lưu chạy mỗi lần ngừng gõ và đã tự cập nhật state, báo toàn app thì mỗi
// lượt lưu kéo theo ~10 request đọc.
const QUIET_WRITE_PATHS = /\/documents\/\d+\/versions\/\d+\/content$/

export function isQuietWrite(method: string, url: string) {
  return method === 'put' && QUIET_WRITE_PATHS.test(url.split('?')[0])
}

api.interceptors.response.use(
  (response) => {
    const method = response.config.method?.toLowerCase() ?? 'get'
    const url = response.config.url ?? ''
    if (WRITE_METHODS.has(method) && !NON_DATA_PATHS.test(url)) {
      if (isQuietWrite(method, url)) clearCachedData()
      else invalidateData()
    }
    return response
  },
  async (error: AxiosError<ApiErrorBody>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig | undefined

    // Request có skipAuth là endpoint công khai (login/register/verify/invitations/...) — 401 ở đó là lỗi
    // nghiệp vụ thật, không phải access token hết hạn, nên không được kích hoạt refresh (nếu cố refresh mà
    // không có refresh token sẽ bị đá về /login giữa chừng luồng công khai).
    const shouldTryRefresh =
      error.response?.status === 401 &&
      originalRequest !== undefined &&
      !originalRequest._retry &&
      !originalRequest.skipAuth &&
      !originalRequest.url?.includes('/auth/refresh')

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
        // Phiên chết: xoá luôn dữ liệu cục bộ của người dùng (nháp, gần đây, cache…) trước khi về /login.
        clearUserLocalData()
        clearCachedData()
        window.location.href = '/login'
        return Promise.reject(toApiError(error))
      }
    }

    return Promise.reject(toApiError(error))
  },
)
