import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AuthProvider, useAuth } from './AuthContext'
import { tokenStorage } from '@/lib/storage'
import { authApi } from '@/api/authApi'
import type { MeResponseDto, UserDto } from '@/types/auth'

vi.mock('@/api/authApi', () => ({
  authApi: {
    me: vi.fn(),
    logout: vi.fn(),
  },
}))

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>

const mockUser: UserDto = {
  id: 1,
  fullName: 'Sarah Lin',
  email: 'sarah@fintechcorp.com',
  avatarUrl: null,
  emailVerified: true,
}

const mockMeResponse: MeResponseDto = {
  user: mockUser,
  companies: [{ companyId: 1, companyName: 'Acme Fintech Corp', roleName: 'Tenant Admin' }],
  workspaces: [{ workspaceId: 10, workspaceName: 'Acme Fintech Corp', companyId: 1 }],
}

describe('AuthContext', () => {
  beforeEach(() => {
    tokenStorage.clear()
    vi.mocked(authApi.me).mockReset()
    vi.mocked(authApi.logout).mockReset()
  })

  afterEach(() => {
    tokenStorage.clear()
  })

  it('không có token sẵn trong storage -> bootstrap xong ngay, không gọi /auth/me, chưa đăng nhập', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.isBootstrapping).toBe(false))

    expect(authApi.me).not.toHaveBeenCalled()
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
  })

  it('có token sẵn trong storage -> gọi /auth/me để hydrate user/companies/workspaces', async () => {
    tokenStorage.setTokens('access-1', 'refresh-1')
    vi.mocked(authApi.me).mockResolvedValue(mockMeResponse)

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.isBootstrapping).toBe(false))

    expect(authApi.me).toHaveBeenCalledTimes(1)
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.user).toEqual(mockUser)
    expect(result.current.hasOnboarded).toBe(true)
  })

  it('có token nhưng /auth/me lỗi (token hỏng) -> clear token, không crash, coi như chưa đăng nhập', async () => {
    tokenStorage.setTokens('access-broken', 'refresh-broken')
    vi.mocked(authApi.me).mockRejectedValue(new Error('401'))

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.isBootstrapping).toBe(false))

    expect(result.current.isAuthenticated).toBe(false)
    expect(tokenStorage.getAccessToken()).toBeNull()
  })

  it('applySession lưu token vào storage và set user ngay lập tức', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isBootstrapping).toBe(false))

    result.current.applySession({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      expiresIn: 900,
      user: mockUser,
    })

    await waitFor(() => expect(result.current.user).toEqual(mockUser))
    expect(tokenStorage.getAccessToken()).toBe('new-access')
    expect(tokenStorage.getRefreshToken()).toBe('new-refresh')
  })

  it('logout xoá token, reset state, và gọi authApi.logout kèm refresh token hiện có', async () => {
    tokenStorage.setTokens('access-1', 'refresh-1')
    vi.mocked(authApi.me).mockResolvedValue(mockMeResponse)
    vi.mocked(authApi.logout).mockResolvedValue({} as never)

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true))

    await result.current.logout()

    // Access token phải được truyền tay vì storage đã bị xoá trước khi gọi API (đăng xuất cục bộ tức thì).
    expect(authApi.logout).toHaveBeenCalledWith('refresh-1', 'access-1')
    expect(tokenStorage.getAccessToken()).toBeNull()
    await waitFor(() => expect(result.current.user).toBeNull())
    expect(result.current.companies).toEqual([])
  })

  it('logout vẫn xoá token ở FE dù API logout lỗi (không chặn đăng xuất cục bộ)', async () => {
    tokenStorage.setTokens('access-1', 'refresh-1')
    vi.mocked(authApi.me).mockResolvedValue(mockMeResponse)
    vi.mocked(authApi.logout).mockRejectedValue(new Error('network down'))

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true))

    await result.current.logout()

    expect(tokenStorage.getAccessToken()).toBeNull()
    await waitFor(() => expect(result.current.user).toBeNull())
  })
})
