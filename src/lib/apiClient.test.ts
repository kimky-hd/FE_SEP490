import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import { api, ApiError } from './apiClient'
import { tokenStorage } from './storage'

const BASE_URL = import.meta.env.VITE_API_BASE_URL

describe('apiClient - request interceptor', () => {
  let apiMock: MockAdapter

  beforeEach(() => {
    apiMock = new MockAdapter(api)
    tokenStorage.clear()
  })

  afterEach(() => {
    apiMock.restore()
    tokenStorage.clear()
  })

  it('gắn Authorization header khi có access token trong storage', async () => {
    tokenStorage.setTokens('access-1', 'refresh-1')
    apiMock.onGet('/ping').reply((config) => {
      expect(config.headers?.Authorization).toBe('Bearer access-1')
      return [200, { ok: true }]
    })
    const res = await api.get('/ping')
    expect(res.data).toEqual({ ok: true })
  })

  it('không gắn Authorization header khi không có token trong storage', async () => {
    apiMock.onGet('/ping').reply((config) => {
      expect(config.headers?.Authorization).toBeUndefined()
      return [200, { ok: true }]
    })
    await api.get('/ping')
  })

  it('không gắn Authorization header khi request có skipAuth: true, dù đang có token', async () => {
    tokenStorage.setTokens('access-1', 'refresh-1')
    apiMock.onGet('/public').reply((config) => {
      expect(config.headers?.Authorization).toBeUndefined()
      return [200, {}]
    })
    await api.get('/public', { skipAuth: true })
  })
})

describe('apiClient - lỗi được chuẩn hoá về ApiError', () => {
  let apiMock: MockAdapter

  beforeEach(() => {
    apiMock = new MockAdapter(api)
    tokenStorage.clear()
  })

  afterEach(() => {
    apiMock.restore()
    tokenStorage.clear()
  })

  it('lỗi 4xx bình thường (không phải 401-cần-refresh) được bọc thành ApiError đúng code/message', async () => {
    apiMock.onPost('/auth/register').reply(409, {
      code: 'EMAIL_ALREADY_EXISTS',
      message: 'Email đã được sử dụng.',
    })

    await expect(api.post('/auth/register', {}, { skipAuth: true })).rejects.toMatchObject({
      code: 'EMAIL_ALREADY_EXISTS',
      message: 'Email đã được sử dụng.',
      status: 409,
    })
  })

  it('lỗi mạng (không có response) được bọc thành ApiError NETWORK_ERROR thay vì để lộ AxiosError thô', async () => {
    apiMock.onGet('/ping').networkError()
    await expect(api.get('/ping')).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
  })
})

describe('apiClient - tự động refresh token khi gặp 401', () => {
  let apiMock: MockAdapter
  let axiosMock: MockAdapter

  beforeEach(() => {
    apiMock = new MockAdapter(api)
    axiosMock = new MockAdapter(axios)
    tokenStorage.clear()
  })

  afterEach(() => {
    apiMock.restore()
    axiosMock.restore()
    tokenStorage.clear()
  })

  it('401 -> tự gọi /auth/refresh -> cập nhật token -> retry request gốc và trả kết quả thành công', async () => {
    tokenStorage.setTokens('expired-token', 'refresh-1')

    let secretCallCount = 0
    apiMock.onGet('/secret').reply((config) => {
      secretCallCount += 1
      if (config.headers?.Authorization === 'Bearer new-access-token') {
        return [200, { secret: 42 }]
      }
      return [401, { code: 'UNAUTHORIZED', message: 'expired' }]
    })

    axiosMock.onPost(`${BASE_URL}/auth/refresh`).reply((config) => {
      expect(JSON.parse(config.data as string)).toEqual({ refreshToken: 'refresh-1' })
      return [200, { accessToken: 'new-access-token', refreshToken: 'new-refresh-token' }]
    })

    const res = await api.get('/secret')

    expect(res.data).toEqual({ secret: 42 })
    expect(secretCallCount).toBe(2) // lần 1 bị 401, lần 2 (retry) thành công
    expect(tokenStorage.getAccessToken()).toBe('new-access-token')
    expect(tokenStorage.getRefreshToken()).toBe('new-refresh-token')
  })

  it('refresh cũng fail -> clear token, KHÔNG retry lặp lại /secret, và ném ra ApiError (không phải AxiosError thô)', async () => {
    tokenStorage.setTokens('expired-token', 'bad-refresh')

    let secretCallCount = 0
    apiMock.onGet('/secret').reply(() => {
      secretCallCount += 1
      return [401, { code: 'UNAUTHORIZED', message: 'expired' }]
    })

    let refreshCallCount = 0
    axiosMock.onPost(`${BASE_URL}/auth/refresh`).reply(() => {
      refreshCallCount += 1
      return [401, { code: 'UNAUTHORIZED', message: 'refresh token invalid' }]
    })

    const originalHref = window.location.href
    let hrefSet = ''
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        set href(value: string) {
          hrefSet = value
        },
        get href() {
          return hrefSet || originalHref
        },
      },
    })

    const rejection = await api.get('/secret').then(
      () => null,
      (err) => err,
    )

    expect(rejection).toBeInstanceOf(ApiError)
    expect(rejection.code).toBe('UNAUTHORIZED')
    expect(secretCallCount).toBe(1) // KHÔNG gọi lại /secret vô hạn lần
    expect(refreshCallCount).toBe(1) // chỉ thử refresh đúng 1 lần rồi bỏ cuộc
    expect(tokenStorage.getAccessToken()).toBeNull()
    expect(tokenStorage.getRefreshToken()).toBeNull()
    expect(hrefSet).toBe('/login')
  })

  it('nhiều request 401 đồng thời chỉ gọi /auth/refresh đúng 1 lần (không gửi trùng nhiều request refresh)', async () => {
    tokenStorage.setTokens('expired-token', 'refresh-1')

    apiMock.onGet(/\/parallel-/).reply((config) => {
      if (config.headers?.Authorization === 'Bearer new-access-token') {
        return [200, { ok: true }]
      }
      return [401, { code: 'UNAUTHORIZED', message: 'expired' }]
    })

    let refreshCallCount = 0
    axiosMock.onPost(`${BASE_URL}/auth/refresh`).reply(() => {
      refreshCallCount += 1
      return [200, { accessToken: 'new-access-token', refreshToken: 'new-refresh-token' }]
    })

    const [r1, r2] = await Promise.all([api.get('/parallel-1'), api.get('/parallel-2')])

    expect(r1.data).toEqual({ ok: true })
    expect(r2.data).toEqual({ ok: true })
    expect(refreshCallCount).toBe(1)
  })

  it('401 trên chính endpoint /auth/login thì KHÔNG cố refresh (tránh vòng lặp), trả lỗi login bình thường', async () => {
    apiMock.onPost('/auth/login').reply(401, { code: 'UNAUTHORIZED', message: 'Email hoặc mật khẩu không đúng.' })

    await expect(api.post('/auth/login', {}, { skipAuth: true })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
  })

  it('401 trên endpoint công khai (skipAuth) khi KHÔNG có token thì không refresh, không redirect, không xoá gì', async () => {
    // Vd: người chưa đăng nhập mở link mời, BE trả 401 → phải hiện lỗi tại chỗ chứ không đá về /login.
    apiMock.onPost('/invitations/abc/accept').reply(401, { code: 'TOKEN_INVALID', message: 'Lời mời không hợp lệ.' })

    let refreshCallCount = 0
    axiosMock.onPost(`${BASE_URL}/auth/refresh`).reply(() => {
      refreshCallCount += 1
      return [200, { accessToken: 'x', refreshToken: 'y' }]
    })

    await expect(api.post('/invitations/abc/accept', {}, { skipAuth: true })).rejects.toMatchObject({
      code: 'TOKEN_INVALID',
    })
    expect(refreshCallCount).toBe(0)
  })

  it('refresh lỗi MẠNG (tạm thời) -> KHÔNG xoá token, KHÔNG redirect; request gốc nhận lỗi để thử lại sau', async () => {
    tokenStorage.setTokens('expired-token', 'refresh-1')

    apiMock.onGet('/secret').reply(401, { code: 'UNAUTHORIZED', message: 'expired' })
    axiosMock.onPost(`${BASE_URL}/auth/refresh`).networkError()

    const rejection = await api.get('/secret').then(
      () => null,
      (err) => err,
    )

    expect(rejection).toBeInstanceOf(ApiError)
    expect(rejection.code).toBe('UNAUTHORIZED')
    // Phiên chưa chết — chỉ là mất mạng thoáng qua — nên token phải còn nguyên.
    expect(tokenStorage.getAccessToken()).toBe('expired-token')
    expect(tokenStorage.getRefreshToken()).toBe('refresh-1')
  })

  it('refresh trả 200 nhưng body sai shape (không có accessToken) -> coi như phiên chết, không ghi "undefined" vào storage', async () => {
    tokenStorage.setTokens('expired-token', 'refresh-1')

    apiMock.onGet('/secret').reply(401, { code: 'UNAUTHORIZED', message: 'expired' })
    axiosMock.onPost(`${BASE_URL}/auth/refresh`).reply(200, { ok: true })

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, href: '' },
    })

    await expect(api.get('/secret')).rejects.toBeInstanceOf(ApiError)
    expect(tokenStorage.getAccessToken()).toBeNull()
    expect(tokenStorage.getRefreshToken()).toBeNull()
  })
})
