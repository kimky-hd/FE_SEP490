import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/renderWithProviders'
import { LoginPage } from './LoginPage'
import { authApi } from '@/api/authApi'
import { tokenStorage } from '@/lib/storage'
import { ApiError } from '@/lib/apiClient'

vi.mock('@/api/authApi', () => ({
  authApi: {
    login: vi.fn(),
    loginWithGoogle: vi.fn(),
    me: vi.fn(),
  },
}))

describe('LoginPage', () => {
  beforeEach(() => {
    tokenStorage.clear()
    vi.mocked(authApi.login).mockReset()
    vi.mocked(authApi.me).mockReset()
  })

  afterEach(() => {
    tokenStorage.clear()
  })

  it('hiện đủ trường email và mật khẩu', () => {
    renderWithProviders(<LoginPage />)
    expect(screen.getByLabelText(/email công việc/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/mật khẩu/i)).toBeInTheDocument()
  })

  it('báo lỗi khi email sai định dạng, không gọi API', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LoginPage />)

    await user.type(screen.getByLabelText(/email công việc/i), 'not-an-email')
    await user.type(screen.getByLabelText(/mật khẩu/i), 'anything')
    await user.click(screen.getByRole('button', { name: /đăng nhập/i }))

    expect(await screen.findByText(/email không hợp lệ/i)).toBeInTheDocument()
    expect(authApi.login).not.toHaveBeenCalled()
  })

  it('báo lỗi khi bỏ trống mật khẩu', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LoginPage />)

    await user.type(screen.getByLabelText(/email công việc/i), 'sarah@fintechcorp.com')
    await user.click(screen.getByRole('button', { name: /đăng nhập/i }))

    expect(await screen.findByText(/vui lòng nhập mật khẩu/i)).toBeInTheDocument()
    expect(authApi.login).not.toHaveBeenCalled()
  })

  it('sai email hoặc mật khẩu (401) -> hiện đúng thông báo, không tiết lộ email có tồn tại hay không', async () => {
    vi.mocked(authApi.login).mockRejectedValue(
      new ApiError(401, { code: 'UNAUTHORIZED', message: 'Email hoặc mật khẩu không đúng.' }),
    )
    const user = userEvent.setup()
    renderWithProviders(<LoginPage />)

    await user.type(screen.getByLabelText(/email công việc/i), 'sarah@fintechcorp.com')
    await user.type(screen.getByLabelText(/mật khẩu/i), 'wrongpass')
    await user.click(screen.getByRole('button', { name: /đăng nhập/i }))

    expect(await screen.findByText(/email hoặc mật khẩu không đúng/i)).toBeInTheDocument()
  })

  it('tài khoản bị khóa (403 ACCOUNT_DISABLED) -> hiện đúng thông báo', async () => {
    vi.mocked(authApi.login).mockRejectedValue(
      new ApiError(403, { code: 'ACCOUNT_DISABLED', message: 'Tài khoản của bạn đã bị vô hiệu hóa.' }),
    )
    const user = userEvent.setup()
    renderWithProviders(<LoginPage />)

    await user.type(screen.getByLabelText(/email công việc/i), 'sarah@fintechcorp.com')
    await user.type(screen.getByLabelText(/mật khẩu/i), 'somepass')
    await user.click(screen.getByRole('button', { name: /đăng nhập/i }))

    expect(await screen.findByText(/vô hiệu hóa/i)).toBeInTheDocument()
  })

  it('đăng nhập thành công -> gọi authApi.login đúng payload rồi gọi /auth/me để quyết định điều hướng', async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      expiresIn: 900,
      user: { id: 1, fullName: 'Sarah Lin', email: 'sarah@fintechcorp.com', avatarUrl: null, emailVerified: true },
    })
    vi.mocked(authApi.me).mockResolvedValue({
      user: { id: 1, fullName: 'Sarah Lin', email: 'sarah@fintechcorp.com', avatarUrl: null, emailVerified: true },
      companies: [],
      workspaces: [],
    })

    const user = userEvent.setup()
    renderWithProviders(<LoginPage />)

    await user.type(screen.getByLabelText(/email công việc/i), 'sarah@fintechcorp.com')
    await user.type(screen.getByLabelText(/mật khẩu/i), 'FintechOps#2025')
    await user.click(screen.getByRole('button', { name: /đăng nhập/i }))

    await waitFor(() =>
      expect(authApi.login).toHaveBeenCalledWith({ email: 'sarah@fintechcorp.com', password: 'FintechOps#2025' }),
    )
    await waitFor(() => expect(authApi.me).toHaveBeenCalledTimes(1))
    expect(tokenStorage.getAccessToken()).toBe('access-1')
  })
})
