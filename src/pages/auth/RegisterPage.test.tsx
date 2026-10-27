import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/renderWithProviders'
import { RegisterPage } from './RegisterPage'
import { authApi } from '@/api/authApi'
import { tokenStorage } from '@/lib/storage'
import { ApiError } from '@/lib/apiClient'

vi.mock('@/api/authApi', () => ({
  authApi: {
    register: vi.fn(),
    loginWithGoogle: vi.fn(),
  },
}))

// Form đăng ký hiện chỉ còn 3 trường (checkbox điều khoản đã bỏ), nên không còn bước "đồng ý".
async function fillValidFormExcept(user: ReturnType<typeof userEvent.setup>, skip?: 'password' | 'email') {
  await user.type(screen.getByLabelText(/họ và tên/i), 'Sarah Lin')
  if (skip !== 'email') await user.type(screen.getByLabelText(/^email$/i), 'sarah@fintechcorp.com')
  if (skip !== 'password') await user.type(screen.getByLabelText(/mật khẩu/i), 'FintechOps#2025')
}

describe('RegisterPage', () => {
  beforeEach(() => {
    tokenStorage.clear()
    vi.mocked(authApi.register).mockReset()
  })

  afterEach(() => {
    tokenStorage.clear()
  })

  it('hiện đủ 3 trường bắt buộc: họ tên, email, mật khẩu', () => {
    renderWithProviders(<RegisterPage />)
    expect(screen.getByLabelText(/họ và tên/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/mật khẩu/i)).toBeInTheDocument()
  })

  it('báo lỗi khi mật khẩu chưa đạt checklist (thiếu ký tự đặc biệt)', async () => {
    const user = userEvent.setup()
    renderWithProviders(<RegisterPage />)

    await user.type(screen.getByLabelText(/họ và tên/i), 'Sarah Lin')
    await user.type(screen.getByLabelText(/^email$/i), 'sarah@fintechcorp.com')
    await user.type(screen.getByLabelText(/mật khẩu/i), 'Password123')
    await user.click(screen.getByRole('button', { name: /tạo tài khoản/i }))

    expect(await screen.findByText(/mật khẩu chưa đạt/i)).toBeInTheDocument()
    expect(authApi.register).not.toHaveBeenCalled()
  })

  it('báo lỗi khi email sai định dạng', async () => {
    const user = userEvent.setup()
    renderWithProviders(<RegisterPage />)

    await user.type(screen.getByLabelText(/họ và tên/i), 'Sarah Lin')
    await user.type(screen.getByLabelText(/^email$/i), 'not-an-email')
    await user.type(screen.getByLabelText(/mật khẩu/i), 'FintechOps#2025')
    await user.click(screen.getByRole('button', { name: /tạo tài khoản/i }))

    expect(await screen.findByText(/email không hợp lệ/i)).toBeInTheDocument()
    expect(authApi.register).not.toHaveBeenCalled()
  })

  it('dữ liệu hợp lệ -> gọi authApi.register đúng payload', async () => {
    vi.mocked(authApi.register).mockResolvedValue({
      accountId: 1,
      email: 'sarah@fintechcorp.com',
      emailVerified: false,
    })
    const user = userEvent.setup()
    renderWithProviders(<RegisterPage />)

    await fillValidFormExcept(user)
    await user.click(screen.getByRole('button', { name: /tạo tài khoản/i }))

    await waitFor(() =>
      expect(authApi.register).toHaveBeenCalledWith({
        fullName: 'Sarah Lin',
        email: 'sarah@fintechcorp.com',
        password: 'FintechOps#2025',
      }),
    )
  })

  it('email đã tồn tại (409) -> hiện đúng thông báo tiếng Việt', async () => {
    vi.mocked(authApi.register).mockRejectedValue(
      new ApiError(409, { code: 'EMAIL_ALREADY_EXISTS', message: 'Email đã được sử dụng.' }),
    )
    const user = userEvent.setup()
    renderWithProviders(<RegisterPage />)

    await fillValidFormExcept(user)
    await user.click(screen.getByRole('button', { name: /tạo tài khoản/i }))

    expect(await screen.findByText(/email này đã được sử dụng/i)).toBeInTheDocument()
  })
})
